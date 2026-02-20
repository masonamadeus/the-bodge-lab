//
// =============================================================================
// Interactive Engine v3.7
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
 * GLOBAL UTILITY BELT (window.PC)
 * =============================================================================
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

    /**
     * Creates a fixed-interval accumulator timer.
     * Immune to drift caused by variable frame times.
     * @param {number} interval - Seconds between ticks
     * @returns {{max:number, t:number, tick:(dt:number)=>boolean}}
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
     * @param {Object} input - Input state
     * @param {Game} game - Reference to game instance
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
 */
class Game {
    constructor(api) {
        this.api = api;
        this.entities = [];
        this.score = 0;
        this.meta = { title: "Untitled", desc: "", instructions: "" };
    }

    onInit() {}
    onCleanup() {}

    /** Adds entity and maintains Z-order invariant */
    add(entity) {
        this.entities.push(entity);
        this.entities.sort((a, b) => a.z - b.z);
        return entity;
    }

    /** Finds first entity of given class */
    find(Type) {
        return this.entities.find(e => e instanceof Type);
    }

    /** Returns all entities of given class overlapping the source */
    collideAll(entity, Type) {
        if (entity.w === undefined || entity.h === undefined) return [];
        return this.entities.filter(other => 
            other !== entity && 
            !other.dead && 
            (other.w !== undefined && other.h !== undefined) &&
            (!Type || other instanceof Type) &&
            window.PC.hitRect(entity, other)
        );
    }

    update(dt, input) {
        for (const e of this.entities) {
            if (!e.dead) e.update(dt, input, this);
        }
        this.entities = this.entities.filter(e => !e.dead);
    }

    draw(gfx) {
        for (const e of this.entities) e.draw(gfx);
    }
}

/**
 * =============================================================================
 * PHYSICS MODULE
 * =============================================================================
 */
const Physics = {
    // 2D Grid for environmental collision
    World: class {
        constructor(cols, rows, tileSize) {
            this.cols = cols;
            this.rows = rows;
            this.size = tileSize;
            this.data = new Uint8Array(cols * rows).fill(0);
        }

        get(x, y) {
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 1;
            return this.data[y * this.cols + x];
        }

        set(x, y, val) {
            if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                this.data[y * this.cols + x] = val;
            }
        }

        toGrid(px) { return Math.floor(px / this.size); }
        
        // Check if any tile within the rectangular bounds is solid (>0)
        overlap(x, y, w, h) {
            const l = this.toGrid(x);
            const r = this.toGrid(x + w - 0.1);
            const t = this.toGrid(y);
            const b = this.toGrid(y + h - 0.1);
            
            for (let gy = t; gy <= b; gy++) {
                for (let gx = l; gx <= r; gx++) {
                    if (this.get(gx, gy) > 0) return true;
                }
            }
            return false;
        }
    },

    // A generic physical body with AABB collision and sub-pixel movement
    Actor: class extends Entity {
        constructor(x, y, w, h) {
            super(x, y);
            this.w = w; this.h = h;
            this.vx = 0; this.vy = 0;
            this.grounded = false;
            this.remainderX = 0; 
            this.remainderY = 0;
        }

        /**
         * Integrates velocity into position, resolving collisions against the World.
         * Sets this.grounded = true if standing on a solid.
         * Zeros out velocity upon collision.
         */
        updatePhysics(dt, world, gravity = 800) {
            this.vy += gravity * dt;

            // X Movement
            this.remainderX += this.vx * dt;
            let moveX = Math.round(this.remainderX);
            if (moveX !== 0) {
                this.remainderX -= moveX;
                const sign = Math.sign(moveX);
                // Step pixel-by-pixel
                while (moveX !== 0) {
                    if (!world.overlap(this.x + sign, this.y, this.w, this.h)) {
                        this.x += sign;
                        moveX -= sign;
                    } else {
                        // HIT WALL
                        this.vx = 0;
                        break;
                    }
                }
            }

            // Y Movement
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
                        // HIT CEILING OR FLOOR
                        if (sign > 0) this.grounded = true;
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
 * INTERACTIVE ENGINE CORE
 * =============================================================================
 */
window.Interactive = (() => {
    const W = 400; 
    const H = 300;

    let _activeGame = null;
    let _activeId = null;
    let _registry = {};
    let _canvas, _ctx, _domLayer, _loopId, _lastTime = 0;
    let _inputLocked = false;

    let _inputPending = { pressed: {}, clicked: false, sx: 0, sy: 0 };
    const input = { 
        pressed: {}, held: {}, mouse: { x: 0, y: 0, down: false, clicked: false }, _sx: 0, _sy: 0 
    };

    const KEY_MAP = { 
        'ArrowUp':'UP', 'w':'UP', 'W':'UP', 
        'ArrowDown':'DOWN', 's':'DOWN', 'S':'DOWN', 
        'ArrowLeft':'LEFT', 'a':'LEFT', 'A':'LEFT', 
        'ArrowRight':'RIGHT', 'd':'RIGHT', 'D':'RIGHT', 
        ' ':'ACTION', 'Enter':'ACTION', 'Escape':'CANCEL' 
    };

    // ── GFX Module ───────────────────────────────────────────────────────────
    const GFX = {
        get W() { return W; }, 
        get H() { return H; },
        clear(c='#111') { _ctx.fillStyle=c; _ctx.fillRect(0,0,W,H); },
        line(x1, y1, x2, y2, c='#fff', w=1) {
            _ctx.beginPath(); _ctx.moveTo(x1, y1); _ctx.lineTo(x2, y2);
            _ctx.strokeStyle = c; _ctx.lineWidth = w; _ctx.stroke();
        },
        rect(x,y,w,h,f) { _ctx.fillStyle=f; _ctx.fillRect(x,y,w,h); },
        circle(x,y,r,f) { _ctx.beginPath(); _ctx.arc(x,y,r,0,Math.PI*2); _ctx.fillStyle=f; _ctx.fill(); },
        text(str,x,y,opts={}) { 
            _ctx.font = `${opts.bold?'bold ':''}${opts.size||14}px 'Fustat'`; 
            _ctx.fillStyle = opts.color||'#fff'; 
            _ctx.textAlign = opts.align||'left'; 
            _ctx.fillText(str,x,y); 
        },
        ctx: () => _ctx 
    };

    // ── UI Module ────────────────────────────────────────────────────────────
    const UI = {
        clear() { _domLayer.innerHTML = ''; },
        get(id) { return document.getElementById(id); },
        build(components) {
            UI.clear();
            const container = document.createElement('div');
            container.className = 'pc-ui-col';
            components.forEach(def => container.appendChild(UI._make(def)));
            _domLayer.appendChild(container);
        },
        _make(def) {
            if (def.type === 'spacer') { 
                const d = document.createElement('div'); d.style.height = (def.size || 10) + 'px'; return d; 
            }
            const tag = (def.type === 'button') ? 'button' : 'div';
            const el = document.createElement(tag);
            if (def.id) el.id = def.id;
            
            if (def.type === 'title') el.className = 'pc-text-title';
            if (def.type === 'text')  el.className = 'pc-text-body';
            
            if (def.type === 'button') {
                el.className = `pc-btn ${def.primary ? 'primary' : ''}`;
                el.onclick = (e) => { 
                    if (!_inputLocked && def.onClick) def.onClick(e); 
                    e.stopPropagation(); 
                };
            }
            
            if (def.type === 'grid') {
                el.className = 'pc-grid'; 
                el.style.gridTemplateColumns = `repeat(${def.cols || 2}, 1fr)`;
                el.style.gap = (def.gap || 8) + 'px';
                (def.children || []).forEach(c => el.appendChild(UI._make(c)));
                return el;
            }

            if (def.text) el.textContent = def.text;
            if (def.style) Object.assign(el.style, def.style);
            return el;
        }
    };

    // ── Public API ───────────────────────────────────────────────────────────
    const API = {
        register(GameClass) {
            if (!GameClass.meta) return;
            const id = GameClass.meta.id;
            _registry[id] = GameClass;
            API._renderCard(GameClass);
        },

        load(id) {
            if (!_registry[id]) return;
            _activeId = id;
            document.getElementById('pc-menu-view').style.display = 'none';
            document.getElementById('pc-machine-view').style.display = 'block';
            _handleResize();
            const m = _registry[id].meta;
            API._overlay(m.title, m.instructions, 'START', () => API.start());
        },

        start() {
            API._hideOverlay(); 
            UI.clear();
            if (_activeGame && _activeGame.onCleanup) _activeGame.onCleanup();
            
            _activeGame = new _registry[_activeId](API.gameOps);
            input.pressed = {}; input.held = {}; input.mouse.down = false; 
            _inputLocked = true; setTimeout(() => _inputLocked = false, 200);

            if (_activeGame.onInit) _activeGame.onInit();
            
            _lastTime = performance.now(); 
            _loopId = requestAnimationFrame(_tick);
        },

        eject() {
            cancelAnimationFrame(_loopId);
            if (_activeGame && _activeGame.onCleanup) _activeGame.onCleanup();
            _activeGame = null; _activeId = null; 
            UI.clear();
            document.getElementById('pc-machine-view').style.display = 'none';
            document.getElementById('pc-menu-view').style.display = 'grid';
        },

        gameOps: {
            W, H, UI,
            setScore(s) { 
                document.getElementById('pc-hud-score').textContent = s; 
                if(_activeId) {
                    const k = `pc_hi_${_activeId}`;
                    const best = Math.max(s, parseInt(localStorage.getItem(k)||'0'));
                    localStorage.setItem(k, best);
                }
            },
            getHighScore() { return parseInt(localStorage.getItem(`pc_hi_${_activeId}`)||'0'); },
            saveData(k, v) { localStorage.setItem(`pc_data_${_activeId}_${k}`, JSON.stringify(v)); },
            getData(k) { const d = localStorage.getItem(`pc_data_${_activeId}_${k}`); return d ? JSON.parse(d) : null; },
            pointInEntity(px, py, e, pad = 0) {
                return px >= e.x - pad && px <= e.x + e.w + pad && py >= e.y - pad && py <= e.y + e.h + pad;
            },
            setStatus(s) { document.getElementById('pc-hud-status').textContent = s; },
            setLabel(s) { const el = document.getElementById('pc-hud-aux'); el.textContent = s; el.style.display = s ? 'block' : 'none'; },
            gameOver(msg) { cancelAnimationFrame(_loopId); API._overlay(msg, 'Terminated', 'RESET', () => API.start()); },
            newStage(t, d, b, cb) { 
                cancelAnimationFrame(_loopId); 
                API._overlay(t, d, b, () => { 
                    API._hideOverlay(); 
                    if(cb) cb(); 
                    _lastTime = performance.now(); 
                    _loopId = requestAnimationFrame(_tick); 
                }); 
            }
        },

        _overlay(t, d, b, fn) {
            document.getElementById('pc-overlay').classList.remove('hidden');
            document.getElementById('pc-overlay-msg').textContent = t;
            document.getElementById('pc-overlay-desc').textContent = d;
            const btn = document.getElementById('pc-overlay-btn');
            btn.textContent = b;
            btn.onclick = fn;
        },

        _hideOverlay() { document.getElementById('pc-overlay').classList.add('hidden'); },

        _renderCard(Class) {
            const slot = document.getElementById('pc-cartridge-slot');
            if (!slot) return;
            const meta = Class.meta;
            const best = localStorage.getItem(`pc_hi_${meta.id}`) || '—';
            const card = document.createElement('div');
            card.className = 'game-card';
            card.onclick = () => API.load(meta.id);
            card.innerHTML = `<div class="game-card-meta">MODULE: ${meta.id.toUpperCase()}</div><div class="game-card-title">${meta.title}</div><div style="font-size:11px;color:#666;">${meta.desc}</div><div class="game-card-score">RECORD: ${best}</div>`;
            slot.appendChild(card);
        }
    };

    function _tick(now) {
        if (!_activeGame) return;
        const dt = Math.min((now - _lastTime) / 1000, 0.1);
        _lastTime = now;
        input.pressed = { ..._inputPending.pressed };
        input.mouse.clicked = _inputPending.clicked;
        _inputPending.pressed = {}; _inputPending.clicked = false;
        _activeGame.update(dt, input);
        _activeGame.draw(GFX);
        if (_loopId !== null) _loopId = requestAnimationFrame(_tick);
    }

    function _handleResize() {
        const b = document.querySelector('.pc-game-board');
        const d = document.getElementById('pc-dom-layer');
        if (b && d) d.style.transform = `scale(${b.clientWidth / W})`;
    }

    async function init() {
        _canvas = document.getElementById('pc-canvas'); _ctx = _canvas.getContext('2d');
        _canvas.width = W; _canvas.height = H; _domLayer = document.getElementById('pc-dom-layer');
        
        window.addEventListener('keydown', e => { if (KEY_MAP[e.key] && !_inputLocked) { e.preventDefault(); _inputPending.pressed[KEY_MAP[e.key]] = true; input.held[KEY_MAP[e.key]] = true; } });
        window.addEventListener('keyup', e => { if (KEY_MAP[e.key]) input.held[KEY_MAP[e.key]] = false; });
        
        const b = document.querySelector('.pc-game-board');
        const u = e => { const r = _canvas.getBoundingClientRect(); input.mouse.x = (e.clientX - r.left) * (W / r.width); input.mouse.y = (e.clientY - r.top) * (H / r.height); };
        b.addEventListener('pointerdown', e => { if (!_inputLocked && !e.target.closest('button')) { b.setPointerCapture(e.pointerId); input.mouse.down = true; input._sx = e.clientX; input._sy = e.clientY; u(e); } });
        b.addEventListener('pointermove', e => { if (input.mouse.down) e.preventDefault(); u(e); });
        b.addEventListener('pointerup', e => { if (!_inputLocked) { input.mouse.down = false; _inputPending.clicked = true; u(e); } });

        window.addEventListener('resize', _handleResize); _handleResize();
        window.Game = Game; window.Entity = Entity;
        
        try {
            const games = await (await fetch('./interactive/games/active-games.json')).json();
            games.forEach(id => { const s = document.createElement('script'); s.src = `./interactive/games/${id}.js`; document.body.appendChild(s); });
        } catch (e) { console.error(e); }
    }

    return { init, register: API.register, eject: API.eject, gameOps: API.gameOps };
})();