/**
 * CURTIS THE CRATE MAN
 * A puzzle-platformer where you pick up and throw crates to build bridges.
 * * NEW IN THIS VERSION:
 * - Crates obey gravity in the world grid (picking up a bottom crate causes the stack to fall).
 * - Press DOWN while carrying a crate to set it down gently in front of you.
 */

(() => {
    // ─── CONSTANTS & CONFIG ──────────────────────────────────────────────────
    const TILE = 20;
    const COLS = 20; // 400px
    const ROWS = 15; // 300px

    const VAL_AIR = 0;
    const VAL_WALL = 1;
    const VAL_CRATE = 2; // Physics.World treats any value > 0 as solid!

    const PALETTE = {
        BG: '#87CEEB',       // Sky blue
        WALL: '#4a5e35',     // Grassy rock
        WALL_TOP: '#658a43', 
        CRATE: '#d4a373',    // Wood
        CRATE_EDGE: '#bc6c25',
        PLAYER_SHIRT: '#1768da',
        PLAYER_SKIN: '#fcd5ce',
        GOAL: '#ffd700'
    };

    // Shared drawing function so grid-crates, falling crates, and carried crates look identical
    function drawCrate(gfx, x, y) {
        gfx.rect(x, y, TILE, TILE, PALETTE.CRATE);
        gfx.rect(x, y, TILE, 2, PALETTE.CRATE_EDGE);
        gfx.rect(x, y, 2, TILE, PALETTE.CRATE_EDGE);
        gfx.rect(x + TILE - 2, y, 2, TILE, PALETTE.CRATE_EDGE);
        gfx.rect(x, y + TILE - 2, TILE, 2, PALETTE.CRATE_EDGE);
        gfx.line(x, y, x + TILE, y + TILE, PALETTE.CRATE_EDGE, 2);
        gfx.line(x + TILE, y, x, y + TILE, PALETTE.CRATE_EDGE, 2);
    }

    // ─── ENTITIES ────────────────────────────────────────────────────────────

    // A physical crate that falls through the air. 
    // Once it hits the ground, it snaps to the grid and becomes a solid tile.
    class FallingCrate extends Physics.Actor {
        constructor(x, y, vx, vy) {
            super(x, y, TILE, TILE);
            this.vx = vx;
            this.vy = vy;
            this.z = 10;
        }

        update(dt, input, game) {
            this.updatePhysics(dt, game.world, 900); // Apply gravity and move
            
            // If it lands on the ground, snap it into the world grid
            if (this.grounded) {
                // Wait! Don't snap and become solid if it landed directly on Curtis's head.
                // It will pause and wait for him to move out from underneath it.
                if (game.collide(this, Curtis)) {
                    this.vx = 0;
                    return; 
                }

                // Determine the closest grid tile
                let gx = Math.round(this.x / TILE);
                let gy = Math.round(this.y / TILE);
                
                gx = PC.clamp(gx, 0, COLS - 1);
                gy = PC.clamp(gy, 0, ROWS - 1);

                // Ensure we don't accidentally overwrite a wall if it got squeezed into a corner
                if (game.world.get(gx, gy) !== VAL_AIR) {
                    gy -= 1; // Try the tile above
                }

                if (gy >= 0 && game.world.get(gx, gy) === VAL_AIR) {
                    game.world.set(gx, gy, VAL_CRATE); // Become a solid tile
                    this.destroy(); // Remove the dynamic actor
                } else {
                    this.destroy(); // Destroy if it somehow fell completely out of bounds
                }
            }
        }

        draw(gfx) {
            drawCrate(gfx, this.x, this.y);
        }
    }

    class Goal extends Entity {
        constructor(x, y) {
            super(x * TILE, y * TILE);
            this.w = TILE;
            this.h = TILE;
            this.timer = 0;
        }
        update(dt) { this.timer += dt; }
        draw(gfx) {
            const hover = Math.sin(this.timer * 4) * 3;
            gfx.rect(this.x + 4, this.y + 4 + hover, TILE - 8, TILE - 8, PALETTE.GOAL);
            gfx.text("EXIT", this.x + 10, this.y - 4 + hover, { size: 10, align: 'center', bold: true, color: '#fff' });
        }
    }

    class Curtis extends Physics.Actor {
        constructor(x, y) {
            super(x * TILE + 2, y * TILE + 2, 14, 18); // Slightly smaller than a tile
            this.carrying = false;
            this.facing = 1; // 1 = right, -1 = left
            this.z = 20;
        }

        update(dt, input, game) {
            // 1. Horizontal Movement
            if (input.held.LEFT) {
                this.vx = -120;
                this.facing = -1;
            } else if (input.held.RIGHT) {
                this.vx = 120;
                this.facing = 1;
            } else {
                this.vx = PC.lerp(this.vx, 0, dt * 15); // Friction
            }

            // 2. Jumping
            if (input.pressed.UP && this.grounded) {
                this.vy = -300;
                this.grounded = false;
            }

            // 3. Interactions (Pick Up / Throw / Set Down)
            let px = this.x + this.w / 2;
            let py = this.y + this.h / 2;
            let gx = Math.floor(px / TILE);
            let gy = Math.floor(py / TILE);
            let fx = gx + this.facing; // The tile immediately in front of Curtis

            if (this.carrying) {
                if (input.pressed.DOWN) {
                    // SET DOWN GENTLY
                    if (game.world.get(fx, gy) === VAL_AIR) {
                        this.carrying = false;
                        game.add(new FallingCrate(fx * TILE, gy * TILE, 0, 0));
                    } else if (game.world.get(fx, gy - 1) === VAL_AIR) {
                        // If chest level is blocked, try head level
                        this.carrying = false;
                        game.add(new FallingCrate(fx * TILE, (gy - 1) * TILE, 0, 0));
                    }
                } else if (input.pressed.ACTION) {
                    // THROW CRATE
                    this.carrying = false;
                    let spawnX = this.x + (this.facing * TILE);
                    let spawnY = this.y - TILE;
                    let tossVx = this.facing * 180 + this.vx; 
                    let tossVy = -150; 
                    game.add(new FallingCrate(spawnX, spawnY, tossVx, tossVy));
                }
            } else {
                if (input.pressed.ACTION) {
                    // PICK UP CRATE
                    let targets = [
                        { x: fx, y: gy },     // Chest level
                        { x: fx, y: gy + 1 }, // Floor level
                        { x: fx, y: gy - 1 }  // Head level
                    ];

                    for (let t of targets) {
                        if (game.world.get(t.x, t.y) === VAL_CRATE) {
                            // Erase from grid
                            game.world.set(t.x, t.y, VAL_AIR);
                            this.carrying = true;
                            break;
                        }
                    }
                }
            }

            // 4. Run standard physics step
            this.updatePhysics(dt, game.world, 800);

            // 5. Check Win Condition
            const goal = game.collide(this, Goal);
            if (goal) {
                game.api.win("SECTOR CLEAR!");
            }
            
            // 6. Check Death (Fell off screen)
            if (this.y > ROWS * TILE) {
                game.api.gameOver("You fell into the abyss. Try again.");
            }
        }

        draw(gfx) {
            gfx.rect(this.x, this.y + 6, this.w, this.h - 6, PALETTE.PLAYER_SHIRT);
            gfx.rect(this.x + 2, this.y, 10, 8, PALETTE.PLAYER_SKIN);
            
            let eyeX = this.facing === 1 ? this.x + 8 : this.x + 4;
            gfx.rect(eyeX, this.y + 2, 2, 2, '#000');

            if (this.carrying) {
                drawCrate(gfx, this.x - 3, this.y - TILE);
            }
        }
    }

    // ─── GAME CARTRIDGE ──────────────────────────────────────────────────────

    class CrateManPlatformer extends Game {
        static meta = {
            id: "curtis-crate",
            title: "Curtis the Crate Man",
            desc: "Pick up and throw crates to build bridges and stairs to reach the goal.",
            instructions: "Left/Right: Move | Up: Jump\nSpace/Enter: Lift or Throw Crate\nDown: Set Crate Down"
        };

        onInit() {
            this.world = new Physics.World(COLS, ROWS, TILE);
            this.loadLevel();
        }

        loadLevel() {
            this.clearEntities();
            this.world.data.fill(VAL_AIR);

            // Let's spawn a big stack of crates to demonstrate the new cascading gravity feature!
            const map = [
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "                   W",
                "                 G W",
                "               WWWWW",
                "     C             W",
                "     C             W",
                "     C             W",
                "W@   C     WW      W",
                "WWWWWW     WWWWWWWWW"
            ];

            map.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    const char = row[x];
                    if (char === 'W') this.world.set(x, y, VAL_WALL);
                    if (char === 'C') this.world.set(x, y, VAL_CRATE);
                    if (char === '@') this.add(new Curtis(x, y));
                    if (char === 'G') this.add(new Goal(x, y));
                }
            });

            this.api.setLabel("LEVEL 1");
            this.api.setStatus("TEST THE GRAVITY");
        }

        update(dt, input) {
            super.update(dt, input);
            
            // ✨ GLOBAL CRATE GRAVITY SWEEP ✨
            // Scan the grid from bottom to top. If a static crate has AIR immediately 
            // beneath it, convert it back into a dynamic FallingCrate.
            for (let gy = ROWS - 2; gy >= 0; gy--) {
                for (let gx = 0; gx < COLS; gx++) {
                    if (this.world.get(gx, gy) === VAL_CRATE && this.world.get(gx, gy + 1) === VAL_AIR) {
                        this.world.set(gx, gy, VAL_AIR); // Remove static tile
                        this.add(new FallingCrate(gx * TILE, gy * TILE, 0, 0)); // Spawn physics actor
                    }
                }
            }
        }

        draw(gfx) {
            gfx.clear(PALETTE.BG);

            // Render the physics world grid
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const t = this.world.get(x, y);
                    if (t === VAL_WALL) {
                        gfx.rect(x * TILE, y * TILE, TILE, TILE, PALETTE.WALL);
                        if (y > 0 && this.world.get(x, y - 1) !== VAL_WALL) {
                            gfx.rect(x * TILE, y * TILE, TILE, 4, PALETTE.WALL_TOP);
                        }
                    } else if (t === VAL_CRATE) {
                        drawCrate(gfx, x * TILE, y * TILE);
                    }
                }
            }

            super.draw(gfx);
        }
    }

    Interactive.register(CrateManPlatformer);
})();