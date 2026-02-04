
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
    const langBtn = document.getElementById('lang-toggle');

    // Theme State
    const THEMES = ['auto', 'light', 'dark'];
    let currentTheme = localStorage.getItem('theme') || 'auto';

    // Lang State
    let currentLang = localStorage.getItem('lang') || 'en';


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

    // --- Language Logic ---
    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        document.getElementById('lang-text').textContent = lang.toUpperCase();

        // Update Static Texts
        updateTexts();
    }

    function updateTexts() {
        const t = translations[currentLang];

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

            // Handle specific element types
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = t[key];
            } else if (id === 'export-btn') {
                // Preserve Icon
                const icon = el.querySelector('svg').outerHTML;
                el.innerHTML = icon + ' ' + t[key];
            } else {
                el.textContent = t[key];
            }
        }

        // Manual updates for complex selectors or classes
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

        // Re-render tables if data exists (to update headers)
        if (currentData) {
            renderScorecardTable(currentData.scorecard || []);
            renderStatsTable(currentData.scorecard || []);
            updateDashboardView();
        }
    }

    langBtn.onclick = () => {
        setLanguage(currentLang === 'en' ? 'es' : 'en');
    };

    // --- Init Theme & Lang ---
    applyTheme(currentTheme);
    setLanguage(currentLang);

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
                    <div style="display: flex; gap: 4px;">
                        <button class="history-edit" title="Edit name" data-id="${item.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="history-delete" title="Delete record" data-id="${item.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                `;

                // Click on item loads it
                li.querySelector('.history-content').onclick = () => loadResult(item.id);

                // Click on edit
                li.querySelector('.history-edit').onclick = (e) => {
                    e.stopPropagation();
                    editHistoryName(li, item);
                };

                // Click on delete
                li.querySelector('.history-delete').onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this record? This will also delete all associated files.')) {
                        deleteHistoryItem(item.id);
                    }
                };

                historyList.appendChild(li);
            });
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }

    function editHistoryName(li, item) {
        const filenameSpan = li.querySelector('.filename');
        const currentName = filenameSpan.textContent;

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = currentName;

        // Replace span with input
        filenameSpan.replaceWith(input);
        input.focus();
        input.select();

        const saveEdit = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    const res = await fetch(`/api/history/${item.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: newName })
                    });

                    if (res.ok) {
                        loadHistory(); // Reload to show updated name
                    } else {
                        alert('Failed to update name');
                        loadHistory();
                    }
                } catch (e) {
                    alert('Error updating name');
                    loadHistory();
                }
            } else {
                loadHistory(); // Cancel - reload original
            }
        };

        input.onblur = saveEdit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            } else if (e.key === 'Escape') {
                loadHistory(); // Cancel
            }
        };
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
        // Reset State for Stability
        selectedImei = 'all';
        document.getElementById('search-scorecard').value = '';
        document.getElementById('search-stats').value = '';

        // Reset Tab View
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelector('[data-tab="scorecard"]').classList.add('active');
        document.getElementById('tab-scorecard').classList.remove('hidden');

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
        const imeis = (data.scorecard || []).map(s => s.imei);
        imeiFilter.innerHTML = `<option value="all">${translations[currentLang].all_devices}</option>` +
            imeis.map(imei => `<option value="${imei}">${imei}</option>`).join('');
        imeiFilter.value = 'all';

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

        let filteredScorecard = currentData.scorecard || [];
        let filteredStats = currentData.scorecard || [];
        let filteredRaw = currentData.raw_data_sample || [];

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

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        updateChartsTheme(isLight ? 'light' : 'dark');

        if (scoreChartInstance) scoreChartInstance.destroy();
        if (eventChartInstance) eventChartInstance.destroy();

        // --- Radar Chart (Data Completeness / Completes V2) ---
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

        scoreChartInstance = new Chart(ctxScore, {
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

        // --- GPS Event Breakdown (Bar Chart V2) ---
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

        eventChartInstance = new Chart(ctxEvent, {
            type: 'bar',
            data: {
                labels: targetEvents,
                datasets: [{
                    label: translations[currentLang].chart_events,
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
    }

    function renderScorecardTable(rows) {
        const tbody = document.querySelector('#scorecard-table tbody');
        const thead = document.querySelector('#scorecard-table thead');
        const t = translations[currentLang];

        thead.innerHTML = `
            <tr>
                <th class="sortable" data-column="imei">${t.th_imei}</th>
                <th class="sortable" data-column="Driver_ID">${t.th_driver_id}</th>
                <th class="sortable" data-column="Puntaje_Calidad">${t.th_score}</th>
                <th class="sortable" data-column="Total_Reportes">${t.th_total_reports}</th>
                <th class="sortable" data-column="Distancia_Recorrida_(KM)">${t.th_dist}</th>
                <th class="sortable" data-column="Odo_Quality_Score">${t.th_odo_quality}</th>
                <th class="sortable" data-column="Delay_Avg">${t.th_delay_avg}</th>
                <th class="sortable" data-column="Harsh_Events">${t.th_harsh}</th>
                <th class="sortable" data-column="Ignition_Balance">${t.th_ign_balance}</th>
                <th class="sortable" data-column="Canbus_Completeness">${t.th_canbus_comp}</th>
                <th>${t.th_frozen_sensors}</th>
                <th>${t.th_lat_lng_var}</th>
            </tr>
        `;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12">No data</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><span class="imei-link" data-imei="${row.imei}">${row.imei}</span></td>
                <td><span class="badge ${row.Driver_ID !== 'N/A' ? 'badge-success' : 'badge-warning'}">${row.Driver_ID}</span></td>
                <td style="font-weight:bold; color:${row.Puntaje_Calidad > 80 ? '#10b981' : (row.Puntaje_Calidad > 60 ? '#f59e0b' : '#ef4444')}">${row.Puntaje_Calidad}</td>
                <td>${row.Total_Reportes}</td>
                <td>${row['Distancia_Recorrida_(KM)']?.toFixed(2)}</td>
                <td>${row.Odo_Quality_Score}%</td>
                <td>${row.Delay_Avg}s</td>
                <td>${row.Harsh_Events}</td>
                <td style="color:${row.Ignition_Balance <= 1 ? '#10b981' : '#ef4444'}">${row.Ignition_Balance} (${row.Ignition_On}/${row.Ignition_Off})</td>
                <td>${row.Canbus_Completeness}%</td>
                <td><span class="badge ${row.Frozen_Sensors === 'None' ? 'badge-success' : 'badge-danger'}">${row.Frozen_Sensors}</span></td>
                <td><span class="badge ${row.Lat_Lng_Correct_Variation === 'OK' ? 'badge-success' : 'badge-danger'}">${row.Lat_Lng_Correct_Variation}</span></td>
            </tr>
        `).join('');

        // Add click handlers for IMEI links
        tbody.querySelectorAll('.imei-link').forEach(link => {
            link.onclick = () => {
                const imei = link.dataset.imei;
                imeiFilter.value = imei;
                selectedImei = imei;
                updateDashboardView();
            };
        });

        // Add sorting to headers
        makeSortable('scorecard-table', rows, renderScorecardTable);
    }

    function renderStatsTable(rows) {
        const tbody = document.querySelector('#stats-table tbody');
        const thead = document.querySelector('#stats-table thead');
        const t = translations[currentLang];

        thead.innerHTML = `
            <tr>
                <th class="sortable" data-column="imei">${t.th_imei}</th>
                <th class="sortable" data-column="Driver_ID">${t.th_driver_id}</th>
                <th class="sortable" data-column="Primer_Reporte">${t.th_first}</th>
                <th class="sortable" data-column="Ultimo_Reporte">${t.th_last}</th>
                <th class="sortable" data-column="Delay_Avg">${t.th_avg_delay}</th>
                <th class="sortable" data-column="KM_Inicial">${t.th_start_km}</th>
                <th class="sortable" data-column="KM_Final">${t.th_end_km}</th>
                <th class="sortable" data-column="Distancia_Recorrida_(KM)">${t.th_dist}</th>
                <th class="sortable" data-column="Velocidad_Promedio_(KPH)">${t.th_avg_speed}</th>
                <th class="sortable" data-column="Velocidad_Maxima_(KPH)">${t.th_max_speed}</th>
                <th class="sortable" data-column="Total_Reportes">${t.th_total_reports}</th>
                <th class="sortable" data-column="RPM_Promedio">${t.th_avg_rpm}</th>
                <th class="sortable" data-column="Nivel_Combustible_Promedio_%">${t.th_fuel}</th>
                <th class="sortable" data-column="Ignition_Off">${t.th_ign_off}</th>
                <th class="sortable" data-column="Ignition_On">${t.th_ign_on}</th>
                <th class="sortable" data-column="Harsh_Events">${t.th_harsh_counts}</th>
            </tr>
        `;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="16">No data</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><span class="imei-link" data-imei="${row.imei}">${row.imei}</span></td>
                <td>${row.Driver_ID}</td>
                <td>${new Date(row.Primer_Reporte).toLocaleString()}</td>
                <td>${new Date(row.Ultimo_Reporte).toLocaleString()}</td>
                <td>${row.Delay_Avg}s</td>
                <td>${row.KM_Inicial}</td>
                <td>${row.KM_Final}</td>
                <td>${row['Distancia_Recorrida_(KM)']?.toFixed(2)}</td>
                <td>${row['Velocidad_Promedio_(KPH)']?.toFixed(1)}</td>
                <td>${row['Velocidad_Maxima_(KPH)'] || 0}</td>
                <td>${row.Total_Reportes}</td>
                <td>${row.RPM_Promedio?.toFixed(0)}</td>
                <td>${row['Nivel_Combustible_Promedio_%']?.toFixed(1)}%</td>
                <td>${row.Ignition_Off}</td>
                <td>${row.Ignition_On}</td>
                <td>${row.Harsh_Events}</td>
            </tr>
        `).join('');

        // Add click handlers for IMEI links
        tbody.querySelectorAll('.imei-link').forEach(link => {
            link.onclick = () => {
                const imei = link.dataset.imei;
                imeiFilter.value = imei;
                selectedImei = imei;
                updateDashboardView();
            };
        });

        // Add sorting to headers
        makeSortable('stats-table', rows, renderStatsTable);
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

            // Add Event Markers
            const eventPoints = points.filter(p => p.event_type && p.event_type !== 'null' && p.event_type !== null);

            eventPoints.forEach(point => {
                let color = '#94a3b8'; // Default gray
                let icon = '📍';

                // Determine color and icon based on event type
                switch (point.event_type) {
                    case 'Ignition On':
                        color = '#10b981'; // Green
                        icon = '🟢';
                        break;
                    case 'Ignition Off':
                        color = '#ef4444'; // Red
                        icon = '🔴';
                        break;
                    case 'Harsh Breaking':
                    case 'Harsh Acceleration':
                    case 'Harsh Turn':
                        color = '#f59e0b'; // Orange
                        icon = '⚠️';
                        break;
                    case 'SOS':
                        color = '#dc2626'; // Dark red
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

                eventMarker.addTo(mapInstance);
                mapMarkers.push(eventMarker);
            });

            mapInstance.fitBounds(bounds, { padding: [50, 50] });
        }

        // Invalidate size and refit bounds to ensure map renders correctly
        setTimeout(() => {
            if (mapInstance) {
                mapInstance.invalidateSize();
                if (points.length > 0) {
                    mapInstance.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }, 300);
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

    // Table Sorting Utility
    function makeSortable(tableId, data, renderFunction) {
        const table = document.getElementById(tableId);
        const headers = table.querySelectorAll('th.sortable');

        headers.forEach(header => {
            header.onclick = () => {
                const column = header.dataset.column;
                const currentSort = header.classList.contains('sort-asc') ? 'asc' :
                    header.classList.contains('sort-desc') ? 'desc' : 'none';

                // Remove sort classes from all headers
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

                // Determine new sort direction
                let newSort = 'asc';
                if (currentSort === 'asc') newSort = 'desc';

                // Add appropriate class
                header.classList.add(`sort-${newSort}`);

                // Sort data
                const sortedData = [...data].sort((a, b) => {
                    let aVal = a[column];
                    let bVal = b[column];

                    // Handle null/undefined
                    if (aVal == null) return 1;
                    if (bVal == null) return -1;

                    // Handle dates
                    if (column.includes('Reporte') || column.includes('time')) {
                        aVal = new Date(aVal);
                        bVal = new Date(bVal);
                    }

                    // Compare
                    if (typeof aVal === 'string') {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }

                    if (aVal < bVal) return newSort === 'asc' ? -1 : 1;
                    if (aVal > bVal) return newSort === 'asc' ? 1 : -1;
                    return 0;
                });

                // Re-render with sorted data
                renderFunction(sortedData);
            };
        });
    }

    function renderRawTable(rows) {
        const table = document.getElementById('raw-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!rows || rows.length === 0) return;

        // Custom ordered columns for professional forensic view
        const cols = [
            'imei', 'time', 'receiveTimestamp', 'delay_seconds', 'lat', 'lng',
            'altitude', 'speed', 'heading', 'lastFixTime', 'isMoving',
            'batteryLevelPercentage', 'reportMode', 'quality', 'mileage',
            'ignitionOn', 'externalPowerVcc', 'digitalInput', 'driverId',
            'engineRPM', 'vehicleSpeed', 'engineCoolantTemperature',
            'totalDistance', 'totalFuelUsed', 'fuelLevelInput', 'event_type'
        ];

        thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

        tbody.innerHTML = rows.map(row => `
            <tr>${cols.map(c => `<td>${row[c] !== undefined && row[c] !== null ? row[c] : ''}</td>`).join('')}</tr>
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
                setTimeout(() => {
                    mapInstance.invalidateSize();
                    // Re-render map to ensure it fits current data bounds when visible
                    if (currentData) {
                        let filteredRaw = currentData.raw_data_sample || [];
                        if (selectedImei !== 'all') {
                            filteredRaw = filteredRaw.filter(r => r.imei === selectedImei);
                        }
                        renderMap(filteredRaw);
                    }
                }, 100);
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
