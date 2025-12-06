(function() {
    if (window.BodgeRSSLoaded) return;
    window.BodgeRSSLoaded = true;

    // 1. Define the Shapes (Paths only)
    const paths = {
        play: "M8 5v14l11-7z",
        pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
        back: "M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z",
        fwd: "M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z",
        download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
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
        download: mkIcon(paths.download)
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.bodge-rss-player').forEach(setupPlayer);
    });

    async function setupPlayer(container) {
        let items = [];
        let showTitle = "";
        let showArt = null; 
        const isSingle = container.classList.contains('single-track');
        const initialSort = container.dataset.sortOrder || "desc";

        if (container.dataset.playlist) {
            try {
                items = JSON.parse(container.dataset.playlist);
                // If title is missing, try to use the one passed in, or a generic one
                showTitle = container.dataset.title || "Audio Collection";
                
                // Optional: Check if there's a cover.jpg in the playlist folder?
                // For now, we leave showArt null so it hides gracefully.
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
            sort: container.querySelector('.rss-sort-btn')
        };

        function renderList() {
            if (isSingle) return;
            els.list.innerHTML = '';
            
            state.items = state.sortAsc ? [...state.originalItems].reverse() : [...state.originalItems];
            els.sort.textContent = state.sortAsc ? "▲ Oldest" : "▼ Newest";

            state.items.forEach((item, i) => {
                const div = document.createElement('div');
                div.className = 'rss-row';
                div.textContent = item.title;
                div.onclick = () => loadTrack(item); 
                if (audio.src === item.src || (audio.src && audio.src.endsWith(item.src))) {
                    div.classList.add('active');
                }
                els.list.appendChild(div);
            });
        }

        function loadTrack(item) {
            const rows = els.list.querySelectorAll('.rss-row');
            state.items.forEach((it, i) => {
                if (it === item) rows[i]?.classList.add('active');
                else rows[i]?.classList.remove('active');
            });

            audio.src = item.src;
            if (!isSingle) els.np.textContent = "BUFFERING...";
            els.dlBtn.href = item.src;

            audio.load();
            audio.play()
                .then(() => updatePlayBtn(true))
                .catch(e => console.log("Auto-play prevented", e));
        }

        function updatePlayBtn(isPlaying) {
            state.playing = isPlaying;
            // SWAP THE HTML TO USE THE MASKED ICON
            els.playBtn.innerHTML = isPlaying ? icons.pause : icons.play;
            els.seek.disabled = false;
        }

        container.onclick = (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;

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
             if(!isSingle) els.np.textContent = state.items.find(i => i.src === audio.getAttribute('src'))?.title || "Playing";
        };
        
        audio.ontimeupdate = () => {
            if (!audio.duration) return;
            const pct = (audio.currentTime / audio.duration) * 100;
            els.fill.style.width = pct + '%';
            els.seek.value = pct;
            els.curr.textContent = fmt(audio.currentTime);
        };
        
        audio.onended = () => updatePlayBtn(false);

        els.seek.oninput = (e) => {
            const time = (e.target.value / 100) * audio.duration;
            audio.currentTime = time;
        };

        els.sort.onclick = () => {
            state.sortAsc = !state.sortAsc;
            renderList();
        };

        renderList();
        
        if (isSingle) {
            loadTrack(state.items[0]); 
            audio.pause(); 
            audio.currentTime = 0;
            els.np.textContent = "READY";
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