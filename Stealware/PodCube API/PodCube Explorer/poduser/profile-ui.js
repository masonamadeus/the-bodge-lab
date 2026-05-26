/**
 * profile-ui.js — Profile Tab Rendering
 *
 * Drop-in replacement for renderUserUI() in explorer.js.
 */

// ─────────────────────────────────────────────────────────────────
// CSS INJECTION (once, on load)
// ─────────────────────────────────────────────────────────────────

(function injectProfileStyles() {
    if (document.getElementById('profile-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'profile-ui-styles';
    style.textContent = `

    /* ── PROFILE HERO ─────────────────────────────── */
    .profile-hero {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        padding: 20px;
        background: #fff;
        border: 3px double var(--primary);
        margin-bottom: 30px;
        position: relative;
        margin-top: 15px;
        flex-wrap: wrap;
    }
    .profile-hero::before {
        content: "Personnel Record";
        position: absolute;
        top: -10px; left: 10px;
        background: var(--bg-body);
        padding: 0 10px;
        font-family: "Fustat", sans-serif;
        font-size: 10px; font-weight: 700;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .profile-username {
        font-size: 1.8em;
        color: var(--primary);
        margin: 0 0 4px;
        line-height: 1;
    }
    .profile-role {
        font-family: "Fustat", sans-serif;
        font-size: 10px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    /* ── PROFILE STATS ────────────────────────────── */
    .profile-stat-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
    }
    @media (max-width: 900px) {
        .profile-stat-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 500px) {
        .profile-stat-grid { grid-template-columns: repeat(2, 1fr); }
    }

    /* ── ACHIEVEMENT FILTER BAR ───────────────────── */
    .ach-filter-bar { display: flex; gap: 4px; }
    .ach-filter-btn {
        font-family: "Fustat", sans-serif;
        font-size: 10px; font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 4px 12px;
        border: 1px solid var(--primary);
        background: #fff;
        color: var(--primary);
        cursor: pointer;
    }
    .ach-filter-btn.active { background: var(--primary); color: #fff; }
    @media (hover: hover) {
        .ach-filter-btn:hover:not(.active) { background: var(--primary-dim); }
    }

    /* ── ACHIEVEMENT GALLERY ──────────────────────── */
    .achievement-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(265px, 1fr));
        grid-auto-rows: 1fr;
        gap: 10px;
    }
    @media (max-width: 500px) { .achievement-gallery { grid-template-columns: 1fr; } }

    .ach-card {
        background: #fff;
        border: 1px solid var(--primary-dim);
        padding: 14px;
        display: flex;
        flex-direction: column;
        position: relative;
        height: 100%;
        transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .ach-card.unlocked { 
        border-color: var(--primary);
        border-top: 3px solid var(--primary);
    }
    .ach-card.hidden-goal.locked { opacity: 0.65; background: #f9f9f9; }
    .ach-card.locked {
        opacity: 0.75;
        background: var(--primary-dim);
        border: 1px dashed var(--primary);
    }
    
    .ach-card.locked .ach-icon {
        filter: grayscale(100%) opacity(0.6);
    }

    .ach-card-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding-right: 60px;
        flex: 1; 
    }
    .ach-icon {
        font-size: 1.6em; width: 32px;
        text-align: center; flex-shrink: 0; line-height: 1.3;
        color:transparent;
        text-shadow: 0 0 var(--primary);
    }
    .ach-meta { flex: 1; }
    .ach-title {
        font-family: "Libertinus Math", serif;
        font-size: 1em; font-weight: 700;
        color: var(--primary); margin: 0 0 4px; line-height: 1.2;
    }
    .ach-desc {
        font-family: "Fustat", sans-serif;
        font-size: 10px; color: #666;
        text-transform: uppercase;
        line-height: 1.5; letter-spacing: 0.02em;
    }

    .ach-status-badge {
        font-family: "Fustat", sans-serif;
        font-size: 9px; font-weight: 700;
        text-transform: uppercase;
        padding: 3px 7px;
        position: absolute; top: 10px; right: 10px;
        letter-spacing: 0.05em;
    }
    .ach-status-badge.is-unlocked { background: var(--primary); color: #fff; }
    .ach-status-badge.is-locked   { background: var(--primary-dim); color: var(--primary); }

    .ach-reward {
        margin-top: 12px; padding-top: 12px;
        border-top: 1px dashed var(--primary-dim);
        flex-shrink: 0; 
    }
    
    .ach-reward-media-wrapper {
        height: 140px; 
        width: 100%;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 4px;
        position: relative;
        margin-bottom: 8px;
        transition: opacity 0.2s ease;
    }
    .ach-reward-media-wrapper:hover {
        opacity: 0.9;
    }
    
    .ach-hover-overlay {
        position: absolute; inset: 0; background: rgba(0,0,0,0.3); 
        display: flex; align-items: center; justify-content: center; 
        opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
    }
    .ach-reward-media-wrapper:hover .ach-hover-overlay {
        opacity: 1;
    }
    
    .ach-video-overlay {
        position: absolute;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ach-reward-caption {
        font-family: "Fustat", sans-serif;
        font-size: 9px; text-transform: uppercase;
        color: var(--primary); margin-top: 5px; letter-spacing: 0.04em;
    }

    /* ── LOCKED REWARD PLACEHOLDER ────────────────── */
    .ach-reward-locked-wrapper {
        height: 140px;
        width: 100%;
        background: repeating-linear-gradient(
            -45deg,
            var(--primary-dim),
            var(--primary-dim) 8px,
            #f5f5f5 8px,
            #f5f5f5 16px
        );
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 4px;
        margin-bottom: 8px;
        border: 1px dashed #c8d8f0;
        position: relative;
        overflow: hidden;
    }
    .ach-reward-locked-wrapper::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, transparent 40%, rgba(249,249,249,0.6) 100%);
        pointer-events: none;
    }
    .ach-reward-lock-icon {
        font-size: 2em;
        filter: grayscale(100%) opacity(0.35);
        line-height: 1;
    }
    .ach-reward-lock-label {
        font-family: 'Fustat', sans-serif;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #b0b8c8;
    }
    .ach-reward-lock-sublabel {
        font-family: 'Fustat', sans-serif;
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #c8d0dc;
        margin-top: -4px;
    }

    /* ── REWARD SECTION HEADER ────────────────────── */
    .ach-reward-section-label {
        font-family: 'Fustat', sans-serif;
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--primary);
        opacity: 0.5;
        margin-bottom: 8px;
    }
    .ach-card.locked .ach-reward-section-label {
        color: #aaa;
        opacity: 1;
    }

    /* ── FULLSCREEN LIGHTBOX ──────────────────────── */
    .ach-lightbox-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
    }
    .ach-lightbox-overlay.active {
        opacity: 1;
        pointer-events: all;
    }
    .ach-lightbox-content {
        max-width: 90vw;
        max-height: 80vh;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        border: 3px double var(--primary);
        background: #000;
        transform: scale(0.95);
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .ach-lightbox-overlay.active .ach-lightbox-content {
        transform: scale(1);
    }
    .ach-lightbox-caption {
        color: #fff;
        font-family: "Fustat", sans-serif;
        margin-top: 15px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        text-align: center;
    }
    .ach-lightbox-close {
        position: absolute;
        top: 20px; right: 30px;
        color: #fff;
        font-size: 40px;
        cursor: pointer;
        background: none;
        border: none;
        line-height: 1;
        padding: 10px;
        opacity: 0.7;
    }
    .ach-lightbox-close:hover { opacity: 1; }

    /* ── MEMORY CARD (bottom) ─────────────────────── */
    .memory-card-section {
        border: 1px dashed var(--primary);
        padding: 20px; position: relative;
    }
    .memory-card-section::before {
        content: "Memory Card — Backup & Restore";
        position: absolute; top: -9px; left: 10px;
        background: var(--bg-body); padding: 0 8px;
        font-family: "Fustat", sans-serif;
        font-size: 10px; font-weight: 700;
        color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;
    }

    .login-code-hidden {
        filter: blur(5px);
        user-select: none; pointer-events: none;
        transition: filter 0.25s ease;
    }
    .login-code-visible {
        filter: none; user-select: all;
        transition: filter 0.25s ease;
    }
    `;
    document.head.appendChild(style);
})();


// ─────────────────────────────────────────────────────────────────
// MODULE STATE
// ─────────────────────────────────────────────────────────────────

let _achFilter = 'all';
let _loginCodeVisible = false;


// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

function renderUserUI(userData) {
    _renderHeaderBadge(userData);
    _renderProfileHero(userData);
    _renderProfileStats(userData);
    _renderAchievements(userData);
    _renderNotifications(userData);
    _refreshLoginCode();
}

/** Switch achievement gallery filter. Called by filter bar buttons. */
function setAchFilter(filter) {
    _achFilter = filter;
    _renderAchievements(PodUser.data);
}

/** Toggle login code visibility. Called by eyeball button. */
function toggleLoginCode() {
    _loginCodeVisible = !_loginCodeVisible;
    _refreshLoginCode();
    const btn = document.getElementById('prof-eyeball-btn');
    if (btn) btn.textContent = _loginCodeVisible ? 'Hide' : 'Reveal';
}

function copyLoginCode() {
    if (!_loginCodeVisible) {
        alert('Reveal the code first.');
        return;
    }
    copyToClipboard('prof-export-code');
}

/** Open the Achievement Fullscreen Lightbox */
window.openAchLightbox = function(type, url, caption) {
    let overlay = document.getElementById('ach-lightbox');
    
    // Construct Lightbox if it doesn't exist yet
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ach-lightbox';
        overlay.className = 'ach-lightbox-overlay';
        overlay.innerHTML = `
            <button class="ach-lightbox-close" onclick="closeAchLightbox()">×</button>
            <div id="ach-lightbox-body" style="display:flex; flex-direction:column; align-items:center;"></div>
        `;
        document.body.appendChild(overlay);
        
        // Click outside media to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === document.getElementById('ach-lightbox-body')) {
                closeAchLightbox();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('ach-lightbox')?.classList.contains('active')) {
                closeAchLightbox();
            }
        });
    }

    const body = document.getElementById('ach-lightbox-body');
    body.innerHTML = ''; // Clear previous content

    // Populate Media
    if (type === 'image') {
        body.innerHTML = `<img src="${url}" class="ach-lightbox-content" style="object-fit:contain;">`;
    } else if (type === 'video') {
        body.innerHTML = `<video src="${url}" class="ach-lightbox-content" controls autoplay style="object-fit:contain;"></video>`;
    }

    // Populate Caption
    if (caption && caption !== 'undefined' && caption.trim() !== '') {
        body.innerHTML += `<div class="ach-lightbox-caption">${escapeHtml(caption)}</div>`;
    }

    // Force CSS reflow to ensure the transition animates smoothly
    void overlay.offsetWidth;
    overlay.classList.add('active');
};

/** Close Lightbox and pause video */
window.closeAchLightbox = function() {
    const overlay = document.getElementById('ach-lightbox');
    if (overlay) {
        overlay.classList.remove('active');
        const vid = overlay.querySelector('video');
        if (vid) vid.pause();
    }
};

// ─────────────────────────────────────────────────────────────────
// PRIVATE: SUB-RENDERERS
// ─────────────────────────────────────────────────────────────────

function _renderHeaderBadge(userData) {
    const name = document.getElementById('ub-name');
    if (name) name.textContent = userData.username;

    const badge = document.getElementById('ub-notif');
    if (!badge) return;
    const n = PodUser.unreadCount;
    badge.textContent = n;
    badge.style.display = n > 0 ? 'inline-block' : 'none';
}

function _renderProfileHero(userData) {
    const el = document.getElementById('prof-username');
    if (el) {
        el.innerHTML = `
            <span id="prof-name-text" spellcheck="false" style="outline: none; border-bottom: 2px solid transparent; transition: border-color 0.2s;">
                ${escapeHtml(userData.username)}
            </span>
            <button onclick="renameUser()" title="Change Designation" 
                    style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.5em; vertical-align:middle; padding:4px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
            </button>
        `;
    }
}

window.renameUser = function() {
    const nameEl = document.getElementById('prof-name-text');
    if (!nameEl) return;

    // Bail if already in edit mode — prevents listener stacking on double-click
    if (nameEl.contentEditable === 'true') return;
    
    nameEl.contentEditable = "true";
    nameEl.style.borderBottomColor = "var(--primary)";
    nameEl.focus();
    
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveRename = () => {
        nameEl.contentEditable = "false";
        nameEl.style.borderBottomColor = "transparent";
        const newName = nameEl.textContent.trim();
        
        if (newName && newName !== PodUser.data.username) {
            PodUser.data.username = newName;
            PodUser.save(); 
        } else {
            nameEl.textContent = PodUser.data.username; 
        }
        
        nameEl.removeEventListener('blur', saveRename);
        nameEl.removeEventListener('keydown', keydownHandler);
    };

    const keydownHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            nameEl.blur();      
        } else if (e.key === 'Escape') {
            e.preventDefault();
            nameEl.textContent = PodUser.data.username; 
            nameEl.blur(); 
        }
    };

    // Defensive: remove any stale listeners before adding fresh ones
    nameEl.removeEventListener('blur', saveRename);
    nameEl.removeEventListener('keydown', keydownHandler);
    nameEl.addEventListener('blur', saveRename);
    nameEl.addEventListener('keydown', keydownHandler);
};

function _renderProfileStats(userData) {
    const grid = document.getElementById('prof-stats-grid');
    if (!grid) return;

    const total    = PodUser.achievements.length;
    const unlocked = userData.achievements.length;

    // Calculate total listening time from the history array
    let totalSeconds = 0;
    if (window.PodCube && typeof window.PodCube.findEpisode === 'function') {
        userData.history.forEach(id => {
            const ep = window.PodCube.findEpisode(id);
            if (ep && ep.duration) {
                totalSeconds += ep.duration;
            }
        });
    }
    
    let timeString = '0H 0M';
    if (totalSeconds > 0) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        timeString = `${h}H ${m}M`;
    }

    // Calculate Productivity Score 
    const prodScore = Object.values(userData.games || {}).reduce((sum, val) => sum + val, 0);

    grid.innerHTML = `
        <div class="stat-box">
            <label>Logins</label>
            <div class="stat-num">${userData.visits}</div>
        </div>
        <div class="stat-box">
            <label>Listens</label>
            <div class="stat-num">${userData.history.length}</div>
        </div>
        <div class="stat-box">
            <label>Time Logged</label>
            <div class="stat-num" style="font-size: 1.3em;" title="${totalSeconds} seconds">${timeString}</div>
        </div>
        <div class="stat-box">
            <label>Punchcards</label>
            <div class="stat-num">${userData.punchcards}</div>
        </div>
        <div class="stat-box">
            <label>Cards Shared</label>
            <div class="stat-num">${userData.punchcardExport || 0}</div>
        </div>
        <div class="stat-box">
            <label>Perks</label>
            <div class="stat-num">${unlocked}<span style="font-size:0.45em;color:#aaa;"> /${total}</span></div>
        </div>
    `;
}

function _renderAchievements(userData) {
    const container = document.getElementById('prof-achievements');
    if (!container) return;

    document.querySelectorAll('.ach-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === _achFilter);
    });

    let list = PodUser.achievements;
    if (_achFilter === 'unlocked') list = list.filter(a =>  userData.achievements.includes(a.id));
    if (_achFilter === 'locked')   list = list.filter(a => !userData.achievements.includes(a.id));

    if (list.length === 0) {
        container.innerHTML = `
            <p style="text-align:center; padding:30px; font-family:'Fustat'; font-size:11px;
                      text-transform:uppercase; color:#888; letter-spacing:0.05em;">
                ${_achFilter === 'locked'
                    ? 'All Perks unlocked. Remarkable.'
                    : 'No Perks registered.'}
            </p>`;
        return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'achievement-gallery';

    list.forEach(ach => {
        const unlocked = userData.achievements.includes(ach.id);
        const isHidden = !unlocked && ach.hiddenGoal;
        
        // Icon rules: hidden-goal locked → ❓, unlocked → custom or 🏆, locked → 🔒 always
        const icon     = isHidden ? '❓' : (unlocked ? (ach.icon || '🏆') : '🔒');
        const title    = isHidden ? '???' : escapeHtml(ach.title);
        const desc     = isHidden ? 'This record is classified.' : escapeHtml(ach.desc);

        const card = document.createElement('div');
        card.id = `ach-card-${ach.id}`; 
        card.className = `ach-card ${unlocked ? 'unlocked' : 'locked'} ${isHidden ? 'hidden-goal' : ''}`;

        let rewardHtml = '';
        if (unlocked && ach.reward) {
            rewardHtml = _buildRewardHtml(ach);
        } else if (!unlocked) {
            rewardHtml = _buildLockedRewardPlaceholder(ach);
        }

        card.innerHTML = `
            <span class="ach-status-badge ${unlocked ? 'is-unlocked' : 'is-locked'}">
                ${unlocked ? '✓ Unlocked' : '🔒 Locked'}
            </span>
            <div class="ach-card-header">
                <div class="ach-icon">${icon}</div>
                <div class="ach-meta">
                    <h4 class="ach-title">${title}</h4>
                    <p class="ach-desc">${desc}</p>
                </div>
            </div>
            ${rewardHtml ? `<div class="ach-reward">${rewardHtml}</div>` : ''}
        `;

        gallery.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(gallery);
}

function _renderNotifications(userData) {
    const container = document.getElementById('prof-notifications');
    if (!container) return;

    if (!userData.notifications.length) {
        container.innerHTML = `<p style="text-align:center; padding:20px; font-family:'Fustat'; font-size:11px; text-transform:uppercase; color:#888;">No alerts at this time.</p>`;
        return;
    }

    container.innerHTML = userData.notifications.map(n => {
        // All live notifications are unread by definition — they are deleted on dismiss.
        const hasPayload = !!n.payload;
        
        return `
        <div class="notification-card unread"
             onclick="handleNotificationClick('${n.id}')" style="cursor:pointer;" title="${hasPayload ? 'View Record' : 'Click to dismiss'}">
            <div style="font-size:10px; color:#888; font-family:'Fustat'; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">
                ${new Date(n.timestamp).toLocaleString()}
            </div>
            <strong style="display:block; margin-bottom:4px; font-family:'Libertinus Math'; font-size:16px;">
                ${escapeHtml(n.title)}
            </strong>
            <p style="font-size:12px; color:#444; margin:0; line-height:1.5; font-family:'Fustat';">
                ${escapeHtml(n.body)}
            </p>
        </div>
        `;
    }).join('');
}

function _buildLockedRewardPlaceholder(ach) {
    // Determine the lock icon hint based on reward type, without revealing what it is
    const rewardTypeHint = {
        'audio': '📡',
        'video': '📼',
        'image': '🖼',
        'game':  '🎮',
        'text':  '📋',
    }[ach.reward?.type] || '🔒';

    // For hidden-goal achievements, don't even hint at the reward type
    const icon = ach.hiddenGoal ? '🔒' : rewardTypeHint;

    return `
        <div class="ach-reward-section-label">${ach.reward ? 'Classified Reward' : 'Classified'}</div>
        <div class="ach-reward-locked-wrapper">
            <div class="ach-reward-lock-icon">${icon}</div>
            <div class="ach-reward-lock-label">Unlock to Reveal</div>
            <div class="ach-reward-lock-sublabel">Content Classified</div>
        </div>
    `;
}

function _buildRewardHtml(ach) {
    if (!ach.reward) return '';
    const sectionLabel = `<div class="ach-reward-section-label">Unlocked Reward</div>`;
    
    // Wraps the media block and sets up Lightbox clicks if enabled
    const mkWrapper = (content, isClickable = false, onclick = '', extraStyles = '') => `
        <div class="ach-reward-media-wrapper" 
             ${isClickable ? `onclick="${onclick}" style="cursor: zoom-in; ${extraStyles}" title="View Fullscreen"` : `style="${extraStyles}"`}>
            ${content}
        </div>
    `;

    switch (ach.reward.type) {
        case 'image':
            return sectionLabel + `
                ${mkWrapper(`
                    <img src="${escapeForAttribute(ach.reward.url)}" 
                         alt="Unlocked: ${escapeForAttribute(ach.title)}"
                         style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="ach-hover-overlay"><span style="font-size: 24px;">🔍</span></div>
                `, true, `openAchLightbox('image', '${escapeForAttribute(ach.reward.url)}', '${escapeForAttribute(ach.reward.caption || '')}')`)}
                ${ach.reward.caption ? `<p class="ach-reward-caption">${escapeHtml(ach.reward.caption)}</p>` : ''}
            `;
        case 'video':
            return sectionLabel + `
                ${mkWrapper(`
                    <video src="${escapeForAttribute(ach.reward.url)}" 
                           style="width: 100%; height: 100%; object-fit: cover;" muted playsinline></video>
                    <div class="ach-video-overlay">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="#fff" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                `, true, `openAchLightbox('video', '${escapeForAttribute(ach.reward.url)}', '')`, 'background: #000;')}
            `;
        case 'audio':
            return sectionLabel + `
                ${mkWrapper(`
                <button class="hero-btn" style="width: 85%; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 0;"
                        onclick="PodUser.playRewardAudio('${escapeForAttribute(ach.id)}')">
                    <span class="hero-btn-icon" style="font-size: 1.2em;">▶</span>
                    <span class="hero-btn-text">
                        <strong style="font-size: 12px; font-family: 'Libertinus Math';">Play Transmission</strong>
                        <span style="font-size: 9px; color: #666; text-transform: uppercase; font-family: 'Fustat';">${escapeHtml(ach.reward.meta?.title || 'Classified')}</span>
                    </span>
                </button>
                `, false, '', 'background: repeating-linear-gradient(45deg, var(--primary-dim), var(--primary-dim) 10px, #fff 10px, #fff 20px);')}
            `;
        case 'game':
            return sectionLabel + `
                ${mkWrapper(`
                <button class="hero-btn" style="width: 85%; padding: 12px; border-color: var(--orange); box-shadow: 0 4px 12px rgba(0,0,0,0.4); border-radius: 0;"
                        onclick="switchTab('interactive', true); window.Interactive?.load?.('${escapeForAttribute(ach.reward.gameId)}')">
                    <span class="hero-btn-icon" style="font-size: 1.2em; color: var(--orange);">🎮</span>
                    <span class="hero-btn-text">
                        <strong style="font-size: 12px; font-family: 'Libertinus Math';">${escapeHtml(ach.reward.buttonText || 'Launch Module')}</strong>
                        <span style="font-size: 9px; color: #666; text-transform: uppercase; font-family: 'Fustat';">Productivity Task</span>
                    </span>
                </button>
                `, false, '', 'background: #1a1a1a;')}
            `;
        case 'text':
            return sectionLabel + `
            <div style="position: relative; background: #f9f9f9; border: 1px solid var(--primary-dim); border-radius: 4px; padding: 16px; margin-top: 8px; height: 140px; display: flex; flex-direction: column;">
                <div style="white-space:pre-wrap; flex: 1; overflow-y: auto; font-size: 11px; font-family: monospace; color: #333;">${escapeHtml(ach.reward.content)}</div>
                <button onclick="navigator.clipboard.writeText('${escapeForAttribute(ach.reward.content)}'); this.textContent='COPIED!'; setTimeout(()=>this.textContent='COPY CODE', 1500);" 
                        style="position: absolute; top: 6px; right: 6px; font-size: 8px; font-weight: bold; font-family: 'Fustat'; padding: 4px 8px; background: var(--primary); color: #fff; border: none; border-radius: 2px; cursor: pointer; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    COPY CODE
                </button>
            </div>`;
        default:
            return '';
    }
}

function _refreshLoginCode() {
    const el = document.getElementById('prof-export-code');
    if (!el) return;
    el.textContent = PodUser.exportCode();
    el.className   = _loginCodeVisible ? 'login-code-visible' : 'login-code-hidden';
}


// CLICK HANDLER FOR NOTIFICATIONS
window.handleNotificationClick = function(id) {
    const n = PodUser.data.notifications.find(x => x.id === id);
    if (!n) return;

    // Extract the payload into a local variable BEFORE we delete the notification!
    const payload = n.payload;

    // 1. Mark as read immediately (which now deletes it from the database)
    PodUser.markNotificationRead(id);

    // 2. Execute Navigation Payload
    if (payload && payload.type === 'achievement') {
        // Switch to the profile tab (using the existing engine function)
        if (typeof switchTab !== 'undefined') switchTab('profile', true);
        
        // Force the filter to 'All' so the achievement is definitely visible
        _achFilter = 'all'; 
        
        // Flush UI changes immediately
        renderUserUI(PodUser.data);

        // Allow 100ms for DOM render before scrolling to the card
        setTimeout(() => {
            const card = document.getElementById(`ach-card-${payload.id}`);
            if (card) {
                // Scroll it into the center of the window
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Add a cool highlight animation
                card.style.transition = 'box-shadow 0.4s ease, transform 0.4s ease';
                card.style.boxShadow = '0 0 20px rgba(23, 104, 218, 0.8)';
                card.style.transform = 'scale(1.03)';
                card.style.zIndex = '10';
                
                // Remove highlight after a couple of seconds
                setTimeout(() => {
                    card.style.boxShadow = 'none';
                    card.style.transform = 'none';
                    setTimeout(() => card.style.zIndex = '', 400);
                }, 2000);
            }
        }, 100);
    } else {
        // If it's a standard notification, just re-render the UI to make it disappear
        renderUserUI(PodUser.data);
    }
};