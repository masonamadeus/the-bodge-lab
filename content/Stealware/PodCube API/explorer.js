// explorer.js - PodCube Explorer (Polished Production Version)

// --- STATE MANAGEMENT ---
const AppState = {
    selectedEpisode: null,
    lastCommandTime: null,
    commandHistory: [],
    filteredResults: [],
    liveDataInterval: null,
    radioMode: false,
};

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
// WINDOW INITIALIZATION
window.addEventListener('PodCube:Ready', async () => {
    try {
        await PodCube.init();
        updateStatusIndicator(`Connected: ${PodCube.FEED_TYPE.toUpperCase()}`);

        const logo = document.getElementById('headerLogo');
        const heroLogo = document.querySelector('.hero-logo');
        if (PodCube.logo) {
            if (logo) {
                logo.src = PodCube.logo;
                logo.style.display = 'block';
            }
            if (heroLogo) {
                heroLogo.src = PodCube.logo;
            }
        }
        
        initArchiveControls();
        updateBrigistics();
        updateGeoDistribution();
        updateArchive();
        showDistribution();
        updatePlaylistsUI();
        checkForPlaylistImport();
        clearInspector();
        initQueueDragAndDrop();
        enableScrubbing('scrubber');        // Global transport scrubber
        enableScrubbing('playerScrubber');  // Player tab scrubber
        refreshSessionInspector();
        initPasteHandler();
        initPunchcardDragDrop();

        // Attempt to restore session
        const sessionRestored = await PodCube.restoreSession();
        if (sessionRestored) {
            updateStatusIndicator("Session Restored");
        }

        // Load inspector only if we have a now playing episode
        // (this happens after session restore, so don't call it twice)
        if (PodCube.nowPlaying) {
            loadEpisodeInspector(PodCube.nowPlaying);
        }

        updateUI();
        startLiveDataMonitor();
        
        // Event Listeners
        PodCube.on('play', updateUI);
        PodCube.on('pause', updateUI);
        PodCube.on('track', (ep) => { 
            updateUI(); 
            loadEpisodeInspector(ep);
            if (AppState.radioMode) {
                checkRadioChain();
            }
        });
        PodCube.on('track', (ep) => {
            updateUI();
            loadEpisodeInspector(ep);
        });

        PodCube.on('timeupdate', (status) => {
            updateProgress(status);
            // Pick the next episode when 30 seconds are remaining
            if (AppState.radioMode && status.remaining < 30) {
                checkRadioChain();
            }
        });

        PodCube.on('queue:changed', () => {
            updateQueueList();
            // Ensure the chain is maintained if the user deletes the next track
            if (AppState.radioMode) {
                checkRadioChain();
            }
        });
        
    } catch (e) {
        updateStatusIndicator(`Error: ${e.message}`);
        console.error(e);
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

// --- OVERVIEW / BRIGISTICS ---
function updateBrigistics() {
    const stats = PodCube.getStatistics();

    const display = [
        { l: 'Total Episodes', v: stats.totalEpisodes },
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

// --- SPECIFIC VIEWS ---
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
    const groupSize = parseInt(document.getElementById('arcYearGroup')?.value) || 5;
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
    const search = document.getElementById('arcSearch')?.value.toLowerCase() || '';
    const model = document.getElementById('arcModel')?.value || '';
    const origin = document.getElementById('arcOrigin')?.value || '';
    const region = document.getElementById('arcRegion')?.value || '';
    const zone = document.getElementById('arcZone')?.value || '';
    const planet = document.getElementById('arcPlanet')?.value || '';
    const locale = document.getElementById('arcLocale')?.value || '';
    const type = document.getElementById('arcType')?.value || '';
    const sort = document.getElementById('arcSort')?.value || 'release_desc';
    const yearRange = document.getElementById('arcYear')?.value || '';
    
    // --- API Call Visualization ---
    let apiCall = '';
    const filters = {};

    if (type === 'issues') {
        apiCall = 'PodCube.getIssues()';
    } else {
        if(model) filters.model = model;
        if(origin) filters.origin = origin;
        if(region) filters.region = region;
        if(zone) filters.zone = zone;
        if(planet) filters.planet = planet;
        if(locale) filters.locale = locale;
        if(type) filters.episodeType = type;

        if (Object.keys(filters).length > 0) {
            const filterStr = Object.entries(filters)
                .map(([k, v]) => `${k}: "${v}"`)
                .join(', ');
            apiCall = `PodCube.where({ ${filterStr} })`;
        } else {
            apiCall = 'PodCube.all';
        }
    }
    
    if(yearRange) {
        const [min, max] = JSON.parse(yearRange);
        apiCall += `.filter(ep => ep.date?.year >= ${min} && ep.date?.year <= ${max})`;
    }
    
    if(search) {
        apiCall += `.filter(ep => /* search: "${search}" */)`;
    }
    
    // Add sort info
    const sortMap = {
        'release_desc': 'sort by release (newest)',
        'release_asc': 'sort by release (oldest)',
        'lore_desc': 'sort by origin date (newest)',
        'lore_asc': 'sort by origin date (oldest)',
        'integrity_desc': 'sort by integrity (high→low)',
        'integrity_asc': 'sort by integrity (low→high)',
        'duration_desc': 'sort by duration (longest)',
        'duration_asc': 'sort by duration (shortest)'
    };
    
    if (sort && sort !== 'release_desc') {
        apiCall += ` // ${sortMap[sort]}`;
    }
    
    logCommand(apiCall);

    // --- Filtering Logic ---
    let results = PodCube.all.filter(ep => {
        if (model && ep.model !== model) return false;
        if (origin && ep.origin !== origin) return false;
        if (region && ep.region !== region) return false;
        if (zone && ep.zone !== zone) return false;
        if (planet && ep.planet !== planet) return false;
        if (locale && ep.locale !== locale) return false;
        
        // Correctly handle the 'issues' pseudo-type
        if (type === 'issues') {
            if (!ep.hasIssues) return false;
        } else if (type && ep.episodeType !== type) {
            return false;
        }
        
        if (yearRange) {
            const [min, max] = JSON.parse(yearRange);
            if (!ep.date || !ep.date.year) return false;
            if (ep.date.year < min || ep.date.year > max) return false;
        }

        if (search) {
            const str = (ep.title + ' ' + ep.shortcode + ' ' + ep.description + ' ' + (ep.tags || []).join(' ')).toLowerCase();
            if (!str.includes(search)) return false;
        }
        
        return true;
    });

    // Sorting
    results.sort((a, b) => {
        if (sort === 'release_desc') return b.published - a.published;
        if (sort === 'release_asc') return a.published - b.published;
        if (sort === 'integrity_asc') return (a.integrityValue || 0) - (b.integrityValue || 0);
        if (sort === 'integrity_desc') return (b.integrityValue || 0) - (a.integrityValue || 0);
        if (sort === 'duration_desc') return (b.duration || 0) - (a.duration || 0);
        if (sort === 'duration_asc') return (a.duration || 0) - (b.duration || 0);
        if (sort.startsWith('lore')) {
            const da = a.date && a.date.year ? a.date.year : -99999;
            const db = b.date && b.date.year ? b.date.year : -99999;
            return sort === 'lore_desc' ? db - da : da - db;
        }
        return 0;
    });

    AppState.filteredResults = results;

    const resCount = document.getElementById('resCount');
    if (resCount) resCount.textContent = `${results.length} Records`;
    
    const list = document.getElementById('archiveList');
    const tCard = document.getElementById('tmpl-ep-card');
    if (!list || !tCard) return;
    
    list.textContent = ''; // Clear existing

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
        const intColor = intVal < 50 ? 'var(--danger)' : (intVal < 90 ? 'var(--warning)' : 'var(--success)');
        
        const clone = document.importNode(tCard.content, true);
        const card = clone.querySelector('.ep-card');
        
        // Populate text (safe from XSS)
        clone.querySelector('.ep-title').textContent = ep.title;
        clone.querySelector('.ep-date').textContent = ep.date?.toString() || 'No Date';
        clone.querySelector('.ep-type').textContent = ep.episodeType || 'unknown';
        
        // Row 1: Model & Duration
        clone.querySelector('.ep-model').textContent = ep.model || 'Unknown Model';
        clone.querySelector('.ep-duration').textContent = ep.duration ? `${ep.weirdDuration}` : '0:00';

        // Row 2: Location
        clone.querySelector('.ep-location').textContent = ep.location || 'Unknown Location';
        
        // Integrity Bar & Text
        const fill = clone.querySelector('.integrity-fill');
        fill.style.width = `${intVal}%`;
        fill.style.backgroundColor = intColor;
        
        clone.querySelector('.integrity-text').textContent = `${intVal}% INTEGRITY`;
        clone.querySelector('.integrity-container').title = `Data Integrity: ${intVal}%`;

        // State classes
        if (PodCube.nowPlaying === ep) card.classList.add('playing');
        if (AppState.selectedEpisode === ep) card.classList.add('selected');

        // Events
        card.addEventListener('click', () => handleEpisodeClick(idx));

        // Wire up PLAY
        clone.querySelector('.btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.play(PodCube.all[${idx}])`);
        });

        // Wire up PLAY NEXT
        clone.querySelector('.btn-play-next').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.addNextInQueue(PodCube.all[${idx}])`);
        });

        // Wire up QUEUE
        clone.querySelector('.btn-queue').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.addToQueue(PodCube.all[${idx}])`);
        });

        

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
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

html += `<br><br>It has been cataloged at index <strong>PodCube.all[${episodeIndex}]</strong> with shortcode date <strong>${escapeHtml(ep.shortcode || 'N/A')}</strong>, `;
html += `is of the type: <strong>"${escapeHtml(ep.episodeType || 'N/A')}"</strong>, `;
html += `and carries an integrity rating of <strong>${escapeHtml(ep.integrity || 'N/A')}</strong>`;
if (ep.integrityValue !== null) {
    html += ` (${ep.integrityValue}%). `;
}

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

//related check
const related = PodCube.findRelated(ep, 5);
if (related.length > 0) {
    const titles = related.map(relEp => `"${escapeHtml(relEp.title)}"`);
    let relatedTitlesNarrative = "";

    if (titles.length === 1) {
        relatedTitlesNarrative = titles[0];
    } else {
        const lastTitle = titles.pop();
        relatedTitlesNarrative = titles.join(', ') + ", or " + lastTitle;
    }

    html += `<br><br>It may or may not be related to ${relatedTitlesNarrative} which will be linked at the bottom of this document.`;
}

html += `</p></div></div>`;

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
            html += `<div class="inspector-related-item" onclick="loadEpisodeInspector(PodCube.all[${relIdx}])">`;
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
        clone.querySelector('.related-ep-title').textContent = relEp.title;
        clone.querySelector('.related-ep-meta').textContent = `${relEp.model || 'Unknown'} • ${relEp.origin || 'Unknown'}`;
        clone.querySelector('.related-ep-card').addEventListener('click', () => {
            loadEpisodeInspector(relEp);
        });
        container.appendChild(clone);
    });
    
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
    AppState.radioMode = enabled;
    
    // FIX: Sync the UI checkbox state (from previous fix)
    const checkbox = document.getElementById('autoplayRandom');
    if (checkbox) {
        checkbox.checked = enabled;
    }
    
    if (enabled) {
        
        // Don't auto-play on toggle. Let the user press Play, 
        // or let the Hero Button handle the initial play command.
        
        // If something IS playing, we check chain immediately to ensure buffer.
        if (PodCube.nowPlaying) {
             checkRadioChain();
        }
        
    }
}

/**
 * Ensures there is always at least one "next" track in the queue 
 * if Radio Mode is active.
 */
function checkRadioChain() {
    if (!AppState.radioMode) return;
    
    const q = PodCube.queueItems; //
    const idx = PodCube.queueIndex; //
    
    // If the currently playing track is the last one in the queue, 
    // append a new random one to the end.
    if (idx >= q.length - 1) {
        const nextRandom = PodCube.random; //
        if (nextRandom) {
            const epIdx = PodCube.getEpisodeIndex(nextRandom);
            // Append to queue without interrupting current playback (playNow = false)
            run(`PodCube.addToQueue(PodCube.all[${epIdx}], false)`, true);
        }
    }
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
    
    // Update all volume displays
    ['playerVolumeValue', 'transportVolumeValue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = value + '%';
    });
    
    // Sync sliders
    ['playerVolume', 'transportVolume'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value != value) el.value = value;
    });
}

function updatePlayerSpeed(value) {
    run(`PodCube.setPlaybackRate(${value})`, true);
    
    // Sync selectors
    ['playerSpeed', 'transportSpeed'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value != value) el.value = value;
    });
}

// MAIN PLAYER SCREEN (THESE ARE REDUNDANT)
function seekPlayer(e) {
    const scrub = document.getElementById('playerScrubber');
    const rect = scrub.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * PodCube.status.duration;
    run(`PodCube.seek(${time.toFixed(1)})`);
}

// FOR THE SMALLER BOTTOM ONE
function seek(e) {
    const scrub = document.getElementById('scrubber');
    const rect = scrub.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * PodCube.status.duration;
    run(`PodCube.seek(${time.toFixed(1)})`);
}

function updateProgress(status) {
    // Update both transport and player scrubbers
    const fills = ['scrubberFill', 'playerScrubberFill'];
    const times = ['transTime', 'playerTimeStart', 'playerTimeEnd'];
    
    if (status.duration) {
        fills.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.width = status.percent + '%';
        });

        const handle = document.getElementById('playerScrubberHandle');
        if (handle) {
            handle.style.left = status.percent + '%';
        }
        
        const timeText = formatTime(status.time) + ' / ' + formatTime(status.duration);
        const el = document.getElementById('transTime');
        if (el) el.textContent = timeText;
        
        const start = document.getElementById('playerTimeStart');
        const end = document.getElementById('playerTimeEnd');
        if (start) start.textContent = formatTime(status.time);
        if (end) end.textContent = formatTime(status.duration);
    }
}

function enableScrubbing(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let isDragging = false;

    const seekToMouse = (e) => {
        const rect = el.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        let percent = relativeX / rect.width;
        
        // Clamp percentage between 0 and 1
        percent = Math.max(0, Math.min(1, percent));
        
        // Only seek if we have a valid duration
        if (PodCube.status.duration) {
            const time = percent * PodCube.status.duration;
            // Use run() with 'true' (silent) to avoid flooding the console log
            run(`PodCube.seek(${time.toFixed(2)})`, true);
        }
    };

    // Start dragging on mousedown
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        seekToMouse(e); // Seek immediately where clicked
    });

    // Update position while dragging (listen on document in case cursor slips off)
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault(); // Prevent text selection
            seekToMouse(e);
        }
    });

    // Stop dragging on mouseup
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function startLiveDataMonitor() {

    // Remove aggressive polling loop
    if (AppState.liveDataInterval) {
        clearInterval(AppState.liveDataInterval);
        AppState.liveDataInterval = null;
    }
    
    // Bind to audio engine events instead
    // 'timeupdate' fires naturally during playback (approx 4Hz-60Hz depending on browser)
    PodCube.on('timeupdate', () => {
        updateLivePlaybackData();
        updatePlayerBufferInfo();
    });

    // Ensure status updates immediately on state changes
    const updateAll = () => {
        updateLivePlaybackData();
        updatePlayerBufferInfo();
    };

    PodCube.on('play', updateAll);
    PodCube.on('pause', updateAll);
    PodCube.on('ended', updateAll);
    PodCube.on('error', updateAll);
}

function updateLivePlaybackData() {
    const container = document.getElementById('livePlaybackData');
    if (!container) return;
    
    const audio = PodCube._audio;
    if (!audio) return;
    
    // Get buffered ranges
    const buffered = [];
    for (let i = 0; i < audio.buffered.length; i++) {
        buffered.push({
            start: audio.buffered.start(i).toFixed(2),
            end: audio.buffered.end(i).toFixed(2)
        });
    }
    
    const data = {
        status: PodCube.status.playing ? 'PLAYING' : 'PAUSED',
        currentTime: audio.currentTime.toFixed(2),
        duration: audio.duration ? audio.duration.toFixed(2) : 0,
        buffered: buffered,
        playing: !audio.paused,
        volume: audio.volume.toFixed(2),
        playbackRate: audio.playbackRate.toFixed(2),
        readyState: audio.readyState,
        networkState: audio.networkState,
        currentEpisode: PodCube.nowPlaying ? PodCube.nowPlaying.title : null
    };
    
    container.textContent = JSON.stringify(data, null, 2);
}

function updatePlayerBufferInfo() {
    const audio = PodCube._audio;
    if (!audio) return;
    
    const stateEl = document.getElementById('playerBufferState');
    if (stateEl) {
        stateEl.textContent = audio.paused ? 'IDLE' : 'ACTIVE';
    }
    
    const readyEl = document.getElementById('playerReadyState');
    if (readyEl) {
        const states = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
        readyEl.textContent = states[audio.readyState] || audio.readyState;
    }
    
    const networkEl = document.getElementById('playerNetworkState');
    if (networkEl) {
        const states = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];
        networkEl.textContent = states[audio.networkState] || audio.networkState;
    }
    
    const rangesEl = document.getElementById('playerBufferedRanges');
    if (rangesEl) {
        rangesEl.textContent = audio.buffered.length.toString();
    }
}

function updateQueueList() {
    const q = PodCube.queueItems;
    const list = document.getElementById('playerQueueList');
    const template = document.getElementById('tmpl-queue-item');
    
    if (!list || !template) return;
    
    
    // Update queue stats
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
    
    list.textContent = ''; // Clear

    if (q.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🅿</div>
                <div>Queue is empty</div>
            </div>
        `;
        return;
    }
    
    const fragment = document.createDocumentFragment();

    const displayQueue = [...q].reverse();

    displayQueue.forEach((ep, i) => {
        // Calculate the actual original index since we reversed the array
        const originalIndex = (q.length - 1) - i;
        const isCur = originalIndex === PodCube.queueIndex;
        
        const clone = document.importNode(template.content, true);
        const item = clone.querySelector('.queue-item');
        
        item.dataset.queueIndex = originalIndex;
        
        if (isCur) {
            item.classList.add('current');
            item.removeAttribute('draggable');
        }

        // Display the user-facing number (1 at top, etc)
        clone.querySelector('.queue-item-number').textContent = `${originalIndex + 1}.`;
        
        clone.querySelector('.qi-title').textContent = ep.title;
        clone.querySelector('.queue-item-meta').textContent = `${ep.model || 'Unknown'} • ${ep.timestamp || 'Unknown duration'}`;
        
        clone.querySelector('.btn-remove').addEventListener('click', () => {
            run(`PodCube.removeFromQueue(${originalIndex})`);
        });

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
}


// --- DRAG AND DROP FOR QUEUE ---

let dragState = {
    draggedIndex: null,
    draggedElement: null,
    dropIndicator: null
};

function initQueueDragAndDrop() {
    const list = document.getElementById('playerQueueList');
    if (!list) return;
    
    // Create drop indicator
    if (!dragState.dropIndicator) {
        dragState.dropIndicator = document.createElement('div');
        dragState.dropIndicator.className = 'queue-drop-indicator';
    }
    
    // Event delegation
    list.addEventListener('dragstart', handleQueueDragStart);
    list.addEventListener('dragend', handleQueueDragEnd);
    list.addEventListener('dragover', handleQueueDragOver);
    list.addEventListener('drop', handleQueueDrop);
    list.addEventListener('dragleave', handleQueueDragLeave);
}

function handleQueueDragStart(e) {
    const queueItem = e.target.closest('.queue-item');
    if (!queueItem || queueItem.classList.contains('current')) {
        e.preventDefault();
        return;
    }
    
    dragState.draggedIndex = parseInt(queueItem.dataset.queueIndex);
    dragState.draggedElement = queueItem;
    
    queueItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleQueueDragEnd(e) {
    e.target.closest('.queue-item')?.classList.remove('dragging');
    document.querySelectorAll('.queue-drop-indicator').forEach(el => el.remove());
    dragState.draggedIndex = null;
    dragState.draggedElement = null;
}

function handleQueueDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const queueItem = e.target.closest('.queue-item');
    if (!queueItem || queueItem === dragState.draggedElement) return;
    
    if (queueItem.classList.contains('current')) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // Show drop indicator
    const rect = queueItem.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    
    document.querySelectorAll('.queue-drop-indicator').forEach(el => el.remove());
    
    if (insertBefore) {
        queueItem.parentNode.insertBefore(dragState.dropIndicator, queueItem);
    } else {
        queueItem.parentNode.insertBefore(dragState.dropIndicator, queueItem.nextSibling);
    }
}

function handleQueueDragLeave(e) {
    const list = document.getElementById('playerQueueList');
    if (!list.contains(e.relatedTarget)) {
        document.querySelectorAll('.queue-drop-indicator').forEach(el => el.remove());
    }
}

function handleQueueDrop(e) {
    e.preventDefault();
    
    const queueItem = e.target.closest('.queue-item');
    if (!queueItem || queueItem === dragState.draggedElement) return;
    
    const fromIndex = dragState.draggedIndex;
    const toIndex = parseInt(queueItem.dataset.queueIndex);
    
    if (fromIndex === null) return;
    
    // Determine insert position
    const rect = queueItem.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    
    let finalToIndex = insertBefore ? toIndex : toIndex + 1;
    if (fromIndex < toIndex && !insertBefore) {
        finalToIndex = toIndex;
    }
    
    // Move via API
    run(`PodCube.moveInQueue(${fromIndex}, ${finalToIndex})`);
    
    document.querySelectorAll('.queue-drop-indicator').forEach(el => el.remove());
}

/**
 * Reads PodCube session data from localStorage and updates the inspector display.
 */
function refreshSessionInspector() {
    const sessionRaw = localStorage.getItem('podcube_session');
    const display = document.getElementById('sessionDataDisplay');
    
    if (sessionRaw) {
        try {
            const parsed = JSON.parse(sessionRaw);
            display.textContent = JSON.stringify(parsed, null, 2);
            display.classList.remove('text-muted');
        } catch (e) {
            display.textContent = "// Error parsing session data";
        }
    } else {
        display.textContent = "// No active session found in localStorage";
    }
    logCommand("// Session Inspector Refreshed");
}

/**
 * Completely resets the engine, clears the queue, and deletes the local session.
 */
function clearUserSession() {
    if (confirm("Are you sure? This will clear your queue, saved session, and all cached audio files.")) {
        // PodCube.clearQueue() handles cache clearing and session removal
        run('PodCube.clearQueue()');
        refreshSessionInspector();
        updateStatusIndicator("Session Purged");
    }
}

// --- PLAYLIST MANAGEMENT ---

function saveQueueAsPlaylist() {
    const input = document.getElementById('playlistNameInput');
    const name = input?.value.trim();
    
    if (!name) {
        logCommand('// Error: Playlist name required');
        return;
    }
    
    if (PodCube.queueItems.length === 0) {
        logCommand('// Error: Queue is empty');
        return;
    }
    
    PodCube.savePlaylist(name, PodCube.queueItems);
    logCommand(`PodCube.savePlaylist("${name}", [Array(${PodCube.queueItems.length})])`);
    
    input.value = '';
    updatePlaylistsUI();
}

function importPlaylistFromInput() {
    const input = document.getElementById('playlistImportInput');
    const val = input.value.trim();
    
    // Check if empty
    if (!val) {
        alert("PUNCHCARD READER EMPTY.\n\nPlease paste a Punchcard Image [Ctrl+V] or enter a Nano-GUID code.");
        input.focus();
        return;
    }

    const result = PodCube.importPlaylist(val); 
    if (result && result.episodes.length > 0) {
        let finalName = result.name;
        if (PodCube.loadPlaylist(finalName)) {
            finalName = `${result.name} (Copy ${new Date().getTime().toString().slice(-4)})`;
        }
        PodCube.savePlaylist(finalName, result.episodes);
        
        updatePlaylistsUI();
        input.value = '';
        
        // Tone-appropriate log
        logCommand(`// Punchcard accepted. "${finalName}" registered.`);
        updateStatusIndicator(`Punchcard Accepted: ${result.episodes.length} Tracks`);
    } else {
        alert("INVALID PUNCHCARD.\n\nThe data appears corrupted or unreadable.");
    }
}

function updatePlaylistsUI() {
    const container = document.getElementById('playlistList');
    if (!container) return;
    
    const playlists = PodCube.getPlaylists();
    container.innerHTML = '';
    
    playlists.forEach(pl => {
        const exportData = PodCube.exportPlaylist(pl.name);
        
        // Create the card wrapper
        const card = document.createElement('div');
        // We add 'interactive' to enable hover effects defined in CSS
        card.className = 'pc-share-card-container interactive'; 
        
        // Render the "Punchcard" structure
        card.innerHTML = `
            <div class="pc-share-header">PodCube™</div>
            
            <div class="pc-share-body">
                <div class="pc-share-title" 
                     contenteditable="true" 
                     title="Click to Rename"
                     onblur="finalizeRename(this, '${escapeForAttribute(pl.name)}')"
                     onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
                    ${escapeHtml(pl.name)}
                </div>
                
                <div class="pc-share-meta">${pl.episodes.length} Transmissions</div>
                
                <div class="pc-share-qr-frame">
                    <div id="miniQR_${btoa(pl.name).substring(0,8)}"></div>
                </div>
            </div>

            <div class="pc-share-actions">
                <button class="icon-btn" onclick="run('PodCube.playPlaylist(\\'${escapeForAttribute(pl.name)}\\')')" title="Load into Queue">
                    INSERT
                </button>
                <button class="icon-btn" onclick="PlaylistSharing.exportToClipboard('${escapeForAttribute(pl.name)}')" title="Copy to Clipboard">
                    EXPORT
                </button>
                <button class="icon-btn" style="color:var(--danger); border-color:var(--danger);" onclick="deletePlaylist('${escapeForAttribute(pl.name)}')" title="Delete Forever">
                    SHRED
                </button>
            </div>
        `;
        
        container.appendChild(card);
        
        // Generate QR Code
        if (window.QRCode) {
            new QRCode(document.getElementById(`miniQR_${btoa(pl.name).substring(0,8)}`), {
                text: exportData.url,
                width: 100, // Slightly larger for better scanning
                height: 100,
                colorDark: "#1768da", // PodCube Blue
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    });
}

function finalizeRename(el, oldName) {
    const newName = el.textContent.trim();
    if (newName && newName !== oldName) {
        PodCube.renamePlaylist(oldName, newName);
        updatePlaylistsUI();
        logCommand(`// Reclassified record to "${newName}"`);
    }
}

function loadPlaylistToQueue(name) {
    // We delegate the heavy lifting to the API
    run(`PodCube.queuePlaylist("${name}")`);
}

function deletePlaylist(name) {
    run(`PodCube.deletePlaylist("${name}")`);
    updatePlaylistsUI();
}

function renamePlaylist(oldName) {
    const newName = prompt("Enter new name for playlist:", oldName);
    if (newName && newName !== oldName) {
        const data = PodCube.loadPlaylist(oldName);
        if (data) {
            PodCube.savePlaylist(newName, data.episodes);
            PodCube.deletePlaylist(oldName);
            updatePlaylistsUI();
            logCommand(`// Renamed playlist to "${newName}"`);
        }
    }
}

// --- UPDATE UI ---

function updateUI() {
    // Update play buttons
    const playBtns = ['playBtn', 'playerPlayBtn'];
    const icon = PodCube.status.playing ? ICONS.pause : ICONS.play;
    
    playBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.innerHTML = icon;
    });
    
    const playerIcon = document.getElementById('playerPlayIcon');
    if (playerIcon) playerIcon.innerHTML = icon;
    
    // Update config displays
    const feedEl = document.getElementById('confFeed');
    const debugEl = document.getElementById('confDebug');
    const totalEl = document.getElementById('confTotal');
    
    if (feedEl) feedEl.textContent = PodCube.FEED_TYPE.toUpperCase();
    if (debugEl) debugEl.textContent = PodCube.DEBUG ? "ON" : "OFF";
    if (totalEl) totalEl.textContent = PodCube.all.length;
    
    // Update feed toggle button text
    const feedBtn = document.getElementById('feedToggleBtn');
    if (feedBtn) {
        const nextType = PodCube.FEED_TYPE === 'rss' ? 'JSON' : 'RSS';
        feedBtn.textContent = `Switch to ${nextType}`;
    }
    
    // Update now playing title
    const titleEl = document.getElementById('transTitle');
    if (titleEl) {
        titleEl.textContent = PodCube.nowPlaying ? PodCube.nowPlaying.title : 'System Idle';
    }

    const playerTitle = document.getElementById('playerNowPlayingTitle');
    const playerMeta = document.getElementById('playerNowPlayingMeta');

    if (playerTitle && playerMeta) {
        if (PodCube.nowPlaying) {
            playerTitle.textContent = PodCube.nowPlaying.title;
            // Display Model • Origin or similar metadata
            playerMeta.textContent = `${PodCube.nowPlaying.model || 'Unknown Model'} • ${PodCube.nowPlaying.timestamp || '0:00'}`;
        } else {
            playerTitle.textContent = 'System Idle';
            playerMeta.textContent = 'No transmission loaded';
        }
    }
    
    updateQueueList();
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
    updateUI();
}

async function toggleFeedType() {
    const current = PodCube.FEED_TYPE;
    const next = current === 'rss' ? 'json' : 'rss';
    
    // Don't toggle if already on that type
    if (current === next) {
        log.info("Already using this feed type");
        return;
    }
    
    updateStatusIndicator(`Switching to ${next.toUpperCase()}...`);
    run(`PodCube.setFeedType('${next}')`);
    
    try {
        const changed = await PodCube.init(true);
        
        if (!changed) {
            updateStatusIndicator(`Already on ${next.toUpperCase()}`);
            return;
        }
        
        updateStatusIndicator(`Connected: ${PodCube.FEED_TYPE.toUpperCase()}`);
        
        // Only refresh if feed actually changed
        refreshAllData();
        logCommand(`// Switched to ${next.toUpperCase()} feed`);
    } catch(e) {
        updateStatusIndicator("Protocol Error");
        logCommand(`// ERROR switching feed: ${e.message}`);
    }
}

// --- UTILITIES ---

function refreshAllData() {
    initArchiveControls();
    updateBrigistics();
    updateGeoDistribution();
    updateArchive();
    showDistribution();
    updateUI();
}

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
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' + sec : sec}`;
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

// --- TAB SWITCHING ---
let lastArchiveScroll = 0; // Stores the position of the Transmissions list
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;
        const currentTab = document.querySelector('.tab-content.active');
        
        // 1. If we are leaving the 'archive' tab, save its scroll position
        if (currentTab && currentTab.id === 'archive') {
            lastArchiveScroll = window.scrollY;
        }

        // 2. Perform the Switch
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        // 3. Handle Scroll Behavior
        if (targetId === 'archive') {
            // If returning to Transmissions, restore the saved position
            window.scrollTo({ top: lastArchiveScroll, behavior: 'instant' });
        } else {
            // For all other tabs, snap to the top for a fresh view
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    });
});

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
    // Space: play/pause
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        run('PodCube.toggle()');
    }
    
    // Arrow keys with Ctrl
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
// --- PLAYLIST SHARING (Refined & Fixed) ---

/**
 * Color palette - hardcoded to avoid CSS variable issues in JS
 */
const COLORS = {
    primary: '#1768da',
    primaryDim: '#e1e8f3',
    primaryDark: '#0d4da1',
    text: '#1a1a1a',
    textMuted: '#555555',
    bg: '#fdfdfc',
    border: '#1768da'
};

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

function importPlaylistFromInput() {
    const input = document.getElementById('playlistImportInput');
    const result = PodCube.importPlaylist(input.value.trim()); //
    if (result && result.episodes.length > 0) {
        // Automatic Save with de-confliction
        let finalName = result.name;
        if (PodCube.loadPlaylist(finalName)) {
            finalName = `${result.name} (Imported ${new Date().getTime().toString().slice(-4)})`;
        }
        PodCube.savePlaylist(finalName, result.episodes); //
        updatePlaylistsUI();
        input.value = '';
        logCommand(`// Imported and saved "${finalName}"`);
    }
}

/**
 * Check for playlist import on page load
 */
function checkForPlaylistImport() {
    const importCode = PodCube.getImportCodeFromUrl();
    if (!importCode) return;

    const playlistData = PodCube.importPlaylist(importCode);
    if (!playlistData) {
        logCommand('// Error: Invalid playlist code');
        return;
    }

    showImportNotification(playlistData);
}

/**
 * Show import notification with action options
 */
function showImportNotification(playlistData) {
    const playerSection = document.getElementById('player');
    if (!playerSection) return;

    const notification = document.createElement('div');
    notification.className = 'import-notification';
    notification.innerHTML = `
        <div class="import-notification-content">
            <div class="import-notification-info">
                <strong>${escapeHtml(playlistData.name)}</strong>
                <span class="import-notification-count">${playlistData.episodes.length} tracks</span>
            </div>
            <div class="import-notification-actions">
                <button class="import-action-btn" onclick="performPlaylistImport('add', this)">Add Queue</button>
                <button class="import-action-btn" onclick="performPlaylistImport('replace', this)">Replace Queue</button>
                <button class="import-action-btn" onclick="performPlaylistImport('save', this)">Save New</button>
                <button class="import-action-close" onclick="this.closest('.import-notification').remove()">Close</button>
            </div>
        </div>
    `;

    playerSection.insertBefore(notification, playerSection.firstChild);
}

/**
 * Execute the playlist import action
 */
function performPlaylistImport(action, button) {
    const notification = button.closest('.import-notification');
    const nameEl = notification.querySelector('strong');
    const name = nameEl.textContent;

    const importCode = PodCube.getImportCodeFromUrl();
    const playlistData = PodCube.importPlaylist(importCode);

    if (!playlistData || playlistData.episodes.length === 0) {
        logCommand('// Error: No episodes to import');
        return;
    }

    try {
        if (action === 'add') {
            // Call API directly with objects
            PodCube.queuePlaylist(playlistData)
            // Log manually for the user
            logCommand(`// Added "${name}" (${episodes.length} tracks) to queue`);
        } else if (action === 'replace') {
            PodCube.clearQueue();
            PodCube.addToQueue(episodes, true);
            logCommand(`// Replaced queue with "${name}"`);
        } else if (action === 'save') {
            const saveName = prompt('Save playlist as:', name);
            if (saveName && saveName.trim()) {
                PodCube.savePlaylist(saveName, episodes);
                updatePlaylistsUI();
                logCommand(`// Saved as "${saveName}"`);
            }
            return;
        }

        updateQueueList();
        notification.remove();
        logCommand(`const playlistData = PodCube.importPlaylist('...'); // playlistData { name, episodes, missingCount }`);
    } catch (e) {
        console.error('Import action failed:', e);
        logCommand(`// Error: Import failed`);
    }
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
            updateStatusIndicator("Scanning pasted Punchcard...");
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
        const files = dt.files;

        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                updateStatusIndicator("Scanning dropped Punchcard...");
                await scanPastedImage(file); // Reuses the Paste logic!
            } else {
                alert("INVALID OBJECT.\n\nThe reader only accepts Image files (PNG/JPG).");
            }
        }
    }, false);
}

async function scanPastedImage(imageBlob) {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

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
                alert("SCAN FAILED.\n\nImage received, but no Nano-GUID could be decoded.\nTry pasting a clearer image or the raw text code.");
                updateStatusIndicator("Error: No QR code found in pasted image.");
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
    let codeToImport = data;

    // Smart-extract: If the QR contains a full URL (like our share links), grab just the code
    if (data.includes('importPlaylist=')) {
        try {
            const url = new URL(data);
            codeToImport = url.searchParams.get('importPlaylist');
        } catch (e) {
            // If URL parsing fails, just use the raw data
            console.warn("Regex parse fallback", e);
        }
    }

    const input = document.getElementById('playlistImportInput');
    if (input) {
        // Visual feedback: Put the code in the box
        input.value = codeToImport;
        // Auto-submit
        importPlaylistFromInput(); 
    }
}

/**
 * Save active tab preference to localStorage
 */
function saveTabPreference(tabId) {
    if (tabId) {
        localStorage.setItem('podCube_activeTab', tabId);
    }
}

/**
 * Restore active tab from localStorage
 */
function restoreTabPreference() {
    const savedTab = localStorage.getItem('podCube_activeTab');
    if (savedTab) {
        const tabElement = document.getElementById(savedTab);
        if (tabElement) {
            // Switch to saved tab
            const tabBtn = document.querySelector(`[data-tab="${savedTab}"]`);
            if (tabBtn) {
                tabBtn.click();
            }
        }
    }
}

// Initialize tab preference restoration on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Attach save handler to all tab buttons
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = btn.getAttribute('data-tab');
            saveTabPreference(tabId);
        });
    });

    // Restore previously active tab
    setTimeout(() => restoreTabPreference(), 100);
});


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