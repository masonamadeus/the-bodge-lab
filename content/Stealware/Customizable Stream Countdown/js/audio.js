import { CONFIG } from './config.js';

let allEpisodes = []; 
let currentAudio = new Audio();
let nextAudio = new Audio();
let playlistQueue = []; 
let currentTrackIndex = 0;
let isSoftStopping = false;

/* =========================================
   PART 1: DATA INGESTION
   ========================================= */
export async function loadEpisodes() {
    if (allEpisodes.length > 0) return allEpisodes;
    const feedPromises = CONFIG.RSS_FEEDS.map(url => fetchAndParseFeed(url));
    const results = await Promise.allSettled(feedPromises);
    allEpisodes = results.filter(r => r.status === 'fulfilled').map(r => r.value).flat();
    return allEpisodes;
}

export async function getPodcastLogoUrl() {
    if (CONFIG.RSS_FEEDS.length === 0) return null;
    try {
        const url = CONFIG.RSS_FEEDS[0];
        const response = await fetch(url);
        const str = await response.text();
        const data = new window.DOMParser().parseFromString(str, "text/xml");
        
        const itunesImages = data.getElementsByTagName('itunes:image');
        if (itunesImages.length > 0) return itunesImages[0].getAttribute('href');

        const channelImages = data.getElementsByTagName('image');
        if (channelImages.length > 0) {
            const urls = channelImages[0].getElementsByTagName('url');
            if (urls.length > 0) return urls[0].textContent;
        }
        return null;
    } catch (e) {
        console.warn("[Audio] Could not fetch podcast logo:", e);
        return null;
    }
}

async function fetchAndParseFeed(url) {
    try {
        const response = await fetch(url);
        const str = await response.text();
        const data = new window.DOMParser().parseFromString(str, "text/xml");
        const items = data.querySelectorAll("item");
        return Array.from(items).map(item => {
            const enclosure = item.querySelector("enclosure");
            const durationRaw = item.querySelector("itunes\\:duration, duration")?.textContent;
            return {
                title: item.querySelector("title").textContent,
                url: enclosure ? enclosure.getAttribute("url") : null,
                duration: parseDuration(durationRaw),
                source_feed: url 
            };
        }).filter(ep => ep.url && ep.duration > 0); 
    } catch (err) {
        console.warn(`[Audio] Failed to load feed: ${url}`, err);
        return []; 
    }
}

function parseDuration(raw) {
    if (!raw) return 0;
    if (!raw.includes(':')) return parseInt(raw, 10);
    const parts = raw.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseInt(parts[0], 10);
    if (parts[1]) seconds += parseInt(parts[1], 10) * 60;
    if (parts[2]) seconds += parseInt(parts[2], 10) * 3600;
    return seconds;
}

/* =========================================
   PART 2: LOGIC (True Random Fill)
   ========================================= */

export function generatePlaylist(totalTimeSeconds) {
    if (allEpisodes.length === 0) return [];

    // Initial Shuffle: Start with a completely random order
    let pool = [...allEpisodes];
    shuffleArray(pool);

    const queue = [];
    let currentFill = 0;
    const TARGET_DURATION = totalTimeSeconds + CONFIG.BUFFER_SECONDS;
    
    let attempts = 0;
    const MAX_ATTEMPTS = 500;

    while (currentFill < TARGET_DURATION && pool.length > 0 && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        const gapCost = queue.length > 0 ? CONFIG.TRACK_GAP_SECONDS : 0;
        const remainingSpace = TARGET_DURATION - (currentFill + gapCost);

        // Find all tracks that fit the remaining time
        let candidates = pool.filter(ep => ep.duration <= remainingSpace);

        if (candidates.length === 0) break;

        // If we have 3 or fewer episodes that fit, we are in the "danger zone" 
        // where the same short episodes get picked too often.
        if (candidates.length <= 3) {
            // 75% chance to stop early and leave a gap instead of 
            // forcing a repeat of the same short tracks.
            if (Math.random() < 0.75) {
                console.log(`[Audio] Low variety (${candidates.length} left). Stopping to preserve randomness.`);
                break;
            }
        }

        // Pick randomly from the available candidates
        // This treats all fitting tracks (short or long) with equal probability.
        const pickIndex = Math.floor(Math.random() * candidates.length);
        const selectedTrack = candidates[pickIndex];

        queue.push(selectedTrack);
        currentFill += (selectedTrack.duration + gapCost);

        // Remove from pool to prevent duplicates in the same session
        pool = pool.filter(ep => ep !== selectedTrack);
    }

    // This solves the "shortest last" side effect of the filling algorithm.
    shuffleArray(queue);

    console.log(`[Audio] Generated playlist with ${queue.length} tracks. Total: ${currentFill}s`);
    return queue;
}

export function getQueueDuration(queue) {
    if (queue.length === 0) return 0;
    const audioTime = queue.reduce((total, track) => total + track.duration, 0);
    // (N tracks) have (N-1) gaps
    const gapTime = (queue.length - 1) * CONFIG.TRACK_GAP_SECONDS;
    return audioTime + gapTime;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/* =========================================
   PART 3: PLAYBACK (With Gaps & Soft Stop)
   ========================================= */

export function setVolume(vol) {
    currentAudio.volume = vol;
    nextAudio.volume = vol;
}

/**
 * Immediate Hard Stop (User clicked Stop)
 */
export function stopAudio() {
    isSoftStopping = false;
    [currentAudio, nextAudio].forEach(a => {
        a.pause();
        a.currentTime = 0;
        a.src = "";
        a.onended = null;
        a.ontimeupdate = null;
    });
    playlistQueue = [];
}

/**
 * Soft Stop (Timer finished)
 * Clears the queue so no NEW tracks play, but lets current one finish.
 */
export function finishCurrentQueue() {
    console.log("[Audio] Soft Stop triggered. Current track will be the last.");
    isSoftStopping = true; 
    // We stop preloading the next track
    nextAudio.src = "";
}

export function playQueue(queue) {
    if (!queue || queue.length === 0) return;
    playlistQueue = queue;
    currentTrackIndex = 0;
    isSoftStopping = false;
    
    window.dispatchEvent(new CustomEvent('trackChange', { 
        detail: { title: playlistQueue[currentTrackIndex].title } 
    }));
    
    prepareTrack(currentAudio, playlistQueue[currentTrackIndex]);
    currentAudio.play().catch(e => console.warn("Autoplay failed:", e));
}

/**
 * Prepares an audio element with listeners and source
 */
function prepareTrack(audioElement, track) {
    if (!track) return;

    audioElement.src = track.url;
    audioElement.preload = "auto";

    audioElement.ontimeupdate = () => {
        // 1. Dispatch progress for UI (only for the active player)
        if (audioElement === currentAudio && audioElement.duration) {
            const pct = (audioElement.currentTime / audioElement.duration) * 100;
            window.dispatchEvent(new CustomEvent('audioProgress', { detail: { percent: pct } }));
        }

        // 2. JUST-IN-TIME PRELOAD: 
        // If 10s remain, and we aren't stopping, and nextAudio isn't ready
        const remaining = audioElement.duration - audioElement.currentTime;
        if (remaining <= 10 && !isSoftStopping && !nextAudio.src) {
            const nextIndex = currentTrackIndex + 1;
            if (nextIndex < playlistQueue.length) {
                console.log(`[Audio] Preloading: ${playlistQueue[nextIndex].title}`);
                nextAudio.src = playlistQueue[nextIndex].url;
                nextAudio.load();
            }
        }
    };

    audioElement.onended = () => {
        if (isSoftStopping) {
            console.log("[Audio] Soft stop: track ended, stopping playback.");
            return;
        }

        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < playlistQueue.length) {
            swapPlayers();
        } else {
            console.log("[Audio] Queue finished.");
        }
    };
}

/**
 * Swaps the background buffer to the foreground
 */
function swapPlayers() {
    currentTrackIndex++;
    const track = playlistQueue[currentTrackIndex];
    
    // Switch roles
    const temp = currentAudio;
    currentAudio = nextAudio;
    nextAudio = temp;

    // The new nextAudio (which was the old currentAudio) needs its src cleared 
    // so the preloader logic triggers again for the next-next track.
    nextAudio.pause();
    nextAudio.src = "";

    console.log(`[Audio] Swapping to: ${track.title}`);
    window.dispatchEvent(new CustomEvent('trackChange', { detail: { title: track.title } }));

    // Re-attach listeners to the new current player (since we need its ontimeupdate)
    prepareTrack(currentAudio, track);
    
    currentAudio.play().catch(e => console.error("[Audio] Gapless swap failed:", e));
}