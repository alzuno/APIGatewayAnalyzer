import os
import json
import uuid
import codecs
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_restx import Api, Resource, Namespace, fields
from werkzeug.datastructures import FileStorage
from database import Database, migrate_json_to_sqlite
from worker import (
    BackgroundWorker, submit_job, get_job_status,
    generate_progress_events, should_process_async
)

app = Flask(__name__)

# Define index route BEFORE Flask-RESTX to ensure it's registered
@app.route('/')
def index():
    return render_template('index.html')

# Flask-RESTX API setup
api = Api(
    app,
    version='3.3.1',
    title='GPS Telemetry Analyzer API',
    description='API for analyzing GPS telemetry JSON logs from vehicle tracking systems',
    doc='/api/docs',
    catch_all_404s=False  # Allow regular Flask routes to work
)

# Namespaces
ns_analysis = api.namespace('api', description='Telemetry analysis operations')

# Configuration
DATA_DIR = os.getenv('DATA_DIR', '.')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
PROCESSED_FOLDER = os.path.join(DATA_DIR, 'processed')
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')
LOGS_FOLDER = os.path.join(DATA_DIR, 'logs')

# File size limit
MAX_UPLOAD_SIZE_MB = int(os.getenv('MAX_UPLOAD_SIZE_MB', 100))
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_SIZE_MB * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(LOGS_FOLDER, exist_ok=True)

# Initialize SQLite database
DB_PATH = os.path.join(DATA_DIR, 'telemetry.db')
db = Database(DB_PATH)

# Initialize background worker (will be started after process_log_data is defined)
background_worker = None

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
file_handler = RotatingFileHandler(
    os.path.join(LOGS_FOLDER, 'app.log'),
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))
logger.addHandler(file_handler)

# API Models for Swagger documentation
summary_model = api.model('Summary', {
    'filename': fields.String(description='Name of the uploaded file'),
    'processed_at': fields.String(description='Processing timestamp'),
    'total_devices': fields.Integer(description='Number of unique devices'),
    'total_records': fields.Integer(description='Total telemetry records processed'),
    'total_distance_km': fields.Float(description='Total distance traveled in km'),
    'average_quality_score': fields.Float(description='Average quality score across devices')
})

history_entry_model = api.model('HistoryEntry', {
    'id': fields.String(description='Unique analysis ID'),
    'filename': fields.String(description='Display name'),
    'original_filename': fields.String(description='Original uploaded filename'),
    'summary': fields.Nested(summary_model)
})

upload_response_model = api.model('UploadResponse', {
    'id': fields.String(description='Analysis ID'),
    'data': fields.Raw(description='Full analysis result')
})

error_model = api.model('Error', {
    'error': fields.String(description='Error message')
})

success_model = api.model('Success', {
    'success': fields.Boolean(description='Operation success status')
})

rename_model = api.model('RenameInput', {
    'filename': fields.String(required=True, description='New display name')
})

job_response_model = api.model('JobResponse', {
    'job_id': fields.String(description='Background job ID'),
    'status': fields.String(description='Job status (pending/processing/completed/failed)')
})

job_status_model = api.model('JobStatus', {
    'status': fields.String(description='Job status'),
    'progress': fields.Integer(description='Processing progress (0-100)'),
    'analysis_id': fields.String(description='Analysis ID when completed'),
    'error': fields.String(description='Error message if failed'),
    'data': fields.Raw(description='Analysis result when completed')
})

# File upload parser
upload_parser = api.parser()
upload_parser.add_argument('file', location='files', type=FileStorage, required=True, help='JSON telemetry log file')

# Migrate existing JSON data to SQLite on startup
if os.path.exists(HISTORY_FILE):
    try:
        migrated = migrate_json_to_sqlite(db, HISTORY_FILE, PROCESSED_FOLDER)
        if migrated > 0:
            logger.info(f"Migrated {migrated} analyses from JSON to SQLite")
            # Rename old history file as backup
            backup_path = HISTORY_FILE + '.backup'
            if not os.path.exists(backup_path):
                os.rename(HISTORY_FILE, backup_path)
                logger.info(f"Created backup at {backup_path}")
    except Exception as e:
        logger.warning(f"Migration failed, continuing with JSON fallback: {e}")

def load_history():
    """Load history from SQLite database."""
    try:
        return db.get_history()
    except Exception as e:
        logger.warning(f"Failed to load history from DB: {e}")
        # Fallback to JSON if database fails
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return []


def sanitize_for_json(obj):
    """Recursively convert NaN, Inf, -Inf to None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
    return obj

def normalize_event_type(raw_type):
    """Map raw event types/codes to normalized strings expected by frontend."""
    if not raw_type:
        return None
    
    # Handle numeric types directly
    if isinstance(raw_type, int):
        mapping = {
            6: 'Ignition On',
            7: 'Ignition Off',
            16: 'Harsh Breaking',
            17: 'Harsh Acceleration',
            18: 'Harsh Turn',
            1: 'SOS'
        }
        return mapping.get(raw_type, str(raw_type))
    
    # Convert to lowercase for case-insensitive matching
    raw_lower = str(raw_type).lower().strip()
    
    # Common mappings based on typical provider JSON
    mapping = {
        '6': 'Ignition On',
        'ignition_on': 'Ignition On',
        'ignitionon': 'Ignition On',
        '7': 'Ignition Off',
        'ignition_off': 'Ignition Off',
        'ignitionoff': 'Ignition Off',
        '16': 'Harsh Breaking',
        'braking_harsh': 'Harsh Breaking',
        'harsh_braking': 'Harsh Breaking',
        'harshbraking': 'Harsh Breaking',
        '17': 'Harsh Acceleration',
        'acceleration_harsh': 'Harsh Acceleration',
        'harsh_acceleration': 'Harsh Acceleration',
        'harshacceleration': 'Harsh Acceleration',
        '18': 'Harsh Turn',
        'cornering_harsh': 'Harsh Turn',
        'harsh_turn': 'Harsh Turn',
        'harshturn': 'Harsh Turn',
        'sos': 'SOS',
        'panic': 'SOS',
        '1': 'SOS'
    }
    return mapping.get(raw_lower, str(raw_type))

def clean_df_for_json(df):
    """Convert a DataFrame to a list of dicts suitable for JSON serialization."""
    df_clean = df.copy()
    # Handle Timestamps
    for col in df_clean.select_dtypes(include=['datetime64[ns]', 'datetime64[ns, UTC]', 'datetime64']).columns:
        df_clean[col] = df_clean[col].astype(str).replace(['NaT', 'nan', 'None'], None)
    
    # Handle NaNs and Infs explicitly by converting to object and replacing
    df_clean = df_clean.replace([np.inf, -np.inf, np.nan], None)
    
    # Final safety pass via dictionary conversion + recursive sanitizer
    data_list = df_clean.to_dict(orient='records')
    return sanitize_for_json(data_list)

def process_log_data(logs_data, filename):
    """
    Advanced Analytics v2.0 - Deep Telemetry Forensic Logic
    """
    print(f"Processing {len(logs_data)} records for v2.0...")
    
    all_telemetry_data = []
    processed_logs_insertIds = set()
    decoder = json.JSONDecoder()

    # --- EXTRACTION LOGIC ---
    for log_entry in logs_data:
        try:
            receive_ts = log_entry.get('receiveTimestamp')
            json_payload = log_entry.get('jsonPayload', {})
            data_obj = json_payload.get('data', {}) if isinstance(json_payload, dict) else {}
            additional_info_str = data_obj.get('AdditionalInformation')
            
            if not additional_info_str:
                continue

            telemetry_list = []
            try:
                additional_info_data = json.loads(additional_info_str)
                arguments_str = additional_info_data.get('Arguments')
                if arguments_str:
                    arguments_data = json.loads(arguments_str)
                    message_content = arguments_data.get('message')
                    if message_content:
                        parsed_data = json.loads(message_content) if isinstance(message_content, str) else message_content
                        if isinstance(parsed_data, dict): telemetry_list.append(parsed_data)
                        elif isinstance(parsed_data, list): telemetry_list = parsed_data
            except Exception as e:
                logger.debug(f"Primary JSON parsing failed, trying fallback: {e}")
                # Fallback extraction
                start_marker = '\\"message\\":'
                start_index = additional_info_str.find(start_marker)
                if start_index != -1:
                    text_to_decode = additional_info_str[start_index + len(start_marker):]
                    try:
                        clean_text = codecs.decode(text_to_decode, 'unicode_escape').strip().strip('"')
                        parsed_data, _ = decoder.raw_decode(clean_text)
                        if isinstance(parsed_data, dict): telemetry_list.append(parsed_data)
                        elif isinstance(parsed_data, list): telemetry_list = parsed_data
                    except Exception as e:
                        logger.debug(f"Fallback JSON parsing failed: {e}")

            for point in telemetry_list:
                if not isinstance(point, dict) or 'imei' not in point: continue
                
                addons = point.get('addOns', {})
                canbus = addons.get('canbus', {})
                event = point.get('event', {})

                all_telemetry_data.append({
                    'imei': point.get('imei'),
                    'time': point.get('time'),
                    'receiveTimestamp': receive_ts,
                    'lat': point.get('lat'),
                    'lng': point.get('lng'),
                    'altitude': point.get('altitude'),
                    'speed': point.get('speed'),
                    'heading': point.get('heading'),
                    'lastFixTime': point.get('lastFixTime'),
                    'isMoving': point.get('isMoving'),
                    'batteryLevelPercentage': point.get('batteryLevelPercentage'),
                    'reportMode': point.get('reportMode'),
                    'quality': point.get('quality'),
                    'mileage': addons.get('mileage'),
                    'ignitionOn': addons.get('ignitionOn'),
                    'externalPowerVcc': addons.get('externalPowerVcc'),
                    'digitalInput': addons.get('digitalInput'),
                    'driverId': addons.get('driverId'),
                    'engineRPM': canbus.get('engineRPM'),
                    'vehicleSpeed': canbus.get('vehicleSpeed'),
                    'engineCoolantTemperature': canbus.get('engineCoolantTemperature'),
                    'totalDistance': canbus.get('totalDistance'),
                    'totalFuelUsed': canbus.get('totalFuelUsed'),
                    'fuelLevelInput': canbus.get('fuelLevelInput'),
                    'event_type': normalize_event_type(
                        point.get('event', {}).get('type') or 
                        point.get('alert', {}).get('type') or 
                        point.get('type') or 
                        point.get('eventId') or 
                        addons.get('alert')
                    ),
                    # Quality Indicators for Radar
                    'has_rpm': canbus.get('engineRPM') is not None,
                    'has_speed': canbus.get('vehicleSpeed') is not None,
                    'has_temp': canbus.get('engineCoolantTemperature') is not None,
                    'has_dist': canbus.get('totalDistance') is not None,
                    'has_fuel_total': canbus.get('totalFuelUsed') is not None,
                    'has_fuel_level': canbus.get('fuelLevelInput') is not None,
                    'has_ignition': addons.get('ignitionOn') is not None,
                    'gps_ok': point.get('quality') == 'Good'
                })
        except Exception as e:
            logger.warning(f"Failed to process log entry: {e}")

    if not all_telemetry_data: return None

    df = pd.DataFrame(all_telemetry_data)
    
    # Conversions
    for col in ['time', 'lastFixTime', 'receiveTimestamp']:
        df[col] = pd.to_datetime(df[col], format='ISO8601', errors='coerce', utc=True).dt.floor('s')
    
    df['delay_seconds'] = (df['receiveTimestamp'] - df['time']).dt.total_seconds().clip(lower=0)
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
    df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
    df['mileage'] = pd.to_numeric(df['mileage'], errors='coerce')
    df['engineRPM'] = pd.to_numeric(df['engineRPM'], errors='coerce')

    # Deduplication
    df = df.drop_duplicates(subset=['imei', 'time', 'lat', 'lng'], keep='first')

    # Mark ignition as available for devices that have ignition events or addOns.ignitionOn
    ign_events = df['event_type'].isin(['Ignition On', 'Ignition Off'])
    devices_with_ignition = df.loc[ign_events | df['has_ignition'], 'imei'].unique()
    df.loc[df['imei'].isin(devices_with_ignition), 'has_ignition'] = True

    # --- IGNITION QUALITY HELPER ---
    def calc_ignition_quality(group):
        ign_on = (group['event_type'] == 'Ignition On').sum()
        ign_off = (group['event_type'] == 'Ignition Off').sum()
        has_addon = group['has_ignition'].any()
        if ign_on == 0 and ign_off == 0 and not has_addon:
            return 0.0
        if ign_on == 0 and ign_off == 0 and has_addon:
            return 100.0
        max_ign = max(ign_on, ign_off)
        min_ign = min(ign_on, ign_off)
        if abs(ign_on - ign_off) <= 1:
            return 100.0
        return (min_ign / max_ign) * 100 if max_ign > 0 else 0.0

    # --- ADVANCED METRICS PER IMEI ---
    def calculate_v2_metrics(group):
        group = group.sort_values('time')
        total = len(group)
        
        # 1. Odometer Quality
        # a) Decreasing
        odo_diff = group['mileage'].diff()
        odo_drops = (odo_diff < 0).sum()
        # b) Frozen (Moving but mileage static)
        # Using a simple threshold for movement: speed > 5 or lat/lng diff
        dist_change = (group['lat'].diff().abs() > 0.0001) | (group['lng'].diff().abs() > 0.0001)
        frozen_odo = (dist_change & (odo_diff == 0)).sum()
        odo_score = max(0, 100 - (odo_drops + frozen_odo) / total * 100)
        
        # 2. CAN Bus Completeness (6 specific fields)
        canbus_fields = ['has_rpm', 'has_speed', 'has_temp', 'has_dist', 'has_fuel_total', 'has_fuel_level']
        canbus_score = group[canbus_fields].mean().mean() * 100
        
        # 3. Latency
        avg_delay = group['delay_seconds'].mean()
        # Points: 100 if < 30s, linear drop to 0 at 300s
        delay_score = 100 if avg_delay <= 30 else max(0, 100 - (avg_delay - 30) * (100/270))
        
        # 4. GPS Integrity
        gps_score = (group['gps_ok'].sum() / total) * 100

        # 5. Ignition Balance
        ign_on = (group['event_type'] == 'Ignition On').sum()
        ign_off = (group['event_type'] == 'Ignition Off').sum()
        ign_balance = abs(ign_on - ign_off)
        ign_score = 100 if ign_balance <= 1 else max(0, 100 - (ign_balance * 10))

        # --- FORENSIC INTELLIGENCE (V2.1) ---
        # 6. Frozen Sensor Penalties
        # RPM Frozen: If Ign On and Moving, but RPM is 0 or static
        moving = (group['speed'] > 5) & (group['ignitionOn'] == 1)
        rpm_variability = group.loc[moving, 'engineRPM'].nunique() if moving.any() else 2
        rpm_frozen_penalty = 15 if (moving.any() and (rpm_variability <= 1 or group.loc[moving, 'engineRPM'].mean() == 0)) else 0
        
        # Temp/Speed Frozen: General check if changing over session
        has_temp = group['engineCoolantTemperature'].notnull().any()
        temp_variability = group['engineCoolantTemperature'].nunique() if has_temp else 2
        temp_frozen_penalty = 10 if (has_temp and temp_variability <= 1 and total > 10) else 0

        # Final Weighted Score (35% CAN, 25% ODO, 20% GPS, 10% Delay, 10% IGN)
        final_score = (canbus_score * 0.35 + odo_score * 0.25 + gps_score * 0.20 + delay_score * 0.10 + ign_score * 0.10)
        
        # Penalties application
        final_score = max(0, final_score - rpm_frozen_penalty - temp_frozen_penalty)
        
        # RPM Anormal penalty (Existing)
        rpm_anormal_penalty = (group['engineRPM'] > 8000).sum() / total * 50
        final_score = max(0, final_score - rpm_anormal_penalty)

        # Event counts for Stats
        harsh_breaking = (group['event_type'] == 'Harsh Breaking').sum()
        harsh_accel = (group['event_type'] == 'Harsh Acceleration').sum()
        harsh_turn = (group['event_type'] == 'Harsh Turn').sum()
        sos = (group['event_type'] == 'SOS').sum()

        driver_id = group['driverId'].dropna().iloc[0] if not group['driverId'].dropna().empty else "N/A"

        return pd.Series({
            'Puntaje_Calidad': round(final_score, 2),
            'Total_Reportes': total,
            'Delay_Avg': round(avg_delay, 2),
            'Odo_Quality_Score': round(odo_score, 2),
            'Canbus_Completeness': round(canbus_score, 2),
            'GPS_Integrity': round(gps_score, 2),
            'Ignition_Balance': ign_balance,
            'Ignition_On': ign_on,
            'Ignition_Off': ign_off,
            'Harsh_Events': harsh_breaking + harsh_accel + harsh_turn,
            'SOS_Count': sos,
            'Harsh_Breaking': harsh_breaking,
            'Harsh_Acceleration': harsh_accel,
            'Harsh_Turn': harsh_turn,
            'RPM_Anormal_Count': (group['engineRPM'] > 8000).sum(),
            'Lat_Lng_Correct_Variation': "OK" if dist_change.sum() > 0 else "Static",
            'Driver_ID': str(driver_id),
            'Frozen_Sensors': (("RPM " if rpm_frozen_penalty > 0 else "") + ("Temp" if temp_frozen_penalty > 0 else "")).strip() or "None",
            'Radar_GPS': round(gps_score, 2),
            'Radar_Ignition': round(calc_ignition_quality(group), 2),
            'Radar_Delay': round((group['delay_seconds'] < 60).mean() * 100, 2),
            'Radar_RPM': round(group['has_rpm'].mean() * 100, 2),
            'Radar_Speed': round(group['has_speed'].mean() * 100, 2),
            'Radar_Temp': round(group['has_temp'].mean() * 100, 2),
            'Radar_Dist': round(group['has_dist'].mean() * 100, 2),
            'Radar_Fuel': round(group['has_fuel_total'].mean() * 100, 2)
        })

    imei_metrics = df.groupby('imei').apply(calculate_v2_metrics).reset_index()

    # --- STATISTICS ---
    stats = df.groupby('imei').agg({
        'time': [('Primer_Reporte', 'min'), ('Ultimo_Reporte', 'max')],
        'mileage': [('KM_Inicial', 'min'), ('KM_Final', 'max')],
        'speed': [('Velocidad_Promedio_(KPH)', 'mean'), ('Velocidad_Maxima_(KPH)', 'max')],
        'engineRPM': [('RPM_Promedio', 'mean')],
        'fuelLevelInput': [('Nivel_Combustible_Promedio_%', 'mean')]
    })
    stats.columns = stats.columns.droplevel(0)
    stats = stats.reset_index()
    stats['Distancia_Recorrida_(KM)'] = (stats['KM_Final'] - stats['KM_Inicial']).clip(lower=0)
    
    # Merge all into scorecard for Frontend
    scorecard = imei_metrics.merge(stats[['imei', 'Distancia_Recorrida_(KM)', 'KM_Inicial', 'KM_Final', 'Primer_Reporte', 'Ultimo_Reporte', 'Velocidad_Promedio_(KPH)', 'Velocidad_Maxima_(KPH)', 'RPM_Promedio', 'Nivel_Combustible_Promedio_%']], on='imei', how='left')

    # --- GLOBAL RADAR DATA ---
    ignition_scores = df.groupby('imei').apply(calc_ignition_quality)
    ignition_avg = float(ignition_scores.mean()) if len(ignition_scores) > 0 else 0.0

    global_quality = {
        'gps_validity': df['gps_ok'].mean() * 100,
        'ignition': ignition_avg,
        'delay': (df['delay_seconds'] < 60).mean() * 100,
        'rpm': df['has_rpm'].mean() * 100,
        'speed': df['has_speed'].mean() * 100,
        'temp': df['has_temp'].mean() * 100,
        'dist': df['has_dist'].mean() * 100,
        'fuel': df['has_fuel_total'].mean() * 100
    }

    summary = {
        "filename": filename,
        "processed_at": datetime.now().isoformat(),
        "total_devices": int(df['imei'].nunique()),
        "total_records": int(len(df)),
        "total_distance_km": float(round(stats['Distancia_Recorrida_(KM)'].sum(), 2)),
        "average_quality_score": float(round(scorecard['Puntaje_Calidad'].mean(), 2))
    }
    
    result = {
        "summary": summary,
        "scorecard": clean_df_for_json(scorecard),
        "raw_data_sample": clean_df_for_json(df),
        "data_quality": global_quality,
        "chart_data": {
            "score_distribution": scorecard['Puntaje_Calidad'].tolist(),
            "events_summary": df['event_type'].value_counts().to_dict()
        }
    }
    return sanitize_for_json(result)

@app.before_request
def check_content_length():
    if request.content_length and request.content_length > app.config['MAX_CONTENT_LENGTH']:
        logger.warning(f"File too large: {request.content_length} bytes")
        return jsonify({"error": f"File too large. Maximum size: {MAX_UPLOAD_SIZE_MB}MB"}), 413


@app.errorhandler(413)
def request_entity_too_large(error):
    logger.warning(f"Request entity too large: {error}")
    return jsonify({"error": f"File too large. Maximum size: {MAX_UPLOAD_SIZE_MB}MB"}), 413


@ns_analysis.route('/upload')
class Upload(Resource):
    @ns_analysis.doc('upload_file')
    @ns_analysis.expect(upload_parser)
    @ns_analysis.response(200, 'Success', upload_response_model)
    @ns_analysis.response(202, 'Accepted - Processing in background', job_response_model)
    @ns_analysis.response(400, 'Bad Request', error_model)
    @ns_analysis.response(413, 'File Too Large', error_model)
    def post(self):
        """Upload and process a JSON telemetry log file.

        For files larger than 10MB, processing is done in the background.
        Returns 202 Accepted with a job_id that can be used to track progress.
        """
        if 'file' not in request.files:
            return {"error": "No file part"}, 400
        file = request.files['file']
        if file.filename == '':
            return {"error": "No selected file"}, 400

        if file:
            filename = file.filename
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)

            # Check file size for async processing
            file_size = os.path.getsize(file_path)
            if should_process_async(file_size):
                # Process large files in background
                job_id = submit_job(file_path, filename, db)
                logger.info(f"Large file ({file_size} bytes), processing async: job {job_id}")
                return {"job_id": job_id, "status": "pending"}, 202

            # Synchronous processing for smaller files
            logs_data = []
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    logs_data = json.load(f)
            except json.JSONDecodeError:
                # Try line by line
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                logs_data.append(json.loads(line))
                            except Exception as e:
                                logger.debug(f"Failed to parse line as JSON: {e}")

            result = process_log_data(logs_data, filename)
            if not result:
                return {"error": "No valid telemetry data found"}, 400

            # Save Result to SQLite
            result_id = str(uuid.uuid4())
            try:
                db.save_analysis(result_id, result)
                logger.info(f"Saved analysis {result_id} to database")
            except Exception as e:
                logger.error(f"Failed to save to database: {e}")
                # Fallback to JSON file
                result_filename = f"{result_id}.json"
                with open(os.path.join(PROCESSED_FOLDER, result_filename), 'w') as f:
                    json.dump(result, f, indent=2)

            return {"id": result_id, "data": result}


@ns_analysis.route('/history')
class HistoryList(Resource):
    @ns_analysis.doc('list_history')
    @ns_analysis.response(200, 'Success', [history_entry_model])
    def get(self):
        """List all past analyses"""
        return load_history()


@ns_analysis.route('/result/<string:id>')
@ns_analysis.param('id', 'The analysis identifier')
class Result(Resource):
    @ns_analysis.doc('get_result')
    @ns_analysis.response(200, 'Success')
    @ns_analysis.response(404, 'Not Found', error_model)
    def get(self, id):
        """Retrieve a cached analysis result by ID"""
        # Try SQLite first
        result = db.get_analysis(id)
        if result:
            return result

        # Fallback to JSON file
        try:
            with open(os.path.join(PROCESSED_FOLDER, f"{id}.json"), 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"error": "Result not found"}, 404


@ns_analysis.route('/result/<string:id>/telemetry')
@ns_analysis.param('id', 'The analysis identifier')
class Telemetry(Resource):
    @ns_analysis.doc('get_telemetry_page',
        params={
            'page': 'Page number (default 1)',
            'per_page': 'Rows per page (default 100, max 500)',
            'imei': 'Optional IMEI filter'
        })
    @ns_analysis.response(200, 'Success')
    @ns_analysis.response(404, 'Not Found', error_model)
    def get(self, id):
        """Retrieve paginated raw telemetry data for an analysis"""
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 100, type=int), 500)
        imei = request.args.get('imei', None)
        if imei == 'all':
            imei = None

        result = db.get_telemetry_page(id, page=page, per_page=per_page, imei=imei)
        if result is None:
            return {"error": "Result not found"}, 404
        return result


@ns_analysis.route('/history/<string:id>')
@ns_analysis.param('id', 'The analysis identifier')
class HistoryItem(Resource):
    @ns_analysis.doc('delete_history_item')
    @ns_analysis.response(200, 'Success', success_model)
    @ns_analysis.response(404, 'Not Found', error_model)
    def delete(self, id):
        """Delete an analysis and its associated files"""
        # Try SQLite first
        original_filename = db.delete_analysis(id)

        if original_filename:
            # Delete original upload file
            try:
                os.remove(os.path.join(UPLOAD_FOLDER, original_filename))
            except OSError:
                pass
            logger.info(f"Deleted analysis {id} from database")
            return {"success": True}

        # Fallback to JSON-based history
        history = load_history()
        item_to_delete = next((item for item in history if item['id'] == id), None)
        if not item_to_delete:
            return {"error": "Item not found"}, 404

        # Delete processed JSON file
        try:
            os.remove(os.path.join(PROCESSED_FOLDER, f"{id}.json"))
        except OSError:
            pass

        # Delete original upload file
        try:
            original_filename = item_to_delete.get('original_filename', item_to_delete.get('filename'))
            if original_filename:
                os.remove(os.path.join(UPLOAD_FOLDER, original_filename))
        except OSError:
            pass

        return {"success": True}

    @ns_analysis.doc('update_history_item')
    @ns_analysis.expect(rename_model)
    @ns_analysis.response(200, 'Success')
    @ns_analysis.response(400, 'Bad Request', error_model)
    @ns_analysis.response(404, 'Not Found', error_model)
    def patch(self, id):
        """Rename a history entry"""
        data = request.get_json()
        if not data or 'filename' not in data:
            return {"error": "Missing filename"}, 400

        new_filename = data['filename']

        # Try SQLite first
        if db.update_filename(id, new_filename):
            logger.info(f"Updated filename for {id} to {new_filename}")
            return {"success": True, "filename": new_filename}

        # Analysis not in database
        return {"error": "Item not found"}, 404


@ns_analysis.route('/job/<string:job_id>')
@ns_analysis.param('job_id', 'The job identifier')
class JobStatus(Resource):
    @ns_analysis.doc('get_job_status')
    @ns_analysis.response(200, 'Success', job_status_model)
    @ns_analysis.response(404, 'Not Found', error_model)
    def get(self, job_id):
        """Get the status of a background processing job"""
        status = get_job_status(job_id, db)
        if not status:
            return {"error": "Job not found"}, 404
        return status


@ns_analysis.route('/job/<string:job_id>/progress')
@ns_analysis.param('job_id', 'The job identifier')
class JobProgress(Resource):
    @ns_analysis.doc('get_job_progress_sse')
    @ns_analysis.response(200, 'SSE stream of progress updates')
    @ns_analysis.response(404, 'Not Found', error_model)
    def get(self, job_id):
        """Get real-time progress updates via Server-Sent Events"""
        from flask import Response

        # Verify job exists
        status = get_job_status(job_id, db)
        if not status:
            return {"error": "Job not found"}, 404

        return Response(
            generate_progress_events(job_id, db),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )


# Initialize and start background worker
background_worker = BackgroundWorker(process_log_data, db)
background_worker.start()


if __name__ == '__main__':
    app.run(debug=True, port=8000)
