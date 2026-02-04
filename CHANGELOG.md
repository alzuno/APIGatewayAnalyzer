# Changelog

All notable changes to this project will be documented in this file.

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
