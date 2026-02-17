/**
 * GPS Analyzer - Main Application Module
 * Initializes the namespace and manages application state
 */
window.GPSAnalyzer = window.GPSAnalyzer || {};

(function(app) {
    'use strict';

    // Application State
    app.state = {
        currentData: null,
        currentAnalysisId: null,
        selectedImei: 'all',
        currentTheme: localStorage.getItem('theme') || 'auto',
        currentLang: localStorage.getItem('lang') || 'en',
        rawPage: 1,
        rawPerPage: 100,
        rawPages: 1,
        rawTotal: 0,
        tableSorts: {
            'scorecard-table': { column: null, dir: null },
            'stats-table': { column: null, dir: null }
        }
    };

    // DOM Element References
    app.elements = {};

    // Chart instances
    app.charts = {
        scoreChart: null,
        eventChart: null
    };

    // Map instances
    app.map = {
        instance: null,
        markers: [],
        polyline: null
    };

    // Constants
    app.THEMES = ['auto', 'light', 'dark'];

    /**
     * Initialize the application
     */
    app.init = function() {
        // Cache DOM elements
        app.elements = {
            uploadZone: document.getElementById('upload-zone'),
            fileInput: document.getElementById('file-input'),
            historyList: document.getElementById('history-list'),
            dashboard: document.getElementById('dashboard'),
            emptyState: document.getElementById('empty-state'),
            loader: document.getElementById('loader'),
            imeiFilter: document.getElementById('imei-filter'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            mainContent: document.getElementById('main-content'),
            sidebar: document.querySelector('.sidebar'),
            exportBtn: document.getElementById('export-btn'),
            themeBtn: document.getElementById('theme-toggle'),
            langBtn: document.getElementById('lang-toggle')
        };

        // Initialize modules
        app.theme.init();
        app.localization.init();
        app.api.init();

        // Setup event listeners
        setupEventListeners();

        // Load initial data
        app.api.loadHistory();
    };

    /**
     * Setup global event listeners
     */
    function setupEventListeners() {
        // Sidebar toggle
        app.elements.sidebarToggle.onclick = () => {
            app.elements.sidebar.classList.toggle('collapsed');
            setTimeout(() => {
                if (app.map.instance) app.map.instance.invalidateSize();
            }, 350);
        };

        // Export CSV
        app.elements.exportBtn.onclick = app.tables.exportCSV;

        // File upload
        app.elements.uploadZone.onclick = () => app.elements.fileInput.click();

        app.elements.uploadZone.ondragover = (e) => {
            e.preventDefault();
            app.elements.uploadZone.classList.add('drag-over');
        };

        app.elements.uploadZone.ondragleave = () => {
            app.elements.uploadZone.classList.remove('drag-over');
        };

        app.elements.uploadZone.ondrop = (e) => {
            e.preventDefault();
            app.elements.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                app.api.handleFileUpload(e.dataTransfer.files[0]);
            }
        };

        app.elements.fileInput.onchange = (e) => {
            if (e.target.files.length) {
                app.api.handleFileUpload(e.target.files[0]);
            }
        };

        // IMEI filter
        app.elements.imeiFilter.onchange = (e) => {
            app.state.selectedImei = e.target.value;
            app.updateDashboardView();
        };

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');

                if (btn.dataset.tab === 'map' && app.map.instance) {
                    setTimeout(() => {
                        app.map.instance.invalidateSize();
                    }, 100);
                }
            };
        });

        // Search setup
        app.tables.setupSearch('search-scorecard', 'scorecard-table');
        app.tables.setupSearch('search-stats', 'stats-table');
    }

    /**
     * Update dashboard view based on current filter
     */
    app.updateDashboardView = function() {
        if (!app.state.currentData) return;

        let filteredScorecard = app.state.currentData.scorecard || [];
        let filteredStats = app.state.currentData.scorecard || [];

        if (app.state.selectedImei !== 'all') {
            filteredScorecard = filteredScorecard.filter(r => r.imei === app.state.selectedImei);
            filteredStats = filteredStats.filter(r => r.imei === app.state.selectedImei);
        }

        // Update KPIs
        if (app.state.selectedImei === 'all') {
            document.getElementById('kpi-score').textContent = app.state.currentData.summary.average_quality_score;
            document.getElementById('kpi-devices').textContent = app.state.currentData.summary.total_devices;
            document.getElementById('kpi-records').textContent = app.state.currentData.summary.total_records.toLocaleString();
            document.getElementById('kpi-distance').textContent = app.state.currentData.summary.total_distance_km.toLocaleString();
        } else {
            const stat = filteredStats[0] || {};
            const sc = filteredScorecard[0] || {};
            document.getElementById('kpi-score').textContent = sc.Puntaje_Calidad || '--';
            document.getElementById('kpi-devices').textContent = "1";
            document.getElementById('kpi-records').textContent = sc.Total_Reportes || 0;
            document.getElementById('kpi-distance').textContent = stat['Distancia_Recorrida_(KM)']?.toFixed(2) || 0;
        }

        app.chartsModule.render(app.state.currentData, app.state.selectedImei);
        app.tables.renderScorecard(filteredScorecard);
        app.tables.renderStats(filteredStats);

        // Load raw data via paginated API
        if (app.state.currentAnalysisId) {
            app.state.rawPage = 1;
            app.api.loadTelemetryPage(
                app.state.currentAnalysisId,
                app.state.rawPage,
                app.state.rawPerPage,
                app.state.selectedImei
            );
        }

        // Map is rendered by loadTelemetryPage after data arrives
    };

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', app.init);

})(window.GPSAnalyzer);
