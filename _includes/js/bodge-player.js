(function() {
    if (window.BodgeRSSLoaded) return;
    window.BodgeRSSLoaded = true;

    // 1. Define the Shapes (Paths only)
    const paths = {
        play: "M8 5v14l11-7z",
        pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
        back: "M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z",
        fwd: "M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z",
        download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
        popout: "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"
    };

    // 2. Helper to generate the "Masked Icon" HTML
    function mkIcon(path) {
        // Create a minimal SVG Data URI
        const svg = `data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${path}'/%3E%3C/svg%3E`;
        // Return the span that CSS turns into an icon
        return `<span class="rss-icon" style="-webkit-mask-image: url(&quot;${svg}&quot;); mask-image: url(&quot;${svg}&quot;);"></span>`;
    }

    // 3. Build the Icons Object (Icon + Text combo)
    const icons = {
        play: mkIcon(paths.play),
        pause: mkIcon(paths.pause),
        // Layout: [Icon] [7]
        back: `${mkIcon(paths.back)}<span class="rss-btn-txt">7</span>`, 
        // Layout: [30] [Icon]
        fwd: `<span class="rss-btn-txt">30</span>${mkIcon(paths.fwd)}`, 
        download: mkIcon(paths.download),
        popout: mkIcon(paths.popout)
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.bodge-rss-player').forEach(setupPlayer);
    });

    async function setupPlayer(container) {

        // --- 1. POPOUT INITIALIZATION ---
        const urlParams = new URLSearchParams(window.location.search);
        const isPopout = urlParams.get('popout') === 'true';

        if (isPopout) {
            // Hijack the page: Remove everything except the player container
            document.documentElement.style.height = "100%";
            document.body.style.margin = "0";
            document.body.style.padding = "0";
            document.body.style.background = "#111"; 
            document.body.style.display = "flex";
            document.body.style.alignItems = "center";
            document.body.style.justifyContent = "center";
            document.body.style.height = "100%";
            document.body.style.overflow = "hidden";
            document.body.style.maxWidth = "none";
            
            container.style.width = "100%";
            container.style.height = "100%";
            container.style.maxHeight = "none";
            container.style.border = "none";
            container.style.transform = "none";
            
            document.body.innerHTML = ''; 
            document.body.appendChild(container);
        }

        // --- 2. DATA PARSING ---
        let items = [];
        let showTitle = "";
        let showArt = null; 
        const isSingle = container.classList.contains('single-track');
        const initialSort = container.dataset.sortOrder || "desc";

        if (container.dataset.playlist) {
            try {
                items = JSON.parse(container.dataset.playlist);
                showTitle = container.dataset.title || "Audio Collection";
            } catch (e) {
                console.error("Playlist Parse Error", e);
            }
        }
        
        if (container.dataset.rssUrl) {
            try {
                const res = await fetch(container.dataset.rssUrl);
                const str = await res.text();
                const xml = new DOMParser().parseFromString(str, "text/xml");
                
                const channel = xml.querySelector('channel');
                showTitle = channel.querySelector('title').textContent;
                
                const imgNode = channel.querySelector('image > url') || channel.getElementsByTagName('image')[0];
                if (imgNode) showArt = imgNode.textContent || imgNode.getAttribute('href');

                items = Array.from(channel.querySelectorAll('item')).map(item => ({
                    title: item.querySelector('title').textContent,
                    src: item.querySelector('enclosure')?.getAttribute('url')
                })).filter(i => i.src);

            } catch (e) {
                container.innerHTML = `<div style="padding:1em; border:2px solid red; font-family:monospace; color:red;">ERR: FEED_LOAD_FAIL</div>`;
                return;
            }
        } else if (container.dataset.src) {
            showTitle = container.dataset.title || "Audio File";
            items = [{ title: showTitle, src: container.dataset.src }];
        }

        if (items.length === 0) return;

        // --- 3. RENDER UI ---
        const artStyle = showArt ? '' : 'display:none;';
        
        container.innerHTML = `
            <div class="rss-header">
                <img src="${showArt || ''}" class="rss-art" alt="Art" style="${artStyle}" onerror="this.style.display='none'">
                <div class="rss-meta">
                    <h3>${showTitle}</h3>
                    <div class="rss-now-playing">STOPPED</div>
                </div>
            </div>

            <div class="rss-controls-area">
                <div class="rss-seek-container">
                    <div class="rss-seek-fill"></div>
                    <input type="range" class="rss-seek-input" value="0" min="0" max="100" step="0.1" disabled>
                </div>

                <div class="rss-toolbar">
                    <div class="rss-time-display">
                        <span class="curr">00:00:00</span><br><span class="total">00:00:00</span>
                    </div>

                    <div class="rss-transport">
                        <button class="rss-btn" data-act="back" title="-7s">${icons.back}</button>
                        <button class="rss-btn rss-play-btn" data-act="play" title="Play">${icons.play}</button>
                        <button class="rss-btn" data-act="fwd" title="+30s">${icons.fwd}</button>
                    </div>

                    <div class="rss-extras">
                        <button class="rss-btn" data-act="popout" title="Popout Player">${icons.popout}</button>
                        <button class="rss-btn rss-speed-btn" data-act="speed" title="Speed">1.0x</button>
                        <a class="rss-btn" data-act="download" href="#" title="Save" download>${icons.download}</a>
                    </div>
                </div>
            </div>

            <div class="rss-playlist-controls">
                <span>Index // ${items.length} FILES</span>
                <button class="rss-sort-btn">▼ Newest</button>
            </div>
            <div class="rss-playlist"></div>`;

        const audio = new Audio();
        
        const state = { 
            idx: 0, 
            playing: false, 
            items: items, 
            originalItems: [...items], 
            sortAsc: (initialSort === 'asc') 
        };

        const els = {
            np: container.querySelector('.rss-now-playing'),
            fill: container.querySelector('.rss-seek-fill'),
            seek: container.querySelector('.rss-seek-input'),
            playBtn: container.querySelector('[data-act="play"]'),
            speedBtn: container.querySelector('[data-act="speed"]'),
            dlBtn: container.querySelector('[data-act="download"]'),
            curr: container.querySelector('.curr'),
            total: container.querySelector('.total'),
            list: container.querySelector('.rss-playlist'),
            sort: container.querySelector('.rss-sort-btn'),
            popoutBtn: container.querySelector('[data-act="popout"]')
        };

        // --- 4. CORE LOGIC ---

        function renderList() {
            if (isSingle) return;
            els.list.innerHTML = '';

            if (isPopout) {
                els.list.style.maxHeight = '100%';
                els.popoutBtn.style.display = 'none';
            }
            
            state.items = state.sortAsc ? [...state.originalItems].reverse() : [...state.originalItems];
            els.sort.textContent = state.sortAsc ? "▲ Oldest" : "▼ Newest";

            state.items.forEach((item, i) => {
                const div = document.createElement('div');
                div.className = 'rss-row';
                div.textContent = item.title;
                div.onclick = () => loadTrack(item); 
                // Fix: Check matches more robustly for active class
                if (audio.src === item.src || (audio.src && item.src && audio.src.endsWith(item.src))) {
                    div.classList.add('active');
                }
                els.list.appendChild(div);
            });
        }

        function loadTrack(item, autoplay = true) {
            const rows = els.list.querySelectorAll('.rss-row');
            state.items.forEach((it, i) => {
                if (it === item) rows[i]?.classList.add('active');
                else rows[i]?.classList.remove('active');
            });

            audio.src = item.src;
            if (!isSingle) els.np.textContent = "BUFFERING...";
            els.dlBtn.href = item.src;

            audio.load();
            
            if (autoplay) {
                audio.play()
                    .then(() => updatePlayBtn(true))
                    .catch(e => console.log("Auto-play prevented", e));
            } else {
                updatePlayBtn(false);
            }
        }

        function updatePlayBtn(isPlaying) {
            state.playing = isPlaying;
            els.playBtn.innerHTML = isPlaying ? icons.pause : icons.play;
            els.seek.disabled = false;
        }

        // --- 5. EVENT HANDLERS ---

        container.onclick = (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;

            if (act === 'popout') {
                // Check both raw and decoded URLs to handle special characters (spaces, etc.)
                const currentIdx = state.items.findIndex(i => {
                    const src = audio.src || '';
                    const decoded = decodeURIComponent(src);
                    return src.includes(i.src) || decoded.includes(i.src);
                });

                // Save State (Include the index!)
                const settings = {
                    items: state.items, 
                    currentSrc: audio.src,
                    currentIdx: currentIdx, 
                    currentTime: audio.currentTime,
                    isPlaying: !audio.paused
                };
                sessionStorage.setItem('bodge_popout_data', JSON.stringify(settings));

                const url = new URL(window.location.href);
                url.searchParams.set('popout', 'true');
                window.open(url.toString(), 'BodgePopout', 'width=500,height=600,menubar=no,toolbar=no,location=no,status=no');
                
                audio.pause();
                return;
            }

            if (act === 'play') {
                if (audio.paused) {
                    if (!audio.src) loadTrack(state.items[0]);
                    else audio.play();
                } else {
                    audio.pause();
                }
            }
            if (act === 'back') audio.currentTime -= 7;
            if (act === 'fwd') audio.currentTime += 30;
            
            if (act === 'speed') {
                const rates = [1.0, 1.25, 1.5, 2.0];
                let cur = rates.indexOf(audio.playbackRate);
                let next = rates[(cur + 1) % rates.length];
                audio.playbackRate = next;
                els.speedBtn.textContent = next + "x";
            }
        };

        audio.onplay = () => updatePlayBtn(true);
        audio.onpause = () => updatePlayBtn(false);
        audio.onloadedmetadata = () => {
             els.total.textContent = fmt(audio.duration);
             // Robust title check
             if(!isSingle) {
                 const match = state.items.find(i => audio.src.includes(i.src));
                 els.np.textContent = match ? match.title : "Playing";
             }
        };
        
        audio.ontimeupdate = () => {
            if (!audio.duration) return;
            const pct = (audio.currentTime / audio.duration) * 100;
            els.fill.style.width = pct + '%';
            els.seek.value = pct;
            els.curr.textContent = fmt(audio.currentTime);
        };
        
        audio.onended = () => {
            const currentSrc = audio.getAttribute('src');
            // FIX: Robust finding of current track index
            const idx = state.items.findIndex(i => currentSrc.includes(i.src));
            
            if (idx > -1 && idx < state.items.length - 1) {
                loadTrack(state.items[idx + 1]);
            } else {
                updatePlayBtn(false);
            }
        };

        els.seek.oninput = (e) => {
            const time = (e.target.value / 100) * audio.duration;
            audio.currentTime = time;
        };

        els.sort.onclick = () => {
            state.sortAsc = !state.sortAsc;
            renderList();
        };

        // --- 6. INITIALIZATION & RESTORE ---

        renderList();

        if (isPopout) {
            try {
                const savedJson = sessionStorage.getItem('bodge_popout_data');
                // CLEANUP: Remove data immediately to prevent loops
                sessionStorage.removeItem('bodge_popout_data');

                const saved = JSON.parse(savedJson);
                if (saved) {
                    state.items = saved.items;
                    renderList();

                    // 1. Try finding track by Index (Most Reliable)
                    let track = null;
                    if (typeof saved.currentIdx === 'number' && saved.currentIdx > -1) {
                        track = state.items[saved.currentIdx];
                    }

                    // 2. Fallback: Try Smart URL Matching (Decodes %20 to spaces)
                    if (!track) {
                        track = state.items.find(i => {
                            const raw = saved.currentSrc || '';
                            const dec = decodeURIComponent(raw);
                            return raw.includes(i.src) || dec.includes(i.src) || raw.endsWith(i.src);
                        });
                    }

                    if (track) {
                        // Load without autoplaying so we can seek safely
                        loadTrack(track, false);

                        const resumeTime = saved.currentTime;

                        // Seek Logic: Handle race conditions where metadata might not be ready
                        if (audio.readyState >= 1) {
                            audio.currentTime = resumeTime;
                        } else {
                            audio.addEventListener('loadedmetadata', function onMeta() {
                                audio.currentTime = resumeTime;
                                audio.removeEventListener('loadedmetadata', onMeta);
                            }, { once: true });
                        }

                        // Resume only if it was playing in the parent
                        if (saved.isPlaying) {
                            setTimeout(() => audio.play().catch(e => console.warn(e)), 150);
                        }
                    }
                }
            } catch (e) { console.error("Popout Restore Failed", e); }
        } else {
            // FIX: Only run standard single-track init if NOT popping out
            if (isSingle) {
                loadTrack(state.items[0], false); // Don't autoplay on page load
                audio.currentTime = 0;
                els.np.textContent = "READY";
            }
        }
    }

    function fmt(s) {
        if (!s || isNaN(s)) return "00:00";
        const m = Math.floor((s / 60)%60);
        const h = Math.floor(m / 60);
        const sec = Math.floor(s % 60);
        return `${h<10? '0':''}${h}:${m<10? '0':''}${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
})();