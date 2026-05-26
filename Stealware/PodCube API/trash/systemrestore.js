// =============================================================================
// SYSTEM RESTORE v6.0 - Definitive Edition
// =============================================================================

const GRID_SIZE = 8;
const UI_HEIGHT = 48;

// Terrain IDs
const T_NULL = 0;
const T_DATA = 1;   // Destructible (Dark Blue)
const T_HARD = 2;   // Indestructible (White)
const T_CODE = 3;   // Player Built (Cyan)
const T_FIRE = 5;   // Hazard (Orange)
const T_CACHE = 6;  // Bonus (Gold)

// Palette
const PALETTE = {
    BG:     '#0a1929',
    DATA:   '#1e3a5f',
    HARD:   '#f0f4f8',
    FIRE:   '#ff5500',
    CODE:   '#00e5ff',
    BIT:    '#ffffff',
    GOLD:   '#ffd700',
    UI_OFF: '#172a45',
    UI_TXT: '#94a3b8',
    UI_DIS: '#0f172a'
};

// Costs for Roles
const COSTS = {
    'WALKER': 0,   'BASHER': 20, 'MINER': 20,
    'BUILDER': 30, 'FLOATER': 15, 'BLOCKER': 10,
    'BOMBER': 5,   'NUKE': 0,    'PAUSE': 0
};

const MAX_FALL_DIST = 70;
const DIG_INTERVAL = 0.12; 

// ─── VISUAL EFFECTS ──────────────────────────────────────────────────────────

class GlitchFragment extends Entity {
    constructor(x, y, color) {
        super(x, y);
        this.vx = PC.rand(-90, 90);
        this.vy = PC.rand(-90, 90);
        this.color = color;
        this.life = 0.5;
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

// ─── DATA PACKET (The Lemming) ───────────────────────────────────────────────

class DataPacket extends Physics.Actor {
    constructor(x, y) {
        super(x, y, GRID_SIZE - 2, GRID_SIZE - 1);
        this.dir = 1; 
        this.speed = 22;
        this.role = 'WALKER';
        this.timer = 0;
        this.actionQuota = 0;
        this.pendingPurge = false;
        this.fallStartY = y;
        this.wasGrounded = false;
        this.bitLabel = Math.random() > 0.5 ? '1' : '0';
        this.flickerTimer = 0;
    }

    // Assign Role (Handles Logic & Economy)
    assignRole(newRole, game) {
        // Free Action: Flip Direction
        if (this.role === newRole) {
            this.flipDirection();
            return true;
        }

        // Paid Action: Buy Tool
        const cost = COSTS[newRole] || 0;
        if (game.cycles < cost) return false; // Too expensive

        game.spendCycles(cost);
        this.role = newRole;
        this.timer = 0;
        this.actionQuota = 0;

        // Role Stats
        if (newRole === 'BUILDER') this.actionQuota = 5;
        if (newRole === 'BASHER')  this.actionQuota = 15;
        if (newRole === 'MINER')   this.actionQuota = 15;
        if (newRole === 'BOMBER')  this.timer = 0.2; 

        // Stop moving if it's a stationary role
        this.z = (newRole !== 'WALKER') ? 10 : 0;
        if (['BLOCKER', 'BUILDER', 'BOMBER', 'MINER'].includes(newRole)) {
            this.vx = 0;
            this.remainderX = 0; 
        }
        return true;
    }

    flipDirection() {
        this.dir *= -1;
        if (this.role === 'WALKER') this.vx = this.dir * this.speed; 
    }

    update(dt, input, game) {
        const world = game.world;
        
        // Visual Flicker
        this.flickerTimer += dt;
        if (this.flickerTimer > 0.15) {
            this.bitLabel = this.bitLabel === '1' ? '0' : '1';
            this.flickerTimer = 0;
        }

        // 1. Environmental Triggers
        const gridX = world.toGrid(this.x + this.w / 2);
        const gridY = world.toGrid(this.y + this.h + 1);
        const tileUnder = world.get(gridX, gridY);

        if (tileUnder === T_FIRE) { this.terminate(game, false); return; }
        if (tileUnder === T_CACHE) {
            world.set(gridX, gridY, T_NULL);
            game.secureBonus();
        }

        // 2. Entity Collision (Blockers)
        const neighbors = game.collideAll(this, DataPacket);
        for (const other of neighbors) {
            if (other.role === 'BLOCKER') {
                if ((this.x < other.x && this.dir > 0) || (this.x > other.x && this.dir < 0)) this.flipDirection();
            }
        }

        if (this.pendingPurge && this.role !== 'BOMBER') this.assignRole('BOMBER', game);

        // 3. Role Logic
        if (this.role === 'WALKER' || this.role === 'FLOATER') {
            this.vx = this.dir * this.speed;
        } else if (this.role === 'BASHER') {
            this.vx = this.dir * (this.speed * 0.6);
            const wallX = world.toGrid(this.dir > 0 ? this.x + this.w + 1 : this.x - 1);
            const wallY = world.toGrid(this.y + 4);
            const tFront = world.get(wallX, wallY);
            // Bash through Data, Cache, or Code
            if (tFront === T_DATA || tFront === T_CACHE || tFront === T_CODE) {
                 world.set(wallX, wallY, T_NULL);
                 game.spawnEffects(wallX*GRID_SIZE, wallY*GRID_SIZE, PALETTE.DATA);
                 this.actionQuota -= (dt * 2); 
            } else if (tFront === T_HARD) { 
                this.flipDirection(); this.role = 'WALKER'; 
            }
            if (this.actionQuota <= 0) this.role = 'WALKER';
        } else if (this.role === 'MINER') {
            this.vx = 0; 
            this.timer += dt;
            if (this.timer > DIG_INTERVAL) {
                this.timer = 0;
                const gx = world.toGrid(this.x + this.w / 2);
                const gy = world.toGrid(this.y + this.h + 1);
                const tBelow = world.get(gx, gy);
                if (tBelow === T_DATA || tBelow === T_CACHE || tBelow === T_CODE) {
                    world.set(gx, gy, T_NULL);
                    game.spawnEffects(gx*GRID_SIZE, gy*GRID_SIZE, PALETTE.DATA);
                    this.actionQuota--;
                    if (this.actionQuota <= 0) this.role = 'WALKER';
                } else { this.role = 'WALKER'; }
            }
        } else if (this.role === 'BUILDER') {
            this.vx = 0;
            this.timer -= dt;
            if (this.timer <= 0) {
                if (this.actionQuota > 0) {
                    if (this.executeBuild(world)) {
                        this.actionQuota--;
                        this.timer = 0.5; 
                    } else { this.role = 'WALKER'; }
                } else { this.role = 'WALKER'; }
            }
        } else if (this.role === 'BOMBER') {
            this.vx = 0;
            this.timer -= dt;
            if (this.timer <= 0) { this.executePurge(world, game); this.destroy(); return; }
        }

        const intendedDir = this.dir;
        const wasMoving = (this.role === 'WALKER' || this.role === 'BASHER');
        this.updatePhysics(dt, world, 600);

        // 4. Wall Interaction
        if (wasMoving && this.vx === 0) {
            const sideX = world.toGrid(intendedDir > 0 ? this.x + this.w + 1 : this.x - 1);
            const sideY = world.toGrid(this.y + this.h / 2);
            // Die on firewall impact
            if (world.get(sideX, sideY) === T_FIRE) { this.terminate(game, false); return; }

            // Auto-step up 1 block
            if (this.grounded && this.checkStepUp(world, intendedDir)) {
                this.y -= GRID_SIZE; this.x += intendedDir * 2; this.vx = intendedDir * this.speed;
            } else { 
                // Bounce
                this.dir = -intendedDir; this.vx = this.dir * (this.role === 'WALKER' ? this.speed : this.speed * 0.5); 
            }
        }

        // 5. Fall Damage
        if (!this.wasGrounded && this.grounded) {
            if (this.y - this.fallStartY > MAX_FALL_DIST && this.role !== 'FLOATER') { this.terminate(game, true); return; }
        }
        if (this.grounded) this.fallStartY = this.y;
        this.wasGrounded = this.grounded;
    }

    executeBuild(world) {
        const gx = world.toGrid(this.x + this.w / 2);
        const gy = world.toGrid(this.y + this.h - 1);
        // Smart Build: Fill gap below first (Safety platform)
        if (world.get(gx, gy + 1) === T_NULL) { world.set(gx, gy + 1, T_CODE); return true; }
        
        const tx = gx + this.dir;
        if (world.get(tx, gy) !== T_NULL || world.get(tx, gy - 1) !== T_NULL) return false;
        world.set(tx, gy, T_CODE);
        this.x = (tx * GRID_SIZE); this.y = (gy * GRID_SIZE) - this.h - 0.1;
        this.vx = 0; this.remainderX = 0;
        return true;
    }

    checkStepUp(world, d) {
        const gx = world.toGrid(d > 0 ? this.x + this.w + 1 : this.x - 1);
        const gy = world.toGrid(this.y + this.h - 1);
        const spaceAboveWall = world.get(gx, gy - 1) === T_NULL;
        const spaceAboveSelf = world.get(world.toGrid(this.x + this.w / 2), gy - 1) === T_NULL;
        return world.get(gx, gy) > 0 && spaceAboveWall && spaceAboveSelf;
    }

    executePurge(world, game) {
        const cx = world.toGrid(this.x + this.w / 2);
        const cy = world.toGrid(this.y + this.h / 2);
        // Explosion radius
        for (let y = cy - 2; y <= cy + 2; y++) {
            for (let x = cx - 2; x <= cx + 2; x++) {
                if (x <= 0 || x >= world.cols - 1 || y <= 0 || y >= world.rows - 1) continue;
                if (world.get(x, y) !== T_HARD) world.set(x, y, T_NULL);
            }
        }
        game.spawnEffects(this.x, this.y, PALETTE.FIRE);
    }

    terminate(game, fx) { if (fx) game.spawnEffects(this.x, this.y, PALETTE.BIT); this.destroy(); }

    draw(gfx) {
        const colors = { 'WALKER': PALETTE.BIT, 'FLOATER': PALETTE.CODE, 'BLOCKER': PALETTE.FIRE, 'BUILDER': PALETTE.HARD, 'BASHER': '#ff00ff', 'MINER': '#00ff00' };
        let c = colors[this.role] || PALETTE.BIT;
        if (this.role === 'BOMBER') c = (this.timer * 5) % 2 > 1 ? PALETTE.BG : PALETTE.FIRE;
        gfx.rect(this.x, this.y, this.w, this.h, c);
        const eyeX = this.dir > 0 ? this.x + 4 : this.x;
        gfx.rect(eyeX, this.y+1, 2, 2, PALETTE.BG);
        gfx.text(this.bitLabel, this.x + 1, this.y - 2, {size: 6, color: PALETTE.CODE});
    }
}

class UploadPort extends Entity {
    constructor(x, y) { super(x, y); this.w=24; this.h=24; }
    update(dt, input, game) {
        const arrivals = game.collideAll(this, DataPacket);
        arrivals.forEach(p => { p.destroy(); game.securePacket(); game.spawnEffects(this.x+10, this.y+10, PALETTE.GOLD); });
    }
    draw(gfx) {
        const glow = Math.abs(Math.sin(Date.now()/200)) * 0.5;
        gfx.rect(this.x, this.y, this.w, this.h, `rgba(79, 195, 247, ${0.2 + glow})`);
        gfx.rect(this.x+6, this.y+6, 8, 8, PALETTE.BIT);
        gfx.text('UPLOAD', this.x-2, this.y-5, {size: 6, color: PALETTE.BIT});
    }
}

// ─── GAME CONTROLLER ─────────────────────────────────────────────────────────

class SystemRestoreGame extends Game {
    static meta = {
        id: "system-restore",
        title: "System Restore v6.0",
        desc: "Definitive Edition. Tactical Data Routing.",
        instructions: "[1-9] Buy Tool | [CLICK IN] Inject | [SPACE] Pause & Plan"
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
        PAUSE: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    };

    static getIconUrl(name, color = 'white') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${SystemRestoreGame.ICONS[name]}</svg>`;
        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    onInit() {
        this.score = 0; this.selectedTool = 'WALKER'; this.isPaused = false;
        this.cycles = 100;
        this.glitchTimer = 0;
        this.level = this.api.getData('level') || 1;
        const carryOver = this.api.getData('bonus_carry') || 0;
        this.packetQueue = 12 + Math.floor(this.level * 1.5) + carryOver;
        this.cycles += (this.level * 25);
        this.api.saveData('bonus_carry', 0);

        const gridH = this.api.H - UI_HEIGHT;
        this.world = new Physics.World(Math.ceil(this.api.W / GRID_SIZE), Math.ceil(gridH / GRID_SIZE), GRID_SIZE);
        
        this.setupLevel();
        this.buildUI();
        
        this.keyHandler = (e) => {
            const tools = ['WALKER','BASHER','MINER','BUILDER','FLOATER','BLOCKER','BOMBER','NUKE','PAUSE'];
            if(e.key === ' ' || e.key === 'p') { this.selectTool('PAUSE'); return; }
            const idx = parseInt(e.key) - 1;
            if (idx >= 0 && idx < tools.length) this.selectTool(tools[idx]);
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    onCleanup() { window.removeEventListener('keydown', this.keyHandler); }

    setupLevel() {
        const cols = this.world.cols; const rows = this.world.rows;
        this.spawnPos = { x: 40, y: 40 };
        this.add(new UploadPort((cols - 8) * GRID_SIZE, (rows - 10) * GRID_SIZE));

        // 1. Organic Terrain (Cellular Automata)
        const density = 0.52 + (Math.random() * 0.13);
        for (let i = 0; i < this.world.data.length; i++) this.world.data[i] = Math.random() < density ? T_NULL : T_DATA;

        // Smooth it out
        for (let iter = 0; iter < 4; iter++) {
            const nextData = new Uint8Array(this.world.data);
            for (let y = 1; y < rows - 1; y++) {
                for (let x = 1; x < cols - 1; x++) {
                    let neighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.world.get(x + dx, y + dy) !== T_NULL) neighbors++;
                    if (neighbors > 4) nextData[y * cols + x] = T_DATA; else if (neighbors < 4) nextData[y * cols + x] = T_NULL;
                }
            }
            this.world.data = nextData;
        }

        // 2. Corruption Clusters (Firewall Patches)
        const numClusters = 5 + (this.level); 
        for(let i=0; i<numClusters; i++) {
            let cx = PC.randInt(10, cols-10);
            let cy = PC.randInt(10, rows-10);
            const size = PC.randInt(2, 5);
            for(let j=0; j<size*3; j++) {
                cx += PC.randInt(-1, 1);
                cy += PC.randInt(-1, 1);
                if (cx > 0 && cx < cols && cy > 0 && cy < rows) {
                    if (this.world.get(cx, cy) !== T_HARD) this.world.set(cx, cy, T_FIRE);
                }
            }
        }

        // 3. Bonus Caches (+Cycles)
        const numCaches = PC.randInt(2, 4);
        for(let i=0; i<numCaches; i++) {
            let placed = false; let attempts = 0;
            while(!placed && attempts < 50) {
                const x = PC.randInt(5, cols-5); const y = PC.randInt(5, rows-5);
                if (this.world.get(x,y) === T_NULL && this.world.get(x, y+1) !== T_NULL) {
                    this.world.set(x, y, T_CACHE); placed = true;
                }
                attempts++;
            }
        }

        // Borders & Spawner Insurance
        for (let y = 0; y < rows; y++) { this.world.set(0, y, T_HARD); this.world.set(cols - 1, y, T_HARD); }
        for (let x = 0; x < cols; x++) { this.world.set(x, 0, T_HARD); this.world.set(x, rows - 1, T_FIRE); }

        const sgx = this.world.toGrid(this.spawnPos.x); 
        const sgy = this.world.toGrid(this.spawnPos.y);
        
        // Clear small shaft
        for(let y=sgy; y<sgy+8; y++) {
            this.world.set(sgx, y, T_NULL); this.world.set(sgx-1, y, T_NULL);
        }
        // Force Platform exactly 4 blocks down (Safety)
        const platY = sgy + 4;
        this.world.set(sgx-1, platY, T_HARD); 
        this.world.set(sgx, platY, T_HARD); 
        this.world.set(sgx+1, platY, T_HARD);
    }

    selectTool(id) {
        if (id === 'PAUSE') this.isPaused = !this.isPaused;
        else if (id === 'NUKE') this.entities.forEach(e => { if (e instanceof DataPacket) e.pendingPurge = true; });
        else this.selectedTool = id;
        this.updateUI();
    }

    spendCycles(amt) {
        this.cycles -= amt;
        this.updateUI(); 
    }

    handleBoardClick(x, y) {
        // 1. Check for entity interaction (Allow this even when PAUSED!)
        const hit = this.entities.slice().reverse().find(e => e instanceof DataPacket && this.api.pointInEntity(x, y, e, 6));
        if (hit) {
            if (hit.assignRole(this.selectedTool, this)) {
                this.spawnEffects(hit.x, hit.y, PALETTE.BIT);
            } else {
                // Failed assignment (no cash)
                this.spawnEffects(hit.x, hit.y, PALETTE.FIRE);
            }
            return;
        }
        
        // 2. Check for Spawner Click (Only if NOT paused)
        if (!this.isPaused) {
            const sX = this.spawnPos.x; const sY = this.spawnPos.y;
            if (x >= sX-15 && x <= sX+15 && y >= sY-15 && y <= sY+15 && this.packetQueue > 0) {
                this.add(new DataPacket(sX, sY)); 
                this.packetQueue--;
                this.spawnEffects(sX, sY, PALETTE.CODE);
            }
        }
    }

    securePacket() { 
        this.score += 1000; 
        this.cycles += 50; 
        this.api.setScore(this.score); 
        this.updateUI();
    }
    secureBonus() { 
        this.score += 500; 
        this.cycles += 100; 
        this.api.setScore(this.score); 
        this.spawnEffects(this.spawnPos.x, this.spawnPos.y, PALETTE.GOLD); 
        this.updateUI();
    }
    spawnEffects(x, y, color) { for(let i=0; i<5; i++) this.add(new GlitchFragment(x, y, color)); }

    update(dt, input) {
        const effectiveDt = this.isPaused ? 0 : dt;
        
        // Allow clicking even when paused
        if (input.mouse.clicked && input.mouse.y < this.api.H - UI_HEIGHT) {
            this.handleBoardClick(input.mouse.x, input.mouse.y);
        }

        super.update(effectiveDt, input);
        this.glitchTimer += dt;
        
        const activeCount = this.entities.filter(e => e instanceof DataPacket).length;
        this.api.setLabel(`CPU: ${this.cycles}¢ | QUEUE: ${this.packetQueue} | ACTIVE: ${activeCount}`);
        
        if (this.packetQueue === 0 && activeCount === 0) {
            if (this.score > 0) { 
                this.api.saveData('level', this.level + 1); 
                // Carry over excess cycles (capped)
                const carry = Math.min(50, Math.floor(this.cycles / 10));
                this.api.saveData('bonus_carry', carry);
                this.api.newStage(`CLEARED`, `Score: ${this.score}\nCycles Left: ${this.cycles}`, "NEXT SECTOR", () => this.onInit()); 
            } else { this.api.gameOver("SYSTEM FAILURE"); }
        }
    }

    buildUI() {
        const tools = [
            {id:'WALKER',lbl:'PING',col:PALETTE.CODE}, {id:'BASHER',lbl:'HACK',col:'#f0f'},
            {id:'MINER',lbl:'MINE',col:'#0f0'},        {id:'BUILDER',lbl:'LINK',col:PALETTE.HARD},
            {id:'FLOATER',lbl:'FLOAT',col:PALETTE.BIT},{id:'BLOCKER',lbl:'HALT',col:PALETTE.FIRE},
            {id:'BOMBER',lbl:'PURGE',col:'#f00'},      {id:'NUKE',lbl:'RESET',col:'#555'},
            {id:'PAUSE',lbl:'STOP',col:PALETTE.BIT}
        ];
        
        this.api.UI.build([
            {type:'spacer',size:this.api.H-UI_HEIGHT+2},
            {type:'grid',cols:9,gap:0,children:tools.map((t,idx)=>({
                type:'button',
                id:`btn-${t.id}`,
                text:`${t.lbl}\n[${idx+1}]\n${COSTS[t.id]}¢`,
                style:{
                    fontSize:'8px', fontWeight:'bold', paddingTop:'10px', height:'42px',
                    backgroundColor:PALETTE.UI_OFF, color:PALETTE.UI_TXT,
                    border:'1px solid #334155', whiteSpace:'pre', textAlign:'center',
                    cursor:'pointer', margin:'0px', paddingLeft:'0px', paddingRight:'0px',
                    transition:'all 0.2s ease', backgroundImage:SystemRestoreGame.getIconUrl(t.id,t.col),
                    backgroundRepeat:'no-repeat', backgroundPosition:'center 3px', backgroundSize:'10px 10px'
                },
                onClick:()=>this.selectTool(t.id)
            }))}
        ]);
        this.updateUI();
    }

    updateUI() {
        const toolMap = {
            'WALKER': PALETTE.CODE, 'BASHER': '#f0f', 'MINER': '#0f0',
            'BUILDER': PALETTE.HARD, 'FLOATER': PALETTE.BIT, 'BLOCKER': PALETTE.FIRE,
            'BOMBER': '#f00', 'NUKE': '#555', 'PAUSE': PALETTE.BIT
        };

        ['WALKER','BASHER','MINER','BUILDER','FLOATER','BLOCKER','BOMBER','NUKE','PAUSE'].forEach(id=>{
            const btn=this.api.UI.get(`btn-${id}`); if(!btn) return;
            const active=(this.selectedTool===id)||(id==='PAUSE'&&this.isPaused);
            const canAfford = this.cycles >= COSTS[id];
            
            // Base state
            if (active) {
                btn.style.backgroundColor = toolMap[id]; 
                btn.style.color = '#000';
                btn.style.borderTop = `3px solid ${PALETTE.GOLD}`;
                btn.style.filter = 'brightness(1.2)';
            } else if (!canAfford && id !== 'NUKE' && id !== 'PAUSE') {
                // Disabled state
                btn.style.backgroundColor = PALETTE.UI_DIS;
                btn.style.color = '#334155'; // Dark grey text
                btn.style.borderTop = '1px solid #1e293b';
                btn.style.filter = 'grayscale(1)';
            } else {
                // Inactive state
                btn.style.backgroundColor = PALETTE.UI_OFF;
                btn.style.color = PALETTE.UI_TXT;
                btn.style.borderTop = '1px solid #475569';
                btn.style.filter = 'none';
            }
        });
    }

    draw(gfx) {
        gfx.clear(PALETTE.BG);
        for(let x=0; x<this.world.cols; x+=2) {
            if (Math.sin(this.glitchTimer + x*0.2) > 0.97) {
                for(let y=0; y<this.world.rows; y+=2) {
                    if (this.world.get(x,y) === T_NULL) {
                        gfx.text(Math.random()>.5?'1':'0', x*GRID_SIZE+2, y*GRID_SIZE+6, {size:6, color:'rgba(0, 229, 255, 0.05)'});
                    }
                }
            }
        }

        for (let y = 0; y < this.world.rows; y++) {
            for (let x = 0; x < this.world.cols; x++) {
                const t = this.world.get(x, y); const px = x * GRID_SIZE; const py = y * GRID_SIZE;
                if (t === T_DATA) { 
                    gfx.rect(px, py, GRID_SIZE, GRID_SIZE, PALETTE.DATA); 
                    if ((x+y)%2===0) gfx.text(Math.random()>.5?'1':'0', px+1, py+6, {size:6, color: 'rgba(255,255,255,0.08)'});
                }
                else if (t === T_HARD) gfx.rect(px, py, GRID_SIZE, GRID_SIZE, PALETTE.HARD);
                else if (t === T_CODE) gfx.rect(px, py, GRID_SIZE, GRID_SIZE, PALETTE.CODE);
                else if (t === T_CACHE) { gfx.circle(px+4, py+4, 3, PALETTE.GOLD); gfx.text('$', px+2, py+6, {size:6, color:PALETTE.BG}); }
                else if (t === T_FIRE) { 
                    const c = (Math.sin(this.glitchTimer*15 + x) > 0) ? PALETTE.FIRE : '#b03c00';
                    gfx.rect(px, py, GRID_SIZE, GRID_SIZE, c); 
                }
            }
        }
        gfx.rect(this.spawnPos.x-10, this.spawnPos.y-10, 20, 20, PALETTE.HARD);
        gfx.text("IN", this.spawnPos.x, this.spawnPos.y+5, {size:10, color:PALETTE.BG, align:'center', bold:true});
        gfx.rect(0, this.api.H-UI_HEIGHT, this.api.W, UI_HEIGHT, PALETTE.BG);
        gfx.line(0, this.api.H-UI_HEIGHT, this.api.W, this.api.H-UI_HEIGHT, PALETTE.CODE, 1);
        super.draw(gfx);
    }
}

Interactive.register(SystemRestoreGame);