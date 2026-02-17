/**
 * GPS Analyzer - API Module
 * Handles all API communication and data fetching
 */
(function(app) {
    'use strict';

    app.api = app.api || {};

    /**
     * Initialize API module
     */
    app.api.init = function() {
        // Nothing to initialize for now
    };

    /**
     * Load analysis history
     */
    app.api.loadHistory = async function() {
        try {
            const res = await fetch('/api/history');
            const history = await res.json();
            app.elements.historyList.innerHTML = '';

            if (history.length === 0) {
                app.elements.historyList.innerHTML = '<li style="padding:1rem; color:#64748b; font-size:0.8rem;">No history yet.</li>';
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

                li.querySelector('.history-content').onclick = () => app.api.loadResult(item.id);
                li.querySelector('.history-edit').onclick = (e) => {
                    e.stopPropagation();
                    app.api.editHistoryName(li, item);
                };
                li.querySelector('.history-delete').onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this record? This will also delete all associated files.')) {
                        app.api.deleteHistoryItem(item.id);
                    }
                };

                app.elements.historyList.appendChild(li);
            });
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    /**
     * Edit history item name
     */
    app.api.editHistoryName = function(li, item) {
        const filenameSpan = li.querySelector('.filename');
        const currentName = filenameSpan.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = currentName;

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
                        app.api.loadHistory();
                    } else {
                        alert('Failed to update name');
                        app.api.loadHistory();
                    }
                } catch (e) {
                    alert('Error updating name');
                    app.api.loadHistory();
                }
            } else {
                app.api.loadHistory();
            }
        };

        input.onblur = saveEdit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            } else if (e.key === 'Escape') {
                app.api.loadHistory();
            }
        };
    };

    /**
     * Delete history item
     */
    app.api.deleteHistoryItem = async function(id) {
        try {
            const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (res.ok) {
                app.api.loadHistory();
            }
        } catch (e) {
            alert("Error deleting item");
        }
    };

    /**
     * Handle file upload
     */
    app.api.handleFileUpload = async function(file) {
        if (!file.name.endsWith('.json')) {
            alert("Please upload a JSON file.");
            return;
        }

        app.utils.showLoader(true);
        app.utils.showSkeletons();
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            // Handle async processing (202 Accepted)
            if (res.status === 202) {
                const jobData = await res.json();
                await app.api.pollJobProgress(jobData.job_id);
                return;
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Upload failed");
            }

            const data = await res.json();
            app.utils.hideSkeletons();
            app.api.renderDashboard(data.data, data.id);
            app.api.loadHistory();
        } catch (e) {
            app.utils.hideSkeletons();
            app.elements.emptyState.classList.remove('hidden');
            app.elements.dashboard.classList.add('hidden');
            alert("Error processing file: " + e.message);
        } finally {
            app.utils.showLoader(false);
        }
    };

    /**
     * Poll job progress using SSE
     */
    app.api.pollJobProgress = async function(jobId) {
        const eventSource = new EventSource(`/api/job/${jobId}/progress`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.error) {
                eventSource.close();
                app.utils.hideSkeletons();
                app.elements.emptyState.classList.remove('hidden');
                app.elements.dashboard.classList.add('hidden');
                app.utils.showLoader(false);
                alert("Processing error: " + data.error);
                return;
            }

            const loaderText = app.elements.loader.querySelector('p');
            if (loaderText) {
                loaderText.textContent = `${app.localization.t().processing} ${data.progress}%`;
            }

            if (data.status === 'completed') {
                eventSource.close();
                app.utils.hideSkeletons();
                app.utils.showLoader(false);

                if (data.data) {
                    app.api.renderDashboard(data.data, data.analysis_id);
                } else if (data.analysis_id) {
                    app.api.loadResult(data.analysis_id);
                }
                app.api.loadHistory();
            } else if (data.status === 'failed') {
                eventSource.close();
                app.utils.hideSkeletons();
                app.elements.emptyState.classList.remove('hidden');
                app.elements.dashboard.classList.add('hidden');
                app.utils.showLoader(false);
                alert("Processing failed: " + (data.error || "Unknown error"));
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            app.api.pollJobProgressFallback(jobId);
        };
    };

    /**
     * Fallback polling for job progress
     */
    app.api.pollJobProgressFallback = async function(jobId) {
        const maxAttempts = 120;
        let attempts = 0;

        const poll = async () => {
            if (attempts >= maxAttempts) {
                app.utils.hideSkeletons();
                app.elements.emptyState.classList.remove('hidden');
                app.elements.dashboard.classList.add('hidden');
                app.utils.showLoader(false);
                alert("Processing timeout. Please try again.");
                return;
            }

            attempts++;

            try {
                const res = await fetch(`/api/job/${jobId}`);
                const data = await res.json();

                if (data.error) {
                    app.utils.hideSkeletons();
                    app.elements.emptyState.classList.remove('hidden');
                    app.elements.dashboard.classList.add('hidden');
                    app.utils.showLoader(false);
                    alert("Processing error: " + data.error);
                    return;
                }

                const loaderText = app.elements.loader.querySelector('p');
                if (loaderText) {
                    loaderText.textContent = `${app.localization.t().processing} ${data.progress}%`;
                }

                if (data.status === 'completed') {
                    app.utils.hideSkeletons();
                    app.utils.showLoader(false);

                    if (data.data) {
                        app.api.renderDashboard(data.data, data.analysis_id);
                    } else if (data.analysis_id) {
                        app.api.loadResult(data.analysis_id);
                    }
                    app.api.loadHistory();
                } else if (data.status === 'failed') {
                    app.utils.hideSkeletons();
                    app.elements.emptyState.classList.remove('hidden');
                    app.elements.dashboard.classList.add('hidden');
                    app.utils.showLoader(false);
                    alert("Processing failed: " + (data.error || "Unknown error"));
                } else {
                    setTimeout(poll, 1000);
                }
            } catch (e) {
                setTimeout(poll, 1000);
            }
        };

        poll();
    };

    /**
     * Load a page of telemetry data
     */
    app.api.loadTelemetryPage = async function(analysisId, page, perPage, imei) {
        try {
            const params = new URLSearchParams({ page, per_page: perPage });
            if (imei && imei !== 'all') params.set('imei', imei);
            const res = await fetch(`/api/result/${analysisId}/telemetry?${params}`);
            if (!res.ok) throw new Error('Failed to load telemetry');
            const data = await res.json();
            app.state.rawPage = data.page;
            app.state.rawPages = data.pages;
            app.state.rawTotal = data.total;
            app.tables.renderRaw(data.rows, data);
            // Update map with telemetry points
            if (data.rows && data.rows.length > 0) {
                app.mapModule.render(data.rows);
            }
        } catch (e) {
            console.error('Failed to load telemetry page', e);
        }
    };

    /**
     * Load a saved result by ID
     */
    app.api.loadResult = async function(id) {
        app.utils.showLoader(true);
        app.utils.showSkeletons();
        try {
            const res = await fetch(`/api/result/${id}`);
            if (!res.ok) throw new Error("Load failed");
            const data = await res.json();
            app.utils.hideSkeletons();
            app.api.renderDashboard(data, id);
        } catch (e) {
            app.utils.hideSkeletons();
            app.elements.emptyState.classList.remove('hidden');
            app.elements.dashboard.classList.add('hidden');
            alert("Error loading result: " + e.message);
        } finally {
            app.utils.showLoader(false);
        }
    };

    /**
     * Render the dashboard with data
     */
    app.api.renderDashboard = function(data, analysisId) {
        if (analysisId) app.state.currentAnalysisId = analysisId;
        // Reset state
        app.state.selectedImei = 'all';
        document.getElementById('search-scorecard').value = '';
        document.getElementById('search-stats').value = '';

        app.state.tableSorts = {
            'scorecard-table': { column: null, dir: null },
            'stats-table': { column: null, dir: null }
        };

        // Reset tab view
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelector('[data-tab="scorecard"]').classList.add('active');
        document.getElementById('tab-scorecard').classList.remove('hidden');

        app.elements.emptyState.classList.add('hidden');
        app.elements.dashboard.classList.remove('hidden');

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

        // Populate IMEI filter
        const imeis = (data.scorecard || []).map(s => s.imei);
        app.elements.imeiFilter.innerHTML = `<option value="all">${app.localization.t().all_devices}</option>` +
            imeis.map(imei => `<option value="${imei}">${imei}</option>`).join('');
        app.elements.imeiFilter.value = 'all';

        app.state.currentData = data;
        app.updateDashboardView();
    };

})(window.GPSAnalyzer);
