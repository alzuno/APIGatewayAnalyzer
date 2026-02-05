/**
 * GPS Analyzer - Utils Module
 * Utility functions for loaders, skeletons, etc.
 */
(function(app) {
    'use strict';

    app.utils = app.utils || {};

    /**
     * Show/hide the loader overlay
     */
    app.utils.showLoader = function(show) {
        if (show) {
            app.elements.loader.classList.remove('hidden');
        } else {
            app.elements.loader.classList.add('hidden');
        }
    };

    /**
     * Show skeleton loaders
     */
    app.utils.showSkeletons = function() {
        // Show dashboard with skeleton placeholders
        app.elements.emptyState.classList.add('hidden');
        app.elements.dashboard.classList.remove('hidden');

        // KPI skeletons
        document.querySelectorAll('.kpi-card .value').forEach(el => {
            el.dataset.originalContent = el.textContent;
            el.innerHTML = '<div class="skeleton skeleton-text short"></div>';
        });

        // Chart skeletons
        document.querySelectorAll('.chart-card canvas').forEach(canvas => {
            canvas.style.display = 'none';
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton skeleton-chart';
            skeleton.dataset.skeletonFor = canvas.id;
            canvas.parentElement.appendChild(skeleton);
        });

        // Table skeletons
        document.querySelectorAll('.table-container tbody').forEach(tbody => {
            tbody.innerHTML = Array(5).fill(0).map(() =>
                `<tr><td colspan="12"><div class="skeleton skeleton-row"></div></td></tr>`
            ).join('');
        });
    };

    /**
     * Hide skeleton loaders
     */
    app.utils.hideSkeletons = function() {
        // Restore KPI values
        document.querySelectorAll('.kpi-card .value').forEach(el => {
            if (el.dataset.originalContent) {
                el.textContent = el.dataset.originalContent;
                delete el.dataset.originalContent;
            }
        });

        // Remove chart skeletons and show canvases
        document.querySelectorAll('.skeleton-chart').forEach(skeleton => {
            skeleton.remove();
        });
        document.querySelectorAll('.chart-card canvas').forEach(canvas => {
            canvas.style.display = '';
        });
    };

})(window.GPSAnalyzer);
