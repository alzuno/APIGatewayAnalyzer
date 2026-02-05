/**
 * GPS Analyzer - Charts Module
 * Handles chart rendering (radar and bar charts)
 */
(function(app) {
    'use strict';

    app.chartsModule = app.chartsModule || {};

    /**
     * Render charts with data
     */
    app.chartsModule.render = function(data, imei) {
        const ctxScore = document.getElementById('scoreChart').getContext('2d');
        const ctxEvent = document.getElementById('eventChart').getContext('2d');

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        app.theme.updateCharts(isLight ? 'light' : 'dark');

        if (app.charts.scoreChart) app.charts.scoreChart.destroy();
        if (app.charts.eventChart) app.charts.eventChart.destroy();

        // Radar Chart (Data Completeness)
        const dq = data.data_quality;
        const radarLabels = ['GPS', 'Ignition', 'Delay', 'RPM', 'Speed', 'Temp', 'Dist', 'Fuel'];
        const radarData = [
            dq.gps_validity || 0,
            dq.ignition || 0,
            dq.delay || 0,
            dq.rpm || 0,
            dq.speed || 0,
            dq.temp || 0,
            dq.dist || 0,
            dq.fuel || 0
        ];

        app.charts.scoreChart = new Chart(ctxScore, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [{
                    label: 'Complete %',
                    data: radarData,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        angleLines: { color: isLight ? '#e2e8f0' : '#334155' },
                        grid: { color: isLight ? '#e2e8f0' : '#334155' },
                        pointLabels: { color: isLight ? '#475569' : '#94a3b8' },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: { display: false }
                    }
                }
            }
        });

        // Event Bar Chart
        const targetEvents = ['Ignition On', 'Ignition Off', 'Harsh Breaking', 'Harsh Acceleration', 'Harsh Turn', 'SOS'];
        let eventCounts = {};
        targetEvents.forEach(e => eventCounts[e] = 0);

        if (imei === 'all') {
            const rawCounts = data.chart_data.events_summary;
            targetEvents.forEach(e => eventCounts[e] = rawCounts[e] || 0);
        } else {
            const sc = data.scorecard.find(r => r.imei === imei) || {};
            eventCounts['Ignition On'] = sc.Ignition_On || 0;
            eventCounts['Ignition Off'] = sc.Ignition_Off || 0;
            eventCounts['Harsh Breaking'] = sc.Harsh_Breaking || 0;
            eventCounts['Harsh Acceleration'] = sc.Harsh_Acceleration || 0;
            eventCounts['Harsh Turn'] = sc.Harsh_Turn || 0;
            eventCounts['SOS'] = sc.SOS_Count || 0;
        }

        app.charts.eventChart = new Chart(ctxEvent, {
            type: 'bar',
            data: {
                labels: targetEvents,
                datasets: [{
                    label: app.localization.t().chart_events,
                    data: targetEvents.map(e => eventCounts[e]),
                    backgroundColor: ['#10b981', '#10b981', '#f59e0b', '#f59e0b', '#f59e0b', '#ef4444'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: isLight ? '#e2e8f0' : '#334155' } },
                    x: { grid: { display: false } }
                }
            }
        });
    };

})(window.GPSAnalyzer);
