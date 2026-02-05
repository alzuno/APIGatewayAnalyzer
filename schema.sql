-- GPS Telemetry Analyzer Database Schema
-- SQLite database schema for storing analysis results

-- Analyses table: stores metadata about each analysis
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    total_devices INTEGER NOT NULL,
    total_records INTEGER NOT NULL,
    total_distance_km REAL NOT NULL,
    average_quality_score REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Scorecard table: stores per-device quality metrics
CREATE TABLE IF NOT EXISTS scorecard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL,
    imei TEXT NOT NULL,
    puntaje_calidad REAL,
    total_reportes INTEGER,
    delay_avg REAL,
    odo_quality_score REAL,
    canbus_completeness REAL,
    gps_integrity REAL,
    ignition_balance INTEGER,
    ignition_on INTEGER,
    ignition_off INTEGER,
    harsh_events INTEGER,
    sos_count INTEGER,
    harsh_breaking INTEGER,
    harsh_acceleration INTEGER,
    harsh_turn INTEGER,
    rpm_anormal_count INTEGER,
    lat_lng_correct_variation TEXT,
    driver_id TEXT,
    frozen_sensors TEXT,
    distancia_recorrida_km REAL,
    km_inicial REAL,
    km_final REAL,
    primer_reporte TEXT,
    ultimo_reporte TEXT,
    velocidad_promedio_kph REAL,
    velocidad_maxima_kph REAL,
    rpm_promedio REAL,
    nivel_combustible_promedio REAL,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

-- Data quality table: stores global radar data
CREATE TABLE IF NOT EXISTS data_quality (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL UNIQUE,
    gps_validity REAL,
    ignition REAL,
    delay REAL,
    rpm REAL,
    speed REAL,
    temp REAL,
    dist REAL,
    fuel REAL,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

-- Chart data table: stores event summaries
CREATE TABLE IF NOT EXISTS chart_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL,
    event_type TEXT,
    count INTEGER,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

-- Raw telemetry sample table: stores sample of raw data points
CREATE TABLE IF NOT EXISTS telemetry_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL,
    imei TEXT,
    time TEXT,
    receive_timestamp TEXT,
    lat REAL,
    lng REAL,
    altitude REAL,
    speed REAL,
    heading REAL,
    last_fix_time TEXT,
    is_moving INTEGER,
    battery_level_percentage REAL,
    report_mode TEXT,
    quality TEXT,
    mileage REAL,
    ignition_on INTEGER,
    external_power_vcc REAL,
    digital_input TEXT,
    driver_id TEXT,
    engine_rpm REAL,
    vehicle_speed REAL,
    engine_coolant_temperature REAL,
    total_distance REAL,
    total_fuel_used REAL,
    fuel_level_input REAL,
    event_type TEXT,
    delay_seconds REAL,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

-- Processing jobs table: for background processing
CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY,
    analysis_id TEXT,
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE SET NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scorecard_analysis ON scorecard(analysis_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_imei ON scorecard(imei);
CREATE INDEX IF NOT EXISTS idx_telemetry_analysis ON telemetry_data(analysis_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_imei ON telemetry_data(imei);
CREATE INDEX IF NOT EXISTS idx_chart_data_analysis ON chart_data(analysis_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
