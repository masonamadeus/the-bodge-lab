// =============================================================================
// PROTOCOL: DASH (The Chaos Update)
// =============================================================================

(() => {
    // ─── CONFIGURATION ───────────────────────────────────────────────────────
    const TILE = 20;
    const COLS = 20; // 400px width
    const ROWS = 15; // 300px height

    const T_SAFE = 0;
    const T_VOID = 1;

    const PALETTE = {
        BG:     '#02060d', // Deep Void
        VOID:   '#051021', // River color
        SAFE:   '#162a3e', // Safe floor
        ISLAND: '#274b73', // Center Spawn Island
        FIRE:   '#ff3300aa', // Hazard
        TRACK:  '#ff0055', // Chaser
        RAFT:   '#00e5ff', // Moving safe platform
        CODE:   '#00e5ff', 
        BIT:    '#8de6fcff', 
        GOLD:   '#ffd700',
        PORT:   '#7affb2ff'
    };

    // ─── VISUAL EFFECTS ──────────────────────────────────────────────────────

    class GlitchParticle extends Entity {
        constructor(x, y, color, speed = 150) {
            super(x, y);
            this.vx = PC.rand(-speed, speed);
            this.vy = PC.rand(-speed, speed);
            this.color = color;
            this.life = PC.rand(0.3, 0.7);
            this.z = 100; 
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;
            if (this.life <= 0) this.destroy();
        }
        draw(gfx) { gfx.rect(this.x, this.y, 3, 3, this.color); }
    }

    class GhostTrail extends Entity {
        constructor(x, y, w, h) {
            super(x, y);
            this.w = w; this.h = h;
            this.life = 0.2;
            this.z = 40; 
        }
        update(dt) {
            this.life -= dt;
            if (this.life <= 0) this.destroy();
        }
        draw(gfx) {
            gfx.rect(this.x, this.y, this.w, this.h, `rgba(0, 229, 255, ${this.life * 2})`);
        }
    }

    class WarningPing extends Entity {
        constructor(x, y) {
            super(x, y);
            this.timer = 1.0;
            this.z = 15;
        }
        update(dt) {
            this.timer -= dt;
            if (this.timer <= 0) this.destroy();
        }
        draw(gfx) {
            const r = (1 - this.timer) * 50;
            const ctx = gfx.ctx();
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255, 0, 85, ${this.timer})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // ─── HAZARDS & PLATFORMS ─────────────────────────────────────────────────

    class Firewall extends Entity {
        constructor(x, y, w, h, vx, vy, type) {
            super(x, y);
            this.w = w; this.h = h;
            this.vx = vx; this.vy = vy;
            this.type = type; // 'h' (horizontal), 'v' (vertical), 'd' (diagonal)
            this.flicker = PC.rand(0, 10);
            this.z = 12;
            this.rotation = 0; // For diagonal spinning
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.flicker += dt;

            // Wrapping logic
            if (this.vx > 0 && this.x > COLS * TILE) this.x = -this.w;
            if (this.vx < 0 && this.x < -this.w) this.x = COLS * TILE;
            if (this.vy > 0 && this.y > ROWS * TILE) this.y = -this.h;
            if (this.vy < 0 && this.y < -this.h) this.y = ROWS * TILE;

            if (this.type === 'd') this.rotation += dt * 3;
        }

        draw(gfx) {
            const ctx = gfx.ctx();
            const color = Math.sin(this.flicker * 20) > 0 ? PALETTE.FIRE : '#b03c00aa';

            if (this.type === 'd') {
                // Spinning Diagonal Threat
                ctx.save();
                // Move origin (0,0) to the center of the box
                ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
                ctx.rotate(this.rotation);
                
                // Draw the box around the new (0,0) center
                gfx.rect(-this.w / 2, -this.h / 2, this.w, this.h, color);
                
                // Draw the SAME dense flickering binary corruption as orthogonal threats
                ctx.beginPath();
                ctx.rect(-this.w / 2, -this.h / 2, this.w, this.h);
                ctx.clip();
                for (let by = 0; by < this.h; by += 8) {
                    for (let bx = 0; bx < this.w; bx += 8) {
                        if (Math.random() > 0.2) { 
                            const bit = Math.random() > 0.5 ? '1' : '0';
                            // Offset bx and by to start from the top-left of the centered origin
                            gfx.text(bit, -this.w / 2 + bx + 1, -this.h / 2 + by + 8, { size: 8, color: 'rgba(255, 255, 255, 0.4)', bold: true });
                        }
                    }
                }
                ctx.restore();
            } else {
                // Orthogonal Threat
                gfx.rect(this.x, this.y, this.w, this.h, color);
                
                // Flickering binary corruption
                ctx.save();
                ctx.beginPath();
                ctx.rect(this.x, this.y, this.w, this.h);
                ctx.clip();
                for (let by = 0; by < this.h; by += 8) {
                    for (let bx = 0; bx < this.w; bx += 8) {
                        if (Math.random() > 0.2) { // 80% chance to draw a bit
                            const bit = Math.random() > 0.5 ? '1' : '0';
                            gfx.text(bit, this.x + bx + 1, this.y + by + 8, { size: 8, color: 'rgba(255, 255, 255, 0.4)', bold: true });
                        }
                    }
                }
                ctx.restore();
            }
        }
    }

    class DataRaft extends Entity {
        constructor(x, y, w, h, vx, vy) {
            super(x, y);
            this.w = w; this.h = h;
            
            // Calculate a step timer based on the original pixel speed
            const speed = Math.abs(vx || vy);
            this.stepTimer = PC.makeTimer(TILE / speed);
            
            this.dirX = Math.sign(vx);
            this.dirY = Math.sign(vy);
            
            this.popScale = 1.0;
            this.z = 5; 
            
            // Proper engine-synced timer for the visual effects!
            this.animTimer = 0; 
        }

        update(dt, input, game) {
            this.animTimer += dt;

            // Animate the leading edge popping up
            if (this.popScale < 1.0) this.popScale += dt * 8;
            if (this.popScale > 1.0) this.popScale = 1.0;

            if (this.stepTimer.tick(dt)) {
                // Record position before moving so we can check if a passenger is on us
                const prevX = this.x;
                const prevY = this.y;

                // Move exactly one tile
                this.x += this.dirX * TILE;
                this.y += this.dirY * TILE;
                this.popScale = 0; // Trigger the animation

                // Wrap around edges
                if (this.dirX > 0 && this.x > COLS * TILE) this.x = -this.w;
                if (this.dirX < 0 && this.x < -this.w) this.x = COLS * TILE;
                if (this.dirY > 0 && this.y > ROWS * TILE) this.y = -this.h;
                if (this.dirY < 0 && this.y < -this.h) this.y = ROWS * TILE;

                // Move Passenger!
                const player = game.find(DataPacket);
                if (player && !player.isMoving && !player.dead) {
                    if (PC.pointInRect(player.x + player.w/2, player.y + player.h/2, {x: prevX, y: prevY, w: this.w, h: this.h})) {
                        player.x += this.dirX * TILE;
                        player.y += this.dirY * TILE;
                        player.gx += this.dirX;
                        player.gy += this.dirY;
                        
                        // Keep animation anchors locked so the player doesn't glitch visually
                        player.startX = player.x;
                        player.startY = player.y;
                        player.targetX = player.x;
                        player.targetY = player.y;
                    }
                }
            }
        }

        draw(gfx) {
            const segments = (this.dirX !== 0) ? this.w / TILE : this.h / TILE;

            for (let i = 0; i < segments; i++) {
                let px = this.x + (this.dirX !== 0 ? i * TILE : 0);
                let py = this.y + (this.dirY !== 0 ? i * TILE : 0);
                
                let scale = 1;
                // Identify the leading edge segment to apply the pop animation
                const isLeading = (this.dirX > 0 && i === segments - 1) || 
                                  (this.dirX < 0 && i === 0) ||
                                  (this.dirY > 0 && i === segments - 1) ||
                                  (this.dirY < 0 && i === 0);

                if (isLeading) scale = this.popScale;
                const sOffset = (TILE - (TILE * scale)) / 2;

                // 1. Holographic glowing outer edge
                gfx.rect(px + sOffset, py + sOffset, TILE * scale, TILE * scale, `rgba(0, 229, 255, ${0.25 * scale})`);
                
                // 2. Solid safe interior plate
                gfx.rect(px + 1 + sOffset, py + 1 + sOffset, (TILE - 2) * scale, (TILE - 2) * scale, PALETTE.SAFE);
                
                if (scale > 0.6) {
                    // 3. Four tech mounting brackets in the corners
                    gfx.rect(px + 2, py + 2, 3, 3, PALETTE.RAFT);
                    gfx.rect(px + 15, py + 2, 3, 3, PALETTE.RAFT);
                    gfx.rect(px + 2, py + 15, 3, 3, PALETTE.RAFT);
                    gfx.rect(px + 15, py + 15, 3, 3, PALETTE.RAFT);

                }
            }
        }
    }

    class Tracker extends Entity {
        constructor(x, y) {
            super(x, y);
            this.w = 12; this.h = 12;
            this.speed = 28; 
            this.z = 20;
            this.timer = 0;
        }
        update(dt, input, game) {
            const player = game.find(DataPacket);
            if (!player || player.dead) return;

            const dx = (player.x + player.w/2) - (this.x + this.w/2);
            const dy = (player.y + player.h/2) - (this.y + this.h/2);
            const dist = Math.hypot(dx, dy);

            if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
            this.timer += dt;
        }
        draw(gfx) {
            const pulse = Math.abs(Math.sin(this.timer * 10)) * 6;
            gfx.rect(this.x - pulse/2, this.y - pulse/2, this.w + pulse, this.h + pulse, 'rgba(255, 0, 85, 0.4)');
            gfx.rect(this.x, this.y, this.w, this.h, PALETTE.TRACK);
            gfx.rect(this.x + 3, this.y + 3, 6, 6, '#fff');
        }
    }

    class UploadPort extends Entity {
        constructor(gx, gy) {
            super(gx * TILE, gy * TILE);
            this.w = TILE; this.h = TILE;
            this.filled = false;
            this.timer = 0; // 1. Add an internal stopwatch
        }
        
        // 2. Add an update loop to track engine time
        update(dt) {
            this.timer += dt;
        }

        draw(gfx) {
            // 3. Multiply timer by 5 to roughly match the old Date.now() speed
            const time = this.timer * 5; 
            const pulse = (Math.sin(time) + 1) / 2; 

            if (this.filled) {
                // Subtle golden pulse for secured ports
                gfx.rect(this.x - pulse * 4, this.y - pulse * 4, this.w + pulse * 8, this.h + pulse * 8, `rgba(255, 215, 0, ${0.3 * (1 - pulse)})`);
                
                gfx.rect(this.x, this.y, this.w, this.h, PALETTE.GOLD);
                gfx.rect(this.x+2, this.y+2, this.w-4, this.h-4, PALETTE.SAFE);
                gfx.rect(this.x+6, this.y+6, this.w-12, this.h-12, PALETTE.GOLD);
            } else {
                // Big, obvious cyan radar pulse for empty ports
                gfx.rect(this.x - pulse * 8, this.y - pulse * 8, this.w + pulse * 16, this.h + pulse * 16, `rgba(0, 229, 255, ${0.6 * (1 - pulse)})`);

                gfx.rect(this.x, this.y, this.w, this.h, PALETTE.PORT);
                gfx.rect(this.x + 2, this.y + 2, this.w - 4, this.h - 4, PALETTE.SAFE);
                
                // Make the inner square throb with the pulse
                gfx.rect(this.x + 6, this.y + 6, 8, 8, `rgba(0, 229, 255, ${0.2 + pulse * 0.6})`);
            }
        }
    }

    // ─── PLAYER ──────────────────────────────────────────────────────────────

    class DataPacket extends Entity {
        constructor(game) {
            super(9 * TILE + 3, 7 * TILE + 3); 
            this.game = game;
            this.w = 14; this.h = 14;
            
            this.gx = 9; 
            this.gy = 7;
            
            this.isMoving = false;
            this.moveTimer = 0;
            this.moveDuration = 0.09; 
            this.inputCooldown = 0; 
            
            // 2 Seconds of Spawn Invulnerability
            this.invulnTimer = 2.0;

            this.startX = this.x; this.startY = this.y;
            this.targetX = this.x; this.targetY = this.y;

            this.flickerTimer = 0;
            this.bitLabel = '1';
            this.z = 50;
            this.trailTimer = PC.makeTimer(0.02);
        }

        update(dt, input) {
            this.flickerTimer += dt;
            if (this.flickerTimer > 0.1) {
                this.bitLabel = this.bitLabel === '7' ? '0' : '7';
                this.flickerTimer = 0;
            }

            if (this.invulnTimer > 0) {
                this.invulnTimer -= dt;
                // End invulnerability immediately if outside the Safe Island (x: 8-10, y: 6-8)
                if (this.gx < 8 || this.gx > 10 || this.gy < 6 || this.gy > 8) {
                    this.invulnTimer = 0;
                }
            }
            if (this.inputCooldown > 0) this.inputCooldown -= dt;

            // 1. Goal Detection 
            const port = this.game.collidePoint(this.x + this.w/2, this.y + this.h/2, UploadPort);
            if (port) {
                if (!port.filled) {
                    port.filled = true;
                    this.game.scorePort(this); return;
                } else if (!this.isMoving) {
                    // this.game.killPlayer(this); return; // Can't park on a full port, do nothing
                }
            }

            // 2. Hazards (Ignored during invulnerability)
            if (this.invulnTimer <= 0) {
                if (this.game.collide(this, Firewall)) {
                    this.game.killPlayer(this); return;
                }
                const hitTracker = this.game.collide(this, Tracker);
                if (hitTracker) {
                    hitTracker.destroy(); 
                    this.game.killPlayer(this); return;
                }
            }

            // Calculate live grid position
            const cx = this.x + this.w/2;
            const cy = this.y + this.h/2;
            const currentGx = Math.round(this.x / TILE);
            const currentGy = Math.round(this.y / TILE);

            // 3. Void & Raft Logic
            if (!this.isMoving) {
                const tUnder = this.game.world.get(currentGx, currentGy);
                
                if (tUnder === T_VOID) {
                    const raft = this.game.collidePoint(cx, cy, DataRaft);
                    if (raft) {
                        // Safe on raft! The raft entity handles shoving the player.
                        if (this.x < -TILE || this.x > COLS*TILE || this.y < -TILE || this.y > ROWS*TILE) {
                            this.game.killPlayer(this, true); return;
                        }
                    } else if (this.invulnTimer <= 0) {
                        // Sunk in the void
                        this.game.killPlayer(this, true); return;
                    }
                }

                // 4. Movement Input
                if (this.inputCooldown <= 0) {
                    let dx = 0, dy = 0;
                    if (input.pressed.UP) dy = -1;
                    else if (input.pressed.DOWN) dy = 1;
                    else if (input.pressed.LEFT) dx = -1;
                    else if (input.pressed.RIGHT) dx = 1;

                    if (dx !== 0 || dy !== 0) {
                        let nx = currentGx + dx;
                        let ny = currentGy + dy;

                        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                            this.gx = nx;
                            this.gy = ny;
                            this.startX = this.x;
                            this.startY = this.y;
                            
                            this.targetX = (this.gx * TILE) + 3; 
                            this.targetY = (this.gy * TILE) + 3;
                            
                            this.isMoving = true;
                            this.moveTimer = 0;
                            this.inputCooldown = 0.12; 
                        }
                    }
                }
            }

            // 5. Animation
            if (this.isMoving) {
                if (this.trailTimer.tick(dt)) {
                    this.game.add(new GhostTrail(this.x, this.y, this.w, this.h));
                }
                this.moveTimer += dt;
                let t = this.moveTimer / this.moveDuration;
                if (t >= 1) { t = 1; this.isMoving = false; }
                this.x = PC.lerp(this.startX, this.targetX, t);
                this.y = PC.lerp(this.startY, this.targetY, t);
            }
        }

        draw(gfx) {
            // Blink if invulnerable
            if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 15) % 2 === 0) return;
            
            gfx.rect(this.x, this.y, this.w, this.h, PALETTE.BIT);
            gfx.rect(this.x + 2, this.y + 2, this.w - 4, this.h - 4, PALETTE.BG);
            gfx.text(this.bitLabel, this.x + this.w/2, this.y +this.h-3, {size: 12, color: PALETTE.CODE, bold: true, align: "center"});
        }
    }

    // ─── GAME CONTROLLER ─────────────────────────────────────────────────────

    class DataDashGame extends Game {
        static meta = {
            id: "freaky-frogger",
            title: "Adiabatic Dash",
            desc: "Evade chaotic, multi-directional network traffic. Maintain data integrity. Reach the corner ports.",
            instructions: "Use Arrows or Swipe.\nFill the 4 corner ports to advance.\nDon't hit 0% integrity."
        };

        onInit() {
            this.level = this.api.getData('level') || 1;
            this.score = this.api.getData('score') || 0;
            this.lives = this.api.getData('lives') || 100;

            this.portsFilled = 0;
            
            this.levelTimer = 0;
            this.trackerTimer = 0;
            this.trackersActive = 0;
            this.shake = 0;

            this.world = new Physics.World(COLS, ROWS, TILE);
            this.api.setScore(this.score);
            this.buildLevel();
        }

        buildLevel() {
            this.clearEntities(); 
            this.world.data.fill(T_SAFE);
            
            // 4 Corner Ports
            this.add(new UploadPort(0, 0));
            this.add(new UploadPort(COLS-1, 0));
            this.add(new UploadPort(0, ROWS-1));
            this.add(new UploadPort(COLS-1, ROWS-1));

            this.respawnPlayer();

            const spd = 1 + (this.level * 0.1);

            // --- PROCEDURAL LANE GENERATION ---
            // Available non-safe rows/cols
            const hRows = [1, 2, 3, 4, 5, 9, 10, 11, 12, 13];
            const vCols = [1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18];
            
            // Shuffle
            hRows.sort(() => Math.random() - 0.5);
            vCols.sort(() => Math.random() - 0.5);

            // Amount scales with level
            const numHLanes = Math.min(8, 2 + Math.floor(this.level / 1.5));
            const numVLanes = Math.min(6, 1 + Math.floor(this.level / 2));

            // Generate H Lanes
            for(let i=0; i<numHLanes; i++) {
                const y = hRows[i];
                // 30% chance for a Void River starting level 2
                const isVoid = (this.level >= 2 && Math.random() < 0.3);
                const dir = Math.random() < 0.5 ? 1 : -1;
                const speed = PC.rand(35, 70) * spd;
                const len = PC.randInt(2, 4);
                
                if (isVoid) {
                    for(let x=0; x<COLS; x++) this.world.set(x, y, T_VOID);
                    this.createLane('h', y, DataRaft, len, speed, dir, 5);
                } else {
                    this.createLane('h', y, Firewall, len, speed, dir, 6);
                }
            }

            // Generate V Lanes (Firewalls only)
            for(let i=0; i<numVLanes; i++) {
                const x = vCols[i];
                const dir = Math.random() < 0.5 ? 1 : -1;
                const speed = PC.rand(40, 80) * spd;
                const len = PC.randInt(1, 3);
                this.createLane('v', x, Firewall, len, speed, dir, 7);
            }

            // Generate Diagonal Chaos (Level 4+)
            const numDiag = this.level >= 4 ? Math.min(8, (this.level - 3) * 2) : 0;
            for(let i=0; i<numDiag; i++) {
                const vx = PC.rand(30, 60) * spd * (Math.random() < 0.5 ? 1 : -1);
                const vy = PC.rand(30, 60) * spd * (Math.random() < 0.5 ? 1 : -1);
                this.add(new Firewall(PC.rand(0, COLS*TILE), PC.rand(0, ROWS*TILE), TILE-4, TILE-4, vx, vy, 'd'));
            }

            this.trackersActive = 0;
            this.trackerTimer = 0;
            this.levelTimer = 0;
        }

        createLane(axis, pos, Type, length, speed, dir, gap) {
            let p = 0;
            const max = axis === 'h' ? COLS : ROWS;
            while (p < max) {
                if (axis === 'h') {
                    const vx = speed * dir;
                    this.add(new Type(p * TILE, pos * TILE, length * TILE, TILE - 4, vx, 0, 'h'));
                } else {
                    const vy = speed * dir;
                    this.add(new Type(pos * TILE, p * TILE, TILE - 4, length * TILE, 0, vy, 'v'));
                }
                p += length + gap;
            }
        }

        respawnPlayer() {
            const old = this.find(DataPacket);
            if (old) old.destroy();
            this.add(new DataPacket(this));
            this.updateHUD();
        }

        spawnEffects(x, y, color, speed) {
            for(let i=0; i<12; i++) this.add(new GlitchParticle(x, y, color, speed));
        }

        screenShake(amt) { this.shake = amt; }

        killPlayer(player, isVoid = false) {
            this.screenShake(12);
            const col = isVoid ? PALETTE.CODE : PALETTE.FIRE;
            this.spawnEffects(player.x + 7, player.y + 7, col, 250);
            player.destroy();
            this.lives -= PC.randInt(15,25);
            this.updateHUD();

            // Clear ALL Trackers on death to ensure a completely safe respawn
            this.entities.filter(e => e instanceof Tracker).forEach(t => t.destroy());
            this.trackersActive = 0;
            this.trackerTimer = 0;

            if (this.lives <= 0) {
                const best = Math.max(this.level, this.api.getData('bestLevel') || 1);
                this.api.saveData('bestLevel', best);
                this.api.saveData('level', 1);
                this.api.saveData('score', 0);
                this.api.saveData('lives', 100);
                this.api.gameOver(`DATA CORRUPTED.\nFinal Score: ${this.score}\nSectors: ${this.level - 1}`);
            } else {
                setTimeout(() => { if (this.lives > 0) this.respawnPlayer(); }, 1000);
            }
        }

        scorePort(player) {
            this.screenShake(4);
            this.spawnEffects(player.x + 7, player.y + 7, PALETTE.GOLD, 100);
            player.destroy();
            
            const timeBonus = Math.max(0, Math.floor((30 - this.levelTimer) * 10));
            this.score += 100 + (this.level * 50) + timeBonus;
            this.api.setScore(this.score);
            this.portsFilled++;

            // Restore some integrity upon port fill
            this.lives += PC.randInt(5,15);
            if (this.lives > 100){
                this.lives = 100;
            }

            this.trackerTimer = -3; // Delay tracker spawning after a score

            if (this.portsFilled >= 4) {
                this.api.saveData('level', this.level + 1);
                this.api.saveData('score', this.score);
                this.api.saveData('lives', this.lives);
                this.api.newStage(`SECTOR ${this.level} SECURE`, `Routing efficient.`, "CONTINUE", () => this.onInit());
            } else {
                setTimeout(() => this.respawnPlayer(), 500);
            }
        }

        update(dt, input) {
            super.update(dt, input);
            this.levelTimer += dt;

            if (this.shake > 0) {
                this.shake -= dt * 40;
                if (this.shake < 0) this.shake = 0;
            }

            // Tracker Logic
            const maxTrackers = Math.min(5, Math.floor((this.level + 1) / 2));
            if (this.level > 1 && this.trackersActive < maxTrackers) {
                this.trackerTimer += dt;
                // Faster spawns at higher levels
                const spawnDelay = Math.max(2, 8 - (this.level * 0.5));
                
                if (this.trackerTimer > spawnDelay) {
                    const corners = [
                        {x: 1*TILE, y: 1*TILE}, {x: 18*TILE, y: 1*TILE},
                        {x: 1*TILE, y: 13*TILE}, {x: 18*TILE, y: 13*TILE}
                    ];
                    const player = this.find(DataPacket);
                    let best = corners[0];
                    let maxDist = 0;
                    
                    if (player) {
                        corners.forEach(c => {
                            const d = Math.hypot(c.x - player.x, c.y - player.y);
                            if (d > maxDist) { maxDist = d; best = c; }
                        });
                    } else {
                        best = corners[PC.randInt(0, 3)];
                    }

                    this.screenShake(5);
                    this.add(new WarningPing(best.x + TILE/2, best.y + TILE/2));
                    this.trackersActive++; 
                    this.trackerTimer = 0;
                    
                    setTimeout(() => {
                        // Only spawn if player is still alive (trackersActive wasn't reset)
                        if (this.trackersActive > 0) this.add(new Tracker(best.x, best.y));
                    }, 1000);
                }
            }
        }

        updateHUD() {
            const displayIntegrity = Math.max(0, this.lives);
            this.api.setStatus(`INTEGRITY: ${displayIntegrity}%`)
            this.api.setLabel(`SECTOR: ${this.level}`);
        }

        draw(gfx) {
            const ctx = gfx.ctx();
            ctx.save();
            
            if (this.shake > 0) {
                ctx.translate(PC.rand(-this.shake, this.shake), PC.rand(-this.shake, this.shake));
            }

            gfx.clear(PALETTE.BG);

            // Draw Terrain Grid and Animated Void
            for(let y=0; y<ROWS; y++) {
                for(let x=0; x<COLS; x++) {
                    const t = this.world.get(x, y);
                    
                    // Safe Island (8,6 to 10,8)
                    if (x >= 8 && x <= 10 && y >= 6 && y <= 8) {
                        gfx.rect(x * TILE, y * TILE, TILE, TILE, PALETTE.ISLAND);
                        gfx.rect(x * TILE, y * TILE, TILE, 1, 'rgba(255, 255, 255, 0.05)');
                        gfx.rect(x * TILE, y * TILE, 1, TILE, 'rgba(255, 255, 255, 0.05)');
                        
                    } 
                    else if (t === T_VOID) {
                        gfx.rect(x * TILE, y * TILE, TILE, TILE, PALETTE.VOID);
                        const v = Math.sin(this.levelTimer * 4 + x * 0.8 + y) > 0.8;
                        // Draw fading binary static in the void
                        if (v) gfx.text(Math.random() > 0.5 ? '1' : '0', x * TILE + 6, y * TILE + 14, { size: 10, color: 'rgba(0, 229, 255, 0.25)', bold: true });
                    } 
                    else {
                        gfx.rect(x * TILE, y * TILE, TILE, TILE, PALETTE.SAFE);
                        gfx.rect(x * TILE, y * TILE, TILE, 1, 'rgba(0, 229, 255, 0.02)');
                        gfx.rect(x * TILE, y * TILE, 1, TILE, 'rgba(0, 229, 255, 0.02)');
                        
                        // Occasional faint binary flicker in the safe floor
                        if (Math.random() > 0.85) {
                            const bit = Math.random() > 0.5 ? '1' : '0';
                            gfx.text(bit, x * TILE + 6, y * TILE + 14, { size: 10, color: 'rgba(0, 229, 255, 0.1)' });
                        }
                    }
                }
            }

            // Draw Center Spawn Label
            gfx.text('IN', 9 * TILE + 10, 7 * TILE + 14, {size: 10, color: 'rgba(255,255,255,0.4)', align: 'center', bold: true});

            super.draw(gfx);
            ctx.restore();
        }
    }

    Interactive.register(DataDashGame);
})();