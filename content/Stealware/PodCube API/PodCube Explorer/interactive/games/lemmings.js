// =============================================================================
// POD-LEMMINGS: REDUX (Refactored & Optimized)
// =============================================================================

const TILE = 8;
const UI_HEIGHT = 40;
const T_AIR = 0;
const T_DIRT = 1;
const T_METAL = 2;
const T_RAMP_R = 3;
const T_RAMP_L = 4;
const T_LAVA = 5;
const T_GOLD = 6;

const MAX_FALL_HEIGHT = 65;
const DIG_SPEED = 0.15;

class Splat extends Entity {
    constructor(x, y) {
        super(x, y + 2);
        this.w = 6; this.h = 2;
        this.color = '#c0392b';
        this.timer = 10.0;
        this.z = -10;
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) this.destroy();
    }
    draw(gfx) {
        gfx.rect(this.x, this.y, this.w, this.h, this.color);
        gfx.rect(this.x - 2, this.y - 1, 1, 1, this.color);
        gfx.rect(this.x + 4, this.y, 1, 1, this.color);
        gfx.rect(this.x + 8, this.y - 1, 1, 1, this.color);
    }
}

class Lemming extends Physics.Actor {
    constructor(x, y) {
        super(x, y, TILE - 2, TILE - 1);
        this.color = '#00ff00';
        this.dir = 1;
        this.speed = 20;
        this.role = 'WALKER';

        this.timer = 0;
        this.actionCount = 0;
        this.nuke = false;

        this.fallStartY = y;
        this.wasGrounded = false;
        this.z = 0;
    }

    setRole(role) {
        // Toggle direction if clicking an existing walker
        if (role === 'WALKER' && this.role === 'WALKER') {
            this.dir *= -1;
            this.vx = this.dir * this.speed;
            return;
        }

        if (this.role === role) return;
        this.role = role;
        this.timer = 0;
        this.actionCount = 0;

        // Role Constraints
        if (role === 'BUILDER') this.actionCount = 5;
        if (role === 'BASHER') this.actionCount = 10;
        if (role === 'MINER') this.actionCount = 10;
        if (role === 'BOMBER') this.timer = 3.0;

        // 1. Z-Index Management (Trigger sort in Game loop if needed)
        this.z = (role !== 'WALKER') ? 10 : 0;

        // 2. Physics Reset for Stationary Roles
        if (['BLOCKER', 'BUILDER', 'BOMBER', 'MINER'].includes(role)) {
            this.vx = 0;
            this.remainderX = 0; // Clear sub-pixel accumulator to prevent drift
        }
    }

    update(dt, input, game) {
        const world = game.world;

        // --- 1. Environmental Hazards ---
        // Check center-bottom point for lava/gold
        const cx = this.x + this.w / 2;
        const bottomY = this.y + this.h + 1; 
        const gx = world.toGrid(cx);
        const gy = world.toGrid(bottomY);
        const t = world.get(gx, gy);

        if (t === T_LAVA) {
            this.die(game, false);
            return;
        } else if (t === T_GOLD) {
            world.set(gx, gy, T_AIR);
            game.collectBonus();
        }

        // --- 2. Entity Collision (Blockers) ---
        const others = game.collideAll(this, Lemming);
        for (const other of others) {
            if (other.role === 'BLOCKER') {
                // Only turn around if we are moving TOWARDS the blocker
                if (this.x < other.x && this.dir > 0) {
                    this.dir = -1;
                    this.vx = this.dir * this.speed; // Apply immediately
                } else if (this.x > other.x && this.dir < 0) {
                    this.dir = 1;
                    this.vx = this.dir * this.speed; // Apply immediately
                }
            }
        }

        // --- 3. Nuke Logic ---
        if (this.nuke && this.role !== 'BOMBER') {
            this.setRole('BOMBER');
            this.timer = Math.random(); 
        }

        // --- 4. Role Logic ---
        if (this.role === 'WALKER' || this.role === 'FLOATER') {
            this.vx = this.dir * this.speed;
        }
        else if (this.role === 'BASHER') {
            this.vx = this.dir * (this.speed * 0.5);
            
            const wallX = world.toGrid(this.x + this.w/2 + (this.dir * (TILE/2)));
            const headY = world.toGrid(this.y + 4);
            const tFront = world.get(wallX, headY);
            
            if (tFront === T_DIRT || tFront === T_GOLD) {
                 world.set(wallX, headY, T_AIR);
                 // Only decrement on valid dig
                 this.actionCount -= (dt * 2); 
            } else if (tFront === T_METAL) {
                 this.dir *= -1; 
                 this.setRole('WALKER');
            }
            if (this.actionCount <= 0) this.setRole('WALKER');
        }
        else if (this.role === 'MINER') {
            this.vx = 0; // STOP moving horizontally
            this.remainderX = 0;

            this.timer += dt;
            if (this.timer > DIG_SPEED) {
                this.timer = 0;
                const res = this.performMine(world);

                if (res === 'DIG') {
                    this.actionCount--;
                    // Optional: Increase actionCount in setRole if you want them to dig deeper/forever
                    if (this.actionCount <= 0) this.setRole('WALKER');
                } else if (res === 'FLOOR') {
                    // Hit steel or lava
                    this.setRole('WALKER');
                }
            }
        }
        else if (this.role === 'BUILDER') {
            this.vx = 0;
            this.timer -= dt;
            if (this.timer <= 0) {
                if (this.actionCount > 0) {
                    const res = this.performBuild(world);
                    if (res === 'BUILT') {
                        this.actionCount--;
                        this.timer = 0.6;
                    } else if (res === 'BLOCKED') {
                        this.dir *= -1;
                        this.setRole('WALKER');
                    }
                } else {
                    this.setRole('WALKER');
                }
            }
        }
        else if (this.role === 'BOMBER') {
            this.vx = 0;
            this.timer -= dt;
            if (this.timer <= 0) {
                this.explode(world);
                this.destroy();
                return;
            }
        }
        else if (this.role === 'BLOCKER') {
            this.vx = 0; // Force stop every frame to fight gravity drift
        }

        // --- 5. Physics Integration ---
        this.wasGrounded = this.grounded;
        
        // Floater Cap
        if (this.role === 'FLOATER' && this.vy > 30) {
            this.vy = 30;
            this.fallStartY = this.y; 
        }
        
        this.updatePhysics(dt, world, 600);

        // Fall Damage
        if (!this.wasGrounded && this.grounded) {
            const fallDist = this.y - this.fallStartY;
            if (fallDist > MAX_FALL_HEIGHT && this.role !== 'FLOATER') {
                this.die(game, true); return;
            }
        }
        if (this.grounded) this.fallStartY = this.y;

        // Auto-Climb (Walker/Floater)
        if ((this.role === 'WALKER' || this.role === 'FLOATER') && Math.abs(this.vx) > 1 && this.grounded) {
            if (this.canStepUp(world)) {
                this.y -= TILE;
                this.x += this.dir * 2;
            } else if (this.vx === 0) { 
                // We hit a wall (vx became 0 in updatePhysics)
                this.dir *= -1; 
            }
        }
    }

    die(game, splat) {
        if (splat) game.add(new Splat(this.x, this.y));
        this.destroy();
    }

    canStepUp(world) {
        const gx = world.toGrid(this.x + this.w / 2);
        const gy = world.toGrid(this.y + this.h - 1);
        const frontX = gx + this.dir;
        // Check if the tile in front is solid, but the one above it is empty
        return world.get(frontX, gy) > 0 && world.get(frontX, gy - 1) === T_AIR && world.get(gx, gy - 1) === T_AIR;
    }

    performMine(world) {
        const cx = this.x + this.w / 2;
        const cy = this.y + this.h + 2; // Probe point just below feet
        const gx = world.toGrid(cx);
        const gy = world.toGrid(cy);

        // Check the tile directly below
        const tDig = world.get(gx, gy);

        // Hit metal or lava? Stop.
        if (tDig === T_METAL || tDig === T_LAVA) return 'FLOOR';

        // Dig the hole
        world.set(gx, gy, T_AIR);

        // (Optional) Dig the tile above it too if you want to ensure they don't get stuck on pixel edges
        // world.set(gx, gy - 1, T_AIR); 

        return 'DIG';
    }

    performBuild(world) {
        const gx = world.toGrid(this.x + this.w / 2);
        const gy = world.toGrid(this.y + this.h - 0.1);
        const targetX = gx + this.dir;
        const headY = gy - 1; 
        const aboveY = gy - 2;

        if (world.get(targetX, gy) === T_METAL || 
            world.get(targetX, headY) === T_METAL || 
            world.get(targetX, aboveY) === T_METAL) return 'BLOCKED';

        if (world.get(targetX, headY) === T_LAVA) return 'BLOCKED';

        // Clear space
        if (world.get(targetX, headY) === T_DIRT) world.set(targetX, headY, T_AIR);
        if (world.get(gx, headY) === T_DIRT) world.set(gx, headY, T_AIR); 
        if (world.get(targetX, aboveY) === T_DIRT) world.set(targetX, aboveY, T_AIR); 

        const type = this.dir > 0 ? T_RAMP_R : T_RAMP_L;
        
        if (world.get(targetX, gy) !== T_METAL) {
             world.set(targetX, gy, type);
        }

        // Snap to new ramp
        this.x = (targetX * TILE) + (this.dir > 0 ? 0 : 2);
        this.y = (gy * TILE) - this.h - 0.01;
        
        // CRITICAL FIX: Reset physics accumulators to prevent teleportation
        this.vx = 0; 
        this.vy = 0; 
        this.remainderX = 0; 
        this.remainderY = 0;
        
        return 'BUILT';
    }

    explode(world) {
        const cx = world.toGrid(this.x + this.w / 2);
        const cy = world.toGrid(this.y + this.h / 2);
        const r = 2; 
        for (let y = cy - r; y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                if (x <= 0 || x >= world.cols - 1 || y <= 0 || y >= world.rows - 1) continue;
                world.set(x, y, T_AIR);
            }
        }
    }

    draw(gfx) {
        const colors = {
            'WALKER': '#2ecc71', 'FLOATER': '#3498db', 'BLOCKER': '#fbff00ff',
            'BUILDER': '#ecf0f1', 'BASHER': '#e67e22', 'MINER': '#9b59b6'
        };
        let c = colors[this.role] || '#fff';
        if (this.role === 'BOMBER') c = (this.timer * 5) % 2 > 1 ? '#222' : '#e74c3c';

        gfx.rect(this.x, this.y, this.w, this.h, c);
        const eyeX = this.dir > 0 ? this.x + this.w - 2 : this.x;
        gfx.rect(eyeX, this.y + 1, 2, 2, '#000');

        if (this.role === 'FLOATER') {
            gfx.rect(this.x - 2, this.y - 2, this.w + 4, 2, '#fff');
            gfx.rect(this.x + 2, this.y - 2, 1, 4, '#fff');
        }
        if (this.role === 'MINER') {
            // Draw pickaxe below them instead of in front
            gfx.rect(this.x + this.w / 2 - 1, this.y + this.h, 2, 3, '#999');
        }
    }
}

class Goal extends Entity {
    constructor(x, y) {
        super(x, y);
        this.w = 20;
        this.h = 20;
    }

    update(dt, input, game) {
        const arrivals = game.collideAll(this, Lemming);
        arrivals.forEach(lemming => {
            lemming.destroy();
            game.score++;
            game.api.setScore(game.score);
        });
    }

    draw(gfx) {
        gfx.rect(this.x, this.y, this.w, this.h, 'rgba(0, 255, 255, 0.3)');
        gfx.rect(this.x + 5, this.y + 5, this.w - 10, this.h - 10, '#0ff');
    }
}


class LemmingsGame extends Game {

    static meta = {
        id: "lemmings",
        title: "Delegation Assessment",
        desc: "Program the q-bits to tunnel through spacetime. Collect stray data. Avoid firewalls.",
        instructions: "Roles are limited. Plan your route.\nTap WALKER to flip direction.\nGrab golden user-data bytes.\nToggle Fast Forward with >>."
    };

    static ICONS = {
        WALKER: '<path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>',
        BASHER: '<path d="M10 12h11M10 12l4-4m-4 4l4 4M3 6v12"/>',
        MINER: '<path d="M19 5L5 19m0 0h9m-9 0v-9"/>',
        BUILDER: '<path d="M2 20h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4v-4h4"/>',
        FLOATER: '<path d="M12 22V10m0 0l-5 5m5-5l5 5M4 8h16c0-4-4-6-8-6S4 4 4 8z"/>',
        BLOCKER: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8"/>',
        BOMBER: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3-7l-2 2m-10 10l-2 2m0-14l2 2m10 10l2 2"/>',
        NUKE: '<path d="M21 4H3m2 0l1 16a2 2 0 002 2h10a2 2 0 002-2l1-16M9 9v8m6-8v8M9 4V2h6v2"/>',
        FF: '<path d="M2 18L10 12L2 6V18ZM11 18L19 12L11 6V18ZM22 6V18"/>'
    };

    static getIconUrl(name, color = 'white') {
        const content = LemmingsGame.ICONS[name] || '';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    onInit() {
        this.score = 0; 
        this.bonusLemmings = 0; 
        this.selectedTool = 'WALKER';
        this.isFastForward = false;

        const savedLvl = this.api.getData('level');
        const savedCount = this.api.getData('count');

        this.level = savedLvl || 1;
        this.totalPool = (savedCount !== null) ? savedCount : 20; 
        
        const gridH = this.api.H - UI_HEIGHT;
        const cols = Math.ceil(this.api.W / TILE);
        const rows = Math.ceil(gridH / TILE);
        this.world = new Physics.World(cols, rows, TILE);

        this.inventory = {
            'WALKER': Infinity, 'FLOATER': 10, 'BLOCKER': 10,
            'BASHER': 10, 'MINER': 10, 'BUILDER': 10, 'BOMBER': 5
        };

        this.generateHiveLevel(cols, rows);
        this.buildUI(); // Build once at start

        this.spawnTimer = 0;
        this.lemmingsCount = this.totalPool;

        this.api.setStatus(`LEVEL ${this.level}`);
        this.api.setLabel(`UNITS: ${this.lemmingsCount}`);
    }

    collectBonus() {
        this.bonusLemmings += 5;
    }

    generateHiveLevel(cols, rows) {
        this.spawnX = PC.randInt(10, cols - 10) * TILE;
        this.spawnY = 15;
        const spawnCol = Math.floor(this.spawnX / TILE);
        
        let goalCol = PC.randInt(5, cols - 10);
        if (Math.abs(goalCol * TILE - this.spawnX) < 100) goalCol = (goalCol + Math.floor(cols / 2)) % (cols - 10);
        const goalRow = rows - 7;
        const goalX = goalCol * TILE;
        const goalY = goalRow * TILE;
        this.add(new Goal(goalX, goalY));

        const density = 0.52 + (Math.random() * 0.13);
        for (let i = 0; i < this.world.data.length; i++) this.world.data[i] = Math.random() < density ? T_AIR : T_DIRT;

        for (let iter = 0; iter < 4; iter++) {
            const nextData = new Uint8Array(this.world.data);
            for (let y = 1; y < rows - 1; y++) {
                for (let x = 1; x < cols - 1; x++) {
                    let neighbors = 0;
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++)
                            if (this.world.get(x + dx, y + dy) !== T_AIR) neighbors++;
                    if (neighbors > 4) nextData[y * cols + x] = T_DIRT;
                    else if (neighbors < 4) nextData[y * cols + x] = T_AIR;
                }
            }
            this.world.data = nextData;
        }

        const numScraps = 5 + PC.randInt(0, 10);
        for (let i = 0; i < numScraps; i++) {
            if (Math.random() > 0.5) {
                const w = PC.randInt(4, 12); const x = PC.randInt(2, cols - w - 2); const y = PC.randInt(5, rows - 5);
                for (let k = 0; k < w; k++) this.world.set(x + k, y, T_METAL);
            } else {
                const h = PC.randInt(4, 12); const x = PC.randInt(5, cols - 5); const y = PC.randInt(5, rows - h - 5);
                for (let k = 0; k < h; k++) this.world.set(x, y + k, T_METAL);
            }
        }

        const numFirewalls = PC.randInt(3, 7);
        for (let i = 0; i < numFirewalls; i++) {
            const h = PC.randInt(5, 12); const x = PC.randInt(10, cols - 10); const y = PC.randInt(10, rows - h - 10);
            if (Math.abs(x - spawnCol) < 6 || Math.abs(x - goalCol) < 6) continue;
            for (let k = 0; k < h; k++) if (this.world.get(x, y + k) !== T_METAL) this.world.set(x, y + k, T_LAVA);
        }

        const numGold = PC.randInt(1, 3);
        for (let i = 0; i < numGold; i++) {
            let placed = false;
            while (!placed) {
                const x = PC.randInt(5, cols - 5); const y = PC.randInt(5, rows - 5);
                const t = this.world.get(x, y);
                if (t !== T_METAL && t !== T_LAVA) { this.world.set(x, y, T_GOLD); placed = true; }
            }
        }

        for (let y = Math.floor(rows / 2); y < rows - 2; y++) {
            for (let x = 2; x < cols - 2; x++) {
                if (Math.random() > 0.1) continue;
                if (Math.abs(x - spawnCol) < 3 || Math.abs(x - goalCol) < 3) continue;
                if (this.world.get(x, y) === T_AIR && this.world.get(x, y + 1) !== T_AIR) {
                    const width = PC.randInt(1, 3);
                    let safe = true;
                    for (let k = 0; k < width; k++) if (this.world.get(x + k, y + 1) === T_AIR || this.world.get(x + k, y) !== T_AIR) safe = false;
                    if (safe) for (let k = 0; k < width; k++) this.world.set(x + k, y, T_LAVA);
                }
            }
        }

        for (let y = 0; y < rows; y++) { this.world.set(0, y, T_METAL); this.world.set(cols - 1, y, T_METAL); }
        for (let x = 0; x < cols; x++) { this.world.set(x, 0, T_METAL); }
        for (let x = 1; x < cols - 1; x++) this.world.set(x, rows - 1, T_LAVA);

        this.forcePlatform(this.spawnX, this.spawnY + 30, 6, T_METAL);
        this.forceClear(this.spawnX, this.spawnY, 4, 4);
        this.forcePlatform(goalX, goalY + 20, 6, T_METAL);
        this.forceClear(goalX, goalY, 4, 4);
    }

    forcePlatform(px, py, wTiles, type) {
        const gx = this.world.toGrid(px); const gy = this.world.toGrid(py); const startX = gx - Math.floor(wTiles / 2);
        for (let x = 0; x < wTiles; x++) if (startX + x > 0 && startX + x < this.world.cols - 1) this.world.set(startX + x, gy, type);
    }
    forceClear(px, py, w, h) {
        const gx = this.world.toGrid(px); const gy = this.world.toGrid(py);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.world.set(gx + x, gy + y, T_AIR);
    }

    buildUI() {
        const tools = [
            { id: 'WALKER',  lbl: 'PING', col: '#2ecc71' },
            { id: 'BASHER',  lbl: 'HACK', col: '#e67e22' },
            { id: 'MINER',   lbl: 'MINE', col: '#9b59b6' },
            { id: 'BUILDER', lbl: 'UPLINK', col: '#7f8c8d' },
            { id: 'FLOATER', lbl: 'BUFFER', col: '#3498db' },
            { id: 'BLOCKER', lbl: 'HALT', col: '#aca900ff' },
            { id: 'BOMBER',  lbl: 'CRASH', col: '#ff0101ff' },
            { id: 'NUKE',    lbl: '\nABORT', col: '#c0392b' },
            { id: 'FF',      lbl: '>>',  col: '#000' }
        ];

        this.api.UI.build([
            { type: 'spacer', size: this.api.H - UI_HEIGHT + 2 },
            {
                type: 'grid', cols: 9, gap: 1, 
                children: tools.map(t => {
                    const count = this.inventory[t.id];
                    let label = t.lbl;
                    if (count !== undefined && count !== Infinity) label = `${count}\n${label}`;
                    else if (count === Infinity) label = `∞\n${label}`;

                    // Set initial look, but logic moves to updateUI
                    return {
                        type: 'button', 
                        id: `btn-${t.id}`, // NEW: ID for DOM access
                        text: label,
                        style: {
                            fontSize: '6px', paddingTop: '16px', paddingLeft: '0px', paddingRight: '0px',
                            height: '32px', backgroundColor: t.col, color: '#fff',
                            border: '1px solid #222',
                            whiteSpace: 'pre', textAlign: 'center', lineHeight: '6px', cursor: 'pointer',
                            backgroundImage: LemmingsGame.getIconUrl(t.id, 'rgba(255,255,255,0.5)'), 
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'center 4px', backgroundSize: '10px 10px'
                        },
                        onClick: () => {
                            if (t.id === 'NUKE') this.nukeAll();
                            else if (t.id === 'FF') { this.isFastForward = !this.isFastForward; this.updateUI(); }
                            else { this.selectedTool = t.id; this.updateUI(); }
                        }
                    };
                })
            }
        ]);
        
        // Apply initial selection state
        this.updateUI();
    }
    
    // NEW: Efficiently updates buttons without destroying the DOM
    updateUI() {
        const toolDefs = [
            { id: 'WALKER',  lbl: 'PING' },
            { id: 'BASHER',  lbl: 'HACK' },
            { id: 'MINER',   lbl: 'MINE' },
            { id: 'BUILDER', lbl: 'UPLINK' },
            { id: 'FLOATER', lbl: 'BUFFER' },
            { id: 'BLOCKER', lbl: 'HALT' },
            { id: 'BOMBER',  lbl: 'CRASH' },
            { id: 'NUKE',    lbl: '\nABORT' },
            { id: 'FF',      lbl: '>>' }
        ];
        
        toolDefs.forEach(t => {
            const btn = this.api.UI.get(`btn-${t.id}`);
            if (!btn) return;
            
            // 1. Update Text
            const count = this.inventory[t.id];
            let label = t.lbl;
            if (count !== undefined && count !== Infinity) label = `${count}\n${label}`;
            else if (count === Infinity) label = `∞\n${label}`;
            btn.textContent = label;
            
            // 2. Update Selection State
            const isSelected = this.selectedTool === t.id;
            const isFF = t.id === 'FF' && this.isFastForward;
            const active = isSelected || isFF;
            
            btn.style.borderColor = active ? '#fff' : '#222';
            btn.style.color = (t.id === 'FF' && active) ? '#0f0' : '#fff';
            
            const iconColor = active ? '#fff' : 'rgba(255,255,255,0.5)';
            btn.style.backgroundImage = LemmingsGame.getIconUrl(t.id, iconColor);
        });
    }

    nukeAll() {
        this.lemmingsCount = 0;
        this.spawnTimer = Infinity;
        this.entities.forEach(e => { if (e instanceof Lemming) e.nuke = true; });
    }

    update(dt, input) {
        const steps = this.isFastForward ? 3 : 1;

        for (let s = 0; s < steps; s++) {
            if (this.lemmingsCount > 0) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.add(new Lemming(this.spawnX + 10, this.spawnY + 10));
                    this.lemmingsCount--;
                    this.spawnTimer = 2.0;
                }
            }

            // Performance: Removed entity sort from inner loop
            super.update(dt, input);
        }
        
        // Sort once per frame (outside the FF loop)
        this.entities.sort((a, b) => a.z - b.z);

        let aliveCount = 0;
        let activeCount = 0;
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            if (e instanceof Lemming) {
                aliveCount++;
                if (!e.dead) activeCount++;
            }
        }

        let label = `UNITS: ${this.lemmingsCount + activeCount}`;
        if (this.bonusLemmings > 0) label += ` (+${this.bonusLemmings})`;
        this.api.setLabel(label);

        // --- INPUT ---
        if (input.mouse.clicked) {
            if (input.mouse.y < this.api.H - UI_HEIGHT) {
                const hit = this.entities.slice().reverse().find(e =>
                    e instanceof Lemming &&
                    this.api.pointInEntity(input.mouse.x, input.mouse.y, e, 6)
                );

                if (hit) {
                    if (hit.role === this.selectedTool) {
                        hit.dir *= -1;
                        if (['WALKER', 'BASHER', 'MINER', 'FLOATER'].includes(hit.role)) {
                            hit.vx = hit.dir * (hit.role === 'WALKER' ? hit.speed : hit.speed * 0.5);
                        }
                    } else if (this.inventory[this.selectedTool] > 0) {
                        hit.setRole(this.selectedTool);
                        if (this.inventory[this.selectedTool] !== Infinity) {
                            this.inventory[this.selectedTool]--;
                            this.updateUI(); // Efficient update
                        }
                    }
                }
            }
        }

        // --- GAME END LOGIC ---
        if (this.lemmingsCount === 0 && activeCount === 0) {
            if (this.score > 0) {
                const nextTotal = this.score + this.bonusLemmings;
                this.api.saveData('level', this.level + 1);
                this.api.saveData('count', nextTotal);

                let msg = `SURVIVORS: ${this.score}`;
                if (this.bonusLemmings > 0) msg += `\nRECOVERED: +${this.bonusLemmings}`;
                msg += `\n\nUNITS FOR NEXT LEVEL: ${nextTotal}`;

                this.api.newStage( `LEVEL ${this.level} COMPLETE`, msg, "PROCEED", () => { this.onInit(); });
            } else {
                this.api.saveData('level', 1);
                this.api.saveData('count', 20);
                this.api.gameOver("COLONY LOST");
            }
        }
    }

    draw(gfx) {
        gfx.clear('#22345cff');
        const ctx = gfx.ctx();

        for (let y = 0; y < this.world.rows; y++) {
            for (let x = 0; x < this.world.cols; x++) {
                const t = this.world.get(x, y);
                const px = x * TILE;
                const py = y * TILE;

                if (t === T_DIRT) gfx.rect(px, py, TILE, TILE, (x + y) % 2 === 0 ? '#2b658bff' : '#418397ff');
                else if (t === T_METAL) gfx.rect(px, py, TILE, TILE, '#b8b8b8ff');
                else if (t === T_GOLD) gfx.rect(px, py, TILE, TILE, '#f1c40f');
                else if (t === T_LAVA) {
                    const c = (Date.now() / 300) % 2 > 1 ? '#c0392b' : '#e74c3c';
                    gfx.rect(px, py, TILE, TILE, c);
                }
                else if (t === T_RAMP_R) {
                    ctx.fillStyle = '#bdc3c7'; ctx.beginPath();
                    ctx.moveTo(px, py + TILE); ctx.lineTo(px + TILE, py + TILE); ctx.lineTo(px + TILE, py);
                    ctx.fill();
                }
                else if (t === T_RAMP_L) {
                    ctx.fillStyle = '#bdc3c7'; ctx.beginPath();
                    ctx.moveTo(px, py); ctx.lineTo(px, py + TILE); ctx.lineTo(px + TILE, py + TILE);
                    ctx.fill();
                }
            }
        }

        gfx.rect(0, this.api.H - UI_HEIGHT, this.api.W, UI_HEIGHT, '#222');
        gfx.line(0, this.api.H - UI_HEIGHT, this.api.W, this.api.H - UI_HEIGHT, '#1768da', 2);
        gfx.rect(this.spawnX - 5, this.spawnY - 10, 10, 10, '#fff');

        super.draw(gfx);
    }
}

Interactive.register(LemmingsGame);