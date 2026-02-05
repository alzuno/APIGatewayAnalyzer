# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GPS Telemetry Analyzer - A Flask web application for analyzing GPS telemetry JSON logs from vehicle tracking systems. Processes large JSON datasets, calculates device quality scorecards, and visualizes routes on interactive maps.

## Development Commands

```bash
# Local development with Docker (recommended)
docker-compose up --build        # Runs on localhost:8000

# Local development without Docker
pip install -r requirements.txt
python app.py                    # Flask dev server on port 8000

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## Architecture

**Stack:** Python 3.11 + Flask backend, vanilla JavaScript frontend (no build step)

**Key Files:**
- `app.py` - Flask application with all API endpoints and data processing logic
- `static/script.js` - Single 1000-line JS file handling all frontend logic
- `static/style.css` - Dual-theme CSS (dark/light modes)
- `static/translations.js` - EN/ES localization strings
- `templates/index.html` - Single page application template

**API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload` | Process uploaded JSON telemetry file |
| GET | `/api/history` | List past analyses |
| GET | `/api/result/<id>` | Retrieve cached analysis |
| DELETE | `/api/history/<id>` | Delete analysis and files |
| PATCH | `/api/history/<id>` | Rename history entry |

**Data Flow:**
1. User uploads JSON → Flask saves to `data/uploads/`
2. `process_log_data()` extracts nested telemetry, normalizes events, calculates metrics
3. Results saved to `data/processed/<uuid>.json`
4. Metadata tracked in `data/history.json`
5. Frontend renders dashboard with charts (Chart.js) and map (Leaflet)

## Key Backend Patterns

**Nested JSON Extraction:** Handles complex pub/sub message format:
```
json_payload → data → AdditionalInformation → Arguments → message
```
Falls back to Unicode escape decoding for malformed strings.

**Data Sanitization:** `sanitize_for_json()` handles NaN/Inf values to prevent JSON serialization errors.

**Scoring Algorithm (see Scorecard.md):**
- 35% CAN Bus completeness (6 fields)
- 25% Odometer quality (frozen/decreasing detection)
- 20% GPS integrity
- 10% Latency
- 10% Event consistency
- Forensic penalties: -15 (frozen RPM), -10 (static temp/speed)

## Key Frontend Patterns

**State:** Global `currentData` holds API response, `selectedImei` tracks active device filter

**Theme System:** Three modes (auto/light/dark), persisted to localStorage, updates chart colors and map tiles

**Localization:** EN/ES toggle with `translations` object, persisted to localStorage

## Data Directory Structure (Runtime)

```
data/
├── uploads/      # Raw uploaded JSON files
├── processed/    # UUID-based analysis result JSON files
└── history.json  # Metadata for all past analyses
```
