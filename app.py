import os
import json
import uuid
import codecs
from datetime import datetime
from collections import Counter
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)

# Configuration
DATA_DIR = os.getenv('DATA_DIR', '.')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
PROCESSED_FOLDER = os.path.join(DATA_DIR, 'processed')
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

if not os.path.exists(HISTORY_FILE):
    with open(HISTORY_FILE, 'w') as f:
        json.dump([], f)

def load_history():
    try:
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_history_entry(entry):
    history = load_history()
    history.insert(0, entry)
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

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
            except:
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
                    except: pass

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
                    'event_type': event.get('type'),
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
        except: pass

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

        # Final Weighted Score (35% CAN, 25% ODO, 20% GPS, 10% Delay, 10% IGN)
        final_score = (canbus_score * 0.35 + odo_score * 0.25 + gps_score * 0.20 + delay_score * 0.10 + ign_score * 0.10)
        
        # Penalties
        rpm_penalty = (group['engineRPM'] > 8000).sum() / total * 50
        final_score = max(0, final_score - rpm_penalty)

        # Event counts for Stats
        harsh_breaking = (group['event_type'] == 'Harsh Breaking').sum()
        harsh_accel = (group['event_type'] == 'Harsh Acceleration').sum()
        harsh_turn = (group['event_type'] == 'Harsh Turn').sum()
        sos = (group['event_type'] == 'SOS').sum()

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
            'Lat_Lng_Correct_Variation': "OK" if dist_change.sum() > 0 else "Static"
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
    global_quality = {
        'gps_validity': df['gps_ok'].mean() * 100,
        'ignition': df['has_ignition'].mean() * 100,
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
        "raw_data_sample": clean_df_for_json(df.head(2000)), 
        "data_quality": global_quality,
        "chart_data": {
            "score_distribution": scorecard['Puntaje_Calidad'].tolist(),
            "events_summary": df['event_type'].value_counts().to_dict()
        }
    }
    return sanitize_for_json(result)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file:
        filename = file.filename
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Read and process
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
                        except: pass
        
        result = process_log_data(logs_data, filename)
        if not result:
            return jsonify({"error": "No valid telemetry data found"}), 400
            
        # Save Result
        result_id = str(uuid.uuid4())
        result_filename = f"{result_id}.json"
        with open(os.path.join(PROCESSED_FOLDER, result_filename), 'w') as f:
            json.dump(result, f, indent=2) # Save full result
            
        # Update History
        history_entry = {
            "id": result_id,
            "filename": filename,
            "summary": result['summary']
        }
        save_history_entry(history_entry)
        
        return jsonify({"id": result_id, "data": result})

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify(load_history())

@app.route('/api/result/<id>', methods=['GET'])
def get_result(id):
    try:
        with open(os.path.join(PROCESSED_FOLDER, f"{id}.json"), 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        return jsonify({"error": "Result not found"}), 404

@app.route('/api/history/<id>', methods=['DELETE'])
def delete_history_item(id):
    history = load_history()
    new_history = [item for item in history if item['id'] != id]
    if len(history) == len(new_history):
        return jsonify({"error": "Item not found"}), 404
        
    with open(HISTORY_FILE, 'w') as f:
        json.dump(new_history, f, indent=2)
        
    # Optional: Delete the processed file associated with it
    try:
        os.remove(os.path.join(PROCESSED_FOLDER, f"{id}.json"))
    except OSError:
        pass # File might be already gone or permission issue
        
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=8000)
