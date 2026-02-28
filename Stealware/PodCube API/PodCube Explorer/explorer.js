// --- STATE MANAGEMENT ---
const AppState = {
    selectedEpisode: null,
    lastCommandTime: null,
    commandHistory: [],
    filteredResults: [],
    liveDataInterval: null,
    radioMode: false,
};

const QR_CACHE = new Map(); // Stores generated QR DOM nodes to prevent re-rendering

// --- ICONS (SVG) ---
const ICONS = {
    prev: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
    next: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
    play: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    skipBack: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>`,
    skipForward:`<svg viewBox="0 0 24 24" class="icon-svg" style="transform: scaleY(-1);"><path d="M10 19c-3.54 0-6.55-2.31-7.6-5.5l-2.37.78C1.42 18.97 5.35 22 10 22c4.65 0 7.05-.99 8.9-2.6L22 23v-9h-9l3.62 3.62c-1.39 1.16-3.16 1.88-5.12 1.88z"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`
};

// --- INITIALIZATION ---
window.addEventListener('PodCube:Ready', async () => {
    try {
        // 1. Initialize Engine (Must be first)
        await PodCube.init();
        await PodUser.init();

        PodUser.onUpdate((data) => {
            renderUserUI(data)
            syncArchiveUI();
        });
        renderUserUI(PodUser.data);

        updateStatusIndicator(`Connected to ${PodCube.FEED_TYPE.toUpperCase()} Feed`);

        // 2. REGISTER LISTENERS (Must be before restoring session!)
        
        // High Frequency: Time & Scrubber
        PodCube.on('timeupdate', (status) => renderTimeDisplays(status));

        // Medium Frequency: Transport State
        const updateTransport = () => renderTransportState(PodCube.status);
        PodCube.on('play', updateTransport);
        PodCube.on('pause', updateTransport);
        PodCube.on('error', updateTransport);

        // Low Frequency: Track Changes
        PodCube.on('track', (ep) => {
            renderTrackMetadata(ep);
            updateTransport();
            updateQueueList();
            syncArchiveUI();
            if (ep) loadEpisodeInspector(ep);
        });

        // Batched Queue Updates
        PodCube.on('queue:changed', () => {
            requestAnimationFrame(() => {
                updateQueueList(); 
                updatePunchcardPreview();
                syncArchiveUI();
            });
        });

        PodCube.on('ended', (episode) => {
            if (episode && window.PodUser) {
                PodUser.logListen(episode.id);
            }
        });

        // 3. Restore Session & Sync State
        // Now that listeners are active, they will catch the events fired here
        await PodCube.restoreSession();
        
        // Update status based on session restoration
        const queueSize = PodCube.queue?.length || 0;
        if (queueSize > 0) {
            updateStatusIndicator(`Session Restored • ${queueSize} item${queueSize === 1 ? '' : 's'} in queue`);
        } else {
            updateStatusIndicator(`${PodCube.FEED_TYPE.toUpperCase()} Feed • ${PodCube.episodes.length} transmissions available`);
        }

        // 4. Static UI Setup & Initial Render
        // Run these once to ensure UI is populated even if no events fired
        updateQueueList(); 
        renderSystemInfo(); 
        renderTimeDisplays(PodCube.status);
        renderTransportState(PodCube.status);
        renderTrackMetadata(PodCube.nowPlaying);
        
        // Static Content
        initArchiveControls();
        updateBrigistics();
        updateGeoDistribution();
        updateArchive();
        showDistribution();
        updatePlaylistsUI();
        initQueueDragAndDrop();
        enableScrubbing('scrubber');
        enableScrubbing('playerScrubber');
        refreshSessionInspector();
        initPasteHandler();
        initPunchcardDragDrop();
        initNavigation(); // This handles all tab navigation, history, and preference restoration

        // 5. Check for Import Code (Punchcards)
        const importCode = PodCube.getImportCodeFromUrl();
        if (importCode) handleIncomingPlaylistCode(importCode);

        // 6. Load Inspector if track exists
        if (PodCube.nowPlaying) {
             loadEpisodeInspector(PodCube.nowPlaying);
        }
        
    } catch (e) {
        console.error("Initialization Failed:", e);
        const ind = document.getElementById('statusIndicator');
        if(ind) ind.textContent = `System Failure: ${e.message || 'Unknown error'}`;
    }
});

// --- CORE UTILITIES ---
function run(code, silent = false) {
    if (!silent) {
        logCommand(code);
    }
    
    try { 
        const result = window.eval(code);
        
        AppState.commandHistory.push({
            code,
            timestamp: Date.now(),
            success: true
        });
        
        return result;
    } catch (e) { 
        console.error('Command execution error:', e);
        AppState.commandHistory.push({
            code,
            timestamp: Date.now(),
            success: false,
            error: e.message
        });
        logCommand(`// ERROR: ${e.message}`);
        return null;
    }
}

function logCommand(code) {
    const monitorText = document.getElementById('monitorText');
    const timestamp = new Date().toLocaleTimeString();
    
    if (monitorText) monitorText.textContent = code;
    
    const timestampEl = document.getElementById('monitorTimestamp');
    if (timestampEl) timestampEl.textContent = timestamp;
    
    AppState.lastCommandTime = Date.now();
}

function updateStatusIndicator(text) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) indicator.textContent = text;
}

// --- UI SUBRENDERERS ---
function renderSystemInfo() {
    // Populate API Tab Statistics
    const totalEl = document.getElementById('confTotal');
    if (totalEl) totalEl.textContent = PodCube.episodes.length;

    const feedEl = document.getElementById('confFeed');
    if (feedEl) feedEl.textContent = PodCube.FEED_TYPE.toUpperCase();

    const debugEl = document.getElementById('confDebug');
    if (debugEl) debugEl.textContent = PodCube.DEBUG ? "ON" : "OFF";
    
    // Update the feed toggle button text
    const toggleBtn = document.getElementById('feedToggleBtn');
    if (toggleBtn) {
        const nextType = PodCube.FEED_TYPE === 'rss' ? 'JSON' : 'RSS';
        toggleBtn.textContent = `Switch to ${nextType}`;
    }
}

function updateBrigistics() {
    const stats = PodCube.getStatistics();

    const display = [
        { l: 'Transmissions', v: stats.totalEpisodes },
        { l: 'Unique Models', v: stats.models },
        { l: 'Origin Points', v: stats.origins },
        { l: 'Avg Integrity', v: stats.averageIntegrity + '%' }
    ];
    
    const grid = document.getElementById('statsGrid');
    const template = document.getElementById('tmpl-stat-box');
    
    if (grid && template) {
        grid.textContent = ''; // Clear safely
        display.forEach(s => {
            const clone = document.importNode(template.content, true);
            clone.querySelector('.stat-num').textContent = s.v;
            clone.querySelector('.stat-lbl').textContent = s.l;
            grid.appendChild(clone);
        });
    }

    logCommand('PodCube.getStatistics()');
}

function showDistribution() {
    const h = PodCube.getDistribution();
    
    const renderCol = (title, items, filterKey) => {
        const sorted = items.sort((a, b) => b.count - a.count);
        return `
        <div style="flex:1; border:1px solid #ddd; padding:12px; height:320px; overflow-y:auto; background:#fff; border-radius:4px;">
            <h4 style="border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:10px; font-size:14px;">${title}</h4>
            ${sorted.map(i => `
                <div class="hierarchy-item" onclick="applyHierarchyFilter('${filterKey}', '${escapeForAttribute(i.name)}')" 
                     style="display:flex; justify-content:space-between; font-size:11px; padding:4px 6px; border-bottom:1px solid #f5f5f5; cursor:pointer; transition: background 0.15s ease;">
                    <span style="font-family:'Fustat'">${escapeHtml(i.name)}</span>
                    <span style="font-weight:700; color:var(--primary); font-family:'Fustat'">${i.count}</span>
                </div>
            `).join('')}
        </div>`;
    };
    
    const output = document.getElementById('loreOutput');
    if (output) {
        output.innerHTML = `
            <div style="display:flex; gap:12px; width:100%;">
                ${renderCol('Models', h.models, 'model')}
                ${renderCol('Origins', h.origins, 'origin')}
                ${renderCol('Tags', h.tags, 'tag')}
            </div>
        `;
    }
    
    logCommand(`PodCube.getDistribution() // ${h.models.length} models, ${h.origins.length} origins, ${h.tags.length} tags`);
}

function renderDistributionGrid(containerId, columns, customClass = 'distribution-grid') {
    const container = document.getElementById(containerId);
    const tCol = document.getElementById('tmpl-hierarchy-col');
    const tItem = document.getElementById('tmpl-hierarchy-item');

    if (!container || !tCol || !tItem) return;

    container.textContent = '';
    const grid = document.createElement('div');
    grid.className = customClass; // Use class for layout control

    let hasContent = false;

    columns.forEach(colDef => {
        if (!colDef.items || colDef.items.length === 0) return;
        hasContent = true;

        const col = document.importNode(tCol.content, true);
        col.querySelector('.hierarchy-title').textContent = colDef.title;
        const list = col.querySelector('.hierarchy-list');
        
        // Sorting: Default to Count (Desc) unless specified otherwise (e.g. Eras)
        const sorted = colDef.noSort 
            ? colDef.items 
            : [...colDef.items].sort((a, b) => b.count - a.count);

        sorted.forEach(i => {
            const item = document.importNode(tItem.content, true);
            item.querySelector('.hi-name').textContent = i.name;
            item.querySelector('.hi-count').textContent = i.count;
            item.querySelector('.hierarchy-item').addEventListener('click', () => {
                applyHierarchyFilter(colDef.key, i.value || i.name);
            });
            list.appendChild(item);
        });
        
        grid.appendChild(col);
    });

    if (hasContent) {
        container.appendChild(grid);
    } else {
        container.innerHTML = '<p class="text-muted" style="font-size:12px;">No distribution data available</p>';
    }
}

function showDistribution() {
    const dist = PodCube.getDistribution();
    
    // Eras need special formatting to match the renderer's expected structure
    const eras = PodCube.getYearGroups(10).map(g => ({
        name: g.label,
        count: g.count,
        value: JSON.stringify([g.start, g.end])
    }));

    const columns = [
        { title: 'Models', items: dist.models, key: 'model' },
        { title: 'Eras', items: eras, key: 'year', noSort: true },
        { title: 'Tags', items: dist.tags, key: 'tag' }
    ];

    renderDistributionGrid('loreOutput', columns, 'distribution-grid');
    logCommand(`PodCube.getDistribution()`);
}

function updateGeoDistribution() {
    const dist = PodCube.getDistribution();

    const columns = [
        { title: 'Origins', items: dist.origins, key: 'origin' },
        { title: 'Locales', items: dist.locales, key: 'locale' },
        { title: 'Regions', items: dist.regions, key: 'region' },
        { title: 'Zones', items: dist.zones, key: 'zone' },
        { title: 'Planets', items: dist.planets, key: 'planet' }
    ];

    renderDistributionGrid('geoDistribution', columns, 'geo-distribution-grid');
}

// Apply filter from hierarchy click
function applyHierarchyFilter(filterType, value) {
    // Switch to archive tab
    const archiveTab = document.querySelector('[data-tab="archive"]');
    if (archiveTab) archiveTab.click();
    
    // Reset all filters first
    resetArchive();
    
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (filterType === 'year') {
        // Special Handling for Eras
        const groupSel = document.getElementById('arcYearGroup');
        const yearSel = document.getElementById('arcYear');
        
        // Ensure 5-year grouping is selected so the options match
        if (groupSel) {
            groupSel.value = '10';
            updateYearOptions(); // Regenerate options based on group size
        }
        
        if (yearSel) {
            yearSel.value = value; // Value is JSON range
            updateArchive();
        }
        return;
    }

    // Apply standard filters
    const elementMap = {
        'model': 'arcModel',
        'origin': 'arcOrigin',
        'region': 'arcRegion',
        'zone': 'arcZone',
        'planet': 'arcPlanet',
        'locale': 'arcLocale',
        'tag': 'arcSearch'
    };
    
    const elementId = elementMap[filterType];
    const element = document.getElementById(elementId);
    
    if (element) {
        if (filterType === 'tag') {
            element.value = value;
        } else {
            element.value = value;
        }
        updateArchive();
    }
}

// --- ARCHIVE REGISTRY TRANSMISSIONS SCREEN ---
function initArchiveControls() {
    const populate = (id, items) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        
        const first = sel.firstElementChild;
        sel.innerHTML = ''; 
        if(first) sel.appendChild(first);
        
        items.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            sel.appendChild(opt);
        });
    };
    
    populate('arcModel', PodCube.models);
    populate('arcOrigin', PodCube.origins);
    
    // Populate geo filters
    const regions = [...new Set(PodCube.all.map(ep => ep.region).filter(Boolean))];
    const zones = [...new Set(PodCube.all.map(ep => ep.zone).filter(Boolean))];
    const planets = [...new Set(PodCube.all.map(ep => ep.planet).filter(Boolean))];
    const locales = [...new Set(PodCube.all.map(ep => ep.locale).filter(Boolean))];
    
    populate('arcRegion', regions);
    populate('arcZone', zones);
    populate('arcPlanet', planets);
    populate('arcLocale', locales);
    
    updateYearOptions();
}

function updateYearOptions() {
    const groupSize = parseInt(document.getElementById('arcYearGroup')?.value) || 10;
    const groups = PodCube.getYearGroups(groupSize);
    const sel = document.getElementById('arcYear');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">All Time</option>';
    
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify([g.start, g.end]);
        opt.textContent = `${g.label} (${g.count})`;
        sel.appendChild(opt);
    });
    
    updateArchive();
}


// Debounce Archive Updates
const _debouncedUpdate = debounce(_performUpdateArchive, 300);
function updateArchive() {
    _debouncedUpdate();
}


function _performUpdateArchive() {
    // 1. Gather Filter State
    const filters = {
        search: document.getElementById('arcSearch')?.value || '',
        model: document.getElementById('arcModel')?.value || '',
        origin: document.getElementById('arcOrigin')?.value || '',
        region: document.getElementById('arcRegion')?.value || '',
        zone: document.getElementById('arcZone')?.value || '',
        planet: document.getElementById('arcPlanet')?.value || '',
        locale: document.getElementById('arcLocale')?.value || '',
        episodeType: document.getElementById('arcType')?.value || ''
    };

    // Handle Year Range (UI stores JSON array in value)
    const yearRangeVal = document.getElementById('arcYear')?.value;
    if (yearRangeVal) {
        filters.year = JSON.parse(yearRangeVal);
    }

    // 2. Gather Sort State
    const sortMode = document.getElementById('arcSort')?.value || 'release_desc';

    // 3. Execute API Call
    // Now passing 'filters' AND 'sortMode' to the improved where()
    const results = PodCube.where(filters, sortMode);

    // 4. Update UI
    AppState.filteredResults = results;
    renderArchiveResults(results); // (Ensure you have extracted the rendering logic as discussed previously)
    
    // Debug Logging
    const activeFilters = Object.keys(filters).filter(k => filters[k]).length;
    logCommand(`PodCube.where({ ${activeFilters} filters }, "${sortMode}") // Found ${results.length}`);
}

function renderArchiveResults(results) {
    const resCount = document.getElementById('resCount');
    if (resCount) resCount.textContent = `${results.length} Records`;
    
    const list = document.getElementById('archiveList');
    const tCard = document.getElementById('tmpl-ep-card');
    if (!list || !tCard) return;
    
    list.textContent = ''; 

    if (results.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🅿️</div>
                <div>No records match your search parameters.</div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach(ep => {
        const idx = PodCube.getEpisodeIndex(ep);
        const intVal = ep.integrityValue;
        const intColor = intVal < 20 ? 'var(--danger)' : (intVal < 90 ? 'var(--warning)' : 'var(--success)');
        const isInQueue = PodCube.queueItems.some(qEp => qEp.id === ep.id);

        const clone = document.importNode(tCard.content, true);
        const card = clone.querySelector('.ep-card');
        const queueBtn = card.querySelector('.btn-queue');
        card.dataset.epId = ep.id;

        const titleEl = clone.querySelector('.et-text');
        if (titleEl) {titleEl.textContent = ep.title;}
        else {clone.querySelector('.ep-title').textContent = ep.title;}

        clone.querySelector('.ep-date').textContent = ep.date?.toString() || 'No Date';
        clone.querySelector('.ep-type').textContent = ep.episodeType || 'unknown';
        clone.querySelector('.ep-model').textContent = ep.model || 'Unknown Model';
        clone.querySelector('.ep-duration').textContent = ep.duration ? `${ep.weirdDuration}` : '0:00';
        clone.querySelector('.ep-location').textContent = ep.location || 'Unknown Location';
        
        const fill = clone.querySelector('.integrity-fill');
        fill.style.width = `${intVal}%`;
        fill.style.backgroundColor = intColor;
        
        clone.querySelector('.integrity-text').textContent = `${intVal}% INTEGRITY`;
        clone.querySelector('.integrity-container').title = `Data Integrity: ${intVal}%`;

        // REMOVE THIS LATER
        if (PodCube.nowPlaying === ep) card.classList.add('playing');
        if (isInQueue) queueBtn.classList.add('selected');

        card.addEventListener('click', () => handleEpisodeClick(idx));

        clone.querySelector('.btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.play(PodCube.all[${idx}])`);
        });

        clone.querySelector('.btn-play-next').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.addNextInQueue(PodCube.all[${idx}])`);
        });

        clone.querySelector('.btn-queue').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.addToQueue(PodCube.all[${idx}])`);
        });

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
    syncArchiveUI();
}

/**
 * TARGETED UPDATE: Syncs visual state (Queue/Playing) without re-rendering DOM.
 * Prevents 'weirdDuration' churn and layout thrashing.
 */
function syncArchiveUI() {
    const queueIds = new Set(PodCube.queueItems.map(ep => ep.id));
    const playingId = PodCube.nowPlaying?.id;
    const historyIds = window.PodUser ? new Set(window.PodUser.data.history) : new Set();

    const cards = document.querySelectorAll('#archiveList .ep-card, #inspectorRelated .related-ep-card');
    
    cards.forEach(card => {
        const id = card.dataset.epId;
        if (!id) return;

        const queueBtn = card.querySelector('.btn-queue');

        if (queueBtn) {
            if (queueIds.has(id)) {
                queueBtn.classList.add('selected');
            } else {
                queueBtn.classList.remove('selected');
            }
        }

        if (id === playingId) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        if (historyIds.has(id)) {
            card.classList.add('is-played');
        } else {
            card.classList.remove('is-played');
        }
    });
}

function handleEpisodeClick(index) {
    const episode = PodCube.all[index];
    loadEpisodeInspector(episode);
    
    //Switch to inspector tab
    const tab = document.querySelector('[data-tab="inspector"]');
    if (tab) tab.click();
}

function resetArchive() {
    ['arcSearch', 'arcModel', 'arcOrigin', 'arcRegion', 'arcZone', 'arcPlanet', 'arcLocale', 'arcType', 'arcYear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateArchive();
}

function playFilteredResults() {
    if (AppState.filteredResults.length === 0) return;
    
    // Clear queue and add all results
    run('PodCube.clearQueue()', true);
    AppState.filteredResults.forEach((ep, i) => {
        run(`PodCube.addToQueue(PodCube.all[${PodCube.getEpisodeIndex(ep)}])`, i > 0);
    });
    
    // Play first
    if (PodCube.queueItems.length > 0) {
        run('PodCube.next()');
    }
}

function queueFilteredResults() {
    if (AppState.filteredResults.length === 0) return;
    
    AppState.filteredResults.forEach((ep, i) => {
        run(`PodCube.addToQueue(PodCube.all[${PodCube.getEpisodeIndex(ep)}])`, i > 0);
    });
}

// --- EPISODE INSPECTOR (COMPREHENSIVE) ---
function loadEpisodeInspector(ep) {
    if (!ep) {
        clearInspector();
        return;
    }
    
    AppState.selectedEpisode = ep;
    // Save to localStorage for session persistence
    localStorage.setItem('podcube_last_inspected', ep.id);
    updateArchive();
    
    const idx = PodCube.getEpisodeIndex(ep);
    
    // === HEADER CARD ===
    const header = document.getElementById('inspectorHeader');
    if (header) {
        header.innerHTML = `
            <div class="inspector-summary">
                <div class="inspector-summary-header">
                    <h2 class="inspector-title">${escapeHtml(ep.title)}</h2>
                    <div class="inspector-summary-actions">
                        <button class="inspector-action-btn primary" onclick="run('PodCube.play(PodCube.all[${idx}])')">
                            PLAY NOW
                        </button>
                        <button class="inspector-action-btn" onclick="run('PodCube.addNextInQueue(PodCube.all[${idx}])')">
                            PLAY NEXT
                        </button>
                        <button class="inspector-action-btn" onclick="run('PodCube.addToQueue(PodCube.all[${idx}])')">
                            ADD TO QUEUE
                        </button>
                    </div>
                </div>
                <div class="inspector-summary-main">
                    <div class="inspector-meta-line">
                        <span class="label">Type</span>
                        <span class="value">${escapeHtml(ep.episodeType || 'none')}</span>
                        <span class="separator">•</span>
                        <span class="label">Model</span>
                        <span class="value">${escapeHtml(ep.model || 'N/A')}</span>
                        <span class="separator">•</span>
                        <span class="label">Duration</span>
                        <span class="value">${escapeHtml(ep.timestamp || 'N/A')}</span>
                        <span class="separator">•</span>
                        <span class="label">Integrity</span>
                        <span class="value">${escapeHtml(ep.integrity || 'N/A')}</span>
                    </div>
                    <div class="inspector-meta-line">
                        <span class="label">Origin</span>
                        <span class="value">${escapeHtml(ep.location || 'Unknown')}</span>
                    </div>
                    <div class="inspector-meta-line">
                        <span class="label">Date</span>
                        <span class="value">${escapeHtml(ep.date?.toString() || 'Unknown Date')}</span>
                        ${ep.anniversary ? `<span class="separator">•</span><span class="value" style="font-style:italic;">${escapeHtml(ep.anniversary)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // === REPORT BODY ===
    const body = document.getElementById('inspectorBody');
    body.className = 'inspector-report-body loaded';
    
    let html = '';
    
    const episodeIndex = PodCube.getEpisodeIndex(ep);
    
// Core Properties Section
html += '<div class="inspector-section">';
html += '<h4 class="inspector-section-title">Executive Summary</h4>';
html += '<div class="inspector-prose">';
html += `<p>This transmission `;
if (ep.anniversary) {
    html += `originated <strong>${escapeHtml(ep.anniversary)}</strong>, and `;
}
html += `has been titled "<strong>${escapeHtml(ep.title)}</strong>" by the Brigistics department. `;

// Narrative Location Data
html += `<br><br>Geographic metadata indicates it originated from planet <strong>${escapeHtml(ep.planet || 'Unknown')}</strong>, `;
html += `within the <strong>${escapeHtml(ep.region || 'Unknown')}</strong> region of the <strong>${escapeHtml(ep.zone || 'Unknown')}</strong> zone. `;
html += `The specific locale is identified as <strong>${escapeHtml(ep.locale || 'Unknown')}</strong>, `;
html += `with the primary origin point recorded as <strong>"${escapeHtml(ep.origin || 'Unknown')}"</strong>. `;



html += `<br><br>It runs for <strong>${escapeHtml(ep.timestamp || 'N/A')}</strong> `;
html += `(${ep.duration ? ep.duration + ' seconds' : 'duration unknown'})`;
if (ep.weirdDuration) {
    html += `, or roughly ${escapeHtml(ep.weirdDuration)}`;
}
html += `. `;
if (ep.sizeBytes) {
    html += `The audio file size is <strong>${formatBytes(ep.sizeBytes)}</strong>. `;
}
html += `Audio source is ${ep.audioUrl ? '<strong>present</strong>' : '<strong style="color:var(--danger);">missing</strong>'}. `;
html += `This transmission's Global Unique ID string is: <strong>"${escapeHtml(ep.id || 'N/A')}"</strong>. `;


html += `<br><br>It has been cataloged at index <strong>PodCube.all[${episodeIndex}]</strong> with shortcode date <strong>${escapeHtml(ep.shortcode || 'N/A')}</strong>, `;
html += `is of the type: <strong>"${escapeHtml(ep.episodeType || 'N/A')}"</strong>, `;
html += `and carries an integrity rating of <strong>${escapeHtml(ep.integrity || 'N/A')}</strong>`;
if (ep.integrityValue !== null) {
    html += ` (${ep.integrityValue}%). `;
}

//related check
const related = PodCube.findRelated(ep, 5);
if (related.length > 0) {
    const titles = related.map(relEp => `"${escapeHtml(relEp.title)}"`);
    let relatedTitlesNarrative = "";

    if (titles.length === 1) {
        relatedTitlesNarrative = titles[0];
    } else {
        const lastTitle = titles.pop();
        relatedTitlesNarrative = titles.join(', ') + ", and/or " + lastTitle;
    }

    html += `<br><br>It may or may not be related to ${relatedTitlesNarrative} which will be linked at the bottom of this document.`;
}

html += `</p></div></div>`;

    // Tags
    if (ep.tags && ep.tags.length > 0) {
        html += '<div class="inspector-section">';
        html += '<h4 class="inspector-section-title">Classification Tags</h4>';
        html += '<div class="inspector-tag-list">';
        ep.tags.forEach(tag => {
            html += `<span class="inspector-tag-pill" onclick="applyHierarchyFilter('tag', '${escapeForAttribute(tag)}')">${escapeHtml(tag)}</span>`;
        });
        html += '</div>';
        html += '</div>';
    }
    
    // Temporal Analysis
    html += '<div class="inspector-section">';
    html += '<h4 class="inspector-section-title">Temporal Analysis</h4>';
    html += '<div class="inspector-callout">';
    html += '<div class="inspector-callout-title">Origin Timeline</div>';
    html += '<div class="inspector-callout-content">';

    
    html += `<strong>Origin Date:</strong> ${escapeHtml(ep.date?.toString() || 'Unknown Date')}<br>`;
    if (ep.anniversary) {
        html += `<strong>Anniversary:</strong> ${escapeHtml(ep.anniversary)}<br>`;
    }
    html += `<strong>Published:</strong> ${ep.published ? new Date(ep.published).toLocaleDateString() + ' at ' + new Date(ep.published).toLocaleTimeString() : 'N/A'}`;
    
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    // Geographic Data
    html += '<div class="inspector-section">';
    html += '<h4 class="inspector-section-title">Geographic Metadata</h4>';
    html += '<div class="inspector-data-grid">';
    html += `<div class="data-label">Origin Point</div><div class="data-value code">${escapeHtml(ep.origin || 'N/A')}</div>`;
    html += `<div class="data-label">Locale</div><div class="data-value code">${escapeHtml(ep.locale || 'N/A')}</div>`;
    html += `<div class="data-label">Region</div><div class="data-value code">${escapeHtml(ep.region || 'N/A')}</div>`;
    html += `<div class="data-label">Zone</div><div class="data-value code">${escapeHtml(ep.zone || 'N/A')}</div>`;
    html += `<div class="data-label">Planet</div><div class="data-value code">${escapeHtml(ep.planet || 'N/A')}</div>`;
    html += '</div>';
    html += '</div>';

    // Related Episodes (10 this time)
    const related10 = PodCube.findRelated(ep, 10);
    if (related10.length > 0) {
        html += '<div class="inspector-section">';
        html += '<h4 class="inspector-section-title">Related Transmissions</h4>';
        html += '<div class="inspector-related-list">';
        related10.forEach(relEp => {
            const relIdx = PodCube.getEpisodeIndex(relEp);
            html += `<div class="inspector-related-item" onclick="loadEpisodeInspector(PodCube.all[${relIdx}]); window.scrollTo({ top: 0, behavior: 'instant' });">`; // yeah i know this is bad shut up
            html += '<div class="inspector-related-item-info">';
            html += `<div class="inspector-related-item-title">${escapeHtml(relEp.title)}</div>`;
            html += `<div class="inspector-related-item-meta">${escapeHtml(relEp.model || 'Unknown')} • ${escapeHtml(relEp.origin || 'Unknown')}</div>`;
            html += '</div>';
            html += '<div class="inspector-related-item-arrow">→</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }
    
    
    body.innerHTML = html;
    
    // Show raw data section
    document.getElementById('inspectorRawSection').style.display = 'block';
    
    // Raw Data Panels
    try {
        document.getElementById('rawJson').textContent = JSON.stringify(ep, null, 2);
        
        // Parsed metadata
        const meta = {};
        ['model', 'origin', 'region', 'zone', 'planet', 'locale', 'integrity', 'date', 'tags'].forEach(key => {
            if (ep[key] !== undefined && ep[key] !== null) {
                meta[key] = ep[key];
            }
        });
        document.getElementById('rawMeta').textContent = JSON.stringify(meta, null, 2);
        
        // Raw description
        document.getElementById('rawDesc').textContent = ep.description || '// No description';
    } catch (e) {
        console.error('Error rendering raw data:', e);
    }
    
    logCommand(`PodCube.all[${idx}] // Inspecting: ${ep.title}`);
}

function renderFields(containerId, fields) {
    const container = document.getElementById(containerId);
    const template = document.getElementById('tmpl-inspector-field');
    if (!container || !template) return;
    
    container.textContent = ''; // Clear existing
    const grid = document.createElement('div');
    grid.className = 'inspector-grid';

    fields.forEach(f => {
        const clone = document.importNode(template.content, true);
        const fieldContainer = clone.querySelector('.inspector-field');
        const valueDisplay = clone.querySelector('.inspector-field-value');
        
        // This triggers the CSS label
        fieldContainer.dataset.label = f.label; 
        
        // This populates the actual data
        valueDisplay.textContent = f.value || '-'; 
        
        // Add styling for empty or code fields
        if (!f.value) valueDisplay.classList.add('empty');
        if (f.code) valueDisplay.classList.add('code');
        
        grid.appendChild(clone);
    });

    container.appendChild(grid);
}

function loadRelatedEpisodes(ep) {
    const container = document.getElementById('inspectorRelated');
    const template = document.getElementById('tmpl-related-ep');
    if (!container || !template) return;
    
    const related = PodCube.findRelated(ep, 5);
    container.textContent = '';
    
    if (related.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size:12px;">No related episodes found</p>';
        return;
    }
    
    related.forEach(relEp => {
        const clone = document.importNode(template.content, true);
        const card = clone.querySelector('.related-ep-card');
        card.dataset.epId = relEp.id; // Sets ID to hook into syncArchiveUI

        const titleEl = clone.querySelector('.et-text');
        if (titleEl) {titleEl.textContent = relEp.title;}
        else {clone.querySelector('.related-ep-title').textContent = relEp.title;}
        clone.querySelector('.related-ep-meta').textContent = `${relEp.model || 'Unknown'} • ${relEp.origin || 'Unknown'}`;
        clone.querySelector('.related-ep-card').addEventListener('click', () => {
            loadEpisodeInspector(relEp);
        });
        container.appendChild(clone);
    });

    syncArchiveUI();
    
    logCommand(`PodCube.findRelated(PodCube.all[${PodCube.getEpisodeIndex(ep)}], 5) // ${related.length} found`);
}

function clearInspector() {
    // Reset Header
    const header = document.getElementById('inspectorHeader');
    if (header) {
        header.innerHTML = `
            <div class="inspector-empty-state">
                <h3>Transmission Data Inspector</h3>
                <p class="text-muted">Select an episode from the Transmissions tab to view complete metadata and analysis.</p>
            </div>
        `;
    }

    // Clear body
    const body = document.getElementById('inspectorBody');
    if (body) {
        body.className = 'inspector-report-body';
        body.innerHTML = '';
    }
    
    // Hide raw data section
    const rawSection = document.getElementById('inspectorRawSection');
    if (rawSection) {
        rawSection.style.display = 'none';
    }
    
    AppState.selectedEpisode = null;
}

// --- PLAYBACK TAB ---

function toggleAutoplayMode(enabled) {
    PodCube.setRadioMode(enabled);
    // Sync UI
    const checkbox = document.getElementById('autoplayRandom');
    if (checkbox) checkbox.checked = enabled;
}

function playNextRandom() {
    const nextEp = PodCube.random;
    if (nextEp) {
        const epIdx = PodCube.getEpisodeIndex(nextEp);
        run(`PodCube.play(PodCube.all[${epIdx}])`);
    }
}

function updatePlayerVolume(value) {
    const vol = value / 100;
    run(`PodCube.setVolume(${vol.toFixed(2)})`, true);

}

function updatePlayerSpeed(value) {
    run(`PodCube.setPlaybackRate(${value})`, true);
}

// MAIN PLAYER SCREEN (THESE ARE REDUNDANT)
function seekPlayer(e) {
    const scrub = document.getElementById('playerScrubber');
    const rect = scrub.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = (clientX - rect.left) / rect.width;
    const time = pct * PodCube.status.duration;
    run(`PodCube.seek(${time.toFixed(1)})`);
}

// FOR THE SMALLER BOTTOM ONE
function seek(e) {
    const scrub = document.getElementById('scrubber');
    const rect = scrub.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = (clientX - rect.left) / rect.width;
    const time = pct * PodCube.status.duration;
    run(`PodCube.seek(${time.toFixed(1)})`);
}



function enableScrubbing(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let isDragging = false;

    // Extract clientX from either a MouseEvent or a TouchEvent
    const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

    const seekToPoint = (e) => {
        const rect = el.getBoundingClientRect();
        const relativeX = getClientX(e) - rect.left;
        const percent = Math.max(0, Math.min(1, relativeX / rect.width));

        if (PodCube.status.duration) {
            const time = percent * PodCube.status.duration;
            run(`PodCube.seek(${time.toFixed(2)})`, true);
        }
    };

    // ── Mouse ────────────────────────────────────────────
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        seekToPoint(e);
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            seekToPoint(e);
        }
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    // ── Touch ────────────────────────────────────────────
    el.addEventListener('touchstart', (e) => {
        isDragging = true;
        seekToPoint(e);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        // cancelable guard required — passive listeners can't preventDefault
        if (e.cancelable) e.preventDefault();
        seekToPoint(e);
    }, { passive: false });

    document.addEventListener('touchend', () => { isDragging = false; });
    document.addEventListener('touchcancel', () => { isDragging = false; });
}

function updatePunchcardPreview() {
    const list = document.getElementById('pcPreviewList');
    const countLabel = document.getElementById('pcPreviewCount');
    if (!list || !countLabel) return;

    const q = PodCube.queueItems;
    
    // Update count
    countLabel.textContent = `${q.length} Item${q.length !== 1 ? 's' : ''}`;
    
    // Clear list
    list.innerHTML = '';

    if (q.length === 0) {
        list.innerHTML = '<div class="pc-preview-empty">Buffer empty. Add transmissions to queue to issue card.</div>';
        return;
    }

    // Populate simplified list
    // We limit to 50 items for performance in the mini view
    const previewItems = q.slice(0, 50);
    
    previewItems.forEach((ep, i) => {
        const div = document.createElement('div');
        div.className = 'pc-preview-item';
        div.innerHTML = `
            <span class="pc-preview-title">${i + 1}. ${escapeHtml(ep.title)}</span>
            <span class="pc-preview-meta">${ep.timestamp || '0:00'}</span>
        `;
        list.appendChild(div);
    });

    if (q.length > 50) {
        const more = document.createElement('div');
        more.className = 'pc-preview-item';
        more.style.justifyContent = 'center';
        more.style.color = '#888';
        more.textContent = `...and ${q.length - 50} more...`;
        list.appendChild(more);
    }
}

// --- QUEUE RENDERING & INTERACTION ---

function updateQueueList() {
    const q = PodCube.queueItems;
    const list = document.getElementById('playerQueueList');
    const template = document.getElementById('tmpl-queue-item');
    
    if (!list || !template) return;
    
    // Update Stats Headers
    const countEl = document.getElementById('queueCount');
    const durationEl = document.getElementById('queueDuration');
    const positionEl = document.getElementById('queuePosition');
    
    if (countEl) countEl.textContent = `${q.length} tracks`;
    if (durationEl) {
        const totalDuration = q.reduce((sum, ep) => sum + (ep.duration || 0), 0);
        durationEl.textContent = formatTime(totalDuration) + ' total';
    }
    if (positionEl) {
        positionEl.textContent = PodCube.queueIndex >= 0 ? `Position: ${PodCube.queueIndex + 1}/${q.length}` : 'Position: -';
    }
    
    list.innerHTML = ''; 

    if (q.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🅿</div><div>Queue is empty</div></div>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();

    q.forEach((ep, i) => {
        const isCur = (i === PodCube.queueIndex);
        const clone = document.importNode(template.content, true);
        const item = clone.querySelector('.queue-item');
        
        // --- CRITICAL FIX: Disable Native Drag ---
        // We handle drag manually via JS. Native drag causes the red cursor issue.
        item.removeAttribute('draggable'); 
        item.dataset.queueIndex = i;
        item.dataset.id = ep.id;
        
        if (isCur) {
            item.classList.add('current');
            item.style.borderLeft = "4px solid var(--primary)";
            item.style.backgroundColor = "var(--primary-dim)";
        }

        // Populate Info
        clone.querySelector('.queue-item-number').textContent = `${i + 1}.`;
        clone.querySelector('.qi-title').textContent = ep.title;
        clone.querySelector('.queue-item-meta').textContent = `${ep.model || 'Unknown'} • ${ep.timestamp || '0:00'}`;
        
        // --- CLICK TO PLAY (Switch Track) ---
        const infoDiv = clone.querySelector('.queue-item-info');
        infoDiv.style.cursor = 'pointer';
        infoDiv.title = "Tap to play this track";
        infoDiv.onclick = (e) => {
            // Only trigger if we aren't currently dragging
            if (dragState.active) return;
            e.stopPropagation(); 
            if (isCur) {
                run('PodCube.toggle()');
            } else {
                run(`PodCube.skipTo(${i})`);
            }
        };

        // --- REMOVE BUTTON ---
        clone.querySelector('.btn-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.removeFromQueue(${i})`);
        });

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
}


// --- HYBRID DRAG AND DROP SYSTEM (Mobile + Desktop) ---

const dragState = {
    active: false,
    item: null,       // The real DOM element we are moving
    ghost: null,      // The floating visual copy
    startIndex: -1,   // Array index where we started
    offsetY: 0,       // Distance from finger to top of item
    listRect: null,   // Cached bounds of the container
    scroller: null,   // Interval ID for auto-scrolling
    scrollSpeed: 0
};

function initQueueDragAndDrop() {
    const list = document.getElementById('playerQueueList');
    if (!list) return;

    // Remove old listeners if any to prevent duplicates
    list.removeEventListener('mousedown', onDragStart);
    list.removeEventListener('touchstart', onDragStart);

    // 1. Desktop Mouse
    list.addEventListener('mousedown', onDragStart);
    
    // 2. Mobile Touch (passive: false is REQUIRED to block scrolling)
    list.addEventListener('touchstart', onDragStart, { passive: false });
}

function onDragStart(e) {
    // A. Filter Targets: Only allow drag on the Handle or Number
    // This allows the user to scroll the list normally by touching the text area
    const target = e.target;
    const handle = target.closest('.queue-drag-handle, .queue-item-number');
    
    if (!handle) return; 

    const item = handle.closest('.queue-item');
    if (!item) return;

    // B. Stop Browser from Scrolling/Selecting
    if (e.type === 'touchstart') {
        e.preventDefault(); 
    }

    // C. Normalize Coordinates
    const point = e.touches ? e.touches[0] : e;
    const rect = item.getBoundingClientRect();

    // D. Initialize State
    dragState.active = true;
    dragState.item = item;
    dragState.startIndex = parseInt(item.dataset.queueIndex);
    dragState.offsetY = point.clientY - rect.top;
    dragState.listRect = document.getElementById('playerQueueList').getBoundingClientRect();

    // E. Create Ghost
    dragState.ghost = item.cloneNode(true);
    dragState.ghost.classList.add('dragging-ghost');
    
    // Apply exact dimensions and position to ghost
    Object.assign(dragState.ghost.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: '10000',
        opacity: '0.9',
        backgroundColor: '#ffffff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        pointerEvents: 'none', // Critical: Lets us detect element BELOW the ghost
        transform: 'scale(1.02)'
    });
    
    document.body.appendChild(dragState.ghost);

    // F. Dim Original
    item.style.opacity = '0.0'; // Invisible but keeps layout space

    // G. Attach Global Move/End Listeners
    if (e.type === 'touchstart') {
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('touchend', onDragEnd);
    } else {
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }
}

function onDragMove(e) {
    if (!dragState.active) return;
    
    // Prevent scrolling while dragging
    if (e.cancelable && e.type === 'touchmove') e.preventDefault();

    const point = e.touches ? e.touches[0] : e;

    // 1. Move Ghost
    dragState.ghost.style.top = `${point.clientY - dragState.offsetY}px`;

    // 2. Auto-Scroll Logic
    const list = document.getElementById('playerQueueList');
    const zone = 60; // Hit zone size in pixels
    
    dragState.scrollSpeed = 0;
    if (point.clientY < dragState.listRect.top + zone) {
        dragState.scrollSpeed = -10; // Scroll Up
    } else if (point.clientY > dragState.listRect.bottom - zone) {
        dragState.scrollSpeed = 10;  // Scroll Down
    }

    if (dragState.scrollSpeed !== 0 && !dragState.scroller) {
        dragState.scroller = setInterval(() => {
            list.scrollTop += dragState.scrollSpeed;
        }, 16);
    } else if (dragState.scrollSpeed === 0 && dragState.scroller) {
        clearInterval(dragState.scroller);
        dragState.scroller = null;
    }

    // 3. Live Reordering (DOM Swapping)
    // We look for the list item currently underneath our cursor
    const elementBelow = document.elementFromPoint(point.clientX, point.clientY);
    const targetItem = elementBelow?.closest('.queue-item');

    if (targetItem && targetItem !== dragState.item && list.contains(targetItem)) {
        // We found a new spot. Swap the DOM elements.
        const children = Array.from(list.children);
        const currentIndex = children.indexOf(dragState.item);
        const targetIndex = children.indexOf(targetItem);

        if (currentIndex < targetIndex) {
            list.insertBefore(dragState.item, targetItem.nextSibling);
        } else {
            list.insertBefore(dragState.item, targetItem);
        }
    }
}

function onDragEnd(e) {
    if (!dragState.active) return;

    // 1. Clean up Listeners
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);

    // 2. Clean up Visuals
    if (dragState.scroller) clearInterval(dragState.scroller);
    dragState.scroller = null;
    
    if (dragState.ghost) dragState.ghost.remove();
    if (dragState.item) dragState.item.style.opacity = '1';

    // 3. Commit Change to Engine
    // We determine the new index by checking where our item ended up in the DOM
    const list = document.getElementById('playerQueueList');
    const newIndex = Array.from(list.children).indexOf(dragState.item);

    if (newIndex !== -1 && newIndex !== dragState.startIndex) {
        // Tell PodCube engine to match the UI state
        run(`PodCube.moveInQueue(${dragState.startIndex}, ${newIndex})`);
    } else {
        // If we didn't actually move it, force a re-render to clean up styles
        updateQueueList();
    }

    dragState.active = false;
    dragState.item = null;
    dragState.ghost = null;
}

/**
 * Reads PodCube session data from localStorage and updates the inspector display.
 */
function refreshSessionInspector() {
    const display = document.getElementById('sessionDataDisplay');
    

        try {
            display.textContent = JSON.stringify(PodCube.status, null, 2);
            display.classList.remove('text-muted');
        } catch (e) {
            display.textContent = "// Error parsing session data: " +e;
        }
    logCommand("// Session Inspector Refreshed");
}

/**
 * Completely resets the engine, clears the queue, deletes the local session,
 * and purges all PodUser personnel data (achievements, history, scores).
 */
async function clearUserSession() {
    if (confirm("Are you sure? This will permanently delete your queue, saved session, ALL personnel data (achievements, history), and cached audio files.")) {
        
        // 1. Clear Engine Queue & Session
        run('PodCube.clearQueue()');
        
        // 2. Wipe Personnel Data
        if (window.PodUser && typeof window.PodUser.wipeData === 'function') {
            await window.PodUser.wipeData();
        }
        
        refreshSessionInspector();
        updateStatusIndicator("System & Personnel Data Purged");
        
        // Optional: Kick them back to the Overview tab so they can see the reset
        switchTab('overview', true);
    }
}

// --- PLAYLIST MANAGEMENT ---

/**
 * Unified Internal Handler for ALL playlist imports.
 * Takes a raw Nano-GUID or URL, validates it, saves it, and triggers the animation.
 */
function handleIncomingPlaylistCode(rawInput) {
    if (!rawInput) return false;

    let codeToImport = rawInput.trim();

    // 1. Smart-extract: If it's a full URL, grab just the parameter
    if (codeToImport.includes('importPlaylist=')) {
        try {
            const url = new URL(codeToImport);
            codeToImport = url.searchParams.get('importPlaylist') || codeToImport;
        } catch (e) {
            console.warn("URL parse failed during import, trying raw string.");
        }
    }

    // 2. Validate using the Engine API
    const result = PodCube.importPlaylist(codeToImport); 
    if (result && result.episodes.length > 0) {
        
        // 3. Switch to Punchcards Tab immediately so the user sees the "Printing"
        const tabBtn = document.querySelector('.tab-button[data-tab="punchcards"]');
        if (tabBtn && !tabBtn.classList.contains('active')) {
            tabBtn.click();
        }

        // 4. De-duplicate naming
        let finalName = result.name;
        let counter = 1;
        while (PodCube.loadPlaylist(finalName)) {
            finalName = `${result.name} (${counter})`;
            counter++;
        }
        
        // 5. Save to the Engine/LocalStorage
        const playlist = PodCube.savePlaylist(finalName, result.episodes);
        
        // 6. Visual Feedback: Trigger the Printing Animation
        // Delay slightly to allow the tab switch to render layout
        setTimeout(() => {
            animatePunchcardIssue(playlist);
        }, 100);
        
        logCommand(`// Punchcard accepted. "${finalName}" registered.`);
        return true;
    } else {
        // Only log error, let caller decide if they want to alert()
        console.error("Invalid Punchcard data provided.");
        return false;
    }
}


/**
 * Saves the current queue and triggers the "Printing" animation.
 */
function saveQueueAsPlaylist() {
    const input = document.getElementById('playlistNameInput');
    let baseName = input?.value.trim() || "Untitled";
    
    if (PodCube.queueItems.length === 0) {
        logCommand('// Error: Queue is empty');
        return;
    }

    // De-duplicate name
    let finalName = baseName;
    let counter = 1;
    while (PodCube.loadPlaylist(finalName)) {
        finalName = `${baseName} (${counter})`;
        counter++;
    }

    const playlist = PodCube.savePlaylist(finalName, PodCube.queueItems);
    logCommand(`PodCube.savePlaylist("${finalName}", ...)`);
    
    if (input) input.value = '';

    if (window.PodUser) window.PodUser.logPunchcardPrinted();
    animatePunchcardIssue(playlist);
}


/**
 * ANIMATION: Printer Slot -> Print -> Drop -> Pop
 */
function animatePunchcardIssue(playlist) {
    const input = document.getElementById('playlistNameInput');
    if (!input) {
        updatePlaylistsUI(playlist.name);
        return;
    }

    // 1. Calculate Geometry
    const rect = input.getBoundingClientRect();
    const cardWidth = 300; 
    const maskWidth = 320; // Extra room so card fits easily
    const maskHeight = 480; // Enough height for card + drop shadow
    
    // Center mask relative to input
    const maskLeft = (rect.left + (rect.width / 2)) - (maskWidth / 2);
    const maskTop = rect.bottom; 

    // 2. Create Mask (Start Closed)
    const mask = document.createElement('div');
    mask.className = 'pc-printer-mask';
    mask.style.left = `${maskLeft}px`;
    mask.style.top = `${maskTop}px`;
    mask.style.width = `${maskWidth}px`;
    mask.style.height = '0px'; // Explicitly closed at start
    
    // 3. Create Card (Start Hidden)
    const card = renderPunchcardDOM(playlist, 'anim');
    
    // FORCE INITIAL STATE IMMEDIATELY (Prevents "Shooting Up" glitch)
    card.style.opacity = '0'; // Start invisible
    card.style.position = 'absolute';
    card.style.top = '-110%'; // Way up inside the machine
    card.style.left = '50%';
    card.style.transform = 'translateX(-50%)';
    card.style.width = `${cardWidth}px`; // Force width now
    
    // 4. Mount to DOM
    mask.appendChild(card);
    document.body.appendChild(mask);
    
    // Force browser repaint so it registers the "Closed" and "Hidden" states
    void mask.offsetWidth; 

    // --- ANIMATION SEQUENCE ---

    requestAnimationFrame(() => {
        mask.classList.add('open-slot');
    });

    // Step 1: Open the Slot (Carve out the height)
    setTimeout(() => {
        mask.style.height = `${maskHeight}px`;
    }, 100); // Small delay after border appears

    // Step 2: Print (Slide Out)
    setTimeout(() => {
        card.style.opacity = '1';
        card.style.top = '20px'; // Card pushes down through the slot
    }, 800);

    // Step 3: Detach & Drop (The "Handoff")
    // Wait for print slide (1.0s + buffer)
    setTimeout(() => {

        mask.classList.remove('open-slot');
        mask.classList.add('close-slot');

        // Get exact onscreen coordinates before we touch anything
        const dropRect = card.getBoundingClientRect();
        
        
        // Re-attach card to body in "Physics Mode"
        document.body.appendChild(card);
        
        // Apply Fixed Coordinates (Seamless Match)
        card.style.position = 'fixed';
        card.style.left = `${dropRect.left}px`;
        card.style.top = `${dropRect.top}px`;
        
        // Re-apply width to prevent "narrow snap"
        card.style.width = `${cardWidth}px`; 
        card.style.minWidth = `${cardWidth}px`;
        
        card.style.margin = '0';
        card.style.transform = 'none'; // Remove the centering transform
        
        // 5. Trigger Gravity
        requestAnimationFrame(() => {
            card.classList.add('falling');
        });

        // Step 4: Grid Pop-in
        setTimeout(() => {
            if (card.parentNode) card.parentNode.removeChild(card);
            
            updatePlaylistsUI(playlist.name);

            // 2. Kill the mask (Clean up DOM)
            if (mask.parentNode) mask.parentNode.removeChild(mask);
        }, 400); 

    }, 2300); 
}


/**
 * Helper to generate card DOM.
 */
function renderPunchcardDOM(pl, indexSuffix) {
    // Generate export data once
    const exportData = PodCube.exportPlaylist(pl.name);
    
    // Safety check if export fails (e.g. empty playlist)
    const safeUrl = exportData ? exportData.url : "";
    
    const uniqueId = `qr_${Date.now()}_${indexSuffix}`;
    const totalDur = formatTime(pl.totalDuration);
    
    const card = document.createElement('div');
    card.className = 'pc-share-card-container interactive'; 
    
    // Note: We removed the inline onclick/onblur handlers here
    card.innerHTML = `
        <div class="pc-share-header">PodCube™</div>
        <div class="pc-share-body">
            <div class="pc-share-title" 
                 contenteditable="true" 
                 title="Click to Rename">
                ${escapeHtml(pl.name)}
            </div>
            <div class="pc-share-meta">${pl.episodes.length} Transmissions</div>
            <div class="pc-share-meta">Duration: ${totalDur}</div>
            <div class="pc-share-qr-frame"></div>
        </div>
        <div class="pc-share-actions">
            <button class="icon-btn btn-load" title="Load into Queue">INSERT</button>
            <button class="icon-btn btn-export" title="Copy to Clipboard">EXPORT</button>
            <button class="icon-btn btn-delete" style="color:var(--danger); border-color:var(--danger);" title="Delete Forever">SHRED</button>
        </div>
    `;
    
    const qrFrame = card.querySelector('.pc-share-qr-frame');
    
    // --- QR CODE CACHING STRATEGY ---
    // We key by the specific Export URL. If the name changes, the URL changes, 
    // automatically invalidating the cache for the new card.
    const cacheKey = safeUrl;

    if (QR_CACHE.has(cacheKey)) {
        // HIT: Move the existing DOM node here. 
        // DO NOT use cloneNode(true) because it wipes <canvas> content!
        qrFrame.appendChild(QR_CACHE.get(cacheKey));
    } else {
        // MISS: Generate new QR
        if (window.QRCode && safeUrl) {
            const qrContainer = document.createElement('div');
            // Ensure container fills frame
            qrContainer.style.width = "100%";
            qrContainer.style.height = "100%";
            
            new QRCode(qrContainer, {
                text: safeUrl,
                width: 100,
                height: 100,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
            
            // Store actual node in cache
            QR_CACHE.set(cacheKey, qrContainer);
            qrFrame.appendChild(qrContainer);
        }
    }


    card.querySelector('.btn-load').addEventListener('click', () => {
        PodCube.playPlaylist(pl.name);
        // We log a "sanitized" version for visual effect, but execute the real one above
        logCommand(`PodCube.playPlaylist("${pl.name.replace(/"/g, '\\"')}")`);
    });

    card.querySelector('.btn-export').addEventListener('click', () => {
        PlaylistSharing.exportToClipboard(pl.name);
    });

    card.querySelector('.btn-delete').addEventListener('click', () => {
        deletePlaylist(pl.name, card);
    });

    // --- RENAME LOGIC ---
    const titleEl = card.querySelector('.pc-share-title');
    
    const submitRename = () => {
        const newName = titleEl.textContent.trim();
        
        // Compare new input against the ORIGINAL name from the scope
        if (newName && newName !== pl.name) {
            handleRename(pl.name, newName);
        } else {
            // Revert visual change if invalid or unchanged
            titleEl.textContent = pl.name; 
        }
    };

    titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleEl.blur(); // Triggers the blur event below
        }
    });

    titleEl.addEventListener('blur', submitRename);

    return card;
}

function handleRename(oldName, newName) {

    const success = PodCube.renamePlaylist(oldName, newName);
    
    if (success) {
        updatePlaylistsUI();
        logCommand(`// Reclassified record to "${newName}"`);
    } else {
        logCommand(`// Error: Could not rename to "${newName}"`);
        updatePlaylistsUI(); // Revert UI
    }
}

function updatePlaylistsUI(highlightName = null) {
    const container = document.getElementById('playlistList');
    if (!container) return;
    
    // Get raw list
    let playlists = PodCube.getPlaylists();
    
    container.innerHTML = '';

    if (playlists.length === 0) {
        container.classList.add('empty');
        container.innerHTML = `
            <div class="empty-state" style="border: 1px dashed var(--primary-dim);">
                <div class="empty-state-icon">🅿</div>
                <div>Issue a new punchcard or insert one into the reader to begin cataloging.</div>
            </div>
        `;
        return;
    }
    
    // Remove empty class when we have playlists
    container.classList.remove('empty');
    
    // Sort by Creation Date (Oldest First)
    playlists.sort((a, b) => {
        const dateA = new Date(a.created || 0);
        const dateB = new Date(b.created || 0);
        return dateA - dateB;
    });
    
    playlists.forEach((pl, index) => {
        const card = renderPunchcardDOM(pl, index);
        
        if (highlightName && pl.name === highlightName) {
            card.classList.add('pop-in');
        }
        
        // Add to top of list
        container.prepend(card);
    });
}


function importPlaylistFromInput() {
    const input = document.getElementById('playlistImportInput');
    const val = input.value.trim();
    
    if (!val) {
        alert("READER EMPTY. Please paste an image or enter a code.");
        return;
    }

    if (handleIncomingPlaylistCode(val)) {
        input.value = ''; // Only clear if successful
    } else {
        alert("INVALID PUNCHCARD. The data is unreadable.");
    }
}

/**
 * Escapes double quotes and backslashes for use inside JavaScript strings.
 * Required for passing names into run() commands. This might be a red flag of bad code.
 */
function escapeForJs(text) {
    if (!text) return "";
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function loadPlaylistToQueue(name) {
    // 1. Direct Execution
    PodCube.queuePlaylist(name);
    
    // 2. Manual Logging
    logCommand(`PodCube.queuePlaylist("${escapeForJs(name)}")`);
}

async function deletePlaylist(name, cardElement) {
    // 1. Prepare Animation (if DOM element exists)
    if (cardElement) {
        // Capture exact geometry
        const rect = cardElement.getBoundingClientRect();
        
        // Find canvas source
        const sourceCanvas = cardElement.querySelector('canvas');
        
        // Helper to fix canvas content on clones
        const fixCanvas = (clone) => {
            if (sourceCanvas) {
                const destCanvas = clone.querySelector('canvas');
                if (destCanvas) {
                    const ctx = destCanvas.getContext('2d');
                    ctx.drawImage(sourceCanvas, 0, 0);
                }
            }
        };

        // Factory: Creates a Wrapper (Rip Shape) containing a Clone (Card Shape)
        const createShredPiece = (clipPath) => {
            // A. The Wrapper: Handles the Animation & The "Rip" Cut
            const wrapper = document.createElement('div');
            wrapper.classList.add('rip-piece');
            
            // Force Wrapper to exact original screen coordinates
            wrapper.style.position = 'fixed';
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.top}px`;
            wrapper.style.width = `${rect.width}px`;
            wrapper.style.height = `${rect.height}px`;
            wrapper.style.zIndex = '9999';
            wrapper.style.boxSizing = 'border-box';
            
            // Apply the jagged seam to the WRAPPER
            wrapper.style.clipPath = clipPath;

            // B. The Clone: Keeps original CSS styling (corners, colors)
            const clone = cardElement.cloneNode(true);
            fixCanvas(clone);
            
            // Reset layout so clone fills the wrapper perfectly
            // We use !important to ensure no CSS overrides this
            clone.style.setProperty('position', 'absolute', 'important');
            clone.style.setProperty('top', '0', 'important');
            clone.style.setProperty('left', '0', 'important');
            clone.style.setProperty('width', '100%', 'important');
            clone.style.setProperty('height', '100%', 'important');
            clone.style.setProperty('margin', '0', 'important');
            clone.style.setProperty('transform', 'none', 'important');
            clone.style.setProperty('opacity', '1', 'important');
            
            // Remove interactive noise
            clone.querySelectorAll('button, input').forEach(b => b.remove());

            wrapper.appendChild(clone);
            return wrapper;
        };

        // Define jagged seam
        const seam = "100% 50%, 85% 55%, 70% 45%, 55% 55%, 40% 45%, 25% 55%, 10% 45%, 0% 50%";
        
        // Create the two halves
        const topWrapper = createShredPiece(`polygon(0% 0%, 100% 0%, ${seam})`);
        const btmWrapper = createShredPiece(`polygon(0% 100%, 100% 100%, ${seam})`);

        // Mount to body
        document.body.appendChild(topWrapper);
        document.body.appendChild(btmWrapper);

        // Animate the WRAPPERS
        requestAnimationFrame(() => {
            topWrapper.style.animation = "ripTop 0.6s ease-in forwards";
            btmWrapper.style.animation = "ripBottom 0.6s ease-in forwards";
        });

        // Cleanup
        setTimeout(() => {
            topWrapper.remove();
            btmWrapper.remove();
        }, 600);
    }

    // make the card transparent but hold its place in the grid temporarily
    cardElement.style.opacity = 0;
    // DELETION
    setTimeout(() => { 
        PodCube.deletePlaylist(name);
        updatePlaylistsUI();
    }, 700);

    logCommand(`PodCube.deletePlaylist("${escapeForJs(name)}")`);
    
}



// --- OPTIMIZED RENDER SYSTEM ---

const UI_CACHE = {
    lastTime: null,
    lastPlayState: null,
    lastTrackId: null,
    lastQueueHash: null,
    lastVolume: null,
    lastRate: null
};

// 1. HIGH FREQUENCY: Time & Progress (Ticks 10x per second)
// Only updates text and width styles. No heavy DOM construction.
function renderTimeDisplays(status) {
    if (status.currentTimeFormatted === UI_CACHE.lastTime) return;

    // Main Transport
    const transTime = document.getElementById('transTime');
    if (transTime) transTime.textContent = `${status.currentTimeFormatted} / ${status.durationFormatted}`;

    // Player Tab
    const tStart = document.getElementById('playerTimeStart');
    const tEnd = document.getElementById('playerTimeEnd');
    if (tStart) tStart.textContent = status.currentTimeFormatted;
    if (tEnd) tEnd.textContent = status.durationFormatted;

    // Scrubbers (CSS Transform is cheaper than width, but width is fine here)
    const pct = `${status.percent}%`;
    ['scrubberFill', 'playerScrubberFill'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = pct;
    });

    const handle = document.getElementById('playerScrubberHandle');
    if (handle) handle.style.left = pct;

    UI_CACHE.lastTime = status.currentTimeFormatted;
}

// 2. MEDIUM FREQUENCY: Play/Pause State & Volume
// Triggered on play, pause, or manual volume change
function renderTransportState(status) {
    // Play/Pause Icons
    if (status.playing !== UI_CACHE.lastPlayState) {
        const playIcon = status.playing ? ICONS.pause : ICONS.play;
        
        ['playBtn', 'playerPlayBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.innerHTML !== playIcon) el.innerHTML = playIcon;
        });

        const playerIconContainer = document.getElementById('playerPlayIcon');
        if (playerIconContainer) playerIconContainer.innerHTML = playIcon;
        
        UI_CACHE.lastPlayState = status.playing;
    }

    // Volume / Speed (Only if changed)
    if (status.volume !== UI_CACHE.lastVolume) {
        if (document.activeElement.id !== 'transportVolume' && document.activeElement.id !== 'playerVolume') {
            const volInt = Math.round(status.volume * 100);
            ['transportVolume', 'playerVolume'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = volInt;
            });
            const volVal = document.getElementById('transportVolumeValue');
            if (volVal) volVal.textContent = `${volInt}%`;
        }
        UI_CACHE.lastVolume = status.volume;
    }
}

// 3. LOW FREQUENCY: Track Metadata
// Triggered only when the track changes
function renderTrackMetadata(ep) {
    if (ep?.id === UI_CACHE.lastTrackId) return;

    const titleText = ep ? ep.title : 'Select a transmission...';

    // Global Title
    const transTitle = document.getElementById('transTitle');
    if (transTitle) transTitle.textContent = titleText;

    // Player Tab Title
    const playerTitle = document.getElementById('playerNowPlayingTitle');
    if (playerTitle) playerTitle.textContent = titleText;

    // Rich Metadata
    const playerMeta = document.getElementById('playerNowPlayingMeta');
    if (playerMeta) {
        if (ep) {
            const parts = [
                `<strong>${ep.model || 'Unknown Model'}</strong>`,
                ep.origin,
                ep.weirdDuration,
                ep.anniversary
            ].filter(Boolean);
            playerMeta.innerHTML = parts.join(' <span style="opacity:0.3; margin:0 5px;">•</span> ');
        } else {
            playerMeta.innerHTML = '<span class="text-muted">Queue is empty. Visit the Transmissions tab.</span>';
        }
    }

    UI_CACHE.lastTrackId = ep?.id;
}

// --- MOBILE TRANSPORT TOGGLE ---
function toggleTransport() {
    const el = document.getElementById('global-transport');
    el.classList.toggle('expanded');
}



// --- CONFIG & SYSTEM ---
function runConsole() {
    const input = document.getElementById('consoleInput');
    const val = input?.value.trim();
    
    if (!val) return;
    
    const out = run(val);
    
    const output = document.getElementById('consoleOutput');
    const template = document.getElementById('tmpl-console-output');

    if (output && template) {
        const clone = document.importNode(template.content, true);
        clone.querySelector('.console-prompt').textContent = `> ${val}`;
        clone.querySelector('.console-result').textContent = formatConsoleOutput(out);
        
        // Prepend logic
        if (output.firstChild) {
            output.insertBefore(clone, output.firstChild);
        } else {
            output.appendChild(clone);
        }
    }
    
    if (input) {
        input.value = '';
        input.focus();
    }
}

function formatConsoleOutput(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }
    
    return String(value);
}

function toggleDebug() {
    const current = PodCube.DEBUG;
    run(`PodCube.setDebug(${!current})`);
    renderSystemInfo();
}

async function toggleFeedType() {
    const current = PodCube.FEED_TYPE;
    const next = current === 'rss' ? 'json' : 'rss';
    
    // Don't toggle if already on that type
    if (current === next) {
        logCommand("// Already using this feed type");
        return;
    }
    
    updateStatusIndicator(`Switching to ${next.toUpperCase()}...`);
    logCommand(`// Switching to ${next.toUpperCase()} feed...`);
    
    try {
        await run(`PodCube.setFeedType('${next}')`);
        await run(`PodCube.init(true)`);
        
        updateStatusIndicator(`Reloading with ${next.toUpperCase()} feed...`);
        
        // Reload page to refresh all data with new feed
        setTimeout(() => window.location.reload(), 500);
    } catch(e) {
        updateStatusIndicator("Feed Switch Error");
        logCommand(`// ERROR switching feed: ${e.message}`);
        console.error('Feed switch error:', e);
    }
}

// -- UTILITIES --

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatTime(s) {
    if (!s) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${h<1? '' : h+':'}${m}:${sec < 10 ? '0' + sec : sec}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeForAttribute(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// --- NAVIGATION ---
let lastArchiveScroll = 0;
let isRewritingHistory = false;
let pendingNavigation = null;

function initNavigation() {
    // Prevent browser scroll jumping during the history rewrite
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    // 1. Click Listeners
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab, true));
    });

    // 2. Popstate Handler (The Rewrite Engine)
    window.addEventListener('popstate', (e) => {
        if (isRewritingHistory && pendingNavigation) {
            // We have successfully stepped back to Depth 1.
            // Now we rewrite the stack to: [Previous, Target]
            
            // Step A: Overwrite the current entry (which was the entry point) with the Previous Tab
            history.replaceState(
                { tab: pendingNavigation.previousTab, depth: 1 }, 
                '', 
                `#${pendingNavigation.previousTab}`
            );

            // Step B: Push the Target Tab
            history.pushState(
                { tab: pendingNavigation.targetTab, depth: 2 }, 
                '', 
                `#${pendingNavigation.targetTab}`
            );

            // Step C: Update UI
            performUISwitch(pendingNavigation.targetTab);

            // Reset
            isRewritingHistory = false;
            pendingNavigation = null;
        } else {
            // Standard Back Button behavior
            const target = (e.state && e.state.tab) ? e.state.tab : 'overview';
            switchTab(target, false);
        }
    });

    // 3. Initial Load State
    const hashTab = window.location.hash.replace('#', '');
    const savedTab = localStorage.getItem('podCube_activeTab');
    
    // Determine start tab, default to 'overview' if invalid
    const tabOrder = getTabOrder();
    let startTab = tabOrder.includes(hashTab) ? hashTab : 
                   (tabOrder.includes(savedTab) ? savedTab : 'overview');

    // Establish the "Root" of the rolling history
    history.replaceState({ tab: startTab, depth: 1 }, '', `#${startTab}`);
    performUISwitch(startTab);

    // 4. Swipe Gestures
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    document.addEventListener('touchend', (e) => {
        handleSwipe(touchStartX, touchStartY, e.changedTouches[0].screenX, e.changedTouches[0].screenY, e.target);
    }, {passive: true});
}

/**
 * Helper: Dynamically gets the list of tab IDs based on the DOM order.
 * This ensures Swipe/Keyboard navigation always matches the visual order.
 */
function getTabOrder() {
    return Array.from(document.querySelectorAll('.tab-button'))
        .map(btn => btn.dataset.tab);
}


/**
 * Helper: Updates DOM classes and restores scroll.
 * INTELLIGENT SCROLL: If the header is hidden, keep it hidden.
 */
function performUISwitch(targetId) {
    const btn = document.querySelector(`.tab-button[data-tab="${targetId}"]`);
    const content = document.getElementById(targetId);
    // Select the header to use as our static reference point
    const header = document.querySelector('header');
    
    if (!btn || !content || !header) return;

    // 1. Snapshot Scroll (only if leaving Archive)
    const currentTab = document.querySelector('.tab-content.active');
    if (currentTab && currentTab.id === 'archive' && targetId !== 'archive') {
        lastArchiveScroll = window.scrollY;
    }

    // Destroy interactive when leaving
    if (Interactive && currentTab &&
        currentTab.id === 'interactive' &&
        targetId !== 'interactive'){
        Interactive.destroy();
    }

    // Init interactive when arriving
    if (Interactive && currentTab &&
        currentTab.id !== 'interactive' &&
        targetId === 'interactive'
    ){ Interactive.init() }

    // 2. Update Classes
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    content.classList.add('active');

    // 3. INTELLIGENT SCROLL CALCULATION
    if (targetId === 'archive') {
        window.scrollTo({ top: lastArchiveScroll, behavior: 'instant' });
    } else {
        // Calculate the exact pixel where the tabs *should* stick.
        // This is the Header's offset + Header's height + Header's bottom margin (20px).
        // We use computed style to be precise about the 20px margin defined in CSS.
        const headerStyle = window.getComputedStyle(header);
        const headerMarginBottom = parseInt(headerStyle.marginBottom);
        
        // This value represents the exact scroll Y position where the header 
        // has completely scrolled out of view and the tabs hit the top.
        const stickyPoint = header.offsetTop + header.offsetHeight + headerMarginBottom;

        // If we are scrolled DEEPER than the sticky point, snap back to it.
        // If we are seeing the header (scrollY < stickyPoint), scroll to top (0).
        const targetScroll = (window.scrollY > stickyPoint) ? stickyPoint : 0;
        
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
    }

    // 4. Persist preference
    localStorage.setItem('podCube_activeTab', targetId);
}

function switchTab(targetId, isNewNavigation = true) {
    const currentTab = document.querySelector('.tab-button.active')?.dataset.tab;
    if (currentTab === targetId) return;

    if (isNewNavigation) {
        const currentDepth = history.state?.depth || 1;

        if (currentDepth === 1) {
            // Standard Navigation: Just push the new tab
            history.pushState({ tab: targetId, depth: 2 }, '', `#${targetId}`);
            performUISwitch(targetId);
        } 
        else if (currentDepth === 2) {
            // Rolling Navigation: We are already deep.
            // 1. Set flags to intercept the 'popstate' event
            isRewritingHistory = true;
            pendingNavigation = {
                previousTab: currentTab, // This becomes the new "Back" destination
                targetTab: targetId      // This becomes the new "Current"
            };
            // 2. Physically go back in browser history to index 0
            history.back(); 
        }
    } else {
        // Simple UI update (User pressed Back button manually)
        performUISwitch(targetId);
    }
}

// --- SWIPE LOGIC ---
function handleSwipe(startX, startY, endX, endY, targetElement) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    
    if (Math.abs(diffX) < 120) return; 
    if (Math.abs(diffY) > 40) return; 

    if (isHorizontallyScrollable(targetElement) || 
        targetElement.closest('.scrubber') || 
        targetElement.closest('.transport-slider')) return;

    // Get order dynamically
    const tabOrder = getTabOrder();
    const currentTab = document.querySelector('.tab-button.active')?.dataset.tab;
    const currentIndex = tabOrder.indexOf(currentTab);
    
    if (currentIndex === -1) return;

    const direction = diffX > 0 ? -1 : 1; 
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < tabOrder.length) {
        switchTab(tabOrder[nextIndex], true);
    }
}

// --- DATA TAB SWITCHING ---
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('data-tab-btn')) {
        const parent = e.target.parentElement;
        parent.querySelectorAll('.data-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        const target = e.target.dataset.target;
        parent.parentElement.querySelectorAll('.data-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(target).classList.add('active');
    }
});

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
    if (isTyping) return;

    // BLOCK NAVIGATION IF SNAKE GAME IS ACTIVE
    // We check if the "interactive" tab is currently active
    const interactiveTab = document.getElementById('interactive');
    if (interactiveTab && interactiveTab.classList.contains('active')) {
        // Stop here so the game gets the key press instead
        return;
    }

    // Desktop Tab Navigation (Arrow Keys)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Ignore if shift is held (audio scrubbing)
        if (e.shiftKey) return;

        const tabOrder = getTabOrder();
        const currentTab = document.querySelector('.tab-button.active')?.dataset.tab;
        const currentIndex = tabOrder.indexOf(currentTab);
        
        if (currentIndex !== -1) {
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            const nextIndex = currentIndex + direction;
            
            if (nextIndex >= 0 && nextIndex < tabOrder.length) {
                e.preventDefault();
                switchTab(tabOrder[nextIndex], true);
                return;
            }
        }
    }

   
    
    // Arrow keys with Ctrl (Skip)
    if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        run('PodCube.skipBack()');
    }
    
    if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        run('PodCube.skipForward()');
    }
    
    // Enter in console
    if (e.code === 'Enter' && e.target.id === 'consoleInput') {
        e.preventDefault();
        runConsole();
    }
});

// --- SHARE CARD FUNCTIONALITY ---

/**
 * Generate a QR code and append to container
 * FIXES: QRCode library requires container as first parameter
 */
function generateQRCode(container, text, size = 200) {
    if (!container) return false;
    if (typeof QRCode === 'undefined') {
        console.warn('QRCode library not loaded');
        return false;
    }

    try {
        container.innerHTML = '';
        new QRCode(container, {
            text: text,
            width: size,
            height: size,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        return true;
    } catch (e) {
        console.error('QR code generation failed:', e);
        return false;
    }
}

/**
 * Copy text to clipboard with visual feedback
 */
function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const text = el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        logCommand('// Copied to clipboard');
        const btn = el.nextElementSibling;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 1500);
        }
    }).catch(e => {
        console.error('Copy failed:', e);
        logCommand('// Error: Copy failed');
    });
}



function initPasteHandler() {
    document.addEventListener('paste', async (e) => {
        // 1. Check what is on the clipboard
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let blob = null;

        // 2. Search for an image item
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                blob = item.getAsFile();
                break; // Found an image, stop looking
            }
        }

        // 3. Logic Branch:
        if (blob) {
            // A. IT IS AN IMAGE: Intercept it everywhere!
            // This prevents the browser from doing nothing (or weird stuff) when pasting 
            // an image into a text input.
            e.preventDefault();
            logCommand("// Scanning pasted Punchcard...");
            await scanPastedImage(blob);
        } else {
            // B. IT IS TEXT (or something else):
            // Let the event bubble normally.
            // This allows the user to paste a text code (Nano-GUID) into the input box
            // without us interfering.
        }
    });
}

/**
 * Initialize Drag-and-Drop for Punchcards
 * Adds visual cues and handling to the reader area
 */
function initPunchcardDragDrop() {
    const reader = document.getElementById('punchcardReader');
    const input = document.getElementById('playlistImportInput');
    
    if (!reader) return;

    // 1. Drag Over / Enter (Visual Cue)
    ['dragenter', 'dragover'].forEach(eventName => {
        reader.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            reader.classList.add('drag-active');
        }, false);
    });

    // 2. Drag Leave / End (Remove Cue)
    ['dragleave', 'dragend'].forEach(eventName => {
        reader.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            reader.classList.remove('drag-active');
        }, false);
    });

    // 3. Drop (The Action)
    reader.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        reader.classList.remove('drag-active');

        const dt = e.dataTransfer;
        const text = dt.getData('text');
        const files = dt.files;

        // --- 1. INTELLIGENT TEXT CHECK (Mobile/Rich Drop Support) ---
        // If the drop contains text (like a URL or Share Code), test it first.
        if (text) {
            let candidate = text.trim();
            
            // Clean URL if present (reusing logic from handlePastedCode)
            if (candidate.includes('importPlaylist=')) {
                try {
                    const url = new URL(candidate);
                    candidate = url.searchParams.get('importPlaylist') || candidate;
                } catch (e) {}
            }

            // "Dry Run" Import: check if valid without alerting
            // We use the raw engine API for this silent check
            const check = PodCube.importPlaylist(candidate);
            
            if (check && check.episodes && check.episodes.length > 0) {
                logCommand("// Valid Punchcard code detected in drop data...");
                handlePastedCode(text); // Pass to main handler to populate UI
                return; // STOP here, do not scan files
            }
        }

        // --- 2. STANDARD IMAGE SCAN ---
        // If text was invalid or missing, check for physical files
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                logCommand("// Scanning dropped Punchcard image...");
                await scanPastedImage(file);
                return;
            } 
        }
        
        // --- 3. FAILURE STATE ---
        // Only alert if we actually received data but couldn't use it
        if ((text && text.length > 0) || (files && files.length > 0)) {
            input.value = "INVALID OBJECT.\n\nThe reader accepts Punchcard Images (PNG/JPG) or valid Nano-GUID Share Codes.";
        }

    }, false);
}

async function scanPastedImage(imageBlob) {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    const input = document.getElementById('playlistImportInput');

    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Force white background to handle transparency
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (window.jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data) {
                handlePastedCode(code.data);
            } else {
                // More helpful error message
                input.value = "// Error: No QR code found in pasted image.";
            }
        } else {
            console.error("jsQR library not loaded.");
            alert("System Error: Scanner library missing.");
        }
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
}

function handlePastedCode(data) {
    handleIncomingPlaylistCode(data);
}


function playHistorySong() {
    // Normalize the raw data to match what the Feed Parser usually produces
    // The Episode constructor expects a specific "normalized" structure
    const raw = {

        title: "The PodCube History Song",
        description: "An official musical chronicle of PodCube's development and deployment history, as performed by our in-house Historical Documentation Chorus.",
        audioUrl: "./podcube-history-song.mp3",
        duration: 0, // Will be set when loaded
        type: "podcube_internal",
        model: "PodCube Orange Abominable Snowman",
        origin: "PodCube Research & Innovation Campus",
        locale: "Miami",
        region: "FL",
        zone: "USA",
        planet: "Earth",
        date: "2048-01-15",

        // prevents inclusion in punchcards/exports
        _excludeFromExport: true,
        _internal: true
    };
    
    const normalizedData = {
        id: "podcube_history_song", // Needs a unique ID
        title: raw.title,
        description: raw.description,
        episodeType: raw.type, // "podcube_internal"
        audioUrl: raw.audioUrl,
        duration: raw.duration, // 0 is fine, engine updates it on load
        metadata: {
            // Mapping flattened properties to where the class expects them
            model: raw.model,
            origin: raw.origin || "PodCube HQ",
            date: raw.date,
            integrity: "100" // It's official, so it's pure
        }
    };

    // 2. Create a valid instance using the class we exposed in Step 1
    // This passes the "instanceof Episode" check in addToQueue()
    const validEpisode = new PodCube.Episode(normalizedData);

    // 3. Re-attach special flags (The constructor doesn't copy custom flags automatically)
    validEpisode._excludeFromExport = true;
    validEpisode._internal = true;

    // 4. Play it
    PodCube.play(validEpisode);
    logCommand('// Playing internal history song');
}

// --- CSS for Hierarchy Hover ---
const style = document.createElement('style');
style.textContent = `
    .hierarchy-item:hover {
        background: var(--primary-dim) !important;
    }
`;
document.head.appendChild(style);

window.pipeToConsole = function(msg, type = 'info') {
    const output = document.getElementById('consoleOutput');
    const template = document.getElementById('tmpl-console-output');
    if (!output || !template) return;

    const clone = document.importNode(template.content, true);
    const prefix = type === 'error' ? '❌ ' : (type === 'warn' ? '⚠️ ' : 'ℹ️ ');
    
    clone.querySelector('.console-prompt').textContent = `[SYSTEM ${type.toUpperCase()}]`;
    clone.querySelector('.console-result').textContent = `${prefix}${msg}`;
    clone.querySelector('.console-result').style.color = type === 'error' ? 'var(--danger)' : (type === 'warn' ? 'var(--warning)' : 'var(--primary)');

    output.insertBefore(clone, output.firstChild);
};