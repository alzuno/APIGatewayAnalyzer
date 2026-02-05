/**
 * GPS Analyzer - Tables Module
 * Handles table rendering, sorting, and searching
 */
(function(app) {
    'use strict';

    app.tables = app.tables || {};

    /**
     * Setup search functionality for a table
     */
    app.tables.setupSearch = function(inputId, tableId) {
        document.getElementById(inputId).addEventListener('keyup', function() {
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
    };

    /**
     * Make table sortable
     */
    app.tables.makeSortable = function(tableId, data, renderFunction) {
        const table = document.getElementById(tableId);
        const headers = table.querySelectorAll('th.sortable');

        headers.forEach(header => {
            header.onclick = () => {
                const column = header.dataset.column;
                let dir = 'asc';

                if (app.state.tableSorts[tableId].column === column && app.state.tableSorts[tableId].dir === 'asc') {
                    dir = 'desc';
                }

                app.state.tableSorts[tableId] = { column, dir };

                const sortedData = [...data].sort((a, b) => {
                    let aVal = a[column];
                    let bVal = b[column];

                    if (aVal == null) return 1;
                    if (bVal == null) return -1;

                    if (column.includes('Reporte') || column.includes('time')) {
                        aVal = new Date(aVal);
                        bVal = new Date(bVal);
                    }

                    if (typeof aVal === 'string') {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }

                    if (aVal < bVal) return dir === 'asc' ? -1 : 1;
                    if (aVal > bVal) return dir === 'asc' ? 1 : -1;
                    return 0;
                });

                renderFunction(sortedData);
            };
        });
    };

    /**
     * Render scorecard table
     */
    app.tables.renderScorecard = function(rows) {
        const tbody = document.querySelector('#scorecard-table tbody');
        const thead = document.querySelector('#scorecard-table thead');
        const t = app.localization.t();
        const sort = app.state.tableSorts['scorecard-table'];

        thead.innerHTML = `
            <tr>
                <th class="sortable ${sort.column === 'imei' ? 'sort-' + sort.dir : ''}" data-column="imei">${t.th_imei}</th>
                <th class="sortable ${sort.column === 'Driver_ID' ? 'sort-' + sort.dir : ''}" data-column="Driver_ID">${t.th_driver_id}</th>
                <th class="sortable ${sort.column === 'Puntaje_Calidad' ? 'sort-' + sort.dir : ''}" data-column="Puntaje_Calidad">${t.th_score}</th>
                <th class="sortable ${sort.column === 'Total_Reportes' ? 'sort-' + sort.dir : ''}" data-column="Total_Reportes">${t.th_total_reports}</th>
                <th class="sortable ${sort.column === 'Distancia_Recorrida_(KM)' ? 'sort-' + sort.dir : ''}" data-column="Distancia_Recorrida_(KM)">${t.th_dist}</th>
                <th class="sortable ${sort.column === 'Odo_Quality_Score' ? 'sort-' + sort.dir : ''}" data-column="Odo_Quality_Score">${t.th_odo_quality}</th>
                <th class="sortable ${sort.column === 'Delay_Avg' ? 'sort-' + sort.dir : ''}" data-column="Delay_Avg">${t.th_delay_avg}</th>
                <th class="sortable ${sort.column === 'Harsh_Events' ? 'sort-' + sort.dir : ''}" data-column="Harsh_Events">${t.th_harsh}</th>
                <th class="sortable ${sort.column === 'Ignition_Balance' ? 'sort-' + sort.dir : ''}" data-column="Ignition_Balance">${t.th_ign_balance}</th>
                <th class="sortable ${sort.column === 'Canbus_Completeness' ? 'sort-' + sort.dir : ''}" data-column="Canbus_Completeness">${t.th_canbus_comp}</th>
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

        // Add IMEI click handlers
        tbody.querySelectorAll('.imei-link').forEach(link => {
            link.onclick = () => {
                const imei = link.dataset.imei;
                app.elements.imeiFilter.value = imei;
                app.state.selectedImei = imei;
                app.updateDashboardView();
            };
        });

        app.tables.makeSortable('scorecard-table', rows, app.tables.renderScorecard);
    };

    /**
     * Render stats table
     */
    app.tables.renderStats = function(rows) {
        const tbody = document.querySelector('#stats-table tbody');
        const thead = document.querySelector('#stats-table thead');
        const t = app.localization.t();
        const sort = app.state.tableSorts['stats-table'];

        thead.innerHTML = `
            <tr>
                <th class="sortable ${sort.column === 'imei' ? 'sort-' + sort.dir : ''}" data-column="imei">${t.th_imei}</th>
                <th class="sortable ${sort.column === 'Driver_ID' ? 'sort-' + sort.dir : ''}" data-column="Driver_ID">${t.th_driver_id}</th>
                <th class="sortable ${sort.column === 'Primer_Reporte' ? 'sort-' + sort.dir : ''}" data-column="Primer_Reporte">${t.th_first}</th>
                <th class="sortable ${sort.column === 'Ultimo_Reporte' ? 'sort-' + sort.dir : ''}" data-column="Ultimo_Reporte">${t.th_last}</th>
                <th class="sortable ${sort.column === 'Delay_Avg' ? 'sort-' + sort.dir : ''}" data-column="Delay_Avg">${t.th_avg_delay}</th>
                <th class="sortable ${sort.column === 'KM_Inicial' ? 'sort-' + sort.dir : ''}" data-column="KM_Inicial">${t.th_start_km}</th>
                <th class="sortable ${sort.column === 'KM_Final' ? 'sort-' + sort.dir : ''}" data-column="KM_Final">${t.th_end_km}</th>
                <th class="sortable ${sort.column === 'Distancia_Recorrida_(KM)' ? 'sort-' + sort.dir : ''}" data-column="Distancia_Recorrida_(KM)">${t.th_dist}</th>
                <th class="sortable ${sort.column === 'Velocidad_Promedio_(KPH)' ? 'sort-' + sort.dir : ''}" data-column="Velocidad_Promedio_(KPH)">${t.th_avg_speed}</th>
                <th class="sortable ${sort.column === 'Velocidad_Maxima_(KPH)' ? 'sort-' + sort.dir : ''}" data-column="Velocidad_Maxima_(KPH)">${t.th_max_speed}</th>
                <th class="sortable ${sort.column === 'Total_Reportes' ? 'sort-' + sort.dir : ''}" data-column="Total_Reportes">${t.th_total_reports}</th>
                <th class="sortable ${sort.column === 'RPM_Promedio' ? 'sort-' + sort.dir : ''}" data-column="RPM_Promedio">${t.th_avg_rpm}</th>
                <th class="sortable ${sort.column === 'Nivel_Combustible_Promedio_%' ? 'sort-' + sort.dir : ''}" data-column="Nivel_Combustible_Promedio_%">${t.th_fuel}</th>
                <th class="sortable ${sort.column === 'Ignition_Off' ? 'sort-' + sort.dir : ''}" data-column="Ignition_Off">${t.th_ign_off}</th>
                <th class="sortable ${sort.column === 'Ignition_On' ? 'sort-' + sort.dir : ''}" data-column="Ignition_On">${t.th_ign_on}</th>
                <th class="sortable ${sort.column === 'Harsh_Events' ? 'sort-' + sort.dir : ''}" data-column="Harsh_Events">${t.th_harsh_counts}</th>
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

        // Add IMEI click handlers
        tbody.querySelectorAll('.imei-link').forEach(link => {
            link.onclick = () => {
                const imei = link.dataset.imei;
                app.elements.imeiFilter.value = imei;
                app.state.selectedImei = imei;
                app.updateDashboardView();
            };
        });

        app.tables.makeSortable('stats-table', rows, app.tables.renderStats);
    };

    /**
     * Render raw data table
     */
    app.tables.renderRaw = function(rows) {
        const table = document.getElementById('raw-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!rows || rows.length === 0) return;

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
    };

    /**
     * Export data as CSV
     */
    app.tables.exportCSV = function() {
        if (!app.state.currentData) return;

        let dataToExport = app.state.currentData.raw_data_sample;
        if (app.state.selectedImei !== 'all') {
            dataToExport = dataToExport.filter(r => r.imei === app.state.selectedImei);
        }

        if (dataToExport.length === 0) {
            alert("No data to export");
            return;
        }

        const headers = Object.keys(dataToExport[0]);
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => headers.map(fieldName => {
                let cell = row[fieldName] === null ? '' : row[fieldName];
                return JSON.stringify(cell);
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `export_${app.state.selectedImei}_${new Date().toISOString()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

})(window.GPSAnalyzer);
