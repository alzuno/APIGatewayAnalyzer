# Changelog

All notable changes to this project will be documented in this file.

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
