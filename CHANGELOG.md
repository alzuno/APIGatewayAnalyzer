# Changelog

All notable changes to this project will be documented in this file.

## [3.2.1] - 2026-02-17
### Fixed
- **Stratified raw data sampling**: Raw telemetry sample now distributes rows proportionally across all devices instead of taking the first 2000 rows globally. This ensures every device has representative data when filtering by device in the dashboard.

## [3.2.0] - 2026-02-13
### Added
- **User Manual**: Comprehensive `USER_MANUAL.md` covering installation, usage, scorecard metrics, API reference, and troubleshooting.

### Changed
- **Non-root Docker Container**: The Docker image now runs as a non-root user (`appuser`) for improved security. Added `--root-user-action=ignore` to suppress pip warnings during build.

### Removed
- **Legacy `static/script.js`**: Deleted the 1,182-line monolithic script superseded by 8 modular JS files in `static/js/`.

## [3.1.0] - 2026-02-13
### Changed
- **Removed Authentication System**: Rolled back the auth system (login, 2FA, admin panel) introduced in v3.0.2–v3.0.6. The application is now open-access as it was in v3.0.1.

### Security
- **Updated gunicorn** to 25.0.3 (from 21.2.0) to fix known vulnerabilities.
- **Updated pip, setuptools, wheel** in Docker build for security.

## [3.0.1] - 2026-02-05
### Fixed
- **Render Deployment**: Use `PORT` environment variable for Gunicorn binding (Render assigns dynamic ports).
- **Flask-RESTX Route Handling**: Added `catch_all_404s=False` to allow regular Flask routes (`/`) to work alongside API routes.

## [3.0.0] - 2026-02-05
### Added
- **Logging System**: Rotating file logger with 10MB max size and 5 backups at `data/logs/app.log`.
- **File Size Limit**: Configurable upload limit via `MAX_UPLOAD_SIZE_MB` environment variable (default: 100MB).
- **Skeleton Loaders**: Visual loading placeholders for better UX during file processing.
- **Test Suite**: 42 pytest tests covering event normalization, JSON sanitization, and scoring logic.
- **API Documentation**: Swagger UI available at `/api/docs` via Flask-RESTX.
- **SQLite Database**: Migrated from JSON files to SQLite for better performance and reliability.
  - Auto-migration of existing JSON data on startup
  - Backup created at `history.json.backup`
- **Background Processing**: Large files (>10MB) processed asynchronously with real-time progress via Server-Sent Events.
  - New endpoints: `GET /api/job/<id>` and `GET /api/job/<id>/progress`
  - Returns 202 Accepted for async jobs with job_id
- **Modular Frontend**: Split `script.js` into 8 modules using `window.GPSAnalyzer` namespace:
  - `app.js` - Main application state
  - `utils.js` - Loader and skeleton functions
  - `theme.js` - Theme management
  - `localization.js` - EN/ES translations
  - `api.js` - API communication
  - `charts.js` - Chart.js rendering
  - `tables.js` - Table rendering and sorting
  - `map.js` - Leaflet map rendering

### Changed
- **Exception Handling**: Replaced 4 bare `except:` blocks with proper logging.
- **API Structure**: Endpoints now use Flask-RESTX Resource classes with full documentation.

### New Files
- `database.py` - SQLite access layer
- `schema.sql` - Database schema (6 tables)
- `worker.py` - Background processing worker
- `pytest.ini` - Test configuration
- `requirements-dev.txt` - Development dependencies
- `tests/` - Test directory with fixtures
- `static/js/` - 8 modular JavaScript files

## [2.3.0] - 2026-02-04
### Added
- **Version Display**: Version number now visible in the top bar for easy reference.
- **Table Sorting**: Click any column header in Scorecard and Statistics tables to sort ascending/descending.
- **Clickable IMEI Links**: IMEI values in tables are now clickable to instantly filter the dashboard for that device.
- **History Name Editing**: Edit history item names inline by clicking the edit icon.
- **Map Event Markers**: Events (Ignition On/Off, Harsh Behavior, SOS) now appear as color-coded pins on the map with detailed popups.
  - 🟢 Green: Ignition On
  - 🔴 Red: Ignition Off
  - ⚠️ Orange: Harsh Behavior (Breaking, Acceleration, Turn)
  - 🆘 Dark Red: SOS Events

### Fixed
- **Table Sorting Toggle**: Fixed a bug where table columns could only be sorted once; they now correctly toggle between ascending and descending order on subsequent clicks.

### Improved
- **File Cleanup**: Deleting a history record now removes all associated files from uploads and processed directories.
- **User Experience**: Enhanced table interactivity and visual feedback.

## [2.2.0] - 2026-02-04
### Fixed
- **System Stability**: Implemented automatic state reset (filters, search, tabs) when loading new files or history records.
- **Map Usability**: Improved map auto-centering and bounds fitting when switching between vehicles or tabs.
- **UI Consistency**: Search fields and IMEI filters are now cleared correctly during fresh data loads.

## [2.1.0] - 2026-02-01
### Added
- **Forensic Sensor Validation**: Detects frozen RPM, static Temperature, and static Speed data.
- **Event Mapping Fix**: Normalized raw event codes to human-readable labels, fixing the empty "GPS Event Breakdown" chart.
- **Driver ID Integration**: `driverId` is now visible in both Scorecard and Statistics tables.
- **Improved Scorecard Documentation**: Updated with details on forensic penalties.

## [2.0.0] - 2026-02-01
### Added
- **Forensic Scorecard**: New scoring algorithm focusing on Odometer Integrity, CAN Bus completeness, and GPS quality.
- **Deep CAN Bus Tracking**: Monitors 6 specific sensors: RPM, Speed, Temp, Distance, Fuel Level, and Total Fuel.
- **GPS Event Breakdown**: Vertical bar chart tracking specific alerts (Ignition, Harsh Breaking/Accel/Turn, SOS).
- **Advanced Statistics**: Expanded tables with latency, Ignition balance, and Min/Max sensor values.
- **Scorecard.md**: Detailed technical documentation on how scores are calculated.
- **Lat/Lng Variation Validation**: Detects "Frozen Odometer" scenarios.

## [1.1.0] - 2026-02-01

### Added
*   **Localization**: Full English/Spanish support with a new language toggle.
*   **Advanced Analytics**:
    *   **Data Quality Radar**: New visualization to assess the completeness of telemetry data (GPS, Ignition, Fuel, Odometer, RPM).
    *   **Event Breakdown**: Dedicated chart for analyzing device alerts.
    *   **Backend Scoring**: Enhanced algorithm that heavily weights API-specific fields like `ignitionOn` and `quality`.

### Changed
*   **Charts**: Replaced generic Histogram with Radar Chart.
*   **UI**: Updated dashboard layout to support chart titles translations.

## [1.0.0] - 2026-01-31

### Added
*   **Docker Support**: Initial containerization with `Dockerfile` and `docker-compose`.
*   **Theme Support**: Dark/Light/Auto modes with persistence.
*   **Persistence**: Local storage mapping for uploads and history.
