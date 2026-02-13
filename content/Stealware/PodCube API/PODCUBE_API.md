---
uid: podcubeapi-f04c7
contentHash: cf5c32ca
date: '2026-02-13T02:27:13.813Z'
---
# PodCube Engine - API Cheatsheet

## Initialization

```javascript
import { PodCube } from './PodCube.js';

// Initialize with current feed (RSS by default)
await PodCube.init();

// Check readiness
if (PodCube.isReady) {
    // Ready to use
}
```

---

## Configuration

### Change Feed Format

```javascript
// Switch to JSON feed
PodCube.setFeedType('json');
await PodCube.init(); // Reload with new format

// Switch back to RSS
PodCube.setFeedType('rss');
await PodCube.init();
```

### Toggle Debug Logging

```javascript
// Enable verbose console logs
PodCube.setDebug(true);

// Disable logging
PodCube.setDebug(false);
```

---

## Accessing Episodes

### Basic Accessors

```javascript
// All episodes
const allEpisodes = PodCube.all;

// Most recent episode
const latest = PodCube.latest;

// Random episode
const random = PodCube.random;

// Total episode count
const count = PodCube.episodes.length;
```

### Metadata Collections

```javascript
// All unique models (from lore data)
const models = PodCube.models;  // ['Model A', 'Model B', ...]

// All unique origins (from lore data)
const origins = PodCube.origins;  // ['Location 1', 'Location 2', ...]

// All unique tags
const tags = PodCube.tags;  // ['tag1', 'tag2', ...]

// Logo URL
const logo = PodCube.logo;
```

---

## Querying Episodes

### Filter by Criteria

```javascript
// Get all episodes with specific model
const episodes = PodCube.where({ model: 'Model A' });

// Get all episodes with specific origin
const episodes = PodCube.where({ origin: 'PodCube HQ' });

// Get episodes within year range
const episodes = PodCube.where({ year: [2020, 2025] });

// Get episodes with specific tag
const episodes = PodCube.where({ tag: 'adventure' });

// Multiple tags (any match)
const episodes = PodCube.where({ tags: ['tag1', 'tag2'] });

// Filter by episode type
const podcastTransmissions = PodCube.where({ episodeType: EPISODE_TYPES.PODCUBE });
const twibbieEpisodes = PodCube.where({ episodeType: EPISODE_TYPES.TWIBBIE_ONDEMAND });
const hqMessages = PodCube.where({ episodeType: EPISODE_TYPES.PODCUBE_HQ });

// Combine filters (all must match)
const episodes = PodCube.where({
    origin: 'PodCube HQ',
    year: [2024, 2025],
    tag: 'important'
});
```

### Search

```javascript
// Search across title, description, and tags
const results = PodCube.search('quantum');

// Search is case-insensitive
const results = PodCube.search('QUANTUM');  // Same as above

// Empty query returns empty array
const results = PodCube.search('');  // []
```

### Year Grouping

```javascript
// Group episodes by year (threshold = 5 episodes minimum per group)
const groups = PodCube.getYearGroups();

// Custom threshold
const groups = PodCube.getYearGroups(10);

// Each group has:
// - label: "2020", "2020 - 2022", etc.
// - start: first year in group
// - end: last year in group
// - count: number of episodes
// - getEpisodes(): function to fetch episodes in this group

for (const group of groups) {
    console.log(group.label);  // "2020"
    const episodesInGroup = group.getEpisodes();
}
```

---

## Episode Object Structure

Each episode has these properties:

```javascript
const episode = PodCube.latest;

// Identifiers
episode.id;           // Unique ID from feed
episode.title;        // Display title (emoji removed)
episode.shortcode;    // Optional shortcode (before _ in title)
episode.episodeType;  // 'podcube', 'podcube_hq', 'twibbie_ondemand', 'none'

// Dates
episode.date;         // PodCubeDate object (for lore episodes)
episode.published;    // JavaScript Date object
episode.anniversary;  // "today", "5 years ago", "3 years from now", etc.

// Lore Properties (null if not populated)
episode.model;        // e.g., "Model 17-X"
episode.origin;       // e.g., "PodCube HQ"
episode.region;       // Geographic region
episode.zone;         // Zone designation
episode.planet;       // Planet name
episode.locale;       // Locale designation
episode.location;     // Computed: "origin, locale, region, zone, planet"

// Metadata
episode.tags;         // Array of tags
episode.integrity;    // e.g., "85%", null if not available
episode.integrityValue; // 85 (number), null if not available
episode.description;  // Raw HTML description

// Audio
episode.audioUrl;     // URL to MP3 file
episode.durationSeconds; // Integer, null if missing
episode.sizeBytes;    // Integer, null if missing

// Computed Properties
episode.timestamp;    // "5:32" (MM:SS format), null if no duration
episode.weirdDuration; // "5.53ish", "5.53?", "5.53 approx", etc.
```

---

## Audio Playback

### Queue Management

```javascript
// Play a specific episode immediately
PodCube.play(episode);

// Queue episode for later (without playing)
PodCube.queue(episode);

// Queue and play immediately
PodCube.queue(episode, true);

// Play next in queue
PodCube.next();

// Play previous (or restart if > 3 seconds elapsed)
PodCube.prev();

// Pause current playback
PodCube.pause();

// Toggle play/pause
PodCube.toggle();

// Jump to position (in seconds)
PodCube.seek(120);  // Jump to 2 minutes
```

### Playback Speed Control

```javascript
// Get current playback rate
const rate = PodCube.getPlaybackRate();  // 0.25 - 2.0

// Set playback rate (0.25x to 2x range)
const success = PodCube.setPlaybackRate(1.5);  // 1.5x speed
if (success) {
    console.log('Playback rate changed');
} else {
    console.log('Rate out of range');
}

// Skip forward/backward
PodCube.skipForward();  // Jump forward CONFIG.SKIP_FORWARD seconds (default: 20s)
PodCube.skipBack();     // Jump back CONFIG.SKIP_BACK seconds (default: 7s)
```

### Playback Status

```javascript
// Get currently playing episode
const current = PodCube.nowPlaying;

// Get full playback status
const status = PodCube.status;
// {
//   playing: true,
//   time: 45.2,           // Current time in seconds
//   duration: 300,        // Total duration in seconds
//   remaining: 254.8,     // Seconds left
//   percent: 15.06,       // 0-100
//   playbackRate: 1.0,    // Current playback speed
//   episode: Episode      // Currently playing episode
// }

// Audio element (advanced)
const audio = PodCube._audio;  // Raw Web Audio API Audio element
```

---

## Episode Discovery & Browsing

All browsing methods are **stateless** and return filtered arrays without modifying engine state.

### Finding Related Episodes

```javascript
// Get episodes related to current episode
const episode = PodCube.latest;
const related = PodCube.findRelated(episode);  // Same model, origin, or tags

// Limit results
const topRelated = PodCube.findRelated(episode, 5);  // Top 5 related

// Works with any episode
const related = PodCube.findRelated(someEpisode, 20);
```

### Browse by Order

```javascript
// By release order (newest first, default)
const byRelease = PodCube.getByReleaseOrder();
const byReleaseOldest = PodCube.getByReleaseOrder(true);  // Oldest first

// By chronological order (lore date, oldest first)
// Filters out episodes without lore dates
const byChronology = PodCube.getByChronologicalOrder();
const byChronologyNewest = PodCube.getByChronologicalOrder(true);  // Newest first
```

### Navigate Episode Sequence

```javascript
// Get episode position in release order
const index = PodCube.getEpisodeIndex(episode);  // 0-based

// Get next/previous episode
const next = PodCube.getNextEpisode(PodCube.latest);
const prev = PodCube.getPreviousEpisode(PodCube.latest);

// Returns null if at boundary
if (next === null) {
    console.log('No next episode');
}
```

### Browse Lore Hierarchy

```javascript
// Get all models, origins, and tags with counts
const hierarchy = PodCube.getLoreHierarchy();

// hierarchy.models = [
//   { name: "Model A", count: 12 },
//   { name: "Model B", count: 8 },
// ]

// Useful for building menus
hierarchy.models.forEach(model => {
    console.log(`${model.name} (${model.count} episodes)`);
});

hierarchy.origins.forEach(origin => {
    console.log(`${origin.name} (${origin.count} episodes)`);
});

hierarchy.tags.forEach(tag => {
    console.log(`${tag.name} (${tag.count} episodes)`);
});
```

### Build Discovery UI

```javascript
// Populate browse categories
const hierarchy = PodCube.getLoreHierarchy();

// Display all origins as category buttons
hierarchy.origins.forEach(origin => {
    const btn = document.createElement('button');
    btn.textContent = `${origin.name} (${origin.count})`;
    btn.onclick = () => {
        const episodes = PodCube.where({ origin: origin.name });
        displayEpisodes(episodes);
    };
    categoriesContainer.appendChild(btn);
});

// Click episode to show related content
episode.addEventListener('click', () => {
    const related = PodCube.findRelated(clickedEpisode, 10);
    displayRelated(related);
});
```

### Timeline Navigation

```javascript
// Show episodes in chronological order
const timeline = PodCube.getByChronologicalOrder();

timeline.forEach(episode => {
    console.log(`[${episode.date.displayYear}] ${episode.title}`);
});

// Or by release order with navigation
const episodes = PodCube.getByReleaseOrder(true);  // Oldest first
let current = episodes[0];

while (current) {
    console.log(current.title);
    current = PodCube.getNextEpisode(current);
}
```

---

## Events

### Listening to Events

```javascript
// Track changed
PodCube.on('track', (episode) => {
    console.log('Now playing:', episode.title);
});

// Playback started
PodCube.on('play', (episode) => {
    console.log('Playing:', episode.title);
});

// Playback paused
PodCube.on('pause', (episode) => {
    console.log('Paused:', episode.title);
});

// Time update (fires frequently)
PodCube.on('timeupdate', (status) => {
    console.log(`Progress: ${status.time}s / ${status.duration}s (${status.remaining}s left)`);
});
```

---

## Episode Types

```javascript
// Episode type constants
EPISODE_TYPES.PODCUBE           // 🅿️ Standard transmissions (has lore)
EPISODE_TYPES.PODCUBE_HQ        // 🔸 PodCube HQ direct messages (has lore)
EPISODE_TYPES.TWIBBIE_ONDEMAND  // 💠 Twibbie™ On-Demand broadcasts
EPISODE_TYPES.NONE              // No special emoji

// Filter by type
const onlyPodcube = PodCube.where({ 
    episodeType: EPISODE_TYPES.PODCUBE 
});

const onlyTwibbie = PodCube.where({ 
    episodeType: EPISODE_TYPES.TWIBBIE_ONDEMAND 
});

// Multiple types
const withLore = PodCube.where({ 
    episodeType: [EPISODE_TYPES.PODCUBE, EPISODE_TYPES.PODCUBE_HQ] 
});
```

---

## PodCubeDate Object

For episodes with lore data, dates are `PodCubeDate` objects:

```javascript
const date = episode.date;

// Properties
date.year;           // Integer (can be negative for BCE)
date.month;          // 0-11 (January = 0)
date.day;            // 1-31
date.displayYear;    // "2024", "1 BCE", "5 BCE", etc.

// Methods
date.toString();     // "February 12, 2024"
```

---

## Common Patterns

### Display Episode List

```javascript
const episodes = PodCube.where({ origin: 'PodCube HQ' });

episodes.forEach(ep => {
    console.log(`${ep.title} - ${ep.date?.toString() || ep.published.toLocaleDateString()}`);
});
```

### Build UI with Metadata

```javascript
const models = PodCube.models;
const origins = PodCube.origins;

// Create filter dropdown
const modelSelect = document.createElement('select');
models.forEach(model => {
    const option = document.createElement('option');
    option.textContent = model;
    option.value = model;
    modelSelect.appendChild(option);
});

// Filter on selection
modelSelect.addEventListener('change', (e) => {
    const filtered = PodCube.where({ model: e.target.value });
    // Update UI with filtered episodes
});
```

### Play Random Episode

```javascript
const random = PodCube.random;
if (random) {
    PodCube.play(random);
}
```

### Search and Play

```javascript
const results = PodCube.search('quantum');
if (results.length > 0) {
    PodCube.play(results[0]);
}
```

### Timeline View

```javascript
const groups = PodCube.getYearGroups();

groups.forEach(group => {
    console.log(`${group.label} (${group.count} episodes)`);
    const episodes = group.getEpisodes();
    episodes.forEach(ep => {
        console.log(`  - ${ep.title}`);
    });
});
```

### Display Progress Bar

```javascript
PodCube.on('timeupdate', (status) => {
    const percent = status.percent;
    const bar = '█'.repeat(Math.floor(percent / 5)) + 
                '░'.repeat(20 - Math.floor(percent / 5));
    console.log(`[${bar}] ${percent.toFixed(1)}%`);
});
```

---

## Error Handling

All methods have error handling built-in. Errors are logged to console:

```javascript
// These won't throw - errors logged instead
PodCube.play(null);           // Logs warning
PodCube.queue(invalidEp);     // Logs warning
PodCube.seek(-100);           // Seeks to 0 safely

// Safe to use in production
try {
    await PodCube.init();
} catch (e) {
    console.error('Failed to load feed:', e);
}
```

---

## Configuration Options

Edit `CONFIG` object in PodCube.js:

```javascript
const CONFIG = {
    FEED_URL_RSS: "https://pinecast.com/feed/pc",
    FEED_URL_JSON: "https://pinecast.com/jsonfeed/pc",
    FEED_TYPE: "rss",      // Which feed to use on init
    SKIP_FORWARD: 20,       // Seconds to skip forward
    SKIP_BACK: 7,           // Seconds to skip back
    DEBUG: true             // Console logging
};
```

---

## Tips & Tricks

- **Case-insensitive search:** `PodCube.search('query')` normalizes to lowercase
- **Safe null returns:** All lore properties return `null` (not empty string or 0)
- **Twibbie episodes:** Included in all results by default, no special filtering needed
- **No loading bars:** Use `timeupdate` event with `status.percent` for UI feedback
- **Memory efficient:** Episodes are loaded once on `init()`, no polling
- **Event isolation:** Event handler errors don't break other handlers or playback

---

## Quick Reference Table

| Method | Returns | Notes |
|--------|---------|-------|
| `await init()` | Promise | Must call before using |
| `where(filters)` | Array\<Episode> | Returns new array |
| `search(query)` | Array\<Episode> | Case-insensitive |
| `getYearGroups(threshold)` | Array\<Group> | Default threshold: 5 |
| `play(episode)` | void | Queues & plays immediately |
| `queue(episode, playNow?)` | void | Default: add to queue |
| `pause()` | void | Safe if already paused |
| `seek(seconds)` | void | Clamps to valid range |
| `skipForward()` | void | Jump forward CONFIG.SKIP_FORWARD |
| `skipBack()` | void | Jump back CONFIG.SKIP_BACK |
| `setPlaybackRate(rate)` | boolean | 0.25-2.0 range, returns success |
| `getPlaybackRate()` | number | Current rate (0.25-2.0) |
| `findRelated(episode, limit?)` | Array\<Episode> | Same model/origin/tags |
| `getByReleaseOrder(reverse?)` | Array\<Episode> | Newest first (default) |
| `getByChronologicalOrder(reverse?)` | Array\<Episode> | By lore date, oldest first |
| `getLoreHierarchy()` | Object | Models, origins, tags with counts |
| `getEpisodeIndex(episode)` | number | 0-based position |
| `getNextEpisode(episode)` | Episode\|null | Next in release order |
| `getPreviousEpisode(episode)` | Episode\|null | Previous in release order |
| `on(event, callback)` | void | Event names: track, play, pause, timeupdate |
| `setFeedType(type)` | boolean | "rss" or "json" |
| `setDebug(enabled)` | void | true or false |

---

**Last Updated:** February 12, 2026  
**Version:** 2.0 (Refactored Middleware)
