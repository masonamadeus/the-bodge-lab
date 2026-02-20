// =============================================================================
// Interactive Engine v2.1  —  PodCube Minigame System
//
// QUICK REFERENCE
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. CREATE A GAME FILE  →  ./interactive/games/mygame.js
//    Then add 'mygame' to the CARTRIDGES list at the bottom of this file.
//
// 2. WRITE YOUR GAME using one of two patterns:
//
//    ┌─ PATTERN A: Flat (simple games) ──────────────────────────────────┐
//    │                                                                   │
//    │  Interactive.register('mygame', (() => {                          │
//    │    // Declare state vars here in the closure.                     │
//    │    let x = 200, y = 150, vel = 0;                                 │
//    │                                                                   │
//    │    return {                                                        │
//    │      meta: {                                                       │
//    │        title:        "My Game",                                   │
//    │        desc:         "Short description for the menu card.",       │
//    │        instructions: "Shown on the start overlay.",               │
//    │        controls:     "ARROWS to move  •  SPACE to jump"           │
//    │      },                                                            │
//    │                                                                   │
//    │      onInit(api)               { x = 200; y = 150; vel = 0; },   │
//    │      onUpdate(dt, input, api)  { /* game logic */ },              │
//    │      onDraw(gfx, api)          { /* canvas drawing */ }           │
//    │    };                                                              │
//    │  })());                                                            │
//    │                                                                   │
//    └───────────────────────────────────────────────────────────────────┘
//
//    ┌─ PATTERN B: Scenes (quizzes, multi-screen games) ─────────────────┐
//    │                                                                   │
//    │  Interactive.register('mygame', (() => {                          │
//    │    let score = 0; // shared across all scenes via closure         │
//    │                                                                   │
//    │    return {                                                        │
//    │      meta: { ... },                                               │
//    │      startScene: 'play',                                          │
//    │      scenes: {                                                    │
//    │        play: {                                                    │
//    │          enter(api)             { score = 0; },                   │
//    │          update(dt, input, api) { ... },                          │
//    │          draw(gfx, api)         { ... },                          │
//    │          exit(api)              { }  // optional                  │
//    │        },                                                         │
//    │        results: {                                                 │
//    │          enter(api)             { /* show score */ },             │
//    │          update(dt, input, api) { },                              │
//    │          draw(gfx, api)         { gfx.clear(); },                 │
//    │        }                                                          │
//    │      }                                                            │
//    │    };                                                              │
//    │  })());                                                            │
//    │                                                                   │
//    │  // Switch scenes from any lifecycle method: api.scene('results') │
//    └───────────────────────────────────────────────────────────────────┘
//
// ═══════════════════════════════════════════════════════════════════════════
// INPUT  — second argument to update()
// ═══════════════════════════════════════════════════════════════════════════
//
//   input.pressed.UP / DOWN / LEFT / RIGHT / ACTION / CANCEL
//     → true only on the very first frame a key is pressed down.
//       Use for: jumping, menu selection, turning in snake.
//
//   input.held.UP / DOWN / LEFT / RIGHT / ACTION / CANCEL
//     → true every frame while the key is held.
//       Use for: smooth movement, charging, holding a button.
//
//   input.mouse.x / .y      Cursor position in logical canvas coords (0–400, 0–300)
//   input.mouse.down        true while any mouse button is held
//   input.mouse.clicked     true only on the frame the button is released
//
// ═══════════════════════════════════════════════════════════════════════════
// GFX  — first argument to draw()
// ═══════════════════════════════════════════════════════════════════════════
//
//   gfx.W / gfx.H                                     Canvas size (400 × 300)
//   gfx.clear(color?)                                 Fill entire canvas
//   gfx.rect(x, y, w, h,  fill?, stroke?, sw?)
//   gfx.roundRect(x, y, w, h, radius,  fill?, stroke?, sw?)
//   gfx.circle(x, y, r,  fill?, stroke?, sw?)
//   gfx.line(x1, y1, x2, y2,  color, width?)
//   gfx.text(str, x, y,  { size, color, align, baseline, bold, font }?)
//   gfx.measureText(str, size?, bold?)                Returns pixel width
//   gfx.image(assetKey, x, y, w?, h?)                Draw a preloaded image
//   gfx.sprite(assetKey, sx, sy, sw, sh, dx, dy, dw, dh)   Spritesheet slice
//   gfx.alpha(opacity, fn)                            Draw fn() at given opacity
//   gfx.transform(x, y, rotation, scaleX, scaleY, fn)  Transformed draw
//   gfx.save() / gfx.restore()
//   gfx.ctx()                                         Raw canvas 2D context escape hatch
//
// ═══════════════════════════════════════════════════════════════════════════
// API  — last argument to all lifecycle methods
// ═══════════════════════════════════════════════════════════════════════════
//
//   api.W / api.H           Logical canvas size (same as gfx.W / gfx.H)
//   api.setScore(n)         Update score HUD  +  auto-save high score to localStorage
//   api.setStatus(str)      Update left status label in HUD  (e.g. 'RUNNING')
//   api.setLabel(str)       Update right secondary HUD  (level, lives, timer, etc.)
//   api.getHighScore()      Read saved high score for this game
//   api.scene('name')       Switch to a named scene  [Pattern B only]
//   api.gameOver(msg, sub?) Stop loop, show RETRY overlay
//   api.win(msg, sub?)      Stop loop, show PLAY AGAIN overlay
//   api.pause()             Pause loop, show RESUME overlay
//   api.assets              Object of preloaded images  { key: HTMLImageElement }
//   api.ui                  DOM UI builder  (see below)
//
// ═══════════════════════════════════════════════════════════════════════════
// API.UI  — DOM component builder for non-canvas / hybrid games
// ═══════════════════════════════════════════════════════════════════════════
//
//   api.ui.build([ ...components ])   Render a column of components into the game board.
//                                     Replaces any existing DOM UI.
//   api.ui.clear()                    Remove all DOM UI elements
//   api.ui.get('id')                  Retrieve a rendered element by id
//   api.ui.append(el)                 Append a raw HTMLElement to the DOM layer
//
//   Component types:
//     { type: 'title',      text, id?, style? }
//     { type: 'text',       text, id?, style? }
//     { type: 'button',     text, onClick,  primary?, id?, style? }
//     { type: 'button-row', buttons: [ ...button defs ] }
//     { type: 'grid',       cols, children: [...], gap?, width?, id?, style? }
//     { type: 'input',      id?, label?, placeholder?, inputType?, onEnter?, onChange? }
//     { type: 'progress',   id?, value (0–1) }
//     { type: 'divider' }
//     { type: 'spacer',     size? }
//     { type: 'html',       html, id?, style? }
//     { type: 'custom',     el: HTMLElement }
//
// ═══════════════════════════════════════════════════════════════════════════
// PC  — global utility belt  (window.PC, available in all game files)
// ═══════════════════════════════════════════════════════════════════════════
//
//   PC.lerp(a, b, t)              Linear interpolation
//   PC.clamp(v, lo, hi)           Clamp value between lo and hi
//   PC.rand(lo, hi)               Random float in [lo, hi)
//   PC.randInt(lo, hi)            Random integer in [lo, hi] inclusive
//   PC.dist(a, b)                 Euclidean distance between {x,y} points
//   PC.norm(v, lo, hi)            Normalize v to 0–1 within [lo, hi]
//   PC.hitRect(a, b)              AABB collision test  —  both: { x, y, w, h }
//   PC.hitCircle(a, b)            Circle collision test  —  both: { x, y, r }
//   PC.pointInRect(px, py, rect)  Point-in-rect test  —  rect: { x, y, w, h }
//   PC.makeTimer(interval)        Repeating tick timer (good for snake speed, NOT countdowns)
//                                   returns { tick(dt)→bool, reset(), progress()→0..1 }
//
// ═══════════════════════════════════════════════════════════════════════════
// ASSET PRELOADING
// ═══════════════════════════════════════════════════════════════════════════
//
//   Add an `assets` object to your cartridge. All images load before onInit fires.
//
//   assets: {
//     ship:  './interactive/images/ship.png',
//     tiles: './interactive/images/tiles.png',
//   }
//
//   Access via: api.assets.ship  (an HTMLImageElement)
//
// =============================================================================

'use strict';

// =============================================================================
//  PC — Global utility belt
// =============================================================================
window.PC = {
  lerp:        (a, b, t)   => a + (b - a) * t,
  clamp:       (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  rand:        (lo, hi)    => Math.random() * (hi - lo) + lo,
  randInt:     (lo, hi)    => Math.floor(Math.random() * (hi - lo + 1)) + lo,
  dist:        (a, b)      => Math.hypot(b.x - a.x, b.y - a.y),
  norm:        (v, lo, hi) => (v - lo) / (hi - lo),
  hitRect:     (a, b)      => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y,
  hitCircle:   (a, b)      => PC.dist(a, b) < (a.r||0) + (b.r||0),
  pointInRect: (px, py, r) => px >= r.x && px <= r.x+r.w && py >= r.y && py <= r.y+r.h,

  // Repeating interval timer. tick(dt) returns true once per `interval` seconds.
  // Great for: snake step speed, enemy spawn rate, animation frames.
  // NOT ideal for countdowns — just use  timeLeft -= dt  for that.
  makeTimer: (interval) => ({
    max: interval, t: 0,
    tick(dt)   { this.t += dt; if (this.t >= this.max) { this.t %= this.max; return true; } return false; },
    reset()    { this.t = 0; },
    progress() { return PC.clamp(this.t / this.max, 0, 1); },
  }),
};

// =============================================================================
//  Interactive Engine — Core
// =============================================================================
window.Interactive = (() => {

  // The canvas always renders at this logical size.
  // CSS scales it to fit the screen; pixel positions are always in these coords.
  const W = 400;
  const H = 300;

  // ── Private engine state ──────────────────────────────────────────────────
  let _cart        = null;   // active cartridge object
  let _cartId      = null;   // active cartridge id string
  let _scene       = null;   // active scene object
  let _loopId      = null;   // rAF handle
  let _lastTime    = 0;
  let _canvas, _ctx, _domLayer;

  // ── Input ─────────────────────────────────────────────────────────────────
  const _keyMap = {
    'ArrowUp':'UP',     'w':'UP',     'W':'UP',
    'ArrowDown':'DOWN', 's':'DOWN',   'S':'DOWN',
    'ArrowLeft':'LEFT', 'a':'LEFT',   'A':'LEFT',
    'ArrowRight':'RIGHT','d':'RIGHT', 'D':'RIGHT',
    ' ':'ACTION', 'Enter':'ACTION',
    'Escape':'CANCEL', 'p':'PAUSE', 'P':'PAUSE',
  };

  const input = {
    pressed: {}, // cleared each frame — good for "just pressed" detection
    held:    {}, // persists while key is down — good for continuous movement
    mouse:   { x: 0, y: 0, down: false, clicked: false },
  };

  // ── Asset loader ──────────────────────────────────────────────────────────
  const _assets = {};

  function _loadAssets(defs, done) {
    const entries = Object.entries(defs || {});
    if (!entries.length) { done(); return; }
    let n = entries.length;
    for (const [key, src] of entries) {
      if (_assets[key]) { if (!--n) done(); continue; }
      const img = new Image();
      img.onload  = () => { _assets[key] = img; if (!--n) done(); };
      img.onerror = () => { console.warn(`[Interactive] Asset load failed: ${key}`); if (!--n) done(); };
      img.src = src;
    }
  }

  // ── GFX — Canvas drawing API ──────────────────────────────────────────────
  // Every method is a thin wrapper around the 2D context.
  // fill/stroke params accept any CSS color string.
  const GFX = {
    get W() { return W; },
    get H() { return H; },

    clear(color = '#fdfdfc') {
      _ctx.fillStyle = color;
      _ctx.fillRect(0, 0, W, H);
    },

    rect(x, y, w, h, fill, stroke, sw = 1) {
      if (fill)   { _ctx.fillStyle   = fill;   _ctx.fillRect(x, y, w, h); }
      if (stroke) { _ctx.strokeStyle = stroke; _ctx.lineWidth = sw; _ctx.strokeRect(x, y, w, h); }
    },

    roundRect(x, y, w, h, r, fill, stroke, sw = 1) {
      _ctx.beginPath(); _ctx.roundRect(x, y, w, h, r);
      if (fill)   { _ctx.fillStyle   = fill;   _ctx.fill(); }
      if (stroke) { _ctx.strokeStyle = stroke; _ctx.lineWidth = sw; _ctx.stroke(); }
    },

    circle(x, y, r, fill, stroke, sw = 1) {
      _ctx.beginPath(); _ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill)   { _ctx.fillStyle   = fill;   _ctx.fill(); }
      if (stroke) { _ctx.strokeStyle = stroke; _ctx.lineWidth = sw; _ctx.stroke(); }
    },

    line(x1, y1, x2, y2, color, width = 1) {
      _ctx.beginPath(); _ctx.moveTo(x1, y1); _ctx.lineTo(x2, y2);
      _ctx.strokeStyle = color; _ctx.lineWidth = width; _ctx.stroke();
    },

    // opts: { size=14, color='#333', align='left', baseline='top', bold=true, font='Fustat' }
    text(str, x, y, opts = {}) {
      const { size=14, color='#333', align='left', baseline='top', bold=true, font='Fustat' } = opts;
      _ctx.font = `${bold ? 'bold ' : ''}${size}px '${font}'`;
      _ctx.fillStyle = color; _ctx.textAlign = align; _ctx.textBaseline = baseline;
      _ctx.fillText(str, x, y);
    },

    measureText(str, size = 14, bold = true) {
      _ctx.font = `${bold ? 'bold ' : ''}${size}px 'Fustat'`;
      return _ctx.measureText(str).width;
    },

    image(key, x, y, w, h) {
      const img = _assets[key];
      if (img) _ctx.drawImage(img, x, y, w ?? img.naturalWidth, h ?? img.naturalHeight);
      else console.warn(`[Interactive] Unknown asset key: '${key}'`);
    },

    sprite(key, sx, sy, sw, sh, dx, dy, dw, dh) {
      const img = _assets[key];
      if (img) _ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    },

    alpha(a, fn) {
      const prev = _ctx.globalAlpha; _ctx.globalAlpha = a; fn(); _ctx.globalAlpha = prev;
    },

    transform(x, y, rot, sx = 1, sy = 1, fn) {
      _ctx.save(); _ctx.translate(x, y); _ctx.rotate(rot); _ctx.scale(sx, sy);
      fn(); _ctx.restore();
    },

    save()    { _ctx.save(); },
    restore() { _ctx.restore(); },
    ctx()     { return _ctx; }, // escape hatch — do anything the 2D API supports
  };

  // ── UI — Declarative DOM component builder ────────────────────────────────
  // For quiz-style or menu-driven games that don't need a canvas at all,
  // just call gfx.clear() in draw() and build your interface with api.ui.
  const UI = {

    // Build a scrollable centered column of components into the game board.
    // Clears any existing DOM UI first.
    build(components) {
      UI.clear();
      const col = document.createElement('div');
      // Scrollable flex column — content will never be clipped by the board height
      col.style.cssText = [
        'position:absolute; inset:0;',
        'display:flex; flex-direction:column; align-items:center;',
        'justify-content:flex-start; overflow-y:auto;',  // scrollable if content is tall
        'gap:8px; padding:16px; box-sizing:border-box;',
        'pointer-events:auto;',
      ].join('');
      for (const def of components) {
        const el = UI._make(def);
        if (el) col.appendChild(el);
      }
      _domLayer.appendChild(col);
      return col;
    },

    clear() { _domLayer.innerHTML = ''; },

    // Retrieve any element built with an id
    get: (id) => document.getElementById(id),

    // Append a raw element to the DOM layer directly
    append(el) {
      el.style.pointerEvents = el.style.pointerEvents || 'auto';
      _domLayer.appendChild(el);
      return el;
    },

    _make(def) {
      switch (def.type) {

        case 'title': {
          const el = document.createElement('div');
          el.className = 'pc-text-title'; el.textContent = def.text;
          if (def.id) el.id = def.id;
          if (def.style) Object.assign(el.style, def.style);
          return el;
        }

        case 'text':
        case 'body': {
          const el = document.createElement('p');
          el.className = 'pc-text-body'; el.textContent = def.text; el.style.margin = '0';
          if (def.id) el.id = def.id;
          if (def.style) Object.assign(el.style, def.style);
          return el;
        }

        case 'button': {
          const el = document.createElement('button');
          el.className = `pc-btn${def.primary ? ' primary' : ''}`;
          el.textContent = def.text;
          if (def.id)      el.id = def.id;
          if (def.onClick) el.onclick = def.onClick;
          if (def.style)   Object.assign(el.style, def.style);
          return el;
        }

        case 'button-row': {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; justify-content:center; width:100%;';
          for (const btn of (def.buttons || [])) {
            const el = UI._make({ type: 'button', ...btn }); if (el) row.appendChild(el);
          }
          return row;
        }

        case 'grid': {
          const grid = document.createElement('div');
          grid.style.cssText = `display:grid; grid-template-columns:repeat(${def.cols||2},1fr); gap:${def.gap??8}px; width:${def.width||'100%'};`;
          if (def.id) grid.id = def.id;
          if (def.style) Object.assign(grid.style, def.style);
          for (const child of (def.children||[])) {
            const el = UI._make(child); if (el) grid.appendChild(el);
          }
          return grid;
        }

        case 'input': {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex; flex-direction:column; gap:4px; width:100%;';
          if (def.label) {
            const lbl = document.createElement('label');
            lbl.className = 'pc-hud-label'; lbl.textContent = def.label;
            wrap.appendChild(lbl);
          }
          const inp = document.createElement('input');
          inp.type = def.inputType || 'text';
          inp.id = def.id || 'pc-input';
          inp.placeholder = def.placeholder || '';
          inp.style.cssText = 'border:1px solid var(--primary-dim); padding:8px; font-family:Fustat; font-size:13px; outline:none; background:#fff; color:#333; width:100%; box-sizing:border-box;';
          inp.onfocus = () => { inp.style.borderColor = 'var(--primary)'; };
          inp.onblur  = () => { inp.style.borderColor = 'var(--primary-dim)'; };
          if (def.onEnter)  inp.addEventListener('keydown', e => { if (e.key === 'Enter') def.onEnter(inp.value); });
          if (def.onChange) inp.addEventListener('input',   () => def.onChange(inp.value));
          wrap.appendChild(inp);
          return wrap;
        }

        case 'progress': {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'width:100%; background:#eee; height:6px; border:1px solid var(--primary-dim);';
          const bar = document.createElement('div');
          bar.id = def.id || 'pc-progress-bar';
          bar.style.cssText = `height:100%; background:var(--primary); width:${(def.value??1)*100}%; transition:width 0.1s linear;`;
          wrap.appendChild(bar);
          return wrap;
        }

        case 'divider': {
          const el = document.createElement('hr');
          el.style.cssText = 'width:100%; border:none; border-top:1px dashed var(--primary-dim); margin:4px 0;';
          return el;
        }

        case 'spacer': {
          const el = document.createElement('div');
          el.style.height = `${def.size ?? 8}px`;
          return el;
        }

        case 'html': {
          const el = document.createElement('div');
          el.style.width = '100%';
          el.innerHTML = def.html;
          if (def.id) el.id = def.id;
          if (def.style) Object.assign(el.style, def.style);
          return el;
        }

        case 'custom':
          return def.el || null;

        default:
          console.warn(`[Interactive] Unknown UI component type: '${def.type}'`);
          return null;
      }
    },
  };

  // ── Overlay helpers ───────────────────────────────────────────────────────
  function _showOverlay(title, desc, btnText, onBtn) {
    document.getElementById('pc-overlay-msg').textContent  = title;
    document.getElementById('pc-overlay-desc').textContent = desc;
    const btn = document.getElementById('pc-overlay-btn');
    btn.textContent = btnText;
    btn.onclick = onBtn;
    document.getElementById('pc-overlay').classList.remove('hidden');
  }

  function _hideOverlay() {
    document.getElementById('pc-overlay').classList.add('hidden');
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  function _startLoop() {
    _lastTime = performance.now();
    _loopId   = requestAnimationFrame(_tick);
  }

  function _stopLoop() {
    if (_loopId) { cancelAnimationFrame(_loopId); _loopId = null; }
  }

  function _tick(now) {
    if (!_scene) return;
    // dt is capped at 100ms to prevent physics explosions after tab switching
    const dt = Math.min((now - _lastTime) / 1000, 0.1);
    _lastTime = now;

    if (_scene.update) _scene.update(dt, input, _api);
    if (_scene.draw)   _scene.draw(GFX, _api);

    // Flush single-frame input flags
    input.pressed       = {};
    input.mouse.clicked = false;

    _loopId = requestAnimationFrame(_tick);
  }

  // ── Scene management ──────────────────────────────────────────────────────
  function _goScene(name) {
    if (!_cart.scenes?.[name]) {
      console.error(`[Interactive] Scene '${name}' not found in '${_cartId}'.`);
      return;
    }
    if (_scene?.exit) _scene.exit(_api);
    UI.clear();
    _scene = _cart.scenes[name];
    if (_scene.enter) _scene.enter(_api);
  }

  // ── API object passed to all lifecycle methods ────────────────────────────
  const _api = {
    W, H,
    ui: UI,
    get assets() { return _assets; },

    scene(name) { _goScene(name); },

    setScore(val) {
      document.getElementById('pc-hud-score').textContent = val;
      const key = `pc_save_${_cartId}`;
      const hi  = parseInt(localStorage.getItem(key) || '0');
      if (typeof val === 'number' && val > hi) localStorage.setItem(key, val);
    },

    setStatus(txt) {
      const el = document.getElementById('pc-hud-status');
      if (el) el.textContent = txt;
    },

    // Secondary HUD — good for level number, lives remaining, time left, etc.
    setLabel(txt) {
      const el = document.getElementById('pc-hud-label2');
      if (!el) return;
      el.textContent    = txt;
      el.style.display  = txt ? 'block' : 'none';
    },

    getHighScore() {
      return parseInt(localStorage.getItem(`pc_save_${_cartId}`) || '0');
    },

    gameOver(msg = 'GAME OVER', sub = '') {
      _stopLoop();
      document.getElementById('pc-hud-status').textContent = 'HALTED';
      _showOverlay(msg, sub || 'Process terminated.', 'RETRY', _boot);
    },

    win(msg = 'COMPLETE', sub = '') {
      _stopLoop();
      document.getElementById('pc-hud-status').textContent = 'COMPLETE';
      _showOverlay(msg, sub, 'PLAY AGAIN', _boot);
    },

    pause() {
      _stopLoop();
      document.getElementById('pc-hud-status').textContent = 'PAUSED';
      _showOverlay('PAUSED', '', 'RESUME', () => {
        _hideOverlay();
        document.getElementById('pc-hud-status').textContent = 'RUNNING';
        _startLoop();
      });
    },
  };

  // ── Boot / restart a game ─────────────────────────────────────────────────
  function _boot() {
    _hideOverlay();
    _api.setScore(0);
    _api.setLabel('');
    _api.setStatus('RUNNING');
    input.pressed = {};
    input.held    = {};
    UI.clear();

    // Pattern A: flat game — wrap onInit/onUpdate/onDraw into an implicit scene
    if (!_cart.scenes) {
      _cart.scenes     = { _: {
        enter:  _cart.onInit   ? api            => _cart.onInit(api)           : null,
        update: _cart.onUpdate ? (dt, inp, api) => _cart.onUpdate(dt, inp, api) : null,
        draw:   _cart.onDraw   ? (gfx, api)     => _cart.onDraw(gfx, api)     : null,
      }};
      _cart.startScene = '_';
    }

    _goScene(_cart.startScene || Object.keys(_cart.scenes)[0]);
    _startLoop();
  }

  // ── Input setup (runs once at engine init) ────────────────────────────────
  function _bindInput() {
    document.addEventListener('keydown', e => {
      if (!_cart) return;
      const k = _keyMap[e.key];
      if (!k) return;
      e.preventDefault();
      if (!input.held[k]) input.pressed[k] = true; // only first-frame
      input.held[k] = true;
      if (k === 'PAUSE') _api.pause();
    });

    document.addEventListener('keyup', e => {
      const k = _keyMap[e.key];
      if (k) input.held[k] = false;
    });

    // Mouse: track cursor in logical canvas coordinates
    _canvas.addEventListener('mousemove', e => {
      const r = _canvas.getBoundingClientRect();
      input.mouse.x = (e.clientX - r.left) * (W / r.width);
      input.mouse.y = (e.clientY - r.top)  * (H / r.height);
    });
    _canvas.addEventListener('mousedown', () => { input.mouse.down = true; });
    _canvas.addEventListener('mouseup',   () => { input.mouse.down = false; input.mouse.clicked = true; });

    // Touch: swipe → direction key, tap → ACTION
    const board = document.querySelector('.pc-game-board');
    if (!board) return;
    let tx = 0, ty = 0;
    board.addEventListener('touchstart', e => { if (!_cart) return; tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; }, { passive: false });
    board.addEventListener('touchend',   e => {
      if (!_cart) return;
      const dx = e.changedTouches[0].screenX - tx;
      const dy = e.changedTouches[0].screenY - ty;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax > 30 || ay > 30) {
        input.pressed[ax > ay ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP')] = true;
      } else {
        input.pressed['ACTION'] = true;
      }
    }, { passive: false });
  }

  // ── Public engine API ─────────────────────────────────────────────────────
  return {

    // Register a game and add its card to the menu grid.
    register(id, cartridge) {
      const slot = document.getElementById('pc-cartridge-slot');
      if (!slot) return;
      const hi   = localStorage.getItem(`pc_save_${id}`) || '—';
      const card = document.createElement('div');
      card.className = 'game-card';
      card.onclick   = () => Interactive.insert(id, cartridge);
      card.innerHTML = `
        <div class="game-card-meta">Module ${id.toUpperCase()}</div>
        <div class="game-card-title">${cartridge.meta.title}</div>
        <p class="text-muted" style="font-size:11px;flex:1;line-height:1.4;margin:0;">${cartridge.meta.desc}</p>
        <div class="game-card-score">RECORD: ${hi}</div>
      `;
      slot.appendChild(card);
    },

    // Navigate from the menu into a game.
    insert(id, cartridge) {
      _cart   = cartridge;
      _cartId = id;

      document.getElementById('pc-menu-view').style.display = 'none';
      const stage = document.getElementById('pc-machine-view');
      stage.style.display = 'block';
      requestAnimationFrame(() => stage.classList.add('active'));

      GFX.clear(); UI.clear();
      document.getElementById('pc-game-title').textContent    = cartridge.meta.title;
      document.getElementById('pc-controls-help').textContent = cartridge.meta.controls || 'ARROWS · SPACE';

      _showOverlay(
        cartridge.meta.title,
        cartridge.meta.instructions || 'Ready to initialize.',
        'INITIALIZE',
        () => _loadAssets(cartridge.assets || {}, _boot)
      );
    },

    // Return to the game menu.
    eject() {
      _stopLoop();
      if (_cart?.onCleanup) _cart.onCleanup();
      _cart = null; _cartId = null; _scene = null;
      UI.clear();
      const stage = document.getElementById('pc-machine-view');
      stage.style.display = 'none';
      stage.classList.remove('active');
      document.getElementById('pc-menu-view').style.display = 'block';
    },

    // Called once on DOMContentLoaded — wires up hardware and loads games.
    init() {
      const slot = document.getElementById('pc-cartridge-slot');
      if (!slot) return;

      _canvas   = document.getElementById('pc-canvas');
      _ctx      = _canvas.getContext('2d');
      _domLayer = document.getElementById('pc-dom-layer');

      // Inject secondary HUD label element (level, lives, etc.) — saved to DOM once
      const scoreCell = document.getElementById('pc-hud-score')?.parentElement;
      if (scoreCell && !document.getElementById('pc-hud-label2')) {
        const el = document.createElement('span');
        el.id = 'pc-hud-label2'; el.className = 'pc-hud-sub'; el.style.display = 'none';
        scoreCell.appendChild(el);
      }

      _bindInput();

      // Load each game file listed in the manifest
      CARTRIDGES.forEach(id => {
        const s = document.createElement('script');
        s.src     = `./interactive/games/${id}.js`;
        s.onerror = () => console.warn(`[Interactive] Failed to load cartridge: ${id}`);
        document.body.appendChild(s);
      });

      setTimeout(() => {
        const loader = document.getElementById('pc-loading');
        if (loader) loader.style.display = 'none';
      }, 600);
    },
  };

})();

// =============================================================================
//  CARTRIDGE MANIFEST  —  add game IDs here, one file per game
//  Each id maps to:  ./interactive/games/{id}.js
// =============================================================================
const CARTRIDGES = [
  'snake',
  'quiz',
  // 'breakout',
  // 'flappy',
];

// Backward-compat alias — the HTML calls PodCubeConsole.eject()
window.PodCubeConsole = Interactive;

document.addEventListener('DOMContentLoaded', Interactive.init);