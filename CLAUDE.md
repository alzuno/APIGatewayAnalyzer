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

# Run tests
pip install -r requirements-dev.txt
pytest -v                        # Run all 42 tests

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## Architecture

**Stack:** Python 3.11 + Flask + Flask-RESTX, vanilla JavaScript frontend (modular, no build step)

**Key Backend Files:**
- `app.py` - Flask application with Flask-RESTX API endpoints
- `database.py` - SQLite database access layer (`Database` class)
- `worker.py` - Background processing for large files (threading + SSE)
- `schema.sql` - Database schema (6 tables)

**Key Frontend Files:**
- `static/js/app.js` - Main application namespace and state
- `static/js/api.js` - API communication and data loading
- `static/js/charts.js` - Chart.js rendering (radar, bar)
- `static/js/tables.js` - Table rendering and sorting
- `static/js/map.js` - Leaflet map rendering
- `static/js/theme.js` - Theme management (auto/light/dark)
- `static/js/localization.js` - EN/ES translations
- `static/js/utils.js` - Loaders and skeleton functions
- `static/style.css` - Dual-theme CSS with skeleton loaders
- `static/translations.js` - Translation strings

**API Endpoints (documented at /api/docs):**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload` | Process uploaded JSON (returns 202 for large files) |
| GET | `/api/history` | List past analyses |
| GET | `/api/result/<id>` | Retrieve analysis result |
| DELETE | `/api/history/<id>` | Delete analysis and files |
| PATCH | `/api/history/<id>` | Rename history entry |
| GET | `/api/job/<id>` | Get background job status |
| GET | `/api/job/<id>/progress` | SSE stream for job progress |

**Data Flow:**
1. User uploads JSON → Flask saves to `data/uploads/`
2. Small files (<10MB): Sync processing via `process_log_data()`
3. Large files (>10MB): Async via `BackgroundWorker`, returns job_id
4. Results saved to SQLite database (`telemetry.db`)
5. Frontend renders dashboard with charts (Chart.js) and map (Leaflet)

## Key Backend Patterns

**Database:** SQLite with 6 tables (analyses, scorecard, data_quality, chart_data, telemetry_data, processing_jobs). Access via `database.py` `Database` class.

**Background Processing:** Files >10MB processed asynchronously via `worker.py`. Progress reported via SSE at `/api/job/<id>/progress`.

**Nested JSON Extraction:** Handles complex pub/sub message format:
```
json_payload → data → AdditionalInformation → Arguments → message
```
Falls back to Unicode escape decoding for malformed strings.

**Data Sanitization:** `sanitize_for_json()` handles NaN/Inf values to prevent JSON serialization errors.

**Logging:** Rotating file handler at `data/logs/app.log` (10MB, 5 backups).

**Scoring Algorithm (see Scorecard.md):**
- 35% CAN Bus completeness (6 fields)
- 25% Odometer quality (frozen/decreasing detection)
- 20% GPS integrity
- 10% Latency
- 10% Event consistency
- Forensic penalties: -15 (frozen RPM), -10 (static temp/speed)

## Key Frontend Patterns

**Namespace:** All modules use `window.GPSAnalyzer` namespace.

**State:** `app.state.currentData` holds API response, `app.state.selectedImei` tracks active device filter.

**Theme System:** Three modes (auto/light/dark), persisted to localStorage, updates chart colors and map tiles.

**Localization:** EN/ES toggle with `translations` object, persisted to localStorage.

**Skeleton Loaders:** `app.utils.showSkeletons()` / `hideSkeletons()` for loading states.

## Testing

42 pytest tests in `tests/` directory:
- `test_normalization.py` - Event type normalization (17 tests)
- `test_sanitization.py` - JSON sanitization (14 tests)
- `test_scoring.py` - Scoring and metrics (11 tests)

Run with: `pytest -v`

## Data Directory Structure (Runtime)

```
data/
├── uploads/       # Raw uploaded JSON files
├── processed/     # Legacy JSON files (migrated to SQLite)
├── logs/          # Application logs (app.log)
├── telemetry.db   # SQLite database
└── history.json.backup  # Backup of migrated JSON history
```

## Version Management

When updating the version, ALL of these must be changed:
1. `app.py` — `version` param in `Api()` constructor
2. `templates/index.html` — version badge in header
3. `CHANGELOG.md` — new version entry
4. `README.md` — version history section

## Commit Conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `security:`
- Always bump the version, even for minor fixes
- Do NOT include `Co-Authored-By:` lines
- Check if documentation (CHANGELOG.md, README.md) needs updating

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `.` (local) / `/data` (Docker) | Base directory for data storage |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum upload file size in MB |
| `PORT` | `8000` | Gunicorn bind port (used by Render) |

## Deployment

Docker image published to `ghcr.io` via GitHub Actions on push to main or `v*.*.*` tags. Render deployments use dynamic `${PORT}` — the Dockerfile CMD must use `${PORT:-8000}`.

**IMPORTANT:** The `@app.route('/')` for index MUST be defined BEFORE `Api()` initialization, otherwise Flask-RESTX swallows it. Use `catch_all_404s=False` in the Api constructor.
