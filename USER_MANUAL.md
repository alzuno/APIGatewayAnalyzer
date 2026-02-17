# GPS Telemetry Analyzer - User Manual

**Version 3.2.1** | Last updated: 2026-02-17

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Requirements](#2-system-requirements)
3. [Installation](#3-installation)
4. [Uploading & Analyzing Data](#4-uploading--analyzing-data)
5. [Dashboard Guide](#5-dashboard-guide)
6. [Scorecard Metrics](#6-scorecard-metrics)
7. [Features](#7-features)
8. [API Reference](#8-api-reference)
9. [Configuration](#9-configuration)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introduction

GPS Telemetry Analyzer is a web application for analyzing GPS telemetry JSON logs from vehicle tracking systems. It processes large JSON datasets, calculates device quality scorecards, and visualizes vehicle routes on interactive maps.

Key capabilities:
- Process raw telemetry JSON logs with nested pub/sub message formats
- Generate quality scorecards for each tracked device (IMEI)
- Visualize routes, events, and sensor data on interactive maps and charts
- Detect data anomalies such as frozen sensors, odometer inconsistencies, and GPS quality issues
- Export analysis results as CSV for external use

---

## 2. System Requirements

### Docker (Recommended)
- Docker Engine 20.10+
- Docker Compose v2+
- 512 MB RAM minimum (1 GB recommended for large files)

### Manual Installation
- Python 3.11+
- pip
- A modern web browser (Chrome, Firefox, Safari, Edge)

---

## 3. Installation

### Option A: Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/alzuno/APIGatewayAnalyzer.git
   cd APIGatewayAnalyzer
   ```

2. Start the application:
   ```bash
   docker-compose up --build
   ```

3. Open your browser at **http://localhost:8000**.

Data is persisted in the `./data/` directory, which is mounted into the container. Your uploads and analysis history survive container restarts.

### Option B: Manual (Without Docker)

1. Clone the repository:
   ```bash
   git clone https://github.com/alzuno/APIGatewayAnalyzer.git
   cd APIGatewayAnalyzer
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the Flask development server:
   ```bash
   python app.py
   ```

4. Open your browser at **http://localhost:8000**.

### Option C: Production Deployment

For production servers, use the pre-built Docker image from GitHub Container Registry:

1. Copy `docker-compose.prod.yml` to your server.

2. Run:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

The image is pulled automatically from `ghcr.io/alzuno/APIGatewayAnalyzer:latest`.

---

## 4. Uploading & Analyzing Data

### Supported Format

The application accepts JSON files containing GPS telemetry logs. The expected format is an array of log entries with nested payloads following this structure:

```
jsonPayload > data > AdditionalInformation > Arguments > message
```

Each telemetry point should contain fields such as `imei`, `time`, `lat`, `lng`, `speed`, `addOns` (with `mileage`, `ignitionOn`, `canbus` data), and `event`.

### How to Upload

1. **Drag and drop** a `.json` file onto the upload area in the top bar, or **click** the upload area to browse for a file.
2. The application processes the file and displays the analysis dashboard.

### Large File Processing

- Files **under 10 MB** are processed synchronously. Results appear immediately.
- Files **over 10 MB** are processed in the background. A progress bar shows real-time processing status via Server-Sent Events (SSE). You can continue using the application while processing completes.

### File Size Limit

The default maximum upload size is **100 MB**. This can be configured via the `MAX_UPLOAD_SIZE_MB` environment variable (see [Configuration](#9-configuration)).

---

## 5. Dashboard Guide

After uploading a file, the dashboard displays the following sections:

### KPI Cards

Four summary cards at the top of the dashboard:
- **Quality Score**: Average quality score across all devices (0-100)
- **Devices**: Number of unique devices (IMEIs) found in the data
- **Total Records**: Total number of telemetry data points processed
- **Distance (km)**: Total distance traveled across all devices

### Charts

#### Quality Score Distribution (Radar Chart)
Displays data quality dimensions across the entire fleet:
- GPS Validity
- Ignition Data
- Latency (< 60s)
- RPM, Speed, Temperature, Distance, Fuel sensors

#### Event Types (Bar Chart)
Breakdown of GPS events detected:
- Ignition On / Ignition Off
- Harsh Breaking / Harsh Acceleration / Harsh Turn
- SOS Events

### Tabs

#### Scorecard Tab
A detailed quality scorecard for each device with columns including:
- IMEI, Quality Score, Total Reports, Average Delay
- Odometer Quality, CAN Bus Completeness, GPS Integrity
- Ignition Balance, Harsh Events, Frozen Sensors
- Driver ID

Click any IMEI to filter the entire dashboard to that device.

#### Statistics Tab
Operational statistics per device:
- First/Last Report timestamps
- Initial/Final Kilometers, Distance Traveled
- Average/Max Speed, Average RPM
- Average Fuel Level

#### Map View Tab
Interactive Leaflet map showing:
- **Route lines** for each device
- **Event markers** with color-coded pins:
  - Green: Ignition On
  - Red: Ignition Off
  - Orange: Harsh Behavior (Breaking, Acceleration, Turn)
  - Dark Red: SOS Events
- Click markers for detailed popup information
- Auto-zoom to the selected device's route

#### Raw Data Tab
A scrollable table showing up to 2,000 raw telemetry data points with all extracted fields.

---

## 6. Scorecard Metrics

The quality score for each device is a weighted average of five components, scored on a 0-100 scale, with forensic penalties applied at the end.

### Weighted Components

| Component | Weight | Description |
|-----------|--------|-------------|
| **CAN Bus Completeness** | 35% | Percentage of 6 core CAN Bus fields present: `engineRPM`, `vehicleSpeed`, `engineCoolantTemperature`, `totalDistance`, `totalFuelUsed`, `fuelLevelInput` |
| **Odometer Quality** | 25% | Detects decreasing mileage values and frozen odometer (GPS position changes but mileage stays static) |
| **GPS Integrity** | 20% | Percentage of records with GPS `quality` field equal to "Good" |
| **Latency** | 10% | Average delay between data generation and receipt. Full score if under 30 seconds; linear drop to zero at 300 seconds |
| **Event Consistency** | 10% | Balance between Ignition On and Ignition Off events. Ideal is a difference of 0 or 1 |

### Forensic Penalties

These penalties are subtracted from the weighted score:

| Penalty | Points | Trigger |
|---------|--------|---------|
| **Frozen RPM** | -15 | Device reports ignition ON and speed > 0, but `engineRPM` is zero or never changes |
| **Static Temperature** | -10 | `engineCoolantTemperature` is reported but never varies across 10+ records |

### Final Score

```
Final Score = (CAN Bus * 0.35 + Odometer * 0.25 + GPS * 0.20 + Latency * 0.10 + Events * 0.10)
              - Frozen RPM Penalty - Static Temp Penalty - Abnormal RPM Penalty
```

The result is clipped to a minimum of 0.

---

## 7. Features

### Device Filtering
- Use the **IMEI dropdown** in the dashboard header to filter all charts, tables, and the map to a specific device.
- Click any **IMEI link** in the Scorecard or Statistics tables to apply the filter instantly.

### Theme Support
Three display modes, toggled via the moon/sun icon in the top bar:
- **Auto**: Follows your operating system preference
- **Light**: Light background with dark text
- **Dark**: Dark background with light text

Your preference is saved to the browser's local storage.

### Language (EN/ES)
Toggle between **English** and **Spanish** using the language button in the top bar. All labels, headers, and descriptions update immediately. Your preference is saved to local storage.

### CSV Export
Click the **Export CSV** button to download the current scorecard data as a comma-separated values file for use in Excel or other tools.

### History Management
- All processed analyses are saved to the sidebar history.
- Click any history entry to reload that analysis.
- **Rename**: Click the edit icon next to a history entry to change its display name.
- **Delete**: Click the delete icon to permanently remove an analysis and its associated uploaded file.

### Table Sorting
Click any column header in the Scorecard or Statistics tables to sort the data. Click again to toggle between ascending and descending order.

---

## 8. API Reference

The application exposes a RESTful API. Full interactive documentation is available at `/api/docs` (Swagger UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload and process a JSON telemetry log file. Returns 200 for sync results, 202 for async (large files) |
| `GET` | `/api/history` | List all past analyses |
| `GET` | `/api/result/<id>` | Retrieve a specific analysis result by ID |
| `DELETE` | `/api/history/<id>` | Delete an analysis and its associated files |
| `PATCH` | `/api/history/<id>` | Rename a history entry (send `{"filename": "new name"}`) |
| `GET` | `/api/job/<job_id>` | Get the status of a background processing job |
| `GET` | `/api/job/<job_id>/progress` | SSE stream for real-time progress updates on a background job |

### Example: Upload a file

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@telemetry_log.json"
```

### Example: List history

```bash
curl http://localhost:8000/api/history
```

---

## 9. Configuration

Configuration is done via environment variables. In Docker, set them in `docker-compose.yml` under the `environment` section.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `.` (local) / `/data` (Docker) | Base directory for uploads, processed files, logs, and the database |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum upload file size in megabytes |
| `PORT` | `8000` | HTTP port for Gunicorn (used by Render and other PaaS platforms) |

### Example: Custom configuration in docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "9000:9000"
    environment:
      - MAX_UPLOAD_SIZE_MB=200
      - PORT=9000
    volumes:
      - ./data:/data
```

---

## 10. Troubleshooting

### File too large error (413)

**Symptom**: Upload fails with "File too large" message.

**Solution**: Increase the `MAX_UPLOAD_SIZE_MB` environment variable. In `docker-compose.yml`:
```yaml
environment:
  - MAX_UPLOAD_SIZE_MB=500
```
Restart the container after changing the value.

### No valid telemetry data found

**Symptom**: Upload succeeds but returns "No valid telemetry data found".

**Cause**: The JSON file does not contain the expected nested structure, or no entries have a valid `imei` field.

**Solution**: Verify your JSON follows the expected pub/sub format:
```
jsonPayload > data > AdditionalInformation > Arguments > message
```
Each telemetry point must include at minimum an `imei` field.

### Docker volume permissions (Linux)

**Symptom**: The application fails to write to the data directory when running on Linux.

**Cause**: The Docker container runs as a non-root user (`appuser`). On Linux, the host `./data` directory may be owned by root.

**Solution**: Set the correct permissions on the host data directory:
```bash
mkdir -p data
chmod 777 data
```
Or match the container user's UID:
```bash
chown -R 999:999 data
```

> **Note**: This issue does not affect Docker Desktop on macOS or Windows, which handle volume permissions transparently.

### Application not loading in browser

**Symptom**: Browser shows connection refused or blank page at http://localhost:8000.

**Solution**:
1. Verify the container is running: `docker-compose ps`
2. Check container logs: `docker-compose logs`
3. Ensure port 8000 is not in use by another application

### Charts or map not rendering

**Symptom**: Dashboard loads but charts appear blank or the map does not display.

**Solution**:
- Ensure your browser is up to date (Chrome, Firefox, Safari, or Edge)
- Check the browser console (F12) for JavaScript errors
- Verify that your network allows loading external resources (Chart.js CDN, Leaflet CDN, OpenStreetMap tiles)
