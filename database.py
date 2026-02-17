"""SQLite database access layer for GPS Telemetry Analyzer."""
import os
import json
import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict, Any


class Database:
    """SQLite database wrapper for telemetry analysis storage."""

    def __init__(self, db_path: str):
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._init_schema()

    def _init_schema(self):
        """Initialize database schema from schema.sql."""
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with self.get_connection() as conn:
            with open(schema_path, 'r') as f:
                conn.executescript(f.read())

    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def save_analysis(self, analysis_id: str, result: Dict[str, Any]) -> None:
        """Save complete analysis result to database.

        Args:
            analysis_id: Unique identifier for the analysis
            result: Full analysis result dictionary
        """
        summary = result['summary']
        scorecard = result.get('scorecard', [])
        data_quality = result.get('data_quality', {})
        chart_data = result.get('chart_data', {})
        raw_data = result.get('raw_data_sample', [])

        with self.get_connection() as conn:
            # Insert analysis metadata
            conn.execute('''
                INSERT INTO analyses (id, filename, original_filename, processed_at,
                    total_devices, total_records, total_distance_km, average_quality_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                analysis_id,
                summary['filename'],
                summary['filename'],
                summary['processed_at'],
                summary['total_devices'],
                summary['total_records'],
                summary['total_distance_km'],
                summary['average_quality_score']
            ))

            # Insert scorecard data
            for row in scorecard:
                conn.execute('''
                    INSERT INTO scorecard (analysis_id, imei, puntaje_calidad, total_reportes,
                        delay_avg, odo_quality_score, canbus_completeness, gps_integrity,
                        ignition_balance, ignition_on, ignition_off, harsh_events, sos_count,
                        harsh_breaking, harsh_acceleration, harsh_turn, rpm_anormal_count,
                        lat_lng_correct_variation, driver_id, frozen_sensors, distancia_recorrida_km,
                        km_inicial, km_final, primer_reporte, ultimo_reporte, velocidad_promedio_kph,
                        velocidad_maxima_kph, rpm_promedio, nivel_combustible_promedio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    analysis_id,
                    row.get('imei'),
                    row.get('Puntaje_Calidad'),
                    row.get('Total_Reportes'),
                    row.get('Delay_Avg'),
                    row.get('Odo_Quality_Score'),
                    row.get('Canbus_Completeness'),
                    row.get('GPS_Integrity'),
                    row.get('Ignition_Balance'),
                    row.get('Ignition_On'),
                    row.get('Ignition_Off'),
                    row.get('Harsh_Events'),
                    row.get('SOS_Count'),
                    row.get('Harsh_Breaking'),
                    row.get('Harsh_Acceleration'),
                    row.get('Harsh_Turn'),
                    row.get('RPM_Anormal_Count'),
                    row.get('Lat_Lng_Correct_Variation'),
                    row.get('Driver_ID'),
                    row.get('Frozen_Sensors'),
                    row.get('Distancia_Recorrida_(KM)'),
                    row.get('KM_Inicial'),
                    row.get('KM_Final'),
                    row.get('Primer_Reporte'),
                    row.get('Ultimo_Reporte'),
                    row.get('Velocidad_Promedio_(KPH)'),
                    row.get('Velocidad_Maxima_(KPH)'),
                    row.get('RPM_Promedio'),
                    row.get('Nivel_Combustible_Promedio_%')
                ))

            # Insert data quality
            conn.execute('''
                INSERT INTO data_quality (analysis_id, gps_validity, ignition, delay,
                    rpm, speed, temp, dist, fuel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                analysis_id,
                data_quality.get('gps_validity'),
                data_quality.get('ignition'),
                data_quality.get('delay'),
                data_quality.get('rpm'),
                data_quality.get('speed'),
                data_quality.get('temp'),
                data_quality.get('dist'),
                data_quality.get('fuel')
            ))

            # Insert chart data (events summary)
            events_summary = chart_data.get('events_summary', {})
            for event_type, count in events_summary.items():
                if event_type and count:
                    conn.execute('''
                        INSERT INTO chart_data (analysis_id, event_type, count)
                        VALUES (?, ?, ?)
                    ''', (analysis_id, str(event_type), count))

            # Insert raw telemetry sample (limit to 2000 records, stratified by device)
            imeis = list({r.get('imei') for r in raw_data if r.get('imei')})
            if imeis:
                per_device_limit = max(1, 2000 // len(imeis))
                device_counts = {}
                stratified_data = []
                for row in raw_data:
                    device = row.get('imei')
                    device_counts[device] = device_counts.get(device, 0) + 1
                    if device_counts[device] <= per_device_limit:
                        stratified_data.append(row)
                raw_data = stratified_data[:2000]
            else:
                raw_data = raw_data[:2000]
            for row in raw_data:
                conn.execute('''
                    INSERT INTO telemetry_data (analysis_id, imei, time, receive_timestamp,
                        lat, lng, altitude, speed, heading, last_fix_time, is_moving,
                        battery_level_percentage, report_mode, quality, mileage, ignition_on,
                        external_power_vcc, digital_input, driver_id, engine_rpm, vehicle_speed,
                        engine_coolant_temperature, total_distance, total_fuel_used,
                        fuel_level_input, event_type, delay_seconds)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    analysis_id,
                    row.get('imei'),
                    row.get('time'),
                    row.get('receiveTimestamp'),
                    row.get('lat'),
                    row.get('lng'),
                    row.get('altitude'),
                    row.get('speed'),
                    row.get('heading'),
                    row.get('lastFixTime'),
                    1 if row.get('isMoving') else 0,
                    row.get('batteryLevelPercentage'),
                    row.get('reportMode'),
                    row.get('quality'),
                    row.get('mileage'),
                    1 if row.get('ignitionOn') else 0,
                    row.get('externalPowerVcc'),
                    row.get('digitalInput'),
                    row.get('driverId'),
                    row.get('engineRPM'),
                    row.get('vehicleSpeed'),
                    row.get('engineCoolantTemperature'),
                    row.get('totalDistance'),
                    row.get('totalFuelUsed'),
                    row.get('fuelLevelInput'),
                    row.get('event_type'),
                    row.get('delay_seconds')
                ))

    def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a complete analysis result by ID.

        Args:
            analysis_id: The analysis identifier

        Returns:
            Analysis result dictionary or None if not found
        """
        with self.get_connection() as conn:
            # Get analysis metadata
            row = conn.execute(
                'SELECT * FROM analyses WHERE id = ?', (analysis_id,)
            ).fetchone()

            if not row:
                return None

            summary = {
                'filename': row['filename'],
                'processed_at': row['processed_at'],
                'total_devices': row['total_devices'],
                'total_records': row['total_records'],
                'total_distance_km': row['total_distance_km'],
                'average_quality_score': row['average_quality_score']
            }

            # Get scorecard
            scorecard_rows = conn.execute(
                'SELECT * FROM scorecard WHERE analysis_id = ?', (analysis_id,)
            ).fetchall()

            scorecard = []
            for r in scorecard_rows:
                scorecard.append({
                    'imei': r['imei'],
                    'Puntaje_Calidad': r['puntaje_calidad'],
                    'Total_Reportes': r['total_reportes'],
                    'Delay_Avg': r['delay_avg'],
                    'Odo_Quality_Score': r['odo_quality_score'],
                    'Canbus_Completeness': r['canbus_completeness'],
                    'GPS_Integrity': r['gps_integrity'],
                    'Ignition_Balance': r['ignition_balance'],
                    'Ignition_On': r['ignition_on'],
                    'Ignition_Off': r['ignition_off'],
                    'Harsh_Events': r['harsh_events'],
                    'SOS_Count': r['sos_count'],
                    'Harsh_Breaking': r['harsh_breaking'],
                    'Harsh_Acceleration': r['harsh_acceleration'],
                    'Harsh_Turn': r['harsh_turn'],
                    'RPM_Anormal_Count': r['rpm_anormal_count'],
                    'Lat_Lng_Correct_Variation': r['lat_lng_correct_variation'],
                    'Driver_ID': r['driver_id'],
                    'Frozen_Sensors': r['frozen_sensors'],
                    'Distancia_Recorrida_(KM)': r['distancia_recorrida_km'],
                    'KM_Inicial': r['km_inicial'],
                    'KM_Final': r['km_final'],
                    'Primer_Reporte': r['primer_reporte'],
                    'Ultimo_Reporte': r['ultimo_reporte'],
                    'Velocidad_Promedio_(KPH)': r['velocidad_promedio_kph'],
                    'Velocidad_Maxima_(KPH)': r['velocidad_maxima_kph'],
                    'RPM_Promedio': r['rpm_promedio'],
                    'Nivel_Combustible_Promedio_%': r['nivel_combustible_promedio']
                })

            # Get data quality
            dq_row = conn.execute(
                'SELECT * FROM data_quality WHERE analysis_id = ?', (analysis_id,)
            ).fetchone()

            data_quality = {}
            if dq_row:
                data_quality = {
                    'gps_validity': dq_row['gps_validity'],
                    'ignition': dq_row['ignition'],
                    'delay': dq_row['delay'],
                    'rpm': dq_row['rpm'],
                    'speed': dq_row['speed'],
                    'temp': dq_row['temp'],
                    'dist': dq_row['dist'],
                    'fuel': dq_row['fuel']
                }

            # Get chart data
            chart_rows = conn.execute(
                'SELECT * FROM chart_data WHERE analysis_id = ?', (analysis_id,)
            ).fetchall()

            events_summary = {r['event_type']: r['count'] for r in chart_rows if r['event_type']}

            # Get raw data sample (stratified by device)
            raw_rows = conn.execute('''
                SELECT * FROM (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY imei ORDER BY time) as rn
                    FROM telemetry_data WHERE analysis_id = ?
                ) WHERE rn <= MAX(1, 2000 / MAX(1, (SELECT COUNT(DISTINCT imei) FROM telemetry_data WHERE analysis_id = ?)))
                LIMIT 2000
            ''', (analysis_id, analysis_id)).fetchall()

            raw_data_sample = []
            for r in raw_rows:
                raw_data_sample.append({
                    'imei': r['imei'],
                    'time': r['time'],
                    'receiveTimestamp': r['receive_timestamp'],
                    'lat': r['lat'],
                    'lng': r['lng'],
                    'altitude': r['altitude'],
                    'speed': r['speed'],
                    'heading': r['heading'],
                    'lastFixTime': r['last_fix_time'],
                    'isMoving': bool(r['is_moving']),
                    'batteryLevelPercentage': r['battery_level_percentage'],
                    'reportMode': r['report_mode'],
                    'quality': r['quality'],
                    'mileage': r['mileage'],
                    'ignitionOn': bool(r['ignition_on']),
                    'externalPowerVcc': r['external_power_vcc'],
                    'digitalInput': r['digital_input'],
                    'driverId': r['driver_id'],
                    'engineRPM': r['engine_rpm'],
                    'vehicleSpeed': r['vehicle_speed'],
                    'engineCoolantTemperature': r['engine_coolant_temperature'],
                    'totalDistance': r['total_distance'],
                    'totalFuelUsed': r['total_fuel_used'],
                    'fuelLevelInput': r['fuel_level_input'],
                    'event_type': r['event_type'],
                    'delay_seconds': r['delay_seconds']
                })

            return {
                'summary': summary,
                'scorecard': scorecard,
                'data_quality': data_quality,
                'chart_data': {
                    'score_distribution': [s['Puntaje_Calidad'] for s in scorecard],
                    'events_summary': events_summary
                },
                'raw_data_sample': raw_data_sample
            }

    def get_history(self) -> List[Dict[str, Any]]:
        """Get list of all analyses for history display.

        Returns:
            List of history entry dictionaries
        """
        with self.get_connection() as conn:
            rows = conn.execute('''
                SELECT id, filename, original_filename, processed_at,
                    total_devices, total_records, total_distance_km, average_quality_score
                FROM analyses
                ORDER BY created_at DESC
            ''').fetchall()

            return [{
                'id': r['id'],
                'filename': r['filename'],
                'original_filename': r['original_filename'],
                'summary': {
                    'filename': r['filename'],
                    'processed_at': r['processed_at'],
                    'total_devices': r['total_devices'],
                    'total_records': r['total_records'],
                    'total_distance_km': r['total_distance_km'],
                    'average_quality_score': r['average_quality_score']
                }
            } for r in rows]

    def update_filename(self, analysis_id: str, new_filename: str) -> bool:
        """Update the display filename for an analysis.

        Args:
            analysis_id: The analysis identifier
            new_filename: New display name

        Returns:
            True if updated, False if not found
        """
        with self.get_connection() as conn:
            cursor = conn.execute(
                'UPDATE analyses SET filename = ? WHERE id = ?',
                (new_filename, analysis_id)
            )
            return cursor.rowcount > 0

    def delete_analysis(self, analysis_id: str) -> Optional[str]:
        """Delete an analysis and return its original filename.

        Args:
            analysis_id: The analysis identifier

        Returns:
            Original filename if deleted, None if not found
        """
        with self.get_connection() as conn:
            row = conn.execute(
                'SELECT original_filename FROM analyses WHERE id = ?', (analysis_id,)
            ).fetchone()

            if not row:
                return None

            original_filename = row['original_filename']

            # Delete cascades to related tables
            conn.execute('DELETE FROM analyses WHERE id = ?', (analysis_id,))

            return original_filename

    def analysis_exists(self, analysis_id: str) -> bool:
        """Check if an analysis exists.

        Args:
            analysis_id: The analysis identifier

        Returns:
            True if exists
        """
        with self.get_connection() as conn:
            row = conn.execute(
                'SELECT 1 FROM analyses WHERE id = ?', (analysis_id,)
            ).fetchone()
            return row is not None

    # Job management methods for background processing
    def create_job(self, job_id: str, filename: str) -> None:
        """Create a new processing job."""
        with self.get_connection() as conn:
            conn.execute(
                'INSERT INTO processing_jobs (id, filename, status) VALUES (?, ?, ?)',
                (job_id, filename, 'pending')
            )

    def update_job_progress(self, job_id: str, progress: int, status: str = 'processing') -> None:
        """Update job progress."""
        with self.get_connection() as conn:
            conn.execute(
                'UPDATE processing_jobs SET progress = ?, status = ? WHERE id = ?',
                (progress, status, job_id)
            )

    def complete_job(self, job_id: str, analysis_id: str) -> None:
        """Mark job as complete with analysis ID."""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE processing_jobs
                SET status = 'completed', analysis_id = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (analysis_id, job_id))

    def fail_job(self, job_id: str, error_message: str) -> None:
        """Mark job as failed with error message."""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE processing_jobs
                SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (error_message, job_id))

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status."""
        with self.get_connection() as conn:
            row = conn.execute(
                'SELECT * FROM processing_jobs WHERE id = ?', (job_id,)
            ).fetchone()

            if not row:
                return None

            return {
                'id': row['id'],
                'analysis_id': row['analysis_id'],
                'filename': row['filename'],
                'status': row['status'],
                'progress': row['progress'],
                'error_message': row['error_message'],
                'created_at': row['created_at'],
                'completed_at': row['completed_at']
            }


def migrate_json_to_sqlite(db: Database, history_file: str, processed_folder: str) -> int:
    """Migrate existing JSON data to SQLite.

    Args:
        db: Database instance
        history_file: Path to history.json
        processed_folder: Path to processed JSON files folder

    Returns:
        Number of analyses migrated
    """
    if not os.path.exists(history_file):
        return 0

    with open(history_file, 'r') as f:
        history = json.load(f)

    migrated = 0
    for entry in history:
        analysis_id = entry.get('id')
        if not analysis_id:
            continue

        # Skip if already migrated
        if db.analysis_exists(analysis_id):
            continue

        # Load processed result
        result_path = os.path.join(processed_folder, f"{analysis_id}.json")
        if not os.path.exists(result_path):
            continue

        try:
            with open(result_path, 'r') as f:
                result = json.load(f)

            db.save_analysis(analysis_id, result)
            migrated += 1
        except Exception as e:
            print(f"Failed to migrate {analysis_id}: {e}")

    return migrated
