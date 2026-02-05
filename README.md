# GPS Telemetry Analyzer

A powerful web application for analyzing GPS telemetry JSON logs, visualizing device routes, and generating quality scorecards.

![Dashboard](https://raw.githubusercontent.com/alzuno/APIGatewayAnalyzer/main/docs/dashboard.png)

## Features

*   **📊 Comprehensive Scorecards**: Analyze device performance with metrics like Odometer accuracy, CAN Bus stability, and Event quality.
*   **🌍 Localization**: Toggle between **English** and **Spanish** instantly.
*   **🗺️ Interactive Map**:
    *   **Auto-Zoom**: Automatically focuses on the selected device's route.
    *   **Event Markers**: Color-coded pins for Ignition On/Off, Harsh Behavior, and SOS events.
    *   **Smart Themes**: Map tiles adapt to System/Light/Dark mode preferences.
    *   **Path Visualization**: Full route plotting for individual devices.
*   **📋 Enhanced Tables**:
    *   **Sortable Columns**: Click any header to sort data ascending/descending.
    *   **Clickable IMEIs**: Filter dashboard instantly by clicking device identifiers.
*   **🌓 Theme Support**: Built-in Dark and Light modes with "Auto" system detection.
*   **📂 Data Management**:
    *   **Drag & Drop Upload**: Easy JSON processing.
    *   **Editable History**: Rename past reports inline.
    *   **Persistent History**: Access past reports anytime.
    *   **CSV Export**: Download raw data for external analysis.
*   **🐳 Docker Ready**: Containerized for easy deployment and persistence.
*   **🔧 Technical Features** (v3.0):
    *   **SQLite Database**: Fast, reliable storage replacing JSON files.
    *   **Background Processing**: Large files (>10MB) process asynchronously with real-time progress.
    *   **API Documentation**: Swagger UI at `/api/docs`.
    *   **Logging**: Rotating file logs at `data/logs/app.log`.
    *   **Test Suite**: 42 pytest tests for core functionality.

## Key Capabilities

- **v3.0 Technical Improvements**: SQLite database, async processing, Swagger API docs, test suite, modular frontend.
- **v2.3 UX Enhancements**: Table sorting, clickable IMEIs, editable history names, and map event pins.
- **v2.1 Forensic Intelligence**: Advanced detection of frozen RPM, static Temperature, and static Speed data.
- **v2.0 Forensic Scorecard**: Deep analysis of Odometer quality (frozen/decreasing) and CAN Bus completeness (6 nodes).
- **GPS Event Bar Chart**: Real-time breakdown of Ignition, Harsh Driving, and SOS events.
- **Driver ID Tracking**: Integrated view of driver identities in statistics and scorecard.
- **Data Quality Radar**: Visualizes API completeness for the entire device fleet.

## 🚀 Getting Started

### Prerequisites

*   **Docker** and **Docker Compose** installed on your machine.

### running Locally (Development)

1.  Clone the repository:
    ```bash
    git clone https://github.com/alzuno/APIGatewayAnalyzer.git
    cd APIGatewayAnalyzer
    ```

2.  Start with Docker Compose:
    ```bash
    docker-compose up --build
    ```

3.  Open your browser at **[http://localhost:8000](http://localhost:8000)**.

### 💾 Data Persistence

All your uploaded files and history logs are stored in the local `data/` directory, which is mounted to the container. This ensures your data survives container restarts.

---

## 📦 Production Deployment

To run this application on a production server, you **do not** need the source code. You only need the `docker-compose.prod.yml` file.

1.  **Copy the file**: Copy `docker-compose.prod.yml` to your server.
2.  **Rename (Optional)**: Rename it to `docker-compose.yml` for convenience.
3.  **Run**:
    ```bash
    # If strictly using prod file
    docker-compose -f docker-compose.prod.yml up -d
    ```
4.  The image will be pulled automatically from `ghcr.io/alzuno/APIGatewayAnalyzer:latest`.

### GitHub Actions (CI/CD)
This repository includes a workflow in `.github/workflows/publish.yml` that automatically builds and publishes the Docker image to **GitHub Container Registry (GHCR)** whenever you push to `main` or create a release tag (e.g., `v1.0`).

## 📜 Version History
See [CHANGELOG.md](CHANGELOG.md) for details.

*   **v3.0.2**: Fix Flask-RESTX route registration order.
*   **v3.0.1**: Fix Render deployment (PORT env var) and Flask-RESTX route handling.
*   **v3.0.0**: SQLite database, background processing, Swagger API docs, test suite.
*   **v2.3.0**: Table sorting, clickable IMEIs, editable history, map event pins.
*   **v2.0.0**: Forensic Scorecard with CAN Bus and Odometer analysis.
*   **v1.1.0**: Localization (EN/ES) & Advanced Data Quality Analytics.
*   **v1.0.0**: Docker Support & Theme System.

---

## 🛠️ Project Structure

```
APIGatewayAnalyzer/
├── app.py                  # Main Flask Application with Flask-RESTX API
├── database.py             # SQLite database access layer
├── worker.py               # Background processing worker
├── schema.sql              # Database schema
├── Dockerfile              # Docker build instruction
├── docker-compose.yml      # Local development config
├── docker-compose.prod.yml # Production config
├── requirements.txt        # Python dependencies
├── requirements-dev.txt    # Development dependencies (pytest)
├── pytest.ini              # Test configuration
├── static/
│   ├── style.css           # Styles with skeleton loaders
│   ├── script.js           # Legacy script (kept for reference)
│   ├── translations.js     # EN/ES translations
│   └── js/                 # Modular JavaScript
│       ├── app.js          # Main application
│       ├── api.js          # API communication
│       ├── charts.js       # Chart rendering
│       ├── localization.js # i18n module
│       ├── map.js          # Map rendering
│       ├── tables.js       # Table rendering
│       ├── theme.js        # Theme management
│       └── utils.js        # Utility functions
├── templates/              # HTML templates
├── tests/                  # Pytest test suite
│   ├── conftest.py         # Test fixtures
│   ├── test_normalization.py
│   ├── test_sanitization.py
│   ├── test_scoring.py
│   └── fixtures/           # Test data
├── .github/                # CI/CD Workflows
└── data/                   # (Created at runtime)
    ├── uploads/            # Uploaded JSON files
    ├── processed/          # Legacy processed JSON (migrated to SQLite)
    ├── logs/               # Application logs
    └── telemetry.db        # SQLite database
```
