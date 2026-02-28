/**
 * PodCube User Tracking & Achievement Engine
 * Manages IndexedDB "Memory Card", Notifications, and Progression.
 */

class PodUserEngine {
    constructor() {
        this.dbName    = 'PodCube_MemoryCard';
        this.dbVersion = 1;
        this.db        = null;

        this.data = {
            username:      this._generateUsername(),
            visits:        0,
            history:       [],   // episode IDs added on 'ended' event
            games:         {},   // { gameId: highScore }
            punchcards:    0,    // count of printed punchcards
            punchcardExport: 0, // count of exported punchcards
            achievements:  [],   // unlocked achievement IDs
            notifications: []    // { id, title, body, read, timestamp }
        };

        this.achievements = [];
        this._listeners   = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                if (!this.db.objectStoreNames.contains('profile')) {
                    this.db.createObjectStore('profile', { keyPath: 'id' });
                }
            };

            request.onsuccess = async (e) => {
                this.db = e.target.result;
                await this._load();

                if (!sessionStorage.getItem('podcube_session_logged')) {
                    this.data.visits += 1;
                    sessionStorage.setItem('podcube_session_logged', 'true');
                    
                    if (this.data.visits === 1) {
                        this._pushNotification(
                            'System Initialization',
                            `Welcome, ${this.data.username}. Your activity is now being monitored by Brigistics for quality assurance. Please begin reviewing the available transmissions.\nThere are silent activities available on the "Interactive" tab to keep your hands busy while you listen.\nYou have also been granted access to print and share PodCube™ PunchCards.\nClick or tap this Alert to clear it.`
                        );
                    }
                }

                this._checkAchievements(); // Evaluate inline
                await this.save();         // Single master save
                this._emitUpdate();
                resolve();
            };

            request.onerror = (e) => reject(e);
        });
    }

    async _load() {
        return new Promise((resolve) => {
            const tx    = this.db.transaction('profile', 'readonly');
            const store = tx.objectStore('profile');
            const req   = store.get('main_user');

            req.onsuccess = () => {
                if (req.result) {
                    this.data = { ...this.data, ...req.result.data };
                }
                resolve();
            };
            req.onerror = () => resolve();
        });
    }

    async save() {
        return new Promise((resolve) => {
            const tx    = this.db.transaction('profile', 'readwrite');
            const store = tx.objectStore('profile');
            store.put({ id: 'main_user', data: this.data });
            tx.oncomplete = () => {
                this._emitUpdate();
                resolve();
            };
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DATA PURGE
    // ─────────────────────────────────────────────────────────────

    async wipeData() {
        // 1. Reset data to factory defaults
        this.data = {
            username:      this._generateUsername(),
            visits:        0,
            history:       [],
            games:         {},
            punchcards:    0,
            punchcardExport: 0,
            achievements:  [],
            notifications: []
        };
        sessionStorage.removeItem('podcube_session_logged');
        
        // 2. Clear related localStorage for the Interactive game modules
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('pc_hi_') || key.startsWith('pc_data_')) {
                localStorage.removeItem(key);
            }
        });

        // 3. Purge the IndexedDB store
        return new Promise((resolve) => {
            if (!this.db) {
                this._emitUpdate();
                resolve(true);
                return;
            }
            
            const tx = this.db.transaction('profile', 'readwrite');
            const store = tx.objectStore('profile');
            const req = store.clear(); // Wipes all records
            
            req.onsuccess = async () => {
                // Immediately save the fresh default state back into the DB
                await this.save(); 
                this._emitUpdate();
                resolve(true);
            };
            
            req.onerror = () => {
                console.error("[PodUser] Failed to wipe memory card.");
                resolve(false);
            };
        });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION HOOKS (Fixed Race Conditions)
    // ─────────────────────────────────────────────────────────────

    async logListen(episodeId) {
        if (!episodeId) return; // Prevent logging undefined DOM events
        if (!this.data.history.includes(episodeId)) {
            this.data.history.push(episodeId);
            this._checkAchievements(); 
            await this.save(); 
        }
    }

    async logGameScore(gameId, score) {
        const best = this.data.games[gameId] || 0;
        if (score > best) {
            this.data.games[gameId] = score;
            this._checkAchievements();
            await this.save();
        }
    }

    async logPunchcardPrinted() {
        this.data.punchcards += 1;
        this._checkAchievements();
        await this.save();
    }

    async logPunchcardExport() {
        this.data.punchcardExport += 1;
        this._checkAchievements();
        await this.save();
    }

    // ─────────────────────────────────────────────────────────────
    // ACHIEVEMENT ENGINE
    // ─────────────────────────────────────────────────────────────

    registerAchievement(def) {
        this.achievements.push(def);
    }

    _checkAchievements() {
        for (const ach of this.achievements) {
            if (this.data.achievements.includes(ach.id)) continue;

            try {
                if (ach.condition(this.data)) {
                    this.data.achievements.push(ach.id);
                    // ADD THE PAYLOAD HERE:
                    this._pushNotification('ACHIEVEMENT UNLOCKED', ach.title, { type: 'achievement', id: ach.id });
                    this._triggerOSNotification('PodCube Achievement', ach.title);
                }
            } catch (e) {
                console.warn(`[PodUser] Condition check skipped for "${ach.id}":`, e.message);
            }
        }
    }

    playRewardAudio(achievementId, metaOverrides = {}) {
        const ach = this.achievements.find(a => a.id === achievementId);
        if (!ach?.reward || ach.reward.type !== 'audio') return;

        const cfg = { ...ach.reward.meta, ...metaOverrides };

        const episode = new window.PodCube.Episode({
            id:          `internal_reward_${achievementId}`,
            title:       cfg.title       || 'CLASSIFIED TRANSMISSION',
            description: cfg.description || 'Internal Brigistics Recording.',
            episodeType: 'podcube_internal',
            audioUrl:    cfg.url,
            duration:    0,
            metadata: {
                model:     cfg.model     || 'PRIC Security Payload',
                origin:    cfg.origin    || 'PodCube HQ',
                date:      cfg.date      || 'Unknown',
                integrity: cfg.integrity || '100'
            }
        });

        episode._excludeFromExport = true;
        episode._internal          = true;

        window.PodCube.play(episode);

        if (typeof logCommand !== 'undefined') {
            logCommand(`// Executing Classified Payload: ${episode.title}`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────

    addNotification(title, body, payload = null) {
        this._pushNotification(title, body, payload);
        this.save();
    }

    _pushNotification(title, body, payload = null) {
        this.data.notifications.unshift({
            id:        Date.now().toString(36) + Math.random().toString(36).substr(2),
            title,
            body,
            payload,
            timestamp: Date.now()
        });
    }

   markNotificationRead(id) {
        const initialLength = this.data.notifications.length;
        // Filter the specific notification out of the array entirely
        this.data.notifications = this.data.notifications.filter(x => x.id !== id);
        
        if (this.data.notifications.length !== initialLength) {
            this.save();
        }
    }

    markAllNotificationsRead() {
        if (this.data.notifications.length > 0) {
            // Empty the array entirely
            this.data.notifications = [];
            this.save();
        }
    }

    get unreadCount() {
        // Notifications are always unread until dismissed (deleted).
        // The 'read' field is not used — markNotificationRead removes entries entirely.
        return this.data.notifications.length;
    }

    async requestOSNotifications() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        return (await Notification.requestPermission()) === 'granted';
    }

    _triggerOSNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: './PODCUBE.png' });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // DATA PORTABILITY
    // ─────────────────────────────────────────────────────────────

    exportCode() {
        const playlists = [];
        if (window.PodCube && typeof window.PodCube.getPlaylists === 'function') {
            window.PodCube.getPlaylists().forEach(p => {
                const exp = window.PodCube.exportPlaylist(p.name);
                if (exp && exp.code) playlists.push(exp.code);
            });
        }

        const minified = {
            u: this.data.username,
            v: this.data.visits,
            h: this.data.history,
            g: this.data.games,
            p: this.data.punchcards,
            e: this.data.punchcardExport,
            a: this.data.achievements,
            pl: playlists 
        };
        return btoa(JSON.stringify(minified)).replace(/=/g, '');
    }

    async importCode(code) {
        if (!code?.trim()) return false;
        try {
            const clean  = code.trim();
            const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
            const parsed = JSON.parse(atob(padded));

            this.data.username     = parsed.u || this.data.username;
            this.data.visits       = parsed.v || 0;
            this.data.history      = parsed.h || [];
            this.data.games        = parsed.g || {};
            this.data.punchcards   = parsed.p || 0;
            this.data.punchcardExport = parsed.e || 0;
            this.data.achievements = parsed.a || [];

            if (parsed.pl && window.PodCube && typeof window.PodCube.importPlaylist === 'function') {
                let importedAny = false;
                parsed.pl.forEach(plCode => {
                    const res = window.PodCube.importPlaylist(plCode);
                    if (res && res.episodes && res.episodes.length > 0) {
                        let finalName = res.name;
                        let counter = 1;
                        while (window.PodCube.loadPlaylist(finalName)) {
                            finalName = `${res.name} (${counter})`;
                            counter++;
                        }
                        window.PodCube.savePlaylist(finalName, res.episodes);
                        importedAny = true;
                    }
                });
                if (importedAny && typeof window.updatePlaylistsUI === 'function') {
                    window.updatePlaylistsUI();
                }
            }

            this._checkAchievements();
            await this.save();
            
            this.addNotification('System Restore', 'External personnel data successfully grafted into local memory.');
            return true;
        } catch (e) {
            console.error('[PodUser] Invalid backup code:', e);
            return false;
        }
    }

    _generateUsername() {
        const prefixes = [
            "Time-agnostic", "Adiabatic", "Spheroid", "Actualization", "Temporal",
            "Finite", "Linear", "Regenerative", "Ethical", "Kinetic",
            "Resonant", "Theoretical", "Molecular", "Pretentious", "Flashy",
            "Talkative", "Forgetful", "Unintrusive", "Spherical", "Maze-like",
            "Experimental", "Hallowed", "Intelligent", "Predictable", "Haunting",
            "Violent", "Family-friendly", "Chunky", "Rhinestone-studded", "Nasty",
            "Dazzling", "Sensory", "Pedestrian", "Concrete", "Imposing",
            "Foreboding", "Visceral", "Tangible", "Fragile", "Permanent",
            "Bionic", "Luxurious", "Fermented", "Synthetic", "Hypersynthetic",
            "Stimulating", "Useless", "Upcycled", "Repurposed", "Robust",
            "Glossy", "Floral", "Euphoric", "Amber-colored", "Crinkly",
            "Professional", "Condescending", "Thirsty", "Yummy", "Bare-minimum",
            "Savory", "Stormy", "Picky", "Extravagant", "Discrete",
            "Iconic", "Authentic", "Shelf-stable", "Fossilized", "Silly",
            "Complex", "Refreshing", "Transparent", "Open", "Cozy",
            "Warm", "Humble", "Electronic", "Multiplex", "Sparky",
            "Cheesy", "Veiny", "Gritty", "Chalky", "Rare",
            "Vibrant", "Flappy", "4D", "High-Definition", "Literal",
            "Unbeatable", "Reasonably-Timed", "Slow", "Stinky", "Rapid-Drying",
            "Disciplinary", "Flabbergasted", "Non-operational", "Pseudo", "Posh"
        ];
        const names = [
            "PodCube", "Spheroid", "Anomaly", "ISWORM", "Tesseract",
            "Turd", "Timeline", "Drone", "Monopoly", "Beeswax",
            "Alligator", "Turbacco", "Sprot", "Condensation", "Flap",
            "Napkin", "Password", "AI", "CoverArt", "PRIC",
            "Hydroelectrics", "Founder", "Colonel", "Service", "QBit",
            "Bandwidth", "Teleporter", "LaserGun", "Statue", "Trinket",
            "Currency", "Haberdashery", "Hat", "Keycard", "Incense",
            "Tapestry", "Implant", "Spacetime", "Wormhole", "Pinch",
            "Caterpillar", "Nano-bot", "FuelCell", "CornCore", "Rope",
            "Fray", "Reactor", "Sauce", "Tiramisu", "Figurine",
            "Lettuce", "Medicine", "Hospital", "Motel", "Casting",
            "Ladyfinger", "Brittle", "Foodsperson", "Heist", "Tooth",
            "Parkour", "SamuraiSword", "Ninja", "Parachute", "Archaeologist",
            "Stonehenge", "Savannah", "Loincloth", "Cheetah", "Lentil",
            "Sandwich", "Bologna", "LaCroix", "Snowball", "Radiation",
            "Ink", "Pallet", "Sommelier", "Oenology", "SolarSystem",
            "Uvula", "Tartar", "FrenchFry", "OnionRing", "Aperture",
            "Goose", "Peacock", "Tuxedo", "Bargain", "Marimba",
            "Wizard", "Obsidian", "Chestnuts", "FootPasty", "Tube",
            "Jingle", "Beatbox", "KneePad", "Formaldehyde", "Dualoscope"
        ];
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${names[Math.floor(Math.random() * names.length)]}-${Math.floor(Math.random() * 9999)}`;
    }

    onUpdate(cb)    { this._listeners.push(cb); }
    _emitUpdate()   { this._listeners.forEach(cb => cb(this.data)); }
}

window.PodUser = new PodUserEngine();