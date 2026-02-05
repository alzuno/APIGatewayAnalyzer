/**
 * GPS Analyzer - Map Module
 * Handles Leaflet map rendering and markers
 */
(function(app) {
    'use strict';

    app.mapModule = app.mapModule || {};

    /**
     * Render map with telemetry points
     */
    app.mapModule.render = function(rows) {
        // Initialize map if needed
        if (!app.map.instance) {
            app.map.instance = L.map('map-container').setView([0, 0], 2);
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            app.theme.updateMap(isLight ? 'light' : 'dark');
        }

        // Clear previous layers
        if (app.map.polyline) app.map.instance.removeLayer(app.map.polyline);
        app.map.markers.forEach(m => app.map.instance.removeLayer(m));
        app.map.markers = [];

        // Valid GPS points only
        const points = rows.filter(r => r.lat && r.lng && r.lat !== 0 && r.lng !== 0);

        if (points.length === 0) return;

        // Auto fitting bounds
        const latlngs = points.map(p => [p.lat, p.lng]);
        const bounds = L.latLngBounds(latlngs);

        if (app.state.selectedImei === 'all') {
            // Show start position of each unique IMEI
            const uniqueImeis = [...new Set(points.map(p => p.imei))];

            uniqueImeis.forEach(imei => {
                const firstPoint = points.find(p => p.imei === imei);
                if (firstPoint) {
                    const marker = L.circleMarker([firstPoint.lat, firstPoint.lng], {
                        radius: 5, color: '#3b82f6', fillOpacity: 0.8
                    }).bindPopup(`<b>${imei}</b><br>${firstPoint.time}`);
                    marker.addTo(app.map.instance);
                    app.map.markers.push(marker);
                }
            });
            app.map.instance.fitBounds(bounds, { padding: [50, 50] });

        } else {
            // Single IMEI - Draw Path
            app.map.polyline = L.polyline(latlngs, { color: '#10b981', weight: 4 }).addTo(app.map.instance);

            // Add Start/End markers
            const start = points[0];
            const end = points[points.length - 1];

            if (start) app.map.markers.push(L.marker([start.lat, start.lng]).addTo(app.map.instance).bindPopup("Start"));
            if (end) app.map.markers.push(L.marker([end.lat, end.lng]).addTo(app.map.instance).bindPopup("End"));

            // Add Event Markers
            const eventPoints = points.filter(p => p.event_type && p.event_type !== 'null' && p.event_type !== null);

            eventPoints.forEach(point => {
                let color = '#94a3b8';
                let icon = '📍';

                switch (point.event_type) {
                    case 'Ignition On':
                        color = '#10b981';
                        icon = '🟢';
                        break;
                    case 'Ignition Off':
                        color = '#ef4444';
                        icon = '🔴';
                        break;
                    case 'Harsh Breaking':
                    case 'Harsh Acceleration':
                    case 'Harsh Turn':
                        color = '#f59e0b';
                        icon = '⚠️';
                        break;
                    case 'SOS':
                        color = '#dc2626';
                        icon = '🆘';
                        break;
                }

                const eventMarker = L.circleMarker([point.lat, point.lng], {
                    radius: 6,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.8,
                    weight: 2
                }).bindPopup(`
                    <b>${icon} ${point.event_type}</b><br>
                    Time: ${point.time}<br>
                    Speed: ${point.speed || 'N/A'} km/h
                `);

                eventMarker.addTo(app.map.instance);
                app.map.markers.push(eventMarker);
            });

            app.map.instance.fitBounds(bounds, { padding: [50, 50] });
        }

        // Invalidate size and refit bounds
        setTimeout(() => {
            if (app.map.instance) {
                app.map.instance.invalidateSize();
                if (points.length > 0) {
                    app.map.instance.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }, 300);
    };

})(window.GPSAnalyzer);
