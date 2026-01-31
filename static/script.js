
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const historyList = document.getElementById('history-list');
    const dashboard = document.getElementById('dashboard');
    const emptyState = document.getElementById('empty-state');
    const loader = document.getElementById('loader');
    const imeiFilter = document.getElementById('imei-filter');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('.sidebar');
    const exportBtn = document.getElementById('export-btn');
    const themeBtn = document.getElementById('theme-toggle');

    // Theme State
    const THEMES = ['auto', 'light', 'dark'];
    let currentTheme = localStorage.getItem('theme') || 'auto';


    // Charts instances
    let scoreChartInstance = null;
    let eventChartInstance = null;

    // Map instances
    let mapInstance = null;
    let mapMarkers = [];
    let mapPolyline = null;

    // State
    let currentData = null;
    let selectedImei = 'all';

    // --- Theme Logic ---
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        let effectiveTheme = theme;
        if (theme === 'auto') {
            effectiveTheme = getSystemTheme();
        }

        // Apply to DOM
        if (effectiveTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // Update Button Icon
        updateThemeIcon(theme);

        // Update Chart Colors
        updateChartsTheme(effectiveTheme);

        // Update Map Tiles
        updateMapTheme(effectiveTheme);
    }

    function updateThemeIcon(theme) {
        let iconPath = '';
        if (theme === 'auto') {
            // Computer/System Icon
            iconPath = '<path d="M20 16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9zm-10 4h4m-2 0v2m0 0h-2m2 0h2" stroke-linecap="round" stroke-linejoin="round"/>';
        } else if (theme === 'light') {
            // Sun Icon
            iconPath = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
            // Moon Icon
            iconPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        themeBtn.querySelector('svg').innerHTML = iconPath;
    }

    function updateChartsTheme(theme) {
        const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
        const gridColor = theme === 'light' ? '#e2e8f0' : '#334155';

        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;

        if (scoreChartInstance) scoreChartInstance.update();
        if (eventChartInstance) eventChartInstance.update();
    }

    function updateMapTheme(theme) {
        if (!mapInstance) return;

        // Remove existing tile layers
        mapInstance.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                mapInstance.removeLayer(layer);
            }
        });

        const tileUrl = theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, {
            attribution: '&copy;OpenStreetMap, &copy;CartoDB'
        }).addTo(mapInstance);

        // Re-add markers/polyline if they exist (Leaflet layers are objects, just need to make sure they are on top)
        if (mapPolyline) mapPolyline.bringToFront();
        mapMarkers.forEach(m => {
            if (m instanceof L.CircleMarker) m.bringToFront();
        });
    }

    themeBtn.onclick = () => {
        const currentIndex = THEMES.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        currentTheme = THEMES[nextIndex];
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    };

    // System theme listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    });

    // --- Init Theme ---
    applyTheme(currentTheme);

    // --- History Loading ---
    async function loadHistory() {
        try {
            const res = await fetch('/api/history');
            const history = await res.json();
            historyList.innerHTML = '';

            if (history.length === 0) {
                historyList.innerHTML = '<li style="padding:1rem; color:#64748b; font-size:0.8rem;">No history yet.</li>';
                return;
            }

            history.forEach(item => {
                const li = document.createElement('li');
                li.className = 'history-item';
                li.innerHTML = `
                    <div class="history-content">
                        <span class="filename" title="${item.filename}">${item.filename}</span>
                        <span class="meta">${new Date(item.summary.processed_at).toLocaleDateString()} • Score: ${item.summary.average_quality_score}</span>
                    </div>
                    <button class="history-delete" title="Delete record" data-id="${item.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                `;

                // Click on item loads it
                li.querySelector('.history-content').onclick = () => loadResult(item.id);

                // Click on delete
                li.querySelector('.history-delete').onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this record?')) {
                        deleteHistoryItem(item.id);
                    }
                };

                historyList.appendChild(li);
            });
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }

    async function deleteHistoryItem(id) {
        try {
            const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadHistory();
                // If currently viewing this item, maybe clear dashboard? 
                // For now, let's leave it.
            }
        } catch (e) {
            alert("Error deleting item");
        }
    }

    // --- Sidebar Toggle ---
    sidebarToggle.onclick = () => {
        sidebar.classList.toggle('collapsed');
        // Wait for transition then resize map
        setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
        }, 350);
    };

    // --- Export CSV ---
    exportBtn.onclick = () => {
        if (!currentData) return;

        let dataToExport = currentData.raw_data_sample;
        if (selectedImei !== 'all') {
            dataToExport = dataToExport.filter(r => r.imei === selectedImei);
        }

        if (dataToExport.length === 0) {
            alert("No data to export");
            return;
        }

        // Convert to CSV
        const headers = Object.keys(dataToExport[0]);
        const csvContent = [
            headers.join(','), // Header row
            ...dataToExport.map(row => headers.map(fieldName => {
                let cell = row[fieldName] === null ? '' : row[fieldName];
                return JSON.stringify(cell); // Handle quotes/commas
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `export_${selectedImei}_${new Date().toISOString()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- File Upload Handling ---
    uploadZone.onclick = () => fileInput.click();

    uploadZone.ondragover = (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    };

    uploadZone.ondragleave = () => {
        uploadZone.classList.remove('drag-over');
    };

    uploadZone.ondrop = (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    fileInput.onchange = (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    };

    async function handleFileUpload(file) {
        if (!file.name.endsWith('.json')) {
            alert("Please upload a JSON file.");
            return;
        }

        showLoader(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            renderDashboard(data.data);
            loadHistory(); // Refresh history
        } catch (e) {
            alert("Error processing file: " + e.message);
        } finally {
            showLoader(false);
        }
    }

    async function loadResult(id) {
        showLoader(true);
        try {
            const res = await fetch(`/api/result/${id}`);
            if (!res.ok) throw new Error("Load failed");
            const data = await res.json();
            renderDashboard(data);
        } catch (e) {
            alert("Error loading result: " + e.message);
        } finally {
            showLoader(false);
        }
    }

    // --- Rendering ---
    function renderDashboard(data) {
        emptyState.classList.add('hidden');
        dashboard.classList.remove('hidden');

        // Header
        document.getElementById('report-title').textContent = data.summary.filename;
        document.getElementById('report-date').textContent = new Date(data.summary.processed_at).toLocaleString();

        // KPIs
        document.getElementById('kpi-score').textContent = data.summary.average_quality_score;
        document.getElementById('kpi-devices').textContent = data.summary.total_devices;
        document.getElementById('kpi-records').textContent = data.summary.total_records.toLocaleString();
        document.getElementById('kpi-distance').textContent = data.summary.total_distance_km.toLocaleString();

        // Dynamic color for score
        const scoreEl = document.getElementById('kpi-score');
        const score = data.summary.average_quality_score;
        scoreEl.style.color = score > 90 ? '#10b981' : (score > 70 ? '#f59e0b' : '#ef4444');

        // Charts
        // Populate IMEI Filter
        const imeis = data.stats_per_imei.map(s => s.imei);
        imeiFilter.innerHTML = '<option value="all">All Devices</option>' +
            imeis.map(imei => `<option value="${imei}">${imei}</option>`).join('');
        imeiFilter.value = 'all'; // Default

        currentData = data;
        updateDashboardView();
    }

    // --- Dashboard Updates based on Filter ---
    imeiFilter.onchange = (e) => {
        selectedImei = e.target.value;
        updateDashboardView();
    };

    function updateDashboardView() {
        if (!currentData) return;

        let filteredScorecard = currentData.scorecard;
        let filteredStats = currentData.stats_per_imei;
        let filteredRaw = currentData.raw_data_sample;

        // If single IMEI selected
        if (selectedImei !== 'all') {
            filteredScorecard = filteredScorecard.filter(r => r.imei === selectedImei);
            filteredStats = filteredStats.filter(r => r.imei === selectedImei);
            filteredRaw = filteredRaw.filter(r => r.imei === selectedImei);
        }

        // Update KPIs
        if (selectedImei === 'all') {
            document.getElementById('kpi-score').textContent = currentData.summary.average_quality_score;
            document.getElementById('kpi-devices').textContent = currentData.summary.total_devices;
            document.getElementById('kpi-records').textContent = currentData.summary.total_records.toLocaleString();
            document.getElementById('kpi-distance').textContent = currentData.summary.total_distance_km.toLocaleString();
        } else {
            // Recalculate specific KPIs for this IMEI
            const stat = filteredStats[0] || {};
            const sc = filteredScorecard[0] || {};
            document.getElementById('kpi-score').textContent = sc.Puntaje_Calidad || '--';
            document.getElementById('kpi-devices').textContent = "1";
            document.getElementById('kpi-records').textContent = sc.Total_Reportes || 0;
            document.getElementById('kpi-distance').textContent = stat['Distancia_Recorrida_(KM)']?.toFixed(2) || 0;
        }

        renderCharts(currentData, selectedImei);
        renderScorecardTable(filteredScorecard);
        renderStatsTable(filteredStats);
        renderRawTable(filteredRaw);
        renderMap(filteredRaw);
    }

    function renderCharts(data, imei) {
        const ctxScore = document.getElementById('scoreChart').getContext('2d');
        const ctxEvent = document.getElementById('eventChart').getContext('2d');

        // Ensure defaults are set before creating
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        updateChartsTheme(isLight ? 'light' : 'dark');

        if (scoreChartInstance) scoreChartInstance.destroy();
        if (eventChartInstance) eventChartInstance.destroy();

        // Score Chart
        if (imei === 'all') {
            // Histogram as before
            const scores = data.chart_data.score_distribution;
            const histData = [0, 0, 0, 0, 0];
            scores.forEach(s => {
                if (s < 50) histData[0]++;
                else if (s < 70) histData[1]++;
                else if (s < 80) histData[2]++;
                else if (s < 90) histData[3]++;
                else histData[4]++;
            });
            scoreChartInstance = new Chart(ctxScore, {
                type: 'bar',
                data: {
                    labels: ['<50', '50-70', '70-80', '80-90', '90-100'],
                    datasets: [{ label: 'Devices', data: histData, backgroundColor: '#3b82f6', borderRadius: 4 }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#334155' } }, x: { grid: { display: false } } } }
            });
        } else {
            // Single Gauge-like chart or just text? Let's do a single bar for now or just hide it?
            // A simple gauge is hard with ChartJS default, let's show history of scores? No data for that.
            // Let's show a single Horizontal Bar
            const sc = data.scorecard.find(r => r.imei === imei) || {};
            scoreChartInstance = new Chart(ctxScore, {
                type: 'bar',
                data: {
                    labels: ['Quality Score'],
                    datasets: [{ label: 'Score', data: [sc.Puntaje_Calidad || 0], backgroundColor: '#10b981', barThickness: 40, borderRadius: 10 }]
                },
                options: { indexAxis: 'y', scales: { x: { max: 100 } } }
            });
        }

        // Event Chart
        let events = {};
        if (imei === 'all') {
            events = data.chart_data.events_summary;
        } else {
            // Filter raw data to count events
            data.raw_data_sample.filter(r => r.imei === imei && r.event_type).forEach(r => {
                events[r.event_type] = (events[r.event_type] || 0) + 1;
            });
        }

        const sortedEvents = Object.entries(events).sort((a, b) => b[1] - a[1]).slice(0, 5);
        eventChartInstance = new Chart(ctxEvent, {
            type: 'doughnut',
            data: {
                labels: sortedEvents.map(e => e[0]),
                datasets: [{
                    data: sortedEvents.map(e => e[1]),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, aspectRatio: 2, plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } } }
        });
    }

    function renderScorecardTable(rows) {
        const tbody = document.querySelector('#scorecard-table tbody');
        const thead = document.querySelector('#scorecard-table thead');

        thead.innerHTML = `
            <tr>
                <th>IMEI</th>
                <th>Score</th>
                <th>Odometer OK %</th>
                <th>CAN Bus %</th>
                <th>LastFix OK %</th>
                <th>Distance (km)</th>
                <th>RPM Anormal</th>
                <th>Events Harsh</th>
                <th>Ignition Balance</th>
            </tr>
        `;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9">No data</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.imei}</td>
                <td><strong>${row.Puntaje_Calidad}</strong></td>
                <td>${row.Odometro_Tasa_OK?.toFixed(1)}%</td>
                <td>${row.CANBUS_Tasa_Reporte?.toFixed(1)}%</td>
                <td>${row.LastFixTime_Tasa_OK?.toFixed(1)}%</td>
                <td>${row['Distancia_Recorrida_(KM)']?.toFixed(2)}</td>
                <td>${row.CANBUS_RPM_Anormal || 0}</td>
                <td>${row.Eventos_Harsh || 0}</td>
                 <td style="color:${row.Ignition_Coherencia === 'OK' ? '#10b981' : '#ef4444'}">${row.Ignition_On_Off_Balance?.toFixed(0)} (${row.Ignition_Coherencia})</td>
            </tr>
        `).join('');
    }

    function renderStatsTable(rows) {
        const tbody = document.querySelector('#stats-table tbody');
        const thead = document.querySelector('#stats-table thead');

        thead.innerHTML = `
            <tr>
                <th>IMEI</th>
                <th>First Report</th>
                <th>Last Report</th>
                <th>Total Reports</th>
                <th>Start KM</th>
                <th>End KM</th>
                <th>Distance (KM)</th>
                <th>Avg Speed</th>
                <th>Max Speed</th>
                <th>Avg RPM</th>
                <th>Avg Fuel %</th>
            </tr>
        `;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11">No data</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.imei}</td>
                <td>${new Date(row.Primer_Reporte).toLocaleString()}</td>
                <td>${new Date(row.Ultimo_Reporte).toLocaleString()}</td>
                <td>${row.Total_Reportes}</td>
                <td>${row.KM_Inicial}</td>
                <td>${row.KM_Final}</td>
                <td>${row['Distancia_Recorrida_(KM)']?.toFixed(2)}</td>
                <td>${row['Velocidad_Promedio_(KPH)']?.toFixed(1)}</td>
                <td>${row['Velocidad_Maxima_(KPH)']}</td>
                <td>${row.RPM_Promedio?.toFixed(0)}</td>
                <td>${row['Nivel_Combustible_Promedio_%']?.toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    function renderMap(rows) {
        // Initialize Map if needed
        if (!mapInstance) {
            mapInstance = L.map('map-container').setView([0, 0], 2);
            // Initial tile load handled by applyTheme, but we call it here to be sure if first load
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const theme = isLight ? 'light' : 'dark';
            updateMapTheme(theme);
        }

        // Clear previous layers
        if (mapPolyline) mapInstance.removeLayer(mapPolyline);
        mapMarkers.forEach(m => mapInstance.removeLayer(m));
        mapMarkers = [];

        // Valid GPS points only
        const points = rows.filter(r => r.lat && r.lng && r.lat !== 0 && r.lng !== 0);

        if (points.length === 0) return;

        // Auto fitting bounds logic
        const latlngs = points.map(p => [p.lat, p.lng]);
        const bounds = L.latLngBounds(latlngs);

        if (selectedImei === 'all') {
            // Show start position of each unique IMEI present in 'points'
            const uniqueImeis = [...new Set(points.map(p => p.imei))];

            uniqueImeis.forEach(imei => {
                const firstPoint = points.find(p => p.imei === imei);
                if (firstPoint) {
                    const marker = L.circleMarker([firstPoint.lat, firstPoint.lng], {
                        radius: 5, color: '#3b82f6', fillOpacity: 0.8
                    }).bindPopup(`<b>${imei}</b><br>${firstPoint.time}`);
                    marker.addTo(mapInstance);
                    mapMarkers.push(marker);
                }
            });
            mapInstance.fitBounds(bounds, { padding: [50, 50] });

        } else {
            // Single IMEI - Draw Path
            mapPolyline = L.polyline(latlngs, { color: '#10b981', weight: 4 }).addTo(mapInstance);

            // Add Start/End markers
            const start = points[0];
            const end = points[points.length - 1];

            if (start) mapMarkers.push(L.marker([start.lat, start.lng]).addTo(mapInstance).bindPopup("Start"));
            if (end) mapMarkers.push(L.marker([end.lat, end.lng]).addTo(mapInstance).bindPopup("End"));

            mapInstance.fitBounds(bounds, { padding: [50, 50] });
        }

        // Invalidate size to fix rendering issues in hidden tabs
        setTimeout(() => mapInstance.invalidateSize(), 200);
    }

    // --- Utils ---
    function setupSearch(inputId, tableId) {
        document.getElementById(inputId).addEventListener('keyup', function () {
            const filter = this.value.toUpperCase();
            const table = document.getElementById(tableId);
            const tr = table.getElementsByTagName('tr');
            for (let i = 1; i < tr.length; i++) {
                let txtValue = tr[i].textContent || tr[i].innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        });
    }
    setupSearch('search-scorecard', 'scorecard-table');
    setupSearch('search-stats', 'stats-table');

    function renderRawTable(rows) {
        const table = document.getElementById('raw-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!rows || rows.length === 0) return;

        // Dynamic headers
        const cols = Object.keys(rows[0]);
        thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

        tbody.innerHTML = rows.map(row => `
            <tr>${cols.map(c => `<td>${row[c] !== null ? row[c] : ''}</td>`).join('')}</tr>
        `).join('');
    }

    // --- Tab Switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');

            // Fix Leaflet resize bug when showing hidden map
            if (btn.dataset.tab === 'map' && mapInstance) {
                setTimeout(() => mapInstance.invalidateSize(), 100);
            }
        };
    });

    function showLoader(show) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }

    // Init
    loadHistory();
});
