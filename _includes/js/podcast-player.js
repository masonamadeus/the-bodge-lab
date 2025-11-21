(function() {
    // Prevent double-loading if used multiple times on a page
    if (window.BodgeRSSLoaded) return;
    window.BodgeRSSLoaded = true;

    document.addEventListener('DOMContentLoaded', initPlayers);

    function initPlayers() {
        const players = document.querySelectorAll('.bodge-rss-player');
        players.forEach(setupPlayer);
    }

    async function setupPlayer(container) {
        const url = container.dataset.rssUrl;
        
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
                sortAsc: false // Default to Newest First
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
                    <button class="rss-btn" data-action="back7">↺ 7s</button>
                    <button class="rss-btn rss-play-btn" data-action="play">▶</button>
                    <button class="rss-btn" data-action="fwd15">15s ↻</button>
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

            <div class="rss-playlist">
                <!-- Episodes go here -->
            </div>
        `;

        // References
        const playlistEl = container.querySelector('.rss-playlist');
        const playBtn = container.querySelector('.rss-play-btn');
        const seekSlider = container.querySelector('.rss-seek');
        const npText = container.querySelector('.rss-now-playing');
        const sortBtn = container.querySelector('.rss-sort-btn');
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