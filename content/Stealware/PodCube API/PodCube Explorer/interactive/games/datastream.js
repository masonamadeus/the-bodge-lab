//
// =============================================================================
// SECTOR 7: DATA STREAM (Refactored Logic)
// =============================================================================

const TILE = 8;
const UI_HEIGHT = 40;

// TERRAIN TYPES
const T_NULL = 0;      // Empty
const T_DATA = 1;      // Diggable (Blue)
const T_HARD = 2;      // Indestructible (White)
const T_CODE_R = 3;    // Ramp R
const T_CODE_L = 4;    // Ramp L
const T_FIREWALL = 5;  // Kill (Orange)
const T_PACKET = 6;    // Bonus Bits (Orange Pickup)

const MAX_FALL = 75;

// PALETTE (High Contrast Cyberspace)
const COL_BG     = '#0a1929'; 
const COL_DATA   = '#334e68'; 
const COL_HARD   = '#f0f4f8'; 
const COL_FIRE   = '#ff6d00'; 
const COL_CODE   = '#4fc3f7'; 
const COL_BIT    = '#ffffff'; 
const COL_BIT_ACTIVE = '#ffd700'; 
const COL_PACKET = '#ff9100'; 

// =============================================================================
// ENTITIES
// =============================================================================

class Fragment extends Entity {
    constructor(x, y, color) {
        super(x, y);
        this.vx = PC.rand(-60, 60);
        this.vy = PC.rand(-60, 60);
        this.color = color;
        this.life = 0.8;
        this.z = 50; 
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.destroy();
    }
    draw(gfx) {
        gfx.rect(this.x, this.y, 2, 2, this.color);
    }
}

class Bit extends Physics.Actor {
    constructor(x, y) {
        super(x, y, 6, 7); 
        this.color = COL_BIT;
        this.dir = 1; 
        this.speed = 20;
        this.job = 'STREAM'; 
        
        this.jobTimer = 0;
        this.jobCount = 0;
        this.nukeTriggered = false;

        this.fallStartY = y;
        this.wasGrounded = false;
        this.z = 10;
        this.label = Math.random() > 0.5 ? '1' : '0';
        this.flicker = 0;
    }

    assignJob(newJob) {
        if (newJob === 'STREAM' && this.job === 'STREAM') {
            this.dir *= -1;
            this.vx = this.dir * this.speed;
            return;
        }
        if (this.job === newJob || this.dead) return;
        this.job = newJob;
        this.jobTimer = 0;
        this.remainderX = 0;
        this.remainderY = 0;
        
        if (newJob === 'PATCH') this.jobCount = 5;  
        if (newJob === 'BRUTE') this.jobCount = 0;  
        if (newJob === 'DRILL') this.jobCount = 0;  
        if (newJob === 'GLITCH') this.jobTimer = 3.0; 

        if (['MUTEX', 'PATCH', 'GLITCH'].includes(newJob)) this.vx = 0;
        this.z = 20;
    }

    update(dt, input, game) {
        if (this.dead) return; 
        const world = game.world;

        // Visuals
        this.flicker += dt;
        if (this.flicker > 0.15) {
            this.label = this.label === '1' ? '0' : '1';
            this.flicker = 0;
        }

        // Environment Check
        const cx = this.x + this.w/2;
        const cy = this.y + this.h; 
        const gx = world.toGrid(cx);
        const gy = world.toGrid(cy + 1); 
        
        const floorTile = world.get(gx, gy);
        if (floorTile === T_FIREWALL) { this.corrupt(game); return; }
        
        // Pickups
        const cgx = world.toGrid(this.x + this.w/2);
        const cgy = world.toGrid(this.y + this.h/2);
        if (world.get(cgx, cgy) === T_PACKET) {
            world.set(cgx, cgy, T_NULL);
            game.collectPacket();
            game.spawnFragments(cgx*TILE, cgy*TILE, COL_PACKET);
        }

        // --- PRE-PHYSICS LOGIC ---
        if (this.nukeTriggered && this.job !== 'GLITCH') {
            this.assignJob('GLITCH');
            this.jobTimer = Math.random(); 
        }

        switch (this.job) {
            case 'STREAM':
            case 'BUFFER':
                this.vx = this.dir * this.speed;
                // STEP UP LOGIC:
                // If we are grounded, and moving, check if we are blocked ahead but clear above.
                if (this.grounded) {
                    const nextX = this.x + (this.dir * 2); 
                    if (world.overlap(nextX, this.y, this.w, this.h)) {
                        // Wall ahead. Is it a step?
                        if (!world.overlap(nextX, this.y - TILE, this.w, this.h)) {
                            this.y -= TILE;
                            this.x += this.dir;
                        }
                    }
                }
                break;
            case 'MUTEX':
                this.vx = 0; 
                break;
            case 'BRUTE': 
                this.vx = this.dir * (this.speed * 0.4); 
                const wallX = world.toGrid(this.x + this.w/2 + (this.dir * 4));
                const wallY = world.toGrid(this.y + 4);
                const tFront = world.get(wallX, wallY);
                if (tFront === T_DATA || tFront === T_PACKET) {
                    world.set(wallX, wallY, T_NULL); 
                    game.spawnFragments(wallX*TILE, wallY*TILE, COL_DATA);
                } else if (tFront === T_HARD || tFront === T_FIREWALL) {
                    this.dir *= -1; 
                    this.assignJob('STREAM');
                } 
                break;
            case 'DRILL': 
                this.vx = 0;
                this.jobTimer += dt;
                if (this.jobTimer > 0.15) { 
                    this.jobTimer = 0;
                    const dGx = world.toGrid(this.x + this.w/2);
                    const dGy = world.toGrid(this.y + this.h + 1);
                    const tBelow = world.get(dGx, dGy);
                    if (tBelow === T_DATA || tBelow === T_PACKET) {
                        world.set(dGx, dGy, T_NULL);
                        game.spawnFragments(dGx*TILE, dGy*TILE, COL_DATA);
                    } else if (tBelow === T_HARD || tBelow === T_FIREWALL) {
                        this.assignJob('STREAM');
                    } else if (tBelow === T_NULL) {
                        this.assignJob('STREAM'); 
                    }
                }
                break;
            case 'PATCH': 
                this.vx = 0;
                this.jobTimer -= dt;
                if (this.jobTimer <= 0) {
                    if (this.jobCount > 0) {
                        if (this.compileCode(world)) {
                            this.jobCount--;
                            this.jobTimer = 0.5;
                        } else {
                            this.dir *= -1;
                            this.assignJob('STREAM');
                        }
                    } else {
                        this.assignJob('STREAM');
                    }
                }
                break;
            case 'GLITCH': 
                this.vx = 0;
                this.jobTimer -= dt;
                if (this.jobTimer <= 0) this.triggerGlitch(game);
                break;
        }

        // --- PHYSICS ---
        const wasMoving = this.vx !== 0;
        this.wasGrounded = this.grounded;
        
        if (this.job === 'BUFFER' && this.vy > 20) {
            this.vy = 20; 
            this.fallStartY = this.y; 
        }

        this.updatePhysics(dt, world, 600);

        // --- POST-PHYSICS LOGIC ---
        // If we wanted to move but Physics stopped us (vx became 0), we hit a wall.
        if (wasMoving && this.vx === 0) {
            this.dir *= -1; // Flip
            this.vx = this.dir * this.speed; // Visual feedback
        }

        if (this.grounded && !this.wasGrounded) {
            if (this.y - this.fallStartY > MAX_FALL && this.job !== 'BUFFER') {
                this.corrupt(game);
                return;
            }
            this.fallStartY = this.y;
            if (['BRUTE', 'DRILL', 'PATCH'].includes(this.job)) this.assignJob('STREAM');
        }
    }
    
    compileCode(world) {
        const gx = world.toGrid(this.x + this.w/2);
        const gy = world.toGrid(this.y + this.h - 1);
        const tx = gx + this.dir;
        const ty = gy - 1; 
        if (world.get(tx, ty) !== T_NULL) return false;
        const block = this.dir > 0 ? T_CODE_R : T_CODE_L;
        world.set(tx, gy, block); 
        this.x = (tx * TILE) + (this.dir > 0 ? 0 : 2);
        this.y = (gy * TILE) - this.h - 0.1;
        this.vx = 0; this.vy = 0; this.remainderX = 0; this.remainderY = 0;
        return true;
    }

    triggerGlitch(game) {
        const cx = Math.floor((this.x + this.w/2)/TILE);
        const cy = Math.floor((this.y + this.h/2)/TILE);
        for(let y=cy-2; y<=cy+2; y++) {
            for(let x=cx-2; x<=cx+2; x++) {
                if (x>0 && x<game.world.cols-1 && y>0 && y<game.world.rows-1) {
                    if (game.world.get(x,y) !== T_HARD) {
                        game.world.set(x,y, T_NULL);
                        if (Math.random() > 0.5) game.spawnFragments(x*TILE, y*TILE, COL_BIT);
                    }
                }
            }
        }
        game.spawnFragments(this.x, this.y, COL_FIRE);
        this.destroy();
    }

    corrupt(game) {
        game.spawnFragments(this.x, this.y, COL_FIRE);
        this.destroy();
    }

    draw(gfx) {
        let c = this.job === 'STREAM' ? COL_BIT : COL_BIT_ACTIVE;
        if (this.job === 'GLITCH') c = (this.jobTimer * 10) % 2 > 1 ? COL_BIT : COL_FIRE;

        gfx.rect(this.x, this.y, this.w, this.h, c);
        const eyeX = this.dir > 0 ? this.x + 4 : this.x;
        gfx.rect(eyeX, this.y+1, 2, 2, COL_BG);
        gfx.text(this.label, this.x + 1, this.y - 2, {size: 6, color: COL_CODE});
        
        if (this.job === 'BUFFER') gfx.rect(this.x-1, this.y-2, 8, 2, COL_BIT_ACTIVE); 
        if (this.job === 'MUTEX') gfx.rect(this.x, this.y, this.w, this.h, `rgba(255,145,0,0.3)`); 
        if (this.job === 'DRILL') gfx.rect(this.x+2, this.y+this.h, 2, 3, COL_BIT_ACTIVE); 
    }
}

class UploadPort extends Entity {
    constructor(x, y) {
        super(x, y);
        this.w = 24; this.h = 24;
        this.timer = 0;
    }
    update(dt, input, game) {
        this.timer += dt;
        const bits = game.collideAll(this, Bit);
        bits.forEach(b => {
            if (!b.dead) {
                game.saveBit();
                b.destroy();
            }
        });
    }
    draw(gfx) {
        const glow = Math.abs(Math.sin(this.timer * 4)) * 0.5;
        gfx.rect(this.x, this.y, this.w, this.h, `rgba(79, 195, 247, ${0.2 + glow})`);
        gfx.rect(this.x+8, this.y+8, 8, 8, COL_BIT);
        gfx.text('UPLOAD', this.x-2, this.y-5, {size: 6, color: COL_BIT});
    }
}

// =============================================================================
// GAME CONTROLLER
// =============================================================================

class DataStreamGame extends Game {

    static meta = {
        id: "lemmings", // Overwrites slot
        title: "DATA STREAM",
        desc: "Guide packets to the upload port.\nCollect Orange Packets for bonus units.",
        instructions: "Tap tools to assign functions.\n→ STREAM: Walk  |  ↓ DRILL: Dig Down\n✕ MUTEX: Block  |  ↗ PATCH: Build"
    };

    onInit() {
        this.score = 0;
        this.savedCount = 0;
        this.bonusBits = 0; 
        
        this.level = this.api.getData('level') || 1;
        const carryOver = this.api.getData('bonus_carry') || 0;
        this.totalBits = 20 + (this.level * 2) + carryOver;
        this.api.saveData('bonus_carry', 0);
        
        const gridH = this.api.H - UI_HEIGHT;
        const cols = Math.ceil(this.api.W / TILE);
        const rows = Math.ceil(gridH / TILE);
        this.world = new Physics.World(cols, rows, TILE);
        
        this.tools = [
            { id: 'STREAM', lbl: '→',   name: 'WALK',  cost: 0 },
            { id: 'BRUTE',  lbl: '⇶',   name: 'BASH',  cost: 10 },
            { id: 'DRILL',  lbl: '↓',   name: 'DIG',   cost: 10 },
            { id: 'PATCH',  lbl: '↗',   name: 'BLD',   cost: 10 },
            { id: 'BUFFER', lbl: '∿',   name: 'FLOAT', cost: 10 },
            { id: 'MUTEX',  lbl: '✕',   name: 'HALT',  cost: 10 },
            { id: 'GLITCH', lbl: '✷',   name: 'BOMB',  cost: 5 },
            { id: 'NUKE',   lbl: '☢',   name: 'NUKE',  cost: 0 },
            { id: 'FF',     lbl: '>>',  name: 'FAST',  cost: 0 }
        ];
        
        this.inventory = {};
        this.tools.forEach(t => this.inventory[t.id] = t.cost > 0 ? 5 : Infinity);
        this.selectedTool = 'STREAM';
        this.isFastForward = false;

        this.genLevel(cols, rows);
        this.buildUI();
        
        this.spawnTimer = 0;
        this.bitsToSpawn = this.totalBits;
        
        this.api.setStatus(`SECTOR ${this.level}`);
        this.updateLabel();
    }

    genLevel(cols, rows) {
        // Fill
        for(let i=0; i<this.world.data.length; i++) this.world.data[i] = Math.random() < 0.4 ? T_DATA : T_NULL;
        
        // Smooth
        for(let k=0; k<4; k++) {
            const next = new Uint8Array(this.world.data);
            for(let y=1; y<rows-1; y++) {
                for(let x=1; x<cols-1; x++) {
                    let n = 0;
                    for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++) if(this.world.get(x+dx, y+dy) !== T_NULL) n++;
                    if(n > 4) next[y*cols+x] = T_DATA; else if(n < 4) next[y*cols+x] = T_NULL;
                }
            }
            this.world.data = next;
        }
        
        // Borders
        for(let x=0; x<cols; x++) { this.world.set(x, 0, T_HARD); this.world.set(x, rows-1, T_FIREWALL); }
        for(let y=0; y<rows; y++) { this.world.set(0, y, T_HARD); this.world.set(cols-1, y, T_HARD); }

        // Spawn/Goal
        this.spawnX = 40; this.spawnY = 40;
        this.clearArea(5, 5, 6, 6);
        this.world.set(5, 8, T_HARD); this.world.set(6, 8, T_HARD);
        
        const goalCol = cols - 8; const goalRow = rows - 10;
        this.clearArea(goalCol, goalRow, 6, 6);
        this.world.set(goalCol, goalRow+3, T_HARD); this.world.set(goalCol+1, goalRow+3, T_HARD);
        this.add(new UploadPort(goalCol*TILE, goalRow*TILE));
        
        // Hazards & Bonus
        for(let i=0; i<8; i++) this.world.set(PC.randInt(10, cols-10), PC.randInt(10, rows-10), T_FIREWALL);
        
        const numPackets = PC.randInt(1, 3);
        for(let i=0; i<numPackets; i++) {
            let placed = false;
            while(!placed) {
                const px = PC.randInt(10, cols-10); const py = PC.randInt(10, rows-10);
                if (this.world.get(px, py) === T_NULL && this.world.get(px, py+1) !== T_NULL) {
                    this.world.set(px, py, T_PACKET); placed = true;
                }
            }
        }
    }
    
    clearArea(gx, gy, w, h) {
        for(let y=gy; y<gy+h; y++) for(let x=gx; x<gx+w; x++) this.world.set(x, y, T_NULL);
    }

    buildUI() {
        this.api.UI.build([
            { type: 'spacer', size: this.api.H - UI_HEIGHT + 2 },
            { 
                type: 'grid', cols: 9, gap: 1,
                children: this.tools.map(t => ({
                    type: 'button', id: `tool-${t.id}`, text: t.lbl,
                    style: {
                        fontSize: '12px', height: '32px', padding: '0',
                        fontFamily: 'monospace', lineHeight: '10px',
                        background: COL_BG, border: `1px solid ${COL_DATA}`, color: COL_CODE,
                        whiteSpace: 'pre'
                    },
                    onClick: () => this.selectTool(t.id)
                }))
            }
        ]);
        this.refreshButtons();
    }
    
    selectTool(id) {
        if (id === 'NUKE') { this.bitsToSpawn = 0; this.entities.forEach(e => { if(e instanceof Bit) e.nukeTriggered = true; }); return; }
        if (id === 'FF') { this.isFastForward = !this.isFastForward; this.refreshButtons(); return; }
        this.selectedTool = id; this.refreshButtons();
    }
    
    refreshButtons() {
        this.tools.forEach(t => {
            const btn = this.api.UI.get(`tool-${t.id}`);
            if (!btn) return;
            const count = this.inventory[t.id];
            const display = count === Infinity ? '∞' : count;
            btn.textContent = `${t.lbl}\n${display}`;
            const active = (this.selectedTool === t.id) || (t.id === 'FF' && this.isFastForward);
            btn.style.borderColor = active ? COL_BIT_ACTIVE : COL_DATA;
            btn.style.color = active ? COL_BIT_ACTIVE : COL_CODE;
        });
    }

    update(dt, input) {
        const iterations = this.isFastForward ? 3 : 1;
        for(let i=0; i<iterations; i++) {
            if (this.bitsToSpawn > 0) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.add(new Bit(this.spawnX, this.spawnY));
                    this.bitsToSpawn--;
                    this.spawnTimer = 1.0;
                    this.updateLabel();
                }
            }
            if (i === 0 && input.mouse.clicked && input.mouse.y < this.api.H - UI_HEIGHT) this.handleInput(input.mouse.x, input.mouse.y);
            super.update(dt, input);
            this.handleCollisions();
        }
        const activeBits = this.entities.filter(e => e instanceof Bit && !e.dead).length;
        if (this.bitsToSpawn === 0 && activeBits === 0) this.endLevel();
    }
    
    handleInput(mx, my) {
        for(let i=this.entities.length-1; i>=0; i--) {
            const e = this.entities[i];
            if (e instanceof Bit && !e.dead && this.api.pointInEntity(mx, my, e, 6)) {
                if (this.selectedTool === 'STREAM' && e.job === 'STREAM') { e.assignJob('STREAM'); return; }
                if (this.inventory[this.selectedTool] > 0) {
                    e.assignJob(this.selectedTool);
                    if (this.inventory[this.selectedTool] !== Infinity) { this.inventory[this.selectedTool]--; this.refreshButtons(); }
                }
                return; 
            }
        }
    }
    
    handleCollisions() {
        const bits = this.entities.filter(e => e instanceof Bit && !e.dead);
        const mutexes = bits.filter(e => e.job === 'MUTEX');
        if (mutexes.length === 0) return;
        for (const b of bits) {
            if (b.job === 'MUTEX' || b.vx === 0) continue; 
            for (const m of mutexes) {
                if (b === m) continue;
                if (Math.abs(b.x - m.x) < 6 && Math.abs(b.y - m.y) < 6) {
                    if (b.x < m.x && b.dir > 0) { b.dir = -1; b.vx = b.dir * b.speed; }
                    if (b.x > m.x && b.dir < 0) { b.dir = 1;  b.vx = b.dir * b.speed; }
                }
            }
        }
    }

    spawnFragments(x, y, color) { for(let i=0; i<5; i++) this.add(new Fragment(x, y, color)); }
    saveBit() { this.savedCount++; this.score += 100; this.updateLabel(); }
    collectPacket() { this.bonusBits += 10; this.score += 500; this.updateLabel(); }
    updateLabel() { let txt = `QUEUE: ${this.bitsToSpawn} | SAVED: ${this.savedCount}`; if (this.bonusBits > 0) txt += ` | BONUS: +${this.bonusBits}`; this.api.setLabel(txt); this.api.setScore(this.score); }
    
    endLevel() {
        if (this.savedCount > 0) {
            this.api.saveData('level', this.level + 1);
            this.api.saveData('bonus_carry', this.bonusBits);
            this.api.newStage("DATA UPLOAD COMPLETE", `Packets Saved: ${this.savedCount}\nCollected Bonus: ${this.bonusBits}`, "NEXT SECTOR", () => this.onInit());
        } else {
            this.api.gameOver("CONNECTION LOST\nZero packets survived.");
        }
    }

    draw(gfx) {
        gfx.clear(COL_BG);
        const ctx = gfx.ctx();
        for(let y=0; y<this.world.rows; y++) {
            for(let x=0; x<this.world.cols; x++) {
                const t = this.world.get(x,y);
                const px = x*TILE; const py = y*TILE;
                if (t === T_DATA) { gfx.rect(px, py, TILE, TILE, COL_DATA); gfx.text(Math.random()>.5?'1':'0', px+1, py+6, {size:6, color: 'rgba(255,255,255,0.1)'}); }
                else if (t === T_HARD) gfx.rect(px, py, TILE, TILE, COL_HARD);
                else if (t === T_FIREWALL) gfx.rect(px, py, TILE, TILE, Math.random()>.8?COL_FIRE:'#b03c00');
                else if (t === T_PACKET) { gfx.circle(px+4, py+4, 3, COL_PACKET); gfx.text('+', px+2, py+6, {size:6, color:'#fff'}); }
                else if (t === T_CODE_R) { ctx.fillStyle = COL_CODE; ctx.beginPath(); ctx.moveTo(px, py+TILE); ctx.lineTo(px+TILE, py+TILE); ctx.lineTo(px+TILE, py); ctx.fill(); }
                else if (t === T_CODE_L) { ctx.fillStyle = COL_CODE; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py+TILE); ctx.lineTo(px+TILE, py+TILE); ctx.fill(); }
            }
        }
        gfx.rect(0, this.api.H - UI_HEIGHT, this.api.W, 1, COL_BIT_ACTIVE);
        super.draw(gfx);
    }
}

Interactive.register(DataStreamGame);