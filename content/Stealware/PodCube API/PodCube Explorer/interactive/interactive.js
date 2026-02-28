// =============================================================================
// Interactive Engine v3.5
// =============================================================================
//
// A lightweight, class-based game engine designed for "cartridge" style games.
// It handles the game loop, input normalization (mouse/touch/keyboard),
// HTML5 Canvas rendering, and a DOM-based UI overlay system.
//
// DESIGN GOALS:
// - Deterministic, fixed-resolution logic (400x300)
// - Minimal abstractions, readable control flow
// - Cartridge isolation (fresh state per run)
// - Declarative DOM UI layered over a canvas renderer
//
// =============================================================================
'use strict';

/**
 * =============================================================================
 * TYPE DEFINITIONS
 * =============================================================================
 */

/**
 * @typedef {Object} MouseState
 * @property {number} x - Mouse X in logical canvas space
 * @property {number} y - Mouse Y in logical canvas space
 * @property {boolean} down - True while pointer is held
 * @property {boolean} clicked - True for one frame on release
 */

/**
 * @typedef {Object} InputState
 * @property {Object<string, boolean>} pressed - True only on the frame an input begins
 * @property {Object<string, boolean>} held - True while an input is held
 * @property {MouseState} mouse
 * @property {number} _sx - Swipe start X (screen space)
 * @property {number} _sy - Swipe start Y (screen space)
 */

/**
 * @typedef {Object} Timer
 * @property {number} max - Interval duration in seconds
 * @property {number} t - Accumulated time
 * @property {(dt:number)=>boolean} tick - Advances timer, returns true on fire
 */

/**
 * @typedef {Object} GameMeta
 * @property {string} title
 * @property {string} desc
 * @property {string} instructions
 */

/**
 * @typedef {Object} UIDefinition
 * @property {string} type
 * @property {string} [id]
 * @property {string} [text]
 * @property {string} [html]
 * @property {Object<string,string>} [style]
 * @property {Function} [onClick]
 * @property {boolean} [primary]
 * @property {number} [value]
 * @property {number} [cols]
 * @property {number} [gap]
 * @property {Array<UIDefinition>} [children]
 * @property {HTMLElement} [el]
 */

/**
 * =============================================================================
 * GLOBAL UTILITY BELT (window.PC)
 * =============================================================================
 *
 * Small, dependency-free helpers shared by all cartridges.
 * Intentionally simple; avoids engine coupling.
 */
window.PC = {
    /** Linear interpolation between a and b */
    lerp: (a, b, t) => a + (b - a) * t,

    /** Clamp value between lo and hi */
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),

    /** Random float in [lo, hi) */
    rand: (lo, hi) => Math.random() * (hi - lo) + lo,

    /** Random integer in [lo, hi] */
    randInt: (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo,

    /** Euclidean distance between points */
    dist: (a, b) => Math.hypot(b.x - a.x, b.y - a.y),

    /**
     * Axis-Aligned Bounding Box collision test
     * @param {{x:number,y:number,w:number,h:number}} a
     * @param {{x:number,y:number,w:number,h:number}} b
     */
    hitRect: (a, b) =>
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y,

    pointInRect: (px, py, r) => {
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    },

    /**
     * Creates a fixed-interval accumulator timer.
     * Immune to drift caused by variable frame times.
     * @param {number} interval - Seconds between ticks
     * @returns {Timer}
     */
    makeTimer: (interval) => ({
        max: interval,
        t: 0,
        tick(dt) {
            this.t += dt;
            if (this.t >= this.max) {
                this.t %= this.max;
                return true;
            }
            return false;
        }
    }),
};



/**
 * =============================================================================
 * ENTITY BASE CLASS
 * =============================================================================
 *
 * Atomic unit of simulation.
 * All gameplay objects ultimately derive from this.
 */
class Entity {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.dead = false; // Flagged for GC at end of frame
        this.z = 0;        // Draw order (ascending)
    }

    /**
     * Per-frame logic update
     * @param {number} dt - Delta time (seconds)
     * @param {InputState} input
     * @param {Game} game
     */
    update(dt, input, game) {}

    /**
     * Per-frame render hook
     * @param {Object} gfx - Graphics helper
     */
    draw(gfx) {}

    /** Marks entity for destruction */
    destroy() { this.dead = true; }
}

/**
 * =============================================================================
 * GAME BASE CLASS (CARTRIDGE)
 * =============================================================================
 *
 * Owns all entities and high-level game state.
 * Instantiated fresh on every run.
 */
class Game {
    constructor(api) {
        /** @type {object} */
        this.api = api;

        /** @type {Entity[]} */
        this.entities = [];

        /** @type {number} */
        this.score = 0;

        /** @type {GameMeta} */
        this.meta = {
            title: "Untitled",
            desc: "No description.",
            instructions: ""
        };
    }

    /** Called once when cartridge boots */
    onInit() {}

    /** Called once when cartridge is ejected */
    onCleanup() {}

    /**
     * Adds entity and maintains Z-order invariant
     * @param {Entity} entity
     */
    add(entity) {
        this.entities.push(entity);
        this.entities.sort((a, b) => a.z - b.z);
        return entity;
    }

    clearEntities() {
        this.entities = [];
    }

    /**
     * Finds first entity of given class
     * @template T
     * @param {new (...args:any)=>T} Type
     * @returns {T|undefined}
     */
    find(Type) {
        return this.entities.find(e => e instanceof Type);
    }

    /**
     * Advances simulation by one frame
     * @param {number} dt
     * @param {InputState} input
     */
    update(dt, input) {
        for (const e of this.entities) {
            if (!e.dead) e.update(dt, input, this);
        }
        // Garbage collection phase
        this.entities = this.entities.filter(e => !e.dead);
    }

    /**
     * Finds the top-most entity at (x,y).
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {Class} [Type] - Filter by class (optional)
     * @param {number} [padding=0] - Hitbox expansion for easier clicking
     */
    pick(x, y, Type, padding = 0) {
        // Iterate backwards to find the one drawn on "top"
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            if (e.dead) continue;
            if (Type && !(e instanceof Type)) continue;
            
            // Use the engine's existing collision helper
            if (this.api.pointInEntity(x, y, e, padding)) {
                return e;
            }
        }
        return null;
    }

    /** Renders all entities */
    draw(gfx) {
        for (const e of this.entities) e.draw(gfx);
    }

    /**
     * Checks if 'entity' overlaps with any other entity of type 'Type'.
     * Returns the first valid hit (or null).
     * @param {Entity} entity - The entity asking for the check (to avoid self-collision)
     * @param {Class} Type - The class to check for (e.g., Lemming, Enemy). Pass null for ANY.
     * @returns {Entity|null}
     */
    collide(entity, Type) {
        // Enforce AABB requirement
        if (entity.w === undefined || entity.h === undefined) return null;

        for (const other of this.entities) {
            // 1. Skip self and dead entities
            if (other === entity || other.dead) continue;

            // 2. Check Type (if provided)
            if (Type && !(other instanceof Type)) continue;

            // 3. Check AABB (using existing global helper)
            if (other.w !== undefined && other.h !== undefined) {
                if (window.PC.hitRect(entity, other)) return other;
            }
        }
        return null;
    }

    /**
     * Same as collide, but returns an ARRAY of all overlaps.
     */
    collideAll(entity, Type) {
        if (entity.w === undefined || entity.h === undefined) return [];
        
        // Filter the entire list efficiently
        return this.entities.filter(other => 
            other !== entity && 
            !other.dead && 
            (other.w !== undefined && other.h !== undefined) &&
            (!Type || other instanceof Type) &&
            window.PC.hitRect(entity, other)
        );
    }

    /**
     * Checks if a point (x,y) is inside any entity of type Type.
     * Useful for mouse clicks.
     */
    collidePoint(x, y, Type) {
        return this.entities.find(e => 
            !e.dead &&
            (!Type || e instanceof Type) &&
            x >= e.x && x <= e.x + e.w &&
            y >= e.y && y <= e.y + e.h
        );
    }
}


// =============================================================================
// PHYSICS MODULE (Tile-Based)
// =============================================================================
const Physics = {
    // The World Grid
    World: class {
        constructor(cols, rows, tileSize) {
            this.cols = cols;
            this.rows = rows;
            this.size = tileSize;
            this.data = new Uint8Array(cols * rows).fill(0); // 0=Air, 1=Solid
        }

        get(x, y) {
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 1; // Bounds are solid
            return this.data[y * this.cols + x];
        }

        set(x, y, val) {
            if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                this.data[y * this.cols + x] = val;
            }
        }

        // Helper: Pixel coordinate to Grid coordinate
        toGrid(px) { return Math.floor(px / this.size); }
        
        // Helper: Collides with solid?
        // Checks the 4 corners of the entity's bounding box
        overlap(x, y, w, h) {
            const l = this.toGrid(x);
            const r = this.toGrid(x + w - 0.1);
            const t = this.toGrid(y);
            const b = this.toGrid(y + h - 0.1);
            
            // If any tile in this range is solid (>0), return true
            for (let gy = t; gy <= b; gy++) {
                for (let gx = l; gx <= r; gx++) {
                    if (this.get(gx, gy) > 0) return true;
                }
            }
            return false;
        }
    },

    // The Physical Actor (Lemming, Box, etc)
    Actor: class extends Entity {
        constructor(x, y, w, h) {
            super(x, y);
            this.x = x; this.y = y;
            this.w = w; this.h = h;
            this.vx = 0; this.vy = 0;
            this.grounded = false;
            this.remainderX = 0; // Sub-pixel accumulator
            this.remainderY = 0;
        }

        // Standard Platformer Physics Step
        updatePhysics(dt, world, gravity = 800) {
            this.vy += gravity * dt;

            // Move X
            this.remainderX += this.vx * dt;
            let moveX = Math.round(this.remainderX);
            if (moveX !== 0) {
                this.remainderX -= moveX;
                const sign = Math.sign(moveX);
                while (moveX !== 0) {
                    if (!world.overlap(this.x + sign, this.y, this.w, this.h)) {
                        this.x += sign;
                        moveX -= sign;
                    } else {
                        this.vx = 0; // Hit wall
                        this.onWallHit?.(sign); // Callback if defined
                        break;
                    }
                }
            }

            // Move Y
            this.remainderY += this.vy * dt;
            let moveY = Math.round(this.remainderY);
            if (moveY !== 0) {
                this.remainderY -= moveY;
                const sign = Math.sign(moveY);
                while (moveY !== 0) {
                    if (!world.overlap(this.x, this.y + sign, this.w, this.h)) {
                        this.y += sign;
                        moveY -= sign;
                        this.grounded = false;
                    } else {
                        if (sign > 0) this.grounded = true; // Hit floor
                        this.vy = 0;
                        break;
                    }
                }
            }
        }
    }
};

/**
 * =============================================================================
 * INTERACTIVE ENGINE CORE (Singleton)
 * =============================================================================
 *
 * Orchestrates:
 * - Canvas + DOM layers
 * - Input normalization
 * - Cartridge lifecycle
 * - Animation frame loop
 */
window.Interactive = (() => {
    // Constants: The logical resolution of the game canvas.
    // CSS scales this up to fit the screen, but game logic always uses these coordinates.
    const W = 400; 
    const H = 300;

    // Internal State
    let _activeGame = null; // The currently running Game instance
    let _activeId = null;   // The string ID of the current game (e.g., 'snake')
    let _registry = {};     // Dictionary of registered game classes
    let _canvas, _ctx, _domLayer; 
    let _loopId;            // requestAnimationFrame ID
    let _lastTime = 0;      // Timestamp of the last frame
    let _inputLocked = false; // Prevents accidental clicks during menu transitions
    let _scriptsLoaded = false; // Prevent re-attaching scripts on re-initialization

    // Input Handling
    let _handlers = {};
    let _boundBoard = null;
    let _inputPending = {
        pressed: {},
        clicked: false,
        sx: 0, sy: 0 // Swipe coords
    };
    const input = { 
        pressed: {},  // True only on the specific frame a key was pressed
        held: {},     // True as long as the key is held down
        mouse: { x: 0, y: 0, down: false, clicked: false }, 
        _sx: 0, _sy: 0 // Internal variables for touch-swipe detection
    };

    // Keyboard Mapping (Hardware Key -> Logical Action)
    const KEY_MAP = { 
        'ArrowUp':'UP', 'w':'UP', 'W':'UP', 
        'ArrowDown':'DOWN', 's':'DOWN', 'S':'DOWN', 
        'ArrowLeft':'LEFT', 'a':'LEFT', 'A':'LEFT', 
        'ArrowRight':'RIGHT', 'd':'RIGHT', 'D':'RIGHT', 
        ' ':'ACTION', 'Enter':'ACTION', 
        'Escape':'CANCEL', 'p':'PAUSE' 
    };

    // ── GFX Module ───────────────────────────────────────────────────────────
    /**
     * Graphics Context Wrapper
     * A simplified API for drawing to the HTML5 Canvas.
     * Passed to the draw() method of Games and Entities.
     */
    const GFX = {
        /** The width of the logical canvas (400px) */
        get W() { return W; }, 
        
        /** The height of the logical canvas (300px) */
        get H() { return H; },
        
        /**
         * Fills the entire screen with a solid color.
         * @param {string} [c='#111'] - CSS color string (hex, rgba, named).
         */
        clear(c='#111') { _ctx.fillStyle=c; _ctx.fillRect(0,0,W,H); },

        /**
         * Draws a line between two points.
         * @param {number} x1 - Start X.
         * @param {number} y1 - Start Y.
         * @param {number} x2 - End X.
         * @param {number} y2 - End Y.
         * @param {string} [c='#fff'] - Color.
         * @param {number} [w=1] - Line width.
         */
        line(x1, y1, x2, y2, c='#fff', w=1) {
            _ctx.beginPath();
            _ctx.moveTo(x1, y1);
            _ctx.lineTo(x2, y2);
            _ctx.strokeStyle = c;
            _ctx.lineWidth = w;
            _ctx.stroke();
        },
        
        /**
         * Draws a filled rectangle.
         * @param {number} x - X coordinate.
         * @param {number} y - Y coordinate.
         * @param {number} w - Width.
         * @param {number} h - Height.
         * @param {string} f - Fill color.
         */
        rect(x,y,w,h,f) { _ctx.fillStyle=f; _ctx.fillRect(x,y,w,h); },
        
        /**
         * Draws a filled circle.
         * @param {number} x - Center X coordinate.
         * @param {number} y - Center Y coordinate.
         * @param {number} r - Radius.
         * @param {string} f - Fill color.
         */
        circle(x,y,r,f) { _ctx.beginPath(); _ctx.arc(x,y,r,0,Math.PI*2); _ctx.fillStyle=f; _ctx.fill(); },
        
        /**
         * Draws text to the screen.
         * @param {string} str - The text string to render.
         * @param {number} x - X coordinate.
         * @param {number} y - Y coordinate.
         * @param {object} [opts] - Styling options.
         * @param {number} [opts.size=14] - Font size in pixels.
         * @param {string} [opts.color='#fff'] - Text color.
         * @param {string} [opts.align='left'] - Alignment (left, center, right).
         * @param {boolean} [opts.bold=false] - Whether to use bold font.
         */
        text(str,x,y,opts={}) { 
            _ctx.font = `${opts.bold?'bold ':''}${opts.size||14}px 'Fustat'`; 
            _ctx.fillStyle = opts.color||'#fff'; 
            _ctx.textAlign = opts.align||'left'; 
            _ctx.fillText(str,x,y); 
        },
        
        /**
         * Returns the raw Canvas2DContext for advanced drawing operations.
         * Use this if you need alpha, gradients, images, or transforms.
         * @returns {CanvasRenderingContext2D}
         */
        ctx: () => _ctx 
    };

    // ── UI Module ────────────────────────────────────────────────────────────
    // A declarative builder for DOM-based User Interfaces (menus, quizzes).
    // Renders HTML elements on top of the canvas.
    const UI = {
        /** Removes all UI elements */
        clear() { _domLayer.innerHTML = ''; },
        
        /** Retrieve a specific UI element by ID (useful for updating timers/scores) */
        get(id) { return document.getElementById(id); }, 
        
        /**
         * Builds a stack of UI components defined by JSON objects.
         * @param {Array} components - List of component definitions.
         */
        build(components) {
            UI.clear();
            const container = document.createElement('div');
            container.className = 'pc-ui-col';
            components.forEach(def => container.appendChild(UI._make(def)));
            _domLayer.appendChild(container);
        },

        // Add this new method:
        setText(id, text) {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        },

        // Add this to update styles easily
        setStyle(id, styleProp, value) {
            const el = document.getElementById(id);
            if (el) el.style[styleProp] = value;
        },
        
        /**
         * Internal Factory: Converts a JSON UI definition into a DOM Element.
         * This function is the heart of the declarative UI system.
         * * @param {object} def - The component definition object.
         * @param {string} def.type - Component type: 'button', 'text', 'title', 'spacer', 'grid', 'progress', 'custom', 'input'.
         * @param {string} [def.id] - HTML ID to assign (useful for UI.get()).
         * @param {string} [def.text] - Text content for buttons, titles, and body text.
         * @param {string} [def.html] - Raw HTML content (use carefully).
         * @param {object} [def.style] - Inline CSS styles object (e.g. { color: 'red' }).
         * @param {function} [def.onClick] - Click handler for buttons.
         * @param {boolean} [def.primary] - If true, applies the 'primary' button style.
         * @param {number} [def.value] - Progress bar value (0.0 to 1.0).
         * @param {number} [def.cols] - Number of columns for grid layouts.
         * @param {number} [def.gap] - Gap size in pixels for grids.
         * @param {Array} [def.children] - Nested component definitions for grids.
         * @returns {HTMLElement} The constructed DOM element.
         */
        _make(def) {
            // 1. HANDLE SPECIAL TYPES
            // 'spacer': A simple invisible div to push content apart.
            if (def.type === 'spacer') { 
                const d = document.createElement('div'); 
                d.style.height = (def.size || 10) + 'px'; 
                return d; 
            }
            
            // 'custom': Allows games to pass raw DOM nodes (e.g., a pre-made canvas or complex div).
            if (def.type === 'custom') return def.el;
            
            // 2. CREATE BASE ELEMENT
            // Determine tag name based on type. Defaults to 'div'.
            const tag = (def.type === 'button') ? 'button' :
                        (def.type === 'input')  ? 'input'  : 'div';
            
            const el = document.createElement(tag);
            
            // Assign ID if provided (crucial for updating elements later via UI.get())
            if (def.id) el.id = def.id;
            
            // 3. APPLY CSS CLASSES BASED ON TYPE
            // Maps abstract types to specific CSS classes defined in interactive.css
            if (def.type === 'title') el.className = 'pc-text-title';
            if (def.type === 'text')  el.className = 'pc-text-body';
            
            // 4. HANDLE BUTTONS
            if (def.type === 'button') {
                // Apply base class + optional 'primary' variant
                el.className = `pc-btn ${def.primary ? 'primary' : ''}`;
                
                // Attach Click Listener
                el.onclick = (e) => { 
                    // Prevent clicks if input is currently locked (e.g. during transitions)
                    if (!_inputLocked && def.onClick) def.onClick(e); 
                    
                    // Stop event from bubbling up to the game board (prevents accidental movement)
                    e.stopPropagation(); 
                };
            }
            
            // 5. HANDLE PROGRESS BARS
            // Uses CSS class 'pc-progress' for the container and 'pc-progress-fill' for the bar.
            if (def.type === 'progress') {
                el.className = 'pc-progress'; 
                
                const bar = document.createElement('div');
                // ID suffix allows easy access: UI.get('my-timer-bar')
                bar.id = def.id ? def.id + '-bar' : null;
                bar.className = 'pc-progress-fill';
                
                // Dynamic styles: width based on value (0..1) and optional color override
                bar.style.width = `${(def.value || 0) * 100}%`;
                if (def.color) bar.style.backgroundColor = def.color;
                
                el.appendChild(bar);
                return el; // Return early since structure is complete
            }
            
            // 6. HANDLE GRIDS (Recursive)
            // Uses CSS class 'pc-grid' for layout foundation.
            if (def.type === 'grid') {
                el.className = 'pc-grid'; 
                
                // Dynamic styles: Set column count and gap size
                el.style.gridTemplateColumns = `repeat(${def.cols || 2}, 1fr)`;
                el.style.gap = (def.gap || 8) + 'px';
                
                // Recursively build children and append them to this grid
                (def.children || []).forEach(childDef => {
                    const childEl = UI._make(childDef);
                    if (childEl) el.appendChild(childEl);
                });
                
                return el; // Return early
            }

            // 7. APPLY COMMON PROPERTIES
            // Content
            if (def.text) el.textContent = def.text;
            if (def.html) el.innerHTML = def.html;
            
            // Apply custom CSS overrides provided in the definition (e.g. { color: 'red' })
            if (def.style) Object.assign(el.style, def.style);

            return el;
        }
    };

    // ── Public API ───────────────────────────────────────────────────────────
    const API = {
        /**
         * Register a new game class with the engine.
         * @param {string} id - Unique identifier (e.g., 'snake').
         * @param {class} GameClass - The class extending Game.
         */
        register(GameClass) {
            // 1. Validate metadata exists
            if (!GameClass.meta || !GameClass.meta.id) {
                console.error("[Interactive] Failed to register game: Missing static meta.id");
                return;
            }

            const id = GameClass.meta.id;

            // 2. Store the CLASS itself, not the title
            _registry[id] = GameClass;

            // 3. Render the UI card
            API._renderCard(GameClass);

            console.log(`[Interactive] Registered module: ${id}`);
        },

        /**
         * Prepares a game to run. Shows the "Ready" overlay.
         */
        load(id) {
            if (!_registry[id]) return;
            _activeId = id;
            const meta = _registry[id].meta;
            
            // Switch DOM views
            document.getElementById('pc-menu-view').style.display = 'none';
            document.getElementById('pc-machine-view').style.display = 'block';

            // Reisze the canvas around our new game
            _handleResize();
            
            // Show Overlay
            API._overlay(meta?.title||'Game', meta?.instructions||'Ready?', 'START', () => API.start());
        },

        /**
         * Actually starts the game loop.
         * Destroys previous instances and creates a fresh Game object.
         */
        start() {
            API._hideOverlay(); 
            UI.clear();
            document.getElementById('pc-machine-view').classList.add('pc-game-active')
            // Cleanup previous game (prevents zombie state)
            if (_activeGame && _activeGame.onCleanup) _activeGame.onCleanup();
            
            // Instantiate fresh game
            _activeGame = new _registry[_activeId](API.gameOps);
            
            // Reset Input State
            input.pressed = {}; 
            input.held = {}; 
            input.mouse.down = false; 
            _inputLocked = true;
            setTimeout(() => _inputLocked = false, 200);

            // Initialize Game
            try { 
                if (_activeGame.onInit) {
                    _activeGame.onInit();
                } 
            } catch(e) { 
                console.error(e); 
                API._overlay("ERROR", "Check Console", "EXIT", () => API.eject()); 
                return; 
            }
            
            // Start Loop
            _lastTime = performance.now(); 
            _loopId = requestAnimationFrame(_tick);
        },

        /**
         * Stops the game and returns to the main menu.
         */
        eject() {
            cancelAnimationFrame(_loopId);
            _loopId = null;
            if (_activeId) {
                // Read the latest score from storage
                const best = parseInt(localStorage.getItem(`pc_hi_${_activeId}`) || '0');

                // Find the card in the menu using the data attribute we added
                const card = document.querySelector(`.game-card[data-id="${_activeId}"]`);

                // Update the high score text
                if (card) {
                    const scoreEl = card.querySelector('.game-card-score');
                    if (scoreEl) scoreEl.textContent = `RECORD: ${best}`;
                }
            }
            // Cleanup the previous game
            if (_activeGame && _activeGame.onCleanup) _activeGame.onCleanup();

            // Remove the cartridge, clear the screen
            _activeGame = null; 
            _activeId = null; 
            this.gameOps.setStatus(null);
            this.gameOps.setLabel(null);
            UI.clear();

            // Switch back to the menu
            const view = document.getElementById('pc-machine-view');
            view.style.display = 'none';
            view.classList.remove("pc-game-active");
            document.getElementById('pc-menu-view').style.display = 'grid';
        },

        /**
         * Tools exposed to the Game instance.
         */
        gameOps: {
            W, H, UI,
            setScore(s) {
                document.getElementById('pc-hud-score').textContent = s;
                if (_activeId) {
                    const k = `pc_hi_${_activeId}`;
                    const best = parseInt(localStorage.getItem(k) || '0');
                    if (s > best) {
                        localStorage.setItem(k, s);
                        if (window.PodUser) {
                            window.PodUser.logGameScore(_activeId, s);
                        }
                    }
                }
            },

            getHighScore() {
                if (!_activeId) return 0;
                let best = parseInt(localStorage.getItem(`pc_hi_${_activeId}`) || '0');
                
                // Cross-reference with PodUser in case memory was imported from a backup code
                if (window.PodUser && window.PodUser.data.games[_activeId] > best) {
                    best = window.PodUser.data.games[_activeId];
                    localStorage.setItem(`pc_hi_${_activeId}`, best);
                }
                
                return best;
            },

            saveData(key, val) { localStorage.setItem(`pc_data_${_activeId}_${key}`, JSON.stringify(val)); },

            getData(key) {
                const d = localStorage.getItem(`pc_data_${_activeId}_${key}`);
                return d ? JSON.parse(d) : null;
            },

            // Precise collision helper for entities vs non-rect points
            pointInEntity(px, py, e, padding = 0) {
                return px >= e.x - padding && px <= e.x + e.w + padding &&
                    py >= e.y - padding && py <= e.y + e.h + padding;
            },

            setStatus(s) { document.getElementById('pc-hud-status').textContent = s; },

            setLabel(s) { 
                const el = document.getElementById('pc-hud-aux');
                if (el) {
                    el.textContent = s; 
                    el.style.display = s ? 'block' : 'none';
                }
            },

            // Set _loopId to null so the loop knows to stop
            gameOver(msg) {
                cancelAnimationFrame(_loopId);
                _loopId = null;
                API._overlay(msg, 'Module Aborted', 'RESET', () => API.start());
            },

            newStage(title, desc, btnText, callback) {
                // Pause the engine
                cancelAnimationFrame(_loopId);
                _loopId = null;

                // 2. Show the overlay
                API._overlay(title, desc, btnText, () => {
                    // 3. On Click: Resume
                    API._hideOverlay();
                    
                    // 4. Run the level setup logic passed by the game
                    if (callback) callback();

                    // 5. Restart the loop (using existing game instance)
                    _lastTime = performance.now();
                    _loopId = requestAnimationFrame(_tick);
                });
            },

            win(msg) {
                cancelAnimationFrame(_loopId);
                _loopId = null;
                API._overlay(msg, 'Module Completed Successfully', 'RESET', () => API.start());
            }
        },

        // Internal: Shows the modal overlay (Pause, Game Over, Ready)
        _overlay(t, d, b, fn) {
            document.getElementById('pc-overlay').classList.remove('hidden');
            document.getElementById('pc-overlay-msg').textContent = t;
            document.getElementById('pc-overlay-desc').textContent = d;
            const btn = document.getElementById('pc-overlay-btn');
            btn.textContent = b;
            btn.onclick = fn;

            // Keyboard Shortcut (Enter / Space) ===
            // Safety check: remove old listener if it somehow stuck around
            if (_handlers.overlayKey) window.removeEventListener('keydown', _handlers.overlayKey);

            // Define the temporary handler
            _handlers.overlayKey = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fn(); // Trigger the button's action (e.g., API.start())
                }
            };

            // Bind it
            window.addEventListener('keydown', _handlers.overlayKey);
        },

        _hideOverlay() {
            document.getElementById('pc-overlay').classList.add('hidden');
            if (_handlers.overlayKey) {
                window.removeEventListener('keydown', _handlers.overlayKey);
                _handlers.overlayKey = null;
            }
         },

        // Internal: Renders the menu card for a registered game
        _renderCard(Class) {
            const slot = document.getElementById('pc-cartridge-slot');
            if (!slot) return;

            const meta = Class.meta;

            // Check localStorage
            let best = parseInt(localStorage.getItem(`pc_hi_${meta.id}`) || '0');
            
            // FIX: Check PodUser first in case a new memory card was imported!
            if (window.PodUser && window.PodUser.data.games[meta.id] > best) {
                best = window.PodUser.data.games[meta.id];
                localStorage.setItem(`pc_hi_${meta.id}`, best);
            }
            
            const displayScore = best > 0 ? best : '—';

            const card = document.createElement('div');
            card.className = 'game-card';
            card.dataset.id = meta.id;
            card.onclick = () => API.load(meta.id);

            card.innerHTML = `
        <div class="game-card-meta">MODULE: ${meta.id.toUpperCase()}</div>
        <div class="game-card-title">${meta.title}</div>
        <div style="font-family:'Fustat'; font-size:11px; color:#666; margin-top:4px; line-height:1.4;">${meta.desc || "No description."}</div>
        <div class="game-card-score">RECORD: ${displayScore}</div>
    `;
            slot.appendChild(card);
        }
    };

    // ── Game Loop ────────────────────────────────────────────────────────────

    function _tick(now) {
        if (!_activeGame) return;

        const dt = Math.min((now - _lastTime) / 1000, 0.1);
        _lastTime = now;

        // LATCH INPUTS AT START OF FRAME
        input.pressed = { ..._inputPending.pressed };
        input.mouse.clicked = _inputPending.clicked;

        // Clear pending
        _inputPending.pressed = {};
        _inputPending.clicked = false;

        _activeGame.update(dt, input);
        _activeGame.draw(GFX);
        
        // Only request the next frame if the loop is still active
        // (i.e., gameOver() hasn't been called)
        if (_loopId !== null) {
            _loopId = requestAnimationFrame(_tick);
        }
    }

    // ── Input Binding ────────────────────────────────────────────────────────
    function _bind() {
        // Define handlers (so we can remove them later)
        _handlers.keydown = e => {
            if (KEY_MAP[e.key] && !_inputLocked) {
                e.preventDefault();
                // Write to pending, not live input
                _inputPending.pressed[KEY_MAP[e.key]] = true;
                input.held[KEY_MAP[e.key]] = true;
            }
        };

        _handlers.keyup = e => { 
            if(KEY_MAP[e.key]) input.held[KEY_MAP[e.key]] = false; 
        };

        // Bind to Window
        window.addEventListener('keydown', _handlers.keydown);
        window.addEventListener('keyup', _handlers.keyup);

        const b = document.querySelector('.pc-game-board');
        if(!b) return;
        _boundBoard = b; // Remember which element we bound to

        // Helper for mouse pos
        const u = (e) => { 
            const r = _canvas.getBoundingClientRect(); 
            input.mouse.x = (e.clientX - r.left)*(W/r.width); 
            input.mouse.y = (e.clientY - r.top)*(H/r.height); 
        };

        // Define Pointer Handlers
        _handlers.ptrDown = e => { 
            if(e.target.closest('.pc-overlay') || e.target.closest('button')) return; 
            if(_inputLocked) return; 
            b.setPointerCapture(e.pointerId); 
            input.mouse.down = true; 
            input._sx = e.clientX; 
            input._sy = e.clientY; 
            u(e); 
        };

        _handlers.ptrMove = e => { 
            if(input.mouse.down) e.preventDefault(); 
            u(e); 
        };

        _handlers.ptrUp = e => {
            if (_inputLocked) return;
            input.mouse.down = false;

            // Store in pending
            _inputPending.clicked = true;

            const dx = e.clientX - input._sx;
            const dy = e.clientY - input._sy;
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                _inputPending.pressed[Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP')] = true;
            } else {
                _inputPending.pressed['ACTION'] = true;
            }
        };

        // 4. Bind Pointer Events
        b.addEventListener('pointerdown', _handlers.ptrDown);
        b.addEventListener('pointermove', _handlers.ptrMove);
        b.addEventListener('pointerup', _handlers.ptrUp);
    }

    // Cleanup Function
    function _unbind() {
        if (_handlers.keydown) window.removeEventListener('keydown', _handlers.keydown);
        if (_handlers.keyup) window.removeEventListener('keyup', _handlers.keyup);
        
        if (_boundBoard) {
            if (_handlers.ptrDown) _boundBoard.removeEventListener('pointerdown', _handlers.ptrDown);
            if (_handlers.ptrMove) _boundBoard.removeEventListener('pointermove', _handlers.ptrMove);
            if (_handlers.ptrUp) _boundBoard.removeEventListener('pointerup', _handlers.ptrUp);
        }
        _handlers = {};
        _boundBoard = null;
    }

    // ── Resizing Logic ───────────────────────────────────────────────────────
    function _handleResize() {
        const board = document.querySelector('.pc-game-board');
        const dom = document.getElementById('pc-dom-layer');
        if (!board || !dom) return;

        // Calculate the ratio: Actual Screen Width / Logical Game Width (400)
        // Example: If phone is 350px wide, scale = 0.875
        const currentWidth = board.clientWidth;
        const scale = currentWidth / W; 

        dom.style.transform = `scale(${scale})`;
    }

    // ── Initialization ───────────────────────────────────────────────────────
    async function init() {

        _unbind();

        // Setup Canvas
        _canvas = document.getElementById('pc-canvas'); 
        _ctx = _canvas.getContext('2d'); 
        _canvas.width = W; 
        _canvas.height = H; 
        _domLayer = document.getElementById('pc-dom-layer');
        
        // Setup Input
        _bind();

        // Resize canvas to fit screen
        window.addEventListener('resize', _handleResize); // Adjust when phone rotates
        _handleResize(); // Adjust immediately on load
        
        // Export Classes globally for cartridges to use
        window.Game = Game; 
        window.Entity = Entity; 

        // Only reload scripts if needed
        if (!_scriptsLoaded) {
            try {
                // 1. Fetch the registry from the JSON file
                // Note: Path is relative to index.html
                const response = await fetch('./interactive/games/active-games.json');
                if (!response.ok) throw new Error("Manifest missing");
                
                const games = await response.json();

                // 2. Load every game listed in the manifest
                games.forEach(id => { 
                    const s = document.createElement('script'); 
                    s.src = `./interactive/games/${id}.js`; 
                    s.onerror = () => console.warn(`[Interactive] Module '${id}' listed in manifest but file not found.`);
                    document.body.appendChild(s); 
                });

                _scriptsLoaded = true;
                console.log(`[Interactive] System initialized. Loading ${games.length} modules...`);

            } catch (e) {
                console.error("[Interactive] Cartridge slot error:", e);
            }
        }
        // Hide Loading Screen
        setTimeout(() => { 
            const l = document.getElementById('pc-loading'); 
            if (l) l.style.display = 'none'; 
        }, 500);
    }

    return { init, 
        register: API.register, 
        eject: API.eject, 
        gameOps: API.gameOps, 
        destroy: () => {
            API.eject(); // Stop any running game
            _unbind();   // Clean up global listeners
        } };
})();