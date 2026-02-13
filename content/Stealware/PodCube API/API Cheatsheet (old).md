---
uid: api-cheatsheet-old-8f844
contentHash: 91a8aff6
date: '2026-02-13T02:27:13.811Z'
---
# PodCube.js API Cheat Sheet

## Overview
PodCube.js is a delicious, nutritious, and slightly mysterious JavaScript engine designed to power applications built on the PodCube™ podcast feed.

It provides a rich set of methods and properties for accessing, querying, and controlling podcast episodes, along with an event system for tracking playback and interactions.

This acts as a bridge between the PodCube™ Research & Innovation Campus's RSS/JSON Feeds and any web-based application, allowing developers to easily build custom players, explorers, or interactive experiences on top of the PodCube™ universe.

---

## Quick Start

```javascript
import { PodCube } from './PodCube.js';

// Initialize and load feed
await PodCube.init();

// Access episodes
const episodes = PodCube.episodes;
const latest = PodCube.latest;
```

---

## Configuration

### CONFIG Object
```javascript
CONFIG = {
    FEED_URL_RSS: "https://pinecast.com/feed/pc",
    FEED_URL_JSON: "https://pinecast.com/jsonfeed/pc",
    FEED_TYPE: "rss",  // "rss" or "json"
    SKIP_FORWARD: 20,  // seconds
    SKIP_BACK: 7,      // seconds
    DEBUG: true        // console logging
}
```

---

## Episode Types

### Constants
```javascript
EPISODE_TYPES.PODCUBE          // 🅿️ Standard transmissions (has lore)
EPISODE_TYPES.PODCUBE_HQ       // 🔸 HQ messages (has lore)
EPISODE_TYPES.TWIBBIE_ONDEMAND // 💠 On-demand broadcasts (no lore)
EPISODE_TYPES.NONE             // No special emoji
```

### Emoji Patterns
- **🅿️** (U+1F17F) - PodCube episodes
- **🔸** (U+1F534) - PodCube HQ episodes  
- **💠** (U+1F338) - Twibbie On-Demand episodes

---

## Core API Methods

### Initialization

#### *init()*
Loads and normalizes the podcast feed.
```javascript
await PodCube.init();
```
**Returns:** Promise that resolves to *this*  
**Sets:** *PodCube.isReady = true* when complete

---

### Configuration Methods

#### *setFeedType(type)*
Switch between RSS and JSON feed.
```javascript
PodCube.setFeedType('rss')   // Switch to RSS
PodCube.setFeedType('json')  // Switch to JSON
```
**Returns:** *true* on success, *false* if invalid type

#### *setDebug(enabled)*
Enable/disable debug logging.
```javascript
PodCube.setDebug(true)   // Enable logging
PodCube.setDebug(false)  // Disable logging
```

---

## Properties & Getters

### Episode Collections
```javascript
PodCube.episodes     // Array of all episodes
PodCube.all          // Alias for episodes
PodCube.latest       // Most recent episode (by publish date)
PodCube.random       // Single random episode
```

### Metadata Collections
```javascript
PodCube.models       // Array of unique model names (sorted)
PodCube.origins      // Array of unique origin locations (sorted)
PodCube.tags         // Array of unique tags (sorted)
```

### Playback State
```javascript
PodCube.nowPlaying   // Currently playing/loaded episode
PodCube.status       // Object with playback details
```

### Status Object
```javascript
{
    playing: false,         // Boolean playback state
    time: 0,               // Current position (seconds)
    duration: 0,           // Total duration (seconds)
    remaining: 0,          // Time remaining (seconds)
    percent: 0,            // Progress percentage (0-100)
    playbackRate: 1,       // Current playback rate
    episode: Episode       // Currently playing episode
}
```

### Other Properties
```javascript
PodCube.logo         // Feed logo URL
PodCube.isReady      // Boolean, true after init() completes
```

---

## Query Methods

### *where(filters)*
Filter episodes by criteria.

```javascript
// Single criterion
PodCube.where({ model: "PC-7700" })
PodCube.where({ origin: "Earth" })
PodCube.where({ tag: "mystery" })
PodCube.where({ episodeType: EPISODE_TYPES.PODCUBE })

// Multiple criteria (AND logic)
PodCube.where({ 
    model: "PC-7700",
    origin: "Earth",
    tag: "mystery"
})

// Tag/tags can be array or string
PodCube.where({ tags: ["mystery", "time"] })  // Has any of these tags

// Episode type can be array
PodCube.where({ episodeType: [EPISODE_TYPES.PODCUBE, EPISODE_TYPES.PODCUBE_HQ] })

// Year range filter
PodCube.where({ year: [-100000, -50000] })  // Episodes between these years
```

**Supported Filters:**
- Any episode property (e.g., *model*, *origin*, *region*, *zone*, *locale*, *planet*)
- *tag* or *tags* - Single tag or array of tags (matches if episode has any)
- *episodeType* - Single type or array of types
- *year* - Array *[min, max]* for year range filtering

**Returns:** Array of matching episodes

---

### *search(query)*
Full-text search across episode content.

```javascript
PodCube.search("time travel")
```

**Searches:**
- Title
- Description  
- Tags (array joined as string)

**Returns:** Array of matching episodes

---

## Discovery & Browsing

### *getByReleaseOrder(reverse = false)*
Episodes sorted by publish date.

```javascript
PodCube.getByReleaseOrder()       // Newest first
PodCube.getByReleaseOrder(true)   // Oldest first
```

**Returns:** Array of all episodes

---

### *getByChronologicalOrder(reverse = false)*
Episodes sorted by in-universe lore date.

```javascript
PodCube.getByChronologicalOrder()       // Oldest lore date first
PodCube.getByChronologicalOrder(true)   // Newest lore date first
```

**Note:** Only includes episodes with lore dates  
**Returns:** Array of episodes with dates

---

### *findRelated(episode, limit = 10)*
Find episodes related by metadata.

```javascript
const related = PodCube.findRelated(currentEpisode)
const related = PodCube.findRelated(currentEpisode, 20)
```

**Matches on:**
- Same model
- Same origin
- Shared tags

**Returns:** Array of related episodes (excludes input episode)

---

### *getLoreHierarchy()*
Get structured metadata counts for browsing UI.

```javascript
const hierarchy = PodCube.getLoreHierarchy()
// {
//   models: [{ name: "PC-7700", count: 15 }, ...],
//   origins: [{ name: "Earth", count: 23 }, ...],
//   tags: [{ name: "mystery", count: 8 }, ...]
// }
```

**Returns:** Object with models, origins, and tags arrays

---

### *getNearestToToday()*
Find episode(s) with lore date closest to today.

```javascript
const nearest = PodCube.getNearestToToday()
```

**Returns:** Array of episodes (may be multiple if tied for closest)

---

### *getYearGroups(threshold = 5)*
Group episodes by year ranges, subdividing when exceeds threshold.

```javascript
const groups = PodCube.getYearGroups()
const groups = PodCube.getYearGroups(10)  // Larger groups
```

**Returns:** Array of year group objects:
```javascript
[
    {
        label: "132975 BCE - 132970 BCE",
        start: -132974,
        end: -132969,
        count: 8,
        episodes: [...]
    },
    ...
]
```

---

### Navigation

#### *getNextEpisode(episode)*
```javascript
const next = PodCube.getNextEpisode(currentEpisode)
```
**Returns:** Next episode in release order or *null*

#### *getPreviousEpisode(episode)*
```javascript
const prev = PodCube.getPreviousEpisode(currentEpisode)
```
**Returns:** Previous episode in release order or *null*

#### *getEpisodeIndex(episode)*
```javascript
const index = PodCube.getEpisodeIndex(episode)
```
**Returns:** Index in episodes array or *-1*

---

## Playback Control

### Basic Controls

#### *play(episode = null)*
```javascript
await PodCube.play()              // Resume current episode
await PodCube.play(episode)       // Queue and play episode
```
**Note:** Calling with an episode queues it and plays immediately

#### *pause()*
```javascript
PodCube.pause()
```

#### *toggle()*
```javascript
PodCube.toggle()  // Play if paused, pause if playing
```

---

### Queue Management

#### *queue(episode, playNow = false)*
Add episode to playback queue.
```javascript
PodCube.queue(episode)         // Add to end of queue
PodCube.queue(episode, true)   // Add next and play immediately
```

#### *next()*
Skip to next episode in queue.
```javascript
PodCube.next()
```

#### *prev()*
Go to previous episode, or restart if > 3 seconds in.
```javascript
PodCube.prev()
```

---

### Seeking

#### *seek(seconds)*
Jump to specific time.
```javascript
PodCube.seek(120)  // Jump to 2:00
```

#### *skipForward()*
Skip forward by *CONFIG.SKIP_FORWARD* seconds.
```javascript
PodCube.skipForward()  // Default: +20s
```

#### *skipBack()*
Skip backward by *CONFIG.SKIP_BACK* seconds.
```javascript
PodCube.skipBack()  // Default: -7s
```

---

### Playback Rate

#### *setPlaybackRate(rate)*
Set playback speed (0.25 to 2.0).
```javascript
PodCube.setPlaybackRate(1.0)   // Normal speed
PodCube.setPlaybackRate(1.5)   // 1.5x speed
PodCube.setPlaybackRate(0.75)  // 0.75x speed
```
**Returns:** *true* on success, *false* if rate outside range

#### *getPlaybackRate()*
Get current playback rate.
```javascript
const rate = PodCube.getPlaybackRate()  // Returns number (default 1)
```

---

## Event System

### Event Listeners

#### *on(event, callback)*
```javascript
const unsubscribe = PodCube.on('play', (episode) => {
    console.log('Playing:', episode.title)
})

// Later: unsubscribe()
```
**Returns:** Unsubscribe function

#### *once(event, callback)*
```javascript
PodCube.once('timeupdate', (status) => {
    console.log('First time update')
})
```

#### *off(event, callback)*
```javascript
PodCube.off('play', myHandler)   // Remove specific handler
PodCube.off('play')              // Remove all handlers for event
```

---

### Available Events

| Event | Payload | Triggered When |
|-------|---------|----------------|
| *play* | *episode* | Playback starts |
| *pause* | *episode* | Playback pauses |
| *track* | *episode* | New episode loads successfully |
| *timeupdate* | *status* object | Playback position updates |
| *ended* | - | Episode finishes (auto-calls *next()*) |
| *error* | *{ episode, mediaError }* | Playback error occurs |

---

### Event Examples

```javascript
// Track playback progress
PodCube.on('timeupdate', (status) => {
    updateProgressBar(status.percent)
})

// Auto-play next episode (built-in, but can override)
PodCube.on('ended', () => {
    // Default behavior already calls next()
})

// Handle errors
PodCube.on('error', ({ episode, mediaError }) => {
    console.error('Playback failed:', mediaError)
    showErrorMessage(episode.title)
})

// Initialize after load
PodCube.on('play', (episode) => {
    console.log('Now playing:', episode.title)
})
```

---

## Episode Object Structure

```javascript
{
    // Basic Info
    id: "ep123",                    // Unique identifier (from feed)
    title: "The Lost Transmission", // Clean title (emoji removed)
    shortcode: "🅿️ PC-001",        // Original title prefix
    description: "Full HTML...",    // Original description (HTML)
    episodeType: "podcube",         // Episode type constant
    
    // Media
    audioUrl: "https://...",        // Audio file URL
    duration: 3600,                 // Duration in seconds
    sizeBytes: 12345678,            // File size in bytes
    
    // Publication
    published: Date,                // JavaScript Date object
    
    // Lore Metadata (if type has lore)
    model: "PC-7700",               // Model name
    origin: "Earth",                // Origin location
    region: "North America",        // Region
    zone: "Eastern",                // Zone
    locale: "New York",             // Locale
    planet: "Earth",                // Planet
    
    // Tags
    tags: ["mystery", "time"],      // Array of tags
    
    // Integrity
    integrityValue: 98.5,           // Numeric integrity
    integrity: "98.5%",             // Formatted integrity string
    
    // Lore Date (PodCubeDate object or null)
    date: PodCubeDate {
        year: -132974,
        month: 5,
        day: 2
    }
}
```

---

## Episode Computed Properties

### *location*
Comma-separated location string.
```javascript
episode.location  // "Earth, New York, North America, Eastern, Earth"
```
Joins: origin, locale, region, zone, planet (filters out nulls)

### *weirdDuration*
Quirky duration format.
```javascript
episode.weirdDuration  // "45.23ish" or "45.23?" or "45.23 approx"
```
Format: *minutes.fractional_seconds* + random suffix

### *timestamp*
Standard MM:SS format.
```javascript
episode.timestamp  // "45:23"
```

### *anniversary*
Human-readable time from lore date to today.
```javascript
episode.anniversary  // "132975 years ago" or "5 months from now" or "today"
```

---

## PodCubeDate Class

### Constructor
```javascript
new PodCubeDate("06/02/132975 BCE")  // US format with era
new PodCubeDate("-134999-01-01")     // ISO format
new PodCubeDate(new Date())          // Standard Date object
new PodCubeDate({ year: 2024, month: 0, day: 15 })
```

### Properties
```javascript
date.year          // -132974 (proleptic Gregorian, 1 BCE = 0)
date.month         // 0-11 (0=January)
date.day           // 1-31
date.displayYear   // "132975 BCE" or "2024" (formatted)
```

### Methods
```javascript
date.toString()    // "June 2, 132975 BCE"
```

### Static Utilities
```javascript
PodCubeDate.isLeapYear(year)
PodCubeDate.daysInMonth(year, month)
PodCubeDate.toAbsoluteDayNumber({ year, month, day })
```

---

## Metadata Extraction

### Metadata Line Format
Episode descriptions can include structured metadata:

```
:: Model: PC-7700
:: Origin: Earth
:: Tags: mystery, time travel, signal
:: Date: 06/02/132975 BCE
:: Region: North America
:: Zone: Eastern
:: Locale: New York
:: Planet: Earth
:: Integrity: 98.5
```

**Parsing Rules:**
- Lines start with *:: *
- Format: *:: Key: Value*
- Key is converted to lowercase with underscores (`Model` → *model*)
- Tags are comma-separated and split into array
- Dates support BCE/BC suffix

---

## Feed Normalization

The engine normalizes both RSS and JSON feeds into a common format.

### RSS Fields Mapped
```javascript
{
    id: node.querySelector("guid")?.textContent
    title: node.querySelector("title")?.textContent
    description: node.querySelector("description")?.textContent
    audioUrl: node.querySelector("enclosure")?.getAttribute("url")
    duration: parseTimeStr(node.querySelector("itunes:duration"))
    pubDate: node.querySelector("pubDate")?.textContent
    sizeBytes: node.querySelector("enclosure")?.getAttribute("length")
}
```

### JSON Fields Mapped
```javascript
{
    id: item.id
    title: item.title
    description: item.content_html
    audioUrl: item.attachments[0].url
    duration: item.attachments[0].duration_in_seconds
    pubDate: item.date_published
    sizeBytes: item.attachments[0].size_in_bytes
}
```

---

## Common Workflows

### Initialize and Play Latest
```javascript
await PodCube.init()
await PodCube.play(PodCube.latest)
```

### Browse by Model
```javascript
const models = PodCube.models
const pc7700Episodes = PodCube.where({ model: "PC-7700" })
```

### Search and Filter
```javascript
const results = PodCube.search("time travel")
const earthOnly = results.filter(ep => ep.origin === "Earth")
```

### Build a Playlist with Queue
```javascript
const playlist = [
    ...PodCube.where({ tag: "mystery" }).slice(0, 3),
    ...PodCube.where({ model: "PC-7700" }).slice(0, 2)
]

// Queue all episodes
playlist.forEach(ep => PodCube.queue(ep))
PodCube.next()  // Start playing
```

### Progress Tracking
```javascript
PodCube.on('timeupdate', (status) => {
    progressBar.style.width = status.percent + '%'
    timeDisplay.textContent = formatTime(status.time)
    remainingDisplay.textContent = formatTime(status.remaining)
})
```

---

## Debugging

### Enable/Disable Logging
```javascript
PodCube.setDebug(true)   // Enable logging
PodCube.setDebug(false)  // Disable logging
```

### Console Access
```javascript
// PodCube is exposed on window in browser
window.PodCube.episodes
window.PodCube.models
window.PodCube.status
```

### Log Levels
```javascript
// Only logs if CONFIG.DEBUG = true
log.info("Message", data)

// Always logs
log.warn("Warning", data)
log.error("Error", data)
```

---

## Browser Compatibility

**Required Features:**
- ES6+ (Classes, arrow functions, async/await, template literals)
- HTML5 Audio API
- Fetch API
- DOMParser (for RSS parsing)

**Supported Browsers:**
- Chrome/Edge 60+
- Firefox 55+
- Safari 11+
- Modern mobile browsers

---

## Quick Reference

### Initialization
```javascript
await PodCube.init()
PodCube.setFeedType('rss' | 'json')
PodCube.setDebug(true | false)
```

### Properties
```javascript
PodCube.episodes, .all, .latest, .random
PodCube.models, .origins, .tags
PodCube.nowPlaying, .status, .logo, .isReady
```

### Querying
```javascript
PodCube.where(filters)
PodCube.search(query)
```

### Browsing
```javascript
PodCube.getByReleaseOrder(reverse?)
PodCube.getByChronologicalOrder(reverse?)
PodCube.findRelated(episode, limit?)
PodCube.getLoreHierarchy()
PodCube.getNearestToToday()
PodCube.getYearGroups(threshold?)
```

### Navigation
```javascript
PodCube.getNextEpisode(episode)
PodCube.getPreviousEpisode(episode)
PodCube.getEpisodeIndex(episode)
```

### Playback
```javascript
PodCube.play(episode?), .pause(), .toggle()
PodCube.queue(episode, playNow?), .next(), .prev()
PodCube.seek(seconds), .skipForward(), .skipBack()
PodCube.setPlaybackRate(rate), .getPlaybackRate()
```

### Events
```javascript
PodCube.on(event, callback)
PodCube.once(event, callback)
PodCube.off(event, callback?)
```
