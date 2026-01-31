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

def clean_df_for_json(df):
    """Convert a DataFrame to a list of dicts suitable for JSON serialization."""
    df_clean = df.copy()
    # Handle Timestamps
    for col in df_clean.select_dtypes(include=['datetime64[ns]', 'datetime64[ns, UTC]']).columns:
        df_clean[col] = df_clean[col].astype(str)
    
    # Handle NaNs and Infs
    df_clean = df_clean.replace([np.inf, -np.inf], None)
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    
    return df_clean.to_dict(orient='records')

def process_log_data(logs_data, filename):
    """
    Main logic ported from user script.
    """
    print(f"Processing {len(logs_data)} records...")
    
    all_telemetry_data = []
    processed_logs_insertIds = set()
    decoder = json.JSONDecoder()

    # --- EXTRACTION LOGIC ---
    for log_entry in logs_data:
        try:
            receive_ts = log_entry.get('receiveTimestamp')
            
            # Access nested JSON payload
            json_payload = log_entry.get('jsonPayload', {})
            # Some logs might have 'data' directly or nested
            data_obj = json_payload.get('data', {}) if isinstance(json_payload, dict) else {}
            
            additional_info_str = data_obj.get('AdditionalInformation')
            
            if not additional_info_str:
                # Fallback: sometimes raw string in jsonPayload?
                # Sticking to user script logic strictly
                continue

            telemetry_list = []

            # Try parsing Arguments -> message
            try:
                additional_info_data = json.loads(additional_info_str)
                arguments_str = additional_info_data.get('Arguments')
                if arguments_str:
                    arguments_data = json.loads(arguments_str)
                    message_content = arguments_data.get('message')
                    if message_content:
                        if isinstance(message_content, str):
                            parsed_data = json.loads(message_content)
                        else:
                            parsed_data = message_content

                        if isinstance(parsed_data, dict):
                            telemetry_list.append(parsed_data)
                        elif isinstance(parsed_data, list):
                            telemetry_list = parsed_data
            except (json.JSONDecodeError, TypeError):
                # Fallback extraction method from user script
                start_marker = '\\"message\\":'
                start_index = additional_info_str.find(start_marker)
                if start_index != -1:
                    text_to_decode = additional_info_str[start_index + len(start_marker):]
                    try:
                        clean_text = codecs.decode(text_to_decode, 'unicode_escape')
                        clean_text = clean_text.strip().strip('"')
                        parsed_data, _ = decoder.raw_decode(clean_text)
                        
                        if isinstance(parsed_data, dict):
                            telemetry_list.append(parsed_data)
                        elif isinstance(parsed_data, list):
                            telemetry_list = parsed_data
                    except:
                        pass

            if not telemetry_list:
                continue

            # Normalize telemetry points
            for point in telemetry_list:
                if not isinstance(point, dict) or 'imei' not in point:
                    continue
                
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
                    'event_type': event.get('type')
                })
            
            if 'insertId' in log_entry:
                processed_logs_insertIds.add(log_entry['insertId'])
                
        except Exception:
            pass # Skipping malformed logs as per script

    if not all_telemetry_data:
        return None

    # --- PANDAS PROCESSING ---
    df = pd.DataFrame(all_telemetry_data)
    
    # helper
    def safe_to_nullable_int(series):
        s_numeric = pd.to_numeric(series, errors='coerce')
        mask = s_numeric.notna()
        # Create a Series with Int64 dtype
        result = pd.Series([pd.NA]*len(series), index=series.index, dtype='Int64')
        result[mask] = s_numeric[mask].astype(int)
        return result

    # Conversions
    df['time'] = pd.to_datetime(df['time'], format='ISO8601', errors='coerce', utc=True)
    df['lastFixTime'] = pd.to_datetime(df['lastFixTime'], format='ISO8601', errors='coerce', utc=True)
    df['receiveTimestamp'] = pd.to_datetime(df['receiveTimestamp'], format='ISO8601', errors='coerce', utc=True)
    
    # Floor to seconds
    df['time'] = df['time'].dt.floor('s')
    df['lastFixTime'] = df['lastFixTime'].dt.floor('s')
    df['receiveTimestamp'] = df['receiveTimestamp'].dt.floor('s')

    # Delay
    df['delay_seconds'] = (df['receiveTimestamp'] - df['time']).dt.total_seconds()

    # Numeric conversions
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lng'] = pd.to_numeric(df['lng'], errors='coerce')

    int_columns = [
        'altitude', 'speed', 'heading', 'batteryLevelPercentage', 'mileage',
        'externalPowerVcc', 'digitalInput', 'driverId', 'engineRPM',
        'vehicleSpeed', 'engineCoolantTemperature', 'totalDistance',
        'totalFuelUsed', 'fuelLevelInput', 'delay_seconds'
    ]

    for col in int_columns:
        if col in df.columns:
            df[col] = safe_to_nullable_int(df[col])
            
    # Booleans
    for col in ['isMoving', 'ignitionOn']:
        if col in df.columns:
            df[col] = df[col].astype('boolean')
            # For JSON serialization later, we might want these as bool or None, handled by clean_df_for_json

    # Deduplication
    df['record_id'] = df['imei'].astype(str) + df['time'].astype(str) + df['lat'].astype(str) + df['lng'].astype(str)
    total_initial = len(df)
    df = df.drop_duplicates(subset=['record_id'], keep='first')
    total_duplicados = total_initial - len(df)
    df = df.drop(columns=['record_id']) # clean up

    # --- AGGREGATION & STATS ---
    agg_dict = {
        'time': ['min', 'max', 'count'],
        'mileage': ['min', 'max'],
        'speed': ['mean', 'max'],
        'engineRPM': ['mean'],
        'fuelLevelInput': ['mean']
    }
    # Flattening logic needed for aggregation rename
    # Simple groupby first
    stats = df.groupby('imei').agg({
        'time': [('Primer_Reporte', 'min'), ('Ultimo_Reporte', 'max'), ('Total_Reportes', 'count')],
        'mileage': [('KM_Inicial', 'min'), ('KM_Final', 'max')],
        'speed': [('Velocidad_Promedio_(KPH)', 'mean'), ('Velocidad_Maxima_(KPH)', 'max')],
        'engineRPM': [('RPM_Promedio', 'mean')],
        'fuelLevelInput': [('Nivel_Combustible_Promedio_%', 'mean')]
    })
    
    # Flatten columns
    stats.columns = stats.columns.droplevel(0)
    stats = stats.reset_index()
    
    # Calculated Fields
    stats['Distancia_Recorrida_(KM)'] = stats['KM_Final'] - stats['KM_Inicial']
    
    # Events
    event_counts = pd.crosstab(df['imei'], df['event_type']).add_prefix('Eventos_')
    if not event_counts.empty:
        stats = stats.merge(event_counts, on='imei', how='left').fillna(0)

    # --- SCORECARD CALCULATION ---
    def calculate_imei_quality(group):
        group = group.sort_values('time')
        # Odómetro decreciente
        odometer_drops = (group['mileage'].diff() < 0).sum()
        # CANBUS NA
        canbus_na_count = group['engineRPM'].isna().sum()
        # RPM Anormal ( > 8000 or < 100)
        rpm_anormal_count = ((group['engineRPM'] > 8000) | (group['engineRPM'] < 100)).sum()
        # Last Fix Time Desactualizado (> 300s)
        # Note: Handle NaT if any
        valid_times = pd.notna(group['time']) & pd.notna(group['lastFixTime'])
        time_diff = (group.loc[valid_times, 'time'] - group.loc[valid_times, 'lastFixTime']).dt.total_seconds()
        lastfix_desactualizado_count = (time_diff > 300).sum()
        
        return pd.Series({
            'Odometro_Errores_Decreciente': odometer_drops,
            'CANBUS_Registros_NA': canbus_na_count,
            'CANBUS_RPM_Anormal': rpm_anormal_count,
            'LastFixTime_Desactualizado_Count': lastfix_desactualizado_count
        })

    imei_metrics = df.groupby('imei').apply(calculate_imei_quality).reset_index()
    
    scorecard = stats[['imei', 'Total_Reportes', 'Distancia_Recorrida_(KM)']].merge(imei_metrics, on='imei', how='left')
    
    # Rates
    scorecard['Odometro_Tasa_OK'] = (1 - (scorecard['Odometro_Errores_Decreciente'] / scorecard['Total_Reportes'])) * 100
    scorecard['CANBUS_Tasa_Reporte'] = (1 - (scorecard['CANBUS_Registros_NA'] / scorecard['Total_Reportes'])) * 100
    scorecard['LastFixTime_Tasa_OK'] = (1 - (scorecard['LastFixTime_Desactualizado_Count'] / scorecard['Total_Reportes'])) * 100
    
    # Harsh / Ignition
    harsh_cols = [c for c in stats.columns if 'Eventos_Harsh' in c]
    stats['Eventos_Harsh'] = stats[harsh_cols].sum(axis=1) if harsh_cols else 0
    
    stats['Ignition_On_Off_Balance'] = abs(stats.get('Eventos_Ignition_on', 0) - stats.get('Eventos_Ignition_off', 0))
    
    # Merge back to scorecard
    cols_to_merge = ['imei', 'Eventos_Harsh', 'Ignition_On_Off_Balance']
    if 'Eventos_Ignition_on' in stats: cols_to_merge.append('Eventos_Ignition_on') 
    if 'Eventos_Ignition_off' in stats: cols_to_merge.append('Eventos_Ignition_off')
    
    scorecard = scorecard.merge(stats[cols_to_merge], on='imei', how='left')
    
    scorecard['Ignition_Coherencia'] = np.where(scorecard['Ignition_On_Off_Balance'] > 10, "Desbalance Alto", "OK")
    
    scorecard['Puntaje_Calidad'] = (
        (scorecard['Odometro_Tasa_OK'] * 0.35) +
        (scorecard['CANBUS_Tasa_Reporte'] * 0.35) +
        (scorecard['LastFixTime_Tasa_OK'] * 0.20)
    ) - (scorecard['CANBUS_RPM_Anormal'] / scorecard['Total_Reportes'] * 100 * 0.10)
    
    scorecard['Puntaje_Calidad'] = scorecard['Puntaje_Calidad'].clip(lower=0).round(2)
    scorecard = scorecard.sort_values('Puntaje_Calidad', ascending=False)

    # --- FINAL OUTPUT CONSTRUCTION ---
    
    # General Stats
    total_devices = df['imei'].nunique()
    total_records = len(df)
    total_distance = stats['Distancia_Recorrida_(KM)'].sum()
    avg_score = scorecard['Puntaje_Calidad'].mean()
    
    summary = {
        "filename": filename,
        "processed_at": datetime.now().isoformat(),
        "total_devices": int(total_devices),
        "total_records": int(total_records),
        "total_duplicates_removed": int(total_duplicados),
        "total_distance_km": float(round(total_distance, 2)),
        "average_quality_score": float(round(avg_score, 2))
    }
    
    result = {
        "summary": summary,
        "scorecard": clean_df_for_json(scorecard),
        "stats_per_imei": clean_df_for_json(stats),
        "raw_data_sample": clean_df_for_json(df.head(1000)), # Send first 1000 for preview
        # We can also aggregate data for charts here if needed
        "chart_data": {
            "score_distribution": scorecard['Puntaje_Calidad'].tolist(),
            "events_summary": df['event_type'].value_counts().to_dict()
        }
    }
    
    return result

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
