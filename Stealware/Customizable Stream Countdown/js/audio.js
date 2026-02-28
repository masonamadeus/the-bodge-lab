import { CONFIG } from './config.js';
import { PodCube } from './PodCube.js'; // Import the new Engine

let allEpisodes = []; 
let loadedFeeds = new Set();
let currentAudio = new Audio();
let nextAudio = new Audio();
let playlistQueue = []; 
let currentTrackIndex = 0;
let isSoftStopping = false;

/* =========================================
   DATA INGESTION
   ========================================= */
/**
 * Loads all tracks from configured feeds.
 * Uses the PodCube engine for the main feed and a legacy parser for others.
 */
export async function loadEpisodes(allowNSFW) {
    // Start with a clean local array for this load cycle
    let newTracksPool = [];

    // Initialize PodCube Engine
    if (!PodCube.isReady) {
        console.log("[Audio] Initializing PodCube Engine...");
        await PodCube.init();
    }

    // Process Feeds from CONFIG
    for (const feed of CONFIG.FEEDS) {
        // We still use the Set to avoid double-fetching if this is called repeatedly
        if (loadedFeeds.has(feed.url)) continue;

        if (feed.type === 'podcube') {
            // Use the rich data from the engine
            const engineTracks = PodCube.all.map(ep => ({
                title: ep.title,
                url: ep.audioUrl,
                duration: ep.duration,
                date: ep.date.toString(),
                source_feed: feed.url,
                isNSFW: false
            }));
            newTracksPool = newTracksPool.concat(engineTracks);
            loadedFeeds.add(feed.url);
            
        } else if (feed.type === 'json') {
            if (feed.isNSFW && !allowNSFW) continue;
            const jsonTracks = await fetchAndParseJSON(feed);
            newTracksPool = newTracksPool.concat(jsonTracks);
            loadedFeeds.add(feed.url);
        }
    }

    // Blacklist Filtering
    const blacklist = CONFIG.BLACKLIST || [];
    const safeEpisodes = newTracksPool.filter(ep => {
        const isBlacklisted = blacklist.some(badString => 
            ep.title.toLowerCase().includes(badString.toLowerCase()) || 
            (ep.url && ep.url.toLowerCase().includes(badString.toLowerCase()))
        );
        return !isBlacklisted;
    });

    // CRITICAL: Filter out zero durations and duplicates
    // We filter durations here so the Playlist Generator never sees a 0-second track.
    const validEpisodes = safeEpisodes.filter(ep => 
        ep.duration !== null && 
        ep.duration > 0 && 
        ep.url
    );

    // debug: log any tracks that had a zero or null duration to help identify feed issues
    const problematicTracks = safeEpisodes.filter(ep => 
        ep.duration === null || ep.duration <= 0 || !ep.url
    );
    if (problematicTracks.length > 0) {
        console.warn("[Audio] Found tracks with invalid durations or URLs:", problematicTracks);
    }

    // Replace/Update Global Pool
    // Instead of simple concat, we ensure we only add genuinely NEW tracks 
    // that aren't already in the global allEpisodes.
    const existingUrls = new Set(allEpisodes.map(e => e.url));
    const trulyNewTracks = validEpisodes.filter(ep => !existingUrls.has(ep.url));
    
    allEpisodes = allEpisodes.concat(trulyNewTracks);

    console.log(`[Audio] Load complete. Total unique playable tracks: ${allEpisodes.length}`);
    return allEpisodes;
}

/**
 * JSON parser for WIDK Ads
 * (PodCube Engine handles the main XML parsing now, so fetchAndParseFeed is removed)
 */
async function fetchAndParseJSON(feedObj) {
    try {
        const response = await fetch(feedObj.url);
        const items = await response.json(); 
        // Measure duration for JSON items that might lack it
        const measuredItems = await Promise.all(items.map(item => measureDuration(item, feedObj)));
        return measuredItems.filter(ep => ep.url && ep.duration > 0);
    } catch (err) {
        console.warn(`[Audio] Failed to load JSON feed: ${feedObj.url}`, err);
        return [];
    }
}

// Helper to pre-calculate duration for JSON files that don't specify it
function measureDuration(item, feedObj) {
    return new Promise((resolve) => {
        if (item.duration) {
            resolve({ 
                ...item, 
                source_feed: feedObj.url, 
                isNSFW: feedObj.isNSFW,
                date: null // JSON ads usually don't have lore dates
            });
            return;
        }

        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            resolve({
                title: item.title,
                url: item.url,
                duration: Math.round(audio.duration),
                source_feed: feedObj.url,
                isNSFW: feedObj.isNSFW,
                date: null
            });
            audio.removeAttribute('src');
            audio.load();
        });
        audio.addEventListener('error', () => {
            resolve({ title: item.title, url: item.url, duration: 0 }); 
        });
        audio.preload = "metadata";
        audio.src = item.url;
    });
}

/* =========================================
   LOGIC (Strict Lookahead, Fair Weighting & History)
   ========================================= */

const HISTORY_KEY = 'podcube_play_history';
const HISTORY_SIZE = 50;

function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function addToHistoryBatch(urls) {
    if (!urls || urls.length === 0) return;
    let history = getHistory();
    history = history.filter(url => !urls.includes(url));
    history.push(...urls);
    if (history.length > HISTORY_SIZE) {
        history = history.slice(history.length - HISTORY_SIZE);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function weightedPick(items, weightFn) {
    const weights = items.map(weightFn);
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];

    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

/* ---------- Playlist Generator ---------- */

export function generatePlaylist(totalTimeSeconds, allowNSFW) {
    if (allEpisodes.length === 0) return [];

    let pool = [...allEpisodes];
    if (!allowNSFW) {
        pool = pool.filter(ep => ep.isNSFW === false);
    }

    if (pool.length === 0) return [];

    const MAX_AUDIO_DURATION = totalTimeSeconds;
    const MIN_AUDIO_DURATION = Math.max(0, totalTimeSeconds - 90);
    const SHORTEST_TRACK = Math.min(...pool.map(p => p.duration));

    const history = getHistory();
    const recentUrls = new Set(history);

    const queue = [];
    let currentFill = 0;

    while (pool.length > 0) {
        const remainingCapacity = MAX_AUDIO_DURATION - currentFill;
        if (remainingCapacity < SHORTEST_TRACK) break;

        const lockingFinal = remainingCapacity < SHORTEST_TRACK * 2;
        let candidates = pool.filter(ep => ep.duration <= remainingCapacity);

        if (candidates.length === 0) break;

        const safeCandidates = candidates.filter(ep => {
            const newFill = currentFill + ep.duration;
            const remainingAfter = MAX_AUDIO_DURATION - newFill;
            return (newFill >= MIN_AUDIO_DURATION || remainingAfter >= SHORTEST_TRACK);
        });

        if (safeCandidates.length > 0) candidates = safeCandidates;

        const fresh = candidates.filter(ep => !recentUrls.has(ep.url));
        if (fresh.length > 0) candidates = fresh;

        const selectedTrack = weightedPick(candidates, ep => {
            const rarityBoost = recentUrls.has(ep.url) ? 0.5 : 1;
            const urgency = 1 / (1 + (remainingCapacity - ep.duration));
            return rarityBoost * urgency;
        });

        queue.push(selectedTrack);
        currentFill += selectedTrack.duration;
        pool = pool.filter(ep => ep !== selectedTrack);

        if (lockingFinal && currentFill >= MIN_AUDIO_DURATION) break;
    }

    if (currentFill >= MIN_AUDIO_DURATION && currentFill <= MAX_AUDIO_DURATION) {
        addToHistoryBatch(queue.map(q => q.url));
    } else {
        console.warn(`[Audio] Could not fill to required range. Fill: ${currentFill}s`);
    }

    console.table(queue.map((t, i) => ({
        Title: t.title,
        Duration: `${t.duration}s`
    })));

    return queue;
}

export function getQueueDuration(queue) {
    if (queue.length === 0) return 0;
    const audioTime = queue.reduce((total, track) => total + track.duration, 0);
    // (N tracks) have (N-1) gaps
    const gapTime = (queue.length - 1) * CONFIG.TRACK_GAP_SECONDS;
    return audioTime + gapTime;
}

/* =========================================
   PLAYBACK (With Gaps & Soft Stop)
   ========================================= */

export function setVolume(vol) {
    currentAudio.volume = vol;
    nextAudio.volume = vol;
}

export function stopAudio() {
    isSoftStopping = false;
    [currentAudio, nextAudio].forEach(a => {
        a.pause();
        a.currentTime = 0;
        a.removeAttribute('src');
        a.onended = null;
        a.ontimeupdate = null;
        a.playbackRate = 1; 
    });
    playlistQueue = [];
}

export function finishCurrentQueue() {
    console.log("[Audio] Soft Stop triggered.");
    isSoftStopping = true; 
    nextAudio.removeAttribute('src');
}

export function preloadFirstTrack(queue) {
    if (!queue || queue.length === 0) return;
    console.log(`[Audio] Preloading first track: ${queue[0].title}`);
    currentAudio.src = queue[0].url;
    currentAudio.preload = "auto";
    currentAudio.load();
}

export function playQueue(queue) {
    if (!queue || queue.length === 0) return;
    playlistQueue = queue;
    currentTrackIndex = 0;
    isSoftStopping = false;
    
    // Dispatch track change with LORE DATE
    window.dispatchEvent(new CustomEvent('trackChange', { 
        detail: { 
            title: playlistQueue[currentTrackIndex].title,
            date: playlistQueue[currentTrackIndex].date, // Pass date to UI
            sourceFeed: playlistQueue[currentTrackIndex].source_feed
        } 
    }));
    
    const expectedUrl = queue[0].url;
    if (!currentAudio.src || !currentAudio.src.includes(expectedUrl.substring(expectedUrl.length - 20))) {
        currentAudio.src = expectedUrl;
        currentAudio.preload = "auto";
    }
    
    attachTrackListeners(currentAudio, playlistQueue[currentTrackIndex]);
    currentAudio.play().catch(e => console.warn("Autoplay failed:", e));
}

function attachTrackListeners(audioElement, track) {
    audioElement.ontimeupdate = () => {
        if (audioElement === currentAudio && audioElement.duration) {
            const pct = (audioElement.currentTime / audioElement.duration) * 100;
            window.dispatchEvent(new CustomEvent('audioProgress', { detail: { percent: pct } }));
        }

        const remaining = audioElement.duration - audioElement.currentTime;
        if (remaining <= 10 && !isSoftStopping && !nextAudio.hasAttribute('src')) {
            const nextIndex = currentTrackIndex + 1;
            if (nextIndex < playlistQueue.length) {
                console.log(`[Audio] Preloading: ${playlistQueue[nextIndex].title}`);
                nextAudio.preload = "auto";
                nextAudio.src = playlistQueue[nextIndex].url;
            }
        }
    };

    audioElement.onended = () => {
        if (isSoftStopping) return;
        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < playlistQueue.length) {
            swapPlayers();
        } else {
            console.log("[Audio] Queue finished.");
        }
    };
}

function swapPlayers() {
    currentTrackIndex++;
    const track = playlistQueue[currentTrackIndex];
    
    const temp = currentAudio;
    currentAudio = nextAudio;
    nextAudio = temp;

    nextAudio.pause();
    nextAudio.removeAttribute('src'); 
    nextAudio.load();
    nextAudio.ontimeupdate = null;
    nextAudio.onended = null;
    nextAudio.playbackRate = 1;

    console.log(`[Audio] Swapping to: ${track.title}`);
    
    // Pass LORE DATE here too
    window.dispatchEvent(new CustomEvent('trackChange', { detail: {
         title: track.title,
         date: track.date,
         sourceFeed: track.source_feed
    } }));

    attachTrackListeners(currentAudio, track);
    currentAudio.play().catch(e => console.error("[Audio] Gapless swap failed:", e));
}

export function syncPlaybackRate(timerSecondsLeft) {
    if (!currentAudio || currentAudio.paused || isSoftStopping || playlistQueue.length === 0) return;
    if (!currentAudio.duration) return; 

    const currentRemaining = currentAudio.duration - currentAudio.currentTime;
    let futureRemaining = 0;
    for (let i = currentTrackIndex + 1; i < playlistQueue.length; i++) {
        futureRemaining += playlistQueue[i].duration;
    }

    const totalAudioRemaining = currentRemaining + futureRemaining;

    if (timerSecondsLeft <= 3) {
        currentAudio.playbackRate = 1;
        return;
    }

    let idealRate = totalAudioRemaining / timerSecondsLeft;
    idealRate = Math.max(0.85, Math.min(idealRate, 1.15));

    if (Math.abs(currentAudio.playbackRate - idealRate) > 0.01) {
        currentAudio.playbackRate = idealRate;
    }
}

export function unlockAudio() {
    const silentUrl = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIAD+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+AAAAAExhdmM1OS4zNyAAAAAAAAAAAAAAAAQAAAAALgAAAAAA//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    [currentAudio, nextAudio].forEach(a => {
        const originalSrc = a.getAttribute('src');
        a.src = silentUrl;
        const cleanup = () => {
            if (a.src && a.src.includes("data:audio/mpeg;base64")) {
                if (originalSrc) a.src = originalSrc;
                else a.removeAttribute('src');
            }
        };
        a.play().then(() => { a.pause(); cleanup(); }).catch(e => { cleanup(); });
    });
}

// Re-export debug function using the engine if possible
export async function debugExportEpisodes(nsfw = true) {
    if (!PodCube.isReady) await PodCube.init();
    
    // We can just dump PodCube.all nicely now
    const data = PodCube.all.map(ep => ({
        title: ep.title,
        date: ep.date.toString(),
        duration: ep.durationSeconds
    }));
    
    console.table(data);
    return data;
}
