/**
 * CRATE MAN: SECTOR 7 LOGISTICS
 * A classic Sokoban-style puzzle game for the PodCube Engine.
 */

(() => {
    const TILE = 20;
    const COLS = 20; // 400px
    const ROWS = 15; // 300px

    // Tile Types
    const AIR = 0;
    const WALL = 1;
    const GOAL = 2;

    const COLORS = {
        WALL: '#162a3e',
        GOAL: '#00e5ff33', // Faint cyan glow
        PLAYER: '#1768da',
        CRATE: '#ffd700',
        CRATE_OK: '#22c55e', // Green when on goal
        BG: '#fdfdfc'
    };

    class Crate extends Entity {
        constructor(gx, gy) {
            super(gx * TILE, gy * TILE);
            this.gx = gx;
            this.gy = gy;
            this.w = TILE;
            this.h = TILE;
            this.onGoal = false;
        }

        update(dt, input, game) {
            // Check if we are currently resting on a goal tile
            this.onGoal = game.world.get(this.gx, this.gy) === GOAL;
            // Visual smoothing
            this.x = PC.lerp(this.x, this.gx * TILE, 0.3);
            this.y = PC.lerp(this.y, this.gy * TILE, 0.3);
        }

        draw(gfx) {
            const color = this.onGoal ? COLORS.CRATE_OK : COLORS.CRATE;
            gfx.rect(this.x + 2, this.y + 2, TILE - 4, TILE - 4, color);
            // Draw a "X" on the crate
            gfx.line(this.x + 6, this.y + 6, this.x + 14, this.y + 14, '#00000033', 2);
            gfx.line(this.x + 14, this.y + 6, this.x + 6, this.y + 14, '#00000033', 2);
        }
    }

    class Worker extends Entity {
        constructor(gx, gy, game) {
            super(gx * TILE, gy * TILE);
            this.gx = gx;
            this.gy = gy;
            this.w = TILE;
            this.h = TILE;
            this.game = game;
            this.moveCooldown = 0;
        }

        update(dt, input) {
            if (this.moveCooldown > 0) {
                this.moveCooldown -= dt;
            } else {
                let dx = 0, dy = 0;
                if (input.pressed.UP) dy = -1;
                else if (input.pressed.DOWN) dy = 1;
                else if (input.pressed.LEFT) dx = -1;
                else if (input.pressed.RIGHT) dx = 1;

                if (dx !== 0 || dy !== 0) {
                    this.tryMove(dx, dy);
                }
            }
            // Visual smoothing
            this.x = PC.lerp(this.x, this.gx * TILE, 0.3);
            this.y = PC.lerp(this.y, this.gy * TILE, 0.3);
        }

        tryMove(dx, dy) {
            const nx = this.gx + dx;
            const ny = this.gy + dy;

            // 1. Check Wall Collision
            if (this.game.world.get(nx, ny) === WALL) return;

            // 2. Check Crate Collision
            const crate = this.game.entities.find(e => e instanceof Crate && e.gx === nx && e.gy === ny);
            
            if (crate) {
                const nnx = nx + dx;
                const nny = ny + dy;
                // Can only push if the space behind the crate is clear (not wall and not another crate)
                const isWall = this.game.world.get(nnx, nny) === WALL;
                const isCrate = this.game.entities.find(e => e instanceof Crate && e.gx === nnx && e.gy === nny);

                if (!isWall && !isCrate) {
                    crate.gx = nnx;
                    crate.gy = nny;
                    this.gx = nx;
                    this.gy = ny;
                    this.moveCooldown = 0.15;
                    this.game.moves++;
                }
            } else {
                // Empty space or goal
                this.gx = nx;
                this.gy = ny;
                this.moveCooldown = 0.15;
                this.game.moves++;
            }
        }

        draw(gfx) {
            gfx.rect(this.x + 3, this.y + 3, TILE - 6, TILE - 6, COLORS.PLAYER);
            // Little hard hat
            gfx.rect(this.x + 5, this.y + 2, TILE - 10, 4, '#ffff00');
        }
    }

    class CrateManGame extends Game {
        static meta = {
            id: "crate-man",
            title: "Sector 7 Logistics",
            desc: "The cargo isn't going to move itself. Push the yellow crates onto the glowing cyan targets.",
            instructions: "Use Arrows or Swipe to move.\nPush crates into marked zones.\nYou cannot pull crates!"
        };

        onInit() {
            this.world = new Physics.World(COLS, ROWS, TILE);
            this.moves = 0;
            this.currentLevel = 0;
            this.loadLevel(this.currentLevel);
        }

        loadLevel(idx) {
            this.clearEntities();
            this.world.data.fill(AIR);
            
            // Basic Level 1 Layout
            const map = [
                "  WWWWW             ",
                "  W   W             ",
                "  W$  W             ",
                "WWW  $WW            ",
                "W  $  $W            ",
                "W WW W W   WWWWWW   ",
                "W    W WWWWW  ..W   ",
                "WW W W        ..W   ",
                " W   W  WWWW  ..W   ",
                " WWWWWWWW  WWWWWW   ",
                "                    "
            ];

            // W=Wall, $=Crate, .=Goal, @=Player
            // Let's place a simple test level
            this.setupMap(6, 3, [
                "WWWWW",
                "W@  W",
                "W $ W",
                "W  .W",
                "WWWWW"
            ]);

            this.api.setLabel("SECTOR: 1");
            this.api.setStatus("PUSH THE CRATE");
        }

        setupMap(offsetX, offsetY, rows) {
            rows.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    const char = row[x];
                    const gx = x + offsetX;
                    const gy = y + offsetY;

                    if (char === 'W') this.world.set(gx, gy, WALL);
                    if (char === '.') this.world.set(gx, gy, GOAL);
                    if (char === '$') this.add(new Crate(gx, gy));
                    if (char === '@') this.add(new Worker(gx, gy, this));
                }
            });
        }

        update(dt, input) {
            super.update(dt, input);
            this.api.setScore(this.moves);

            // Check Win Condition
            const crates = this.entities.filter(e => e instanceof Crate);
            if (crates.length > 0 && crates.every(c => c.onGoal)) {
                this.api.win(`EFFICIENCY ACHIEVED!\nMoves: ${this.moves}`);
            }
        }

        draw(gfx) {
            gfx.clear(COLORS.BG);

            // Draw Level
            for (let gy = 0; gy < ROWS; gy++) {
                for (let gx = 0; gx < COLS; gx++) {
                    const t = this.world.get(gx, gy);
                    if (t === WALL) {
                        gfx.rect(gx * TILE, gy * TILE, TILE, TILE, COLORS.WALL);
                    } else if (t === GOAL) {
                        gfx.rect(gx * TILE + 4, gy * TILE + 4, TILE - 8, TILE - 8, COLORS.GOAL);
                    }
                }
            }

            super.draw(gfx);
        }
    }

    Interactive.register(CrateManGame);
})();