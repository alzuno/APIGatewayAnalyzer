# GPS Telemetry Analyzer

A powerful web application for analyzing GPS telemetry JSON logs, visualizing device routes, and generating quality scorecards.

![Dashboard](https://raw.githubusercontent.com/username/repo/main/docs/dashboard.png)
*(Note: Replace with your actual screenshot URL or local path for internal use)*

## Features

*   **📊 Comprehensive Scorecards**: Analyze device performance with metrics like Odometer accuracy, CAN Bus stability, and Event quality.
*   **🗺️ Interactive Maps**:
    *   **Auto-Zoom**: Automatically focuses on the selected device's route.
    *   **Smart Themes**: Map tiles adapt to System/Light/Dark mode preferences.
    *   **Path Visualization**: Full route plotting for individual devices.
*   **🌓 Theme Support**: Built-in Dark and Light modes with "Auto" system detection.
*   **📂 Data Management**:
    *   **Drag & Drop Upload**: Easy JSON processing.
    *   **Persistent History**: Access past reports anytime.
    *   **CSV Export**: Download raw data for external analysis.
*   **🐳 Docker Ready**: Containerized for easy deployment and persistence.

## 🚀 Getting Started

### Prerequisites

*   **Docker** and **Docker Compose** installed on your machine.

### running Locally (Development)

1.  Clone the repository:
    ```bash
    git clone https://github.com/YOUR_USERNAME/gps-analyzer.git
    cd gps-analyzer
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
4.  The image will be pulled automatically from `ghcr.io/YOUR_USERNAME/gps-analyzer:latest`.

### GitHub Actions (CI/CD)
This repository includes a workflow in `.github/workflows/publish.yml` that automatically builds and publishes the Docker image to **GitHub Container Registry (GHCR)** whenever you push to `main` or create a release tag (e.g., `v1.0`).

---

## 🛠️ Project Structure

```
gps-analyzer/
├── app.py                  # Main Flask Application
├── Dockerfile             # Docker build instruction
├── docker-compose.yml     # Local development config
├── docker-compose.prod.yml # Production config
├── requirements.txt       # Python dependencies
├── static/                # Frontend assets (CSS, JS)
├── templates/             # HTML templates
├── .github/               # CI/CD Workflows
└── data/                  # (Created at runtime) Persistent storage
```
