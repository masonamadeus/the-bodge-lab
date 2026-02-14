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
    skipForward: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M10 19c-3.54 0-6.55-2.31-7.6-5.5l-2.37.78C1.42 18.97 5.35 22 10 22c4.65 0 7.05-.99 8.9-2.6L22 23v-9h-9l3.62 3.62c-1.39 1.16-3.16 1.88-5.12 1.88z"/></svg>`,
    shuffle: `<svg viewBox="0 0 24 24" class="icon-svg"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`
};

// --- INITIALIZATION ---
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
            if (heroLogo) { // Add this block
                heroLogo.src = PodCube.logo;
            }
        }
        
        initArchiveControls();
        updateBrigistics();
        updateGeoDistribution();
        updateArchive();
        showDistribution();
        updatePlaylistsUI();
        clearInspector();


        if (await PodCube.restoreSession()) {
            updateStatusIndicator("Session Restored");
            if (PodCube.nowPlaying) {
                loadEpisodeInspector(PodCube.nowPlaying);
            }
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
        PodCube.on('timeupdate', updateProgress);
        PodCube.on('queue:changed', () => {
            updateQueueList();
            updatePlayerQueueList();
        });
        
        // Auto-select currently playing episode if any
        if (PodCube.nowPlaying) {
            loadEpisodeInspector(PodCube.nowPlaying);
        }
        
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

function updatePlayerQueueList() {
    const q = PodCube.queueItems;
    const currentIndex = PodCube.queueIndex;
    
    // Show only upcoming tracks (everything AFTER current index)
    const upcoming = q.slice(currentIndex + 1);
    
    if (upcoming.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div>No upcoming tracks</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = upcoming.map((ep, i) => {
        const actualIndex = currentIndex + 1 + i;  // Actual index in full queue
        return `
        <div class="queue-item">
            <div class="queue-item-info">
                <div class="queue-item-title">
                    <span class="queue-item-number">${i + 1}.</span>
                    ${escapeHtml(ep.title)}
                </div>
            </div>
            <div class="queue-item-actions">
                <button class="icon-btn" onclick="run('PodCube.removeFromQueue(${actualIndex})')">REMOVE</button>
            </div>
        </div>
        `;
    }).join('');
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

function updateArchive() {
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
        'lore_desc': 'sort by lore date (newest)',
        'lore_asc': 'sort by lore date (oldest)',
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
        clone.querySelector('.ep-duration').textContent = ep.duration ? `${ep.weirdDuration} Minutes` : '0:00';

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
        
        clone.querySelector('.btn-play').addEventListener('click', (e) => {
            e.stopPropagation();
            run(`PodCube.play(PodCube.all[${idx}])`);
        });

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

        // Wire up INSPECT
        clone.querySelector('.btn-inspect').addEventListener('click', (e) => {
            e.stopPropagation();
            handleEpisodeClick(idx); // Standard inspection trigger
        });

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
}

function handleEpisodeClick(index) {
    const episode = PodCube.all[index];
    loadEpisodeInspector(episode);
    
    // Switch to inspector tab
    //const tab = document.querySelector('[data-tab="inspector"]');
    //if (tab) tab.click();
}

function resetArchive() {
    ['arcSearch', 'arcModel', 'arcOrigin', 'arcRegion', 'arcZone', 'arcPlanet', 'arcLocale', 'arcType', 'arcYear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateArchive();
    logCommand('// Filters reset');
}

function playFilteredResults() {
    if (AppState.filteredResults.length === 0) return;
    
    logCommand(`// Playing ${AppState.filteredResults.length} filtered results`);
    
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
    
    logCommand(`// Queuing ${AppState.filteredResults.length} episodes`);
    
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
    
    // Header with actions
    const header = document.getElementById('inspectorHeader');
    if (header) {
        // We reuse the structure but safely update content
        // Note: For simplicity here we kept the innerHTML structure in index.njk 
        // but we are injecting buttons safely now. 
        // Ideally inspectorHeader in HTML should have distinct elements to target.
        // For this refactor, let's just make the buttons safer:
        
        header.textContent = ''; // Clear
        
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `<h3>Transmission Data Inspector</h3>`;
        const p = document.createElement('h1');
        p.style.color = 'var(--primary)';
        p.style.marginTop = '15px';
        p.innerHTML = 'Complete metadata for: ';
        const strong = document.createElement('strong');
        strong.textContent = ep.title;
        p.appendChild(strong);
        titleDiv.appendChild(p);

        const btnDiv = document.createElement('div');
        btnDiv.style.display = 'flex';
        btnDiv.style.gap = '10px';

        const btnPlay = document.createElement('button');
        btnPlay.className = 'icon-btn';
        btnPlay.textContent = 'PLAY NOW';
        btnPlay.onclick = () => run(`PodCube.play(PodCube.all[${idx}])`);

        const btnQueue = document.createElement('button');
        btnQueue.className = 'icon-btn';
        btnQueue.textContent = 'ADD TO QUEUE';
        btnQueue.onclick = () => run(`PodCube.addToQueue(PodCube.all[${idx}])`);

        btnDiv.appendChild(btnPlay);
        btnDiv.appendChild(btnQueue);

        header.appendChild(titleDiv);
        header.appendChild(btnDiv);
    }
    
    // Core Properties
    const coreFields = [
        { label: 'Title', value: ep.title },
        { label: 'Shortcode', value: ep.shortcode || 'N/A', code: true },
        { label: 'Episode Type', value: ep.episodeType || 'none', code: true },
        { label: 'Model', value: ep.model || 'N/A', code: true },
        { label: 'Integrity', value: ep.integrity || 'N/A', code: false },
        { label: 'Integrity Value', value: ep.integrityValue !== null ? ep.integrityValue + '%' : 'N/A', code: false },
        { label: 'Episode ID', value: ep.id || 'N/A', code: true },
    ];
    
    renderFields('inspectorCore', coreFields);
    
    // Temporal Data
    const temporalFields = [
        { label: 'Anniversary', value: ep.anniversary || 'N/A', code: false },
        { label: 'Lore Date', value: ep.date?.toString() || 'Unknown Date', code: false },
        { label: 'Lore Year', value: ep.date?.year ? ep.date.displayYear : 'N/A', code: true },
        { label: 'Published Date', value: ep.published ? new Date(ep.published).toLocaleDateString() : 'N/A', code: false },
        { label: 'Published Time', value: ep.published ? new Date(ep.published).toLocaleTimeString() : 'N/A', code: true },
    ];
    
    renderFields('inspectorTemporal', temporalFields);
    
    // Geographic Metadata
    const geoFields = [
        { label: 'Origin', value: ep.origin || 'N/A', code: true },
        { label: 'Locale', value: ep.locale || 'N/A', code: true },
        { label: 'Region', value: ep.region || 'N/A', code: true },
        { label: 'Zone', value: ep.zone || 'N/A', code: true },
        { label: 'Planet', value: ep.planet || 'N/A', code: true },
        { label: 'Location (Composite)', value: ep.location || 'N/A', code: false },
    ];
    
    renderFields('inspectorGeo', geoFields);
    
    // Audio Information
    const audioFields = [
        { label: 'Duration', value: ep.timestamp || 'N/A', code: false },
        { label: 'Duration (seconds)', value: ep.duration ? ep.duration + 's' : 'N/A', code: true },
        { label: 'Weird Duration', value: ep.weirdDuration || 'N/A', code: false },
        { label: 'Audio URL', value: ep.audioUrl ? 'Present' : 'Missing', code: false },
        { label: 'File Size', value: ep.sizeBytes ? formatBytes(ep.sizeBytes) : 'N/A', code: true },
    ];
    
    renderFields('inspectorAudio', audioFields);
    
    // Description
    const descContainer = document.getElementById('inspectorDescription');
    if (descContainer) {
        descContainer.innerHTML = ep.description 
            ? `<div>${escapeHtml(ep.description)}</div>`
            : '<div class="text-muted" style="font-style:italic;">No description available</div>';
    }
    
    // Tags
    const tagsContainer = document.getElementById('inspectorTags');
    if (tagsContainer) {
        if (ep.tags && ep.tags.length > 0) {
            tagsContainer.innerHTML = `
        <div class="inspector-tags">
            ${ep.tags.map(tag => `
                <span class="inspector-tag" 
                      style="cursor:pointer;" 
                      onclick="applyHierarchyFilter('tag', '${escapeForAttribute(tag)}')">
                    ${escapeHtml(tag)}
                </span>`).join('')}
        </div>
    `;
        } else {
            tagsContainer.innerHTML = '<p class="text-muted" style="font-size:12px;">No tags</p>';
        }
    }
    
    // Related Episodes
    loadRelatedEpisodes(ep);
    
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
    // 1. Reset Header (Remove buttons, reset text)
    const header = document.getElementById('inspectorHeader');
    if (header) {
        header.innerHTML = `
            <div>
                <h3>Episode Data Inspector</h3>
                <p class="text-muted" style="font-size:12px; margin-top:5px;">
                    Select an episode from the Browse tab to populate metadata fields.
                </p>
            </div>
            <div id="inspectorActions"></div>
        `;
    }

    // 2. Render Empty Grids (Scaffolding)
    // We use empty strings so the boxes appear but are marked as .empty by the renderer
    
    renderFields('inspectorCore', [
        { label: 'Title', value: '' },
        { label: 'Shortcode', value: '' },
        { label: 'Episode Type', value: '' },
        { label: 'Model', value: '' },
        { label: 'Integrity', value: '' },
        { label: 'Integrity Value', value: '' },
        { label: 'Episode ID', value: '' },
    ]);
    
    renderFields('inspectorTemporal', [
        { label: 'Anniversary', value: '' },
        { label: 'Lore Date', value: '' },
        { label: 'Lore Year', value: '' },
        { label: 'Published Date', value: '' },
        { label: 'Published Time', value: '' },
    ]);
    
    renderFields('inspectorGeo', [
        { label: 'Origin', value: '' },
        { label: 'Locale', value: '' },
        { label: 'Region', value: '' },
        { label: 'Zone', value: '' },
        { label: 'Planet', value: '' },
        { label: 'Location (Composite)', value: '' },
    ]);
    
    renderFields('inspectorAudio', [
        { label: 'Duration', value: '' },
        { label: 'Duration (seconds)', value: '' },
        { label: 'Weird Duration', value: '' },
        { label: 'Audio URL', value: '' },
        { label: 'File Size', value: '' },
    ]);
    
    // 3. Reset Non-Grid Sections
    const desc = document.getElementById('inspectorDescription');
    if (desc) desc.innerHTML = '<span class="text-muted" style="font-style:italic;">-</span>';
    
    const tags = document.getElementById('inspectorTags');
    if (tags) tags.innerHTML = '<span class="text-muted">-</span>';
    
    const related = document.getElementById('inspectorRelated');
    if (related) related.innerHTML = '<span class="text-muted" style="font-size:12px;">-</span>';
    
    // 4. Clear Raw Data Tabs
    ['rawJson', 'rawMeta', 'rawDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
}

// --- PLAYBACK & PLAYER TAB ---

function toggleAutoplayMode(enabled) {
    AppState.radioMode = enabled;
    
    if (enabled) {
        logCommand("// RADIO MODE: AUTHORIZED. Continuous transmission active.");
        
        // If nothing is playing, start the radio immediately
        if (!PodCube.nowPlaying) {
            playNextRandom();
        } else {
            // If something IS playing, check if we need to append the next track now
            checkRadioChain();
        }
    } else {
        logCommand("// RADIO MODE: DE-AUTHORIZED.");
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
        
        const timeText = formatTime(status.time) + ' / ' + formatTime(status.duration);
        const el = document.getElementById('transTime');
        if (el) el.textContent = timeText;
        
        const start = document.getElementById('playerTimeStart');
        const end = document.getElementById('playerTimeEnd');
        if (start) start.textContent = formatTime(status.time);
        if (end) end.textContent = formatTime(status.duration);
    }
}

function startLiveDataMonitor() {
    if (AppState.liveDataInterval) {
        clearInterval(AppState.liveDataInterval);
    }
    
    AppState.liveDataInterval = setInterval(() => {
        updateLivePlaybackData();
        updatePlayerBufferInfo();
    }, 100);
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

function updatePlayerQueueList() {
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

    
    q.forEach((ep, i) => {
        const isCur = i === PodCube.queueIndex;
        const clone = document.importNode(template.content, true);
        
        const item = clone.querySelector('.queue-item');
        item.dataset.queueIndex = i;
         if (isCur) {
            item.classList.add('current');
            item.removeAttribute('draggable');  // Can't drag current
        }

        clone.querySelector('.queue-item-number').textContent = `${i + 1}.`;
        clone.querySelector('.qi-title').textContent = ep.title;
        clone.querySelector('.queue-item-meta').textContent = `${ep.model || 'Unknown'} • ${ep.timestamp || 'Unknown duration'}`;
        
        clone.querySelector('.btn-remove').addEventListener('click', () => {
            run(`PodCube.removeFromQueue(${i})`);
        });

        fragment.appendChild(clone);
    });

    list.appendChild(fragment);
}

function updateQueueList() {
    console.log(
        `alias called for updateplayerqueuelist, find the culprit`
    )
    updatePlayerQueueList();
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

// Add to initialization
window.addEventListener('PodCube:Ready', async () => {
    // ... existing init ...
    initQueueDragAndDrop();
});

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

function updatePlaylistsUI() {
    const container = document.getElementById('playlistList');
    const template = document.getElementById('tmpl-playlist-item');
    if (!container || !template) return;
    
    const playlists = PodCube.getPlaylists();
    container.textContent = '';
    
    if (playlists.length === 0) {
        container.innerHTML = '<div class="text-muted" style="font-size:12px; grid-column: 1/-1; text-align:center; padding:10px;">No saved playlists</div>';
        return;
    }
    
    playlists.forEach(pl => {
        const clone = document.importNode(template.content, true);
        clone.querySelector('.playlist-name').textContent = pl.name;
        clone.querySelector('.playlist-meta').textContent = `${pl.episodes.length} tracks • ${new Date(pl.created).toLocaleDateString()}`;
        
        clone.querySelector('.btn-load').addEventListener('click', () => {
            loadPlaylistToQueue(pl.name);
        });
        
        clone.querySelector('.btn-delete').addEventListener('click', () => {
            deletePlaylist(pl.name);
        });
        
        container.appendChild(clone);
    });
}

function loadPlaylistToQueue(name) {
    // We delegate the heavy lifting to the API
    run(`PodCube.queuePlaylist("${name}")`);
}

function deletePlaylist(name) {
    run(`PodCube.deletePlaylist("${name}")`);
    updatePlaylistsUI();
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
    
    updatePlayerQueueList();
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
    
    updateStatusIndicator("Switching Protocol...");
    run(`PodCube.setFeedType('${next}')`);
    
    try {
        await PodCube.init(true);
        updateStatusIndicator(`Connected: ${PodCube.FEED_TYPE.toUpperCase()}`);
        
        // Refresh all data
        initArchiveControls();
        updateBrigistics();
        updateGeoDistribution();
        updateArchive();
        showDistribution();
        updateUI();
        
        logCommand(`// Switched to ${next.toUpperCase()} feed`);
    } catch(e) {
        updateStatusIndicator("Protocol Error");
        logCommand(`// ERROR switching feed: ${e.message}`);
    }
}

// --- UTILITIES ---
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
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
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