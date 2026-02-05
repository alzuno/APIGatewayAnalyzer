/**
 * GPS Analyzer - Localization Module
 * Handles EN/ES language switching
 */
(function(app) {
    'use strict';

    app.localization = app.localization || {};

    /**
     * Initialize localization module
     */
    app.localization.init = function() {
        app.localization.setLanguage(app.state.currentLang);

        // Language toggle button
        app.elements.langBtn.onclick = () => {
            app.localization.setLanguage(app.state.currentLang === 'en' ? 'es' : 'en');
        };
    };

    /**
     * Set the current language
     */
    app.localization.setLanguage = function(lang) {
        app.state.currentLang = lang;
        localStorage.setItem('lang', lang);
        document.getElementById('lang-text').textContent = lang.toUpperCase();
        app.localization.updateTexts();
    };

    /**
     * Update all translatable text elements
     */
    app.localization.updateTexts = function() {
        const t = translations[app.state.currentLang];

        // Element ID -> Translation Key mapping
        const idMap = {
            'upload-text': 'upload_text',
            'report-title': 'report_title',
            'export-btn': 'export_btn',
            'search-scorecard': 'search_placeholder',
            'search-stats': 'search_placeholder'
        };

        // Update mapped IDs
        for (const [id, key] of Object.entries(idMap)) {
            const el = document.getElementById(id);
            if (!el) continue;

            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = t[key];
            } else if (id === 'export-btn') {
                const icon = el.querySelector('svg').outerHTML;
                el.innerHTML = icon + ' ' + t[key];
            } else {
                el.textContent = t[key];
            }
        }

        // Manual updates for complex selectors
        document.querySelector('.sidebar-header h2').textContent = t.title;
        document.querySelector('.history-section h3').textContent = t.history;
        document.querySelector('#empty-state h2').textContent = t.ready_title;
        document.querySelector('#empty-state p').textContent = t.ready_desc;
        document.querySelector('#loader p').textContent = t.processing;
        document.querySelector('label[for="imei-filter"]').textContent = t.filter_label;
        document.querySelector('#imei-filter option[value="all"]').textContent = t.all_devices;

        // KPIs
        document.querySelector('#kpi-score').parentElement.querySelector('h3').textContent = t.kpi_score;
        document.querySelector('#kpi-devices').parentElement.querySelector('h3').textContent = t.kpi_devices;
        document.querySelector('#kpi-records').parentElement.querySelector('h3').textContent = t.kpi_records;
        document.querySelector('#kpi-distance').parentElement.querySelector('h3').textContent = t.kpi_distance;

        // Chart Titles
        const chartCards = document.querySelectorAll('.chart-card h3');
        if (chartCards.length >= 2) {
            chartCards[0].textContent = t.chart_quality;
            chartCards[1].textContent = t.chart_events;
        }

        // Tabs
        document.querySelector('[data-tab="scorecard"]').textContent = t.tab_scorecard;
        document.querySelector('[data-tab="stats"]').textContent = t.tab_stats;
        document.querySelector('[data-tab="map"]').textContent = t.tab_map;
        document.querySelector('[data-tab="raw"]').textContent = t.tab_raw;

        // Re-render tables if data exists
        if (app.state.currentData) {
            app.tables.renderScorecard(app.state.currentData.scorecard || []);
            app.tables.renderStats(app.state.currentData.scorecard || []);
            app.updateDashboardView();
        }
    };

    /**
     * Get current translation object
     */
    app.localization.t = function() {
        return translations[app.state.currentLang];
    };

})(window.GPSAnalyzer);
