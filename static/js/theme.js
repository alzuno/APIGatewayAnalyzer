/**
 * GPS Analyzer - Theme Module
 * Handles theme switching (auto/light/dark) and updates
 */
(function(app) {
    'use strict';

    app.theme = app.theme || {};

    /**
     * Initialize theme module
     */
    app.theme.init = function() {
        app.theme.apply(app.state.currentTheme);

        // Theme toggle button
        app.elements.themeBtn.onclick = () => {
            const currentIndex = app.THEMES.indexOf(app.state.currentTheme);
            const nextIndex = (currentIndex + 1) % app.THEMES.length;
            app.state.currentTheme = app.THEMES[nextIndex];
            localStorage.setItem('theme', app.state.currentTheme);
            app.theme.apply(app.state.currentTheme);
        };

        // System theme change listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (app.state.currentTheme === 'auto') {
                app.theme.apply('auto');
            }
        });
    };

    /**
     * Get system theme preference
     */
    app.theme.getSystemTheme = function() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    /**
     * Apply theme to the application
     */
    app.theme.apply = function(theme) {
        let effectiveTheme = theme;
        if (theme === 'auto') {
            effectiveTheme = app.theme.getSystemTheme();
        }

        // Apply to DOM
        if (effectiveTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // Update button icon
        app.theme.updateIcon(theme);

        // Update chart colors
        app.theme.updateCharts(effectiveTheme);

        // Update map tiles
        app.theme.updateMap(effectiveTheme);
    };

    /**
     * Update theme toggle icon
     */
    app.theme.updateIcon = function(theme) {
        let iconPath = '';
        if (theme === 'auto') {
            iconPath = '<path d="M20 16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9zm-10 4h4m-2 0v2m0 0h-2m2 0h2" stroke-linecap="round" stroke-linejoin="round"/>';
        } else if (theme === 'light') {
            iconPath = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
            iconPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        app.elements.themeBtn.querySelector('svg').innerHTML = iconPath;
    };

    /**
     * Update chart colors for theme
     */
    app.theme.updateCharts = function(theme) {
        const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
        const gridColor = theme === 'light' ? '#e2e8f0' : '#334155';

        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;

        if (app.charts.scoreChart) app.charts.scoreChart.update();
        if (app.charts.eventChart) app.charts.eventChart.update();
    };

    /**
     * Update map tiles for theme
     */
    app.theme.updateMap = function(theme) {
        if (!app.map.instance) return;

        // Remove existing tile layers
        app.map.instance.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                app.map.instance.removeLayer(layer);
            }
        });

        const tileUrl = theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, {
            attribution: '&copy;OpenStreetMap, &copy;CartoDB'
        }).addTo(app.map.instance);

        // Bring markers to front
        if (app.map.polyline) app.map.polyline.bringToFront();
        app.map.markers.forEach(m => {
            if (m instanceof L.CircleMarker) m.bringToFront();
        });
    };

})(window.GPSAnalyzer);
