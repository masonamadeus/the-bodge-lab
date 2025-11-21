(function() {
    // Prevent double-loading if used multiple times on a page
    if (window.BodgeRSSLoaded) return;
    window.BodgeRSSLoaded = true;

    const icons = {
        play: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
        pause: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        back7: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/><text x="12" y="18" font-size="8" text-anchor="middle" font-family="sans-serif" font-weight="bold">7</text></svg>`,
        fwd15: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8.002 8.002 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/><text x="12" y="18" font-size="8" text-anchor="middle" font-family="sans-serif" font-weight="bold">15</text></svg>`
        ,
        download: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 20h14v-2H5v2zM11 4h2v8h3l-4 4-4-4h3V4z"/></svg>`
    };

    document.addEventListener('DOMContentLoaded', initPlayers);

    function initPlayers() {
        const players = document.querySelectorAll('.bodge-rss-player');
        players.forEach(setupPlayer);
    }

    async function setupPlayer(container) {
        const url = container.dataset.rssUrl;
        const sort = container.dataset.sortOrder || "desc";
        
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            // NATIVE XML PARSING (No Library!)
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "text/xml");
            
            const channel = xml.querySelector('channel');
            const title = channel.querySelector('title').textContent;
            
            // Try to find artwork (itunes or standard)
            let art = '/content/.config/sitebg.svg'; // Fallback
            const imgNode = channel.querySelector('image > url') || 
                            channel.getElementsByTagNameNS('*', 'image')[0]; 
            if (imgNode) art = imgNode.textContent || imgNode.getAttribute('href');

            // Get Episodes
            const items = Array.from(channel.querySelectorAll('item'));
            
            // Store state
            const state = {
                items: items,
                currentIdx: 0,
                isPlaying: false,
                audio: new Audio(),
                sortAsc: (sort === "asc")
            };

            // Build UI
            renderPlayer(container, title, art, state);

        } catch (e) {
            console.error("RSS Error:", e);
            container.innerHTML = `<p style="color:red; padding:1em; border:1px dashed red;">
                <strong>Signal Lost:</strong> Unable to fetch RSS feed.<br>
                <small>Note: If this is an external feed, you might be hitting CORS protections. 
                Try using a CORS proxy like 'https://corsproxy.io/?' before the URL.</small>
            </p>`;
        }
    }

    function renderPlayer(container, showTitle, showArt, state) {
        container.innerHTML = `
            <div class="rss-header">
                <img src="${showArt}" class="rss-art" alt="Cover Art">
                <div class="rss-meta">
                    <h3>${showTitle}</h3>
                    <div class="rss-now-playing" id="np-${container.id}">Select an episode...</div>
                </div>
            </div>
            
            <div class="rss-controls-area">
                <input type="range" class="rss-seek" value="0" min="0" max="100" disabled>
                
                <div class="rss-buttons">
                    <button class="rss-btn" data-action="back7" title="Back 7s">${icons.back7}</button>
                    <button class="rss-btn rss-play-btn" data-action="play" title="Play/Pause">${icons.play}</button>
                    <button class="rss-btn" data-action="fwd15" title="Forward 15s">${icons.fwd15}</button>
                    <a class="rss-btn rss-download-btn" data-action="download" title="Download" href="#" download>${icons.download}</a>
                </div>
                
                <div class="rss-time-display">
                    <span class="curr-time">00:00</span> / <span class="total-time">00:00</span>
                </div>
            </div>

            <div class="rss-playlist-controls">
                <strong>Episodes</strong>
                <button class="rss-sort-btn" title="Toggle Sort Order">
                    ${state.sortAsc ? 'Oldest First ▲' : 'Newest First ▼'}
                </button>
            </div>

            <div class="rss-playlist"></div>
        `;

        // References
        const playlistEl = container.querySelector('.rss-playlist');
        const playBtn = container.querySelector('.rss-play-btn');
        const seekSlider = container.querySelector('.rss-seek');
        const npText = container.querySelector('.rss-now-playing');
        const sortBtn = container.querySelector('.rss-sort-btn');
        const dlEl = container.querySelector('.rss-download-btn');
        const currTimeEl = container.querySelector('.curr-time');
        const totalTimeEl = container.querySelector('.total-time');

        // --- RENDER LIST ---
        function refreshList() {
            playlistEl.innerHTML = '';
            const displayItems = state.sortAsc ? [...state.items].reverse() : state.items;

            displayItems.forEach((item, index) => {
                // Find original index in the main array (for playback logic)
                const originalIndex = state.items.indexOf(item);
                
                const title = item.querySelector('title').textContent;
                const row = document.createElement('div');
                row.className = `rss-row ${state.currentIdx === originalIndex ? 'active' : ''}`;
                row.textContent = title;
                row.onclick = () => loadEpisode(originalIndex);
                playlistEl.appendChild(row);
            });
        }

        // --- AUDIO LOGIC ---
        function loadEpisode(index) {
            // Update UI Selection
            const rows = playlistEl.querySelectorAll('.rss-row');
            // Reset active classes (rough, better to re-render list but this is cheaper)
            refreshList(); 

            state.currentIdx = index;
            const item = state.items[index];
            const title = item.querySelector('title').textContent;
            const enclosure = item.querySelector('enclosure');
            
            if (!enclosure) return alert("No audio file found for this episode.");
            
            const audioSrc = enclosure.getAttribute('url');
            
            state.audio.src = audioSrc;
            npText.textContent = title;
            state.audio.load();

            // Update download button href and filename (if present)
            const dlEl = container.querySelector('.rss-download-btn');
            if (dlEl) {
                try {
                    const resolved = new URL(audioSrc, window.location.href).href;
                    dlEl.href = resolved;
                    const pathname = new URL(resolved).pathname || '';
                    const fname = pathname.split('/').pop().split('?')[0] || 'episode';
                    dlEl.setAttribute('download', fname);
                } catch (e) {
                    dlEl.href = audioSrc;
                    dlEl.removeAttribute('download');
                }
            }
            
            // Auto play
            togglePlay(true);
        }

        function togglePlay(forcePlay) {
            if (forcePlay === true || state.audio.paused) {
                state.audio.play().then(() => {
                    playBtn.textContent = '⏸';
                    seekSlider.disabled = false;
                }).catch(e => console.error(e));
            } else {
                state.audio.pause();
                playBtn.textContent = '▶';
            }
        }

        // --- EVENT LISTENERS ---

        // 1. Sort Toggle
        sortBtn.onclick = () => {
            state.sortAsc = !state.sortAsc;
            sortBtn.textContent = state.sortAsc ? 'Oldest First ▲' : 'Newest First ▼';
            refreshList();
        };

        // 2. Transport Controls
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                if (action === 'play') togglePlay();
                if (action === 'back7') state.audio.currentTime -= 7;
                if (action === 'fwd15') state.audio.currentTime += 15;
            };
        });

        // 2b. Download handler: try fetch+blob to force download, fallback to opening the file
        if (dlEl) {
            dlEl.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = dlEl.href || dlEl.dataset.src;
                if (!url) return;
                try {
                    const resp = await fetch(url, { mode: 'cors' });
                    if (!resp.ok) throw new Error('Network response was not ok');
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = dlEl.getAttribute('download') || 'episode';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                } catch (err) {
                    // If fetch fails (likely CORS), open in new tab as fallback
                    window.open(url, '_blank', 'noopener');
                }
            });
        }

        // 3. Seek Bar
        seekSlider.oninput = (e) => {
            const pct = e.target.value;
            const time = (pct / 100) * state.audio.duration;
            state.audio.currentTime = time;
        };

        // 4. Audio Events
        state.audio.ontimeupdate = () => {
            if (state.audio.duration) {
                const pct = (state.audio.currentTime / state.audio.duration) * 100;
                seekSlider.value = pct;
                currTimeEl.textContent = formatTime(state.audio.currentTime);
                totalTimeEl.textContent = formatTime(state.audio.duration);
            }
        };
        
        state.audio.onended = () => {
            playBtn.textContent = '▶';
        };

        // Initial List Render
        refreshList();
        // Load first ep (paused)
        loadEpisode(0);
        togglePlay(false); // Stop it from auto playing on page load
        state.audio.currentTime = 0;
    }

    // Helper: Seconds -> MM:SS
    function formatTime(s) {
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

})();