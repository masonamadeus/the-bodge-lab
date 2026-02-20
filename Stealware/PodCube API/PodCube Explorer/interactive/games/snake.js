// =============================================================================
// SNAKE - Cartridge
// =============================================================================

// grid is 400 x 300
const CELL = 16;
const COLS = 400/CELL;
const ROWS = 300/CELL;

/**
 * FOOD ENTITY
 * Spawns recursively until it finds a spot not occupied by the snake.
 */
class Food extends Entity {
    constructor(snakeBody) {
        super(0, 0);
        this.respawn(snakeBody || []);
    }

    respawn(snakeBody) {
        let valid = false;
        // Keep trying random spots until we find a clear one
        while (!valid) {
            this.x = PC.randInt(1, COLS - 2);
            this.y = PC.randInt(1, ROWS - 2); // never spawn against walls
            valid = !snakeBody.some(s => s.x === this.x && s.y === this.y);
        }
    }

    draw(gfx) {
        const px = this.x * CELL + CELL / 2;
        const py = this.y * CELL + CELL / 2;
        // Draw a glow and the food dot
        gfx.circle(px, py, 6, 'rgba(255, 150, 0, 0.4)');
        gfx.circle(px, py, 4, '#ff9900');
    }
}

/**
 * SNAKE ENTITY
 * Handles movement, self-collision, and eating.
 */
class Snake extends Entity {
    constructor(game) {
        super();
        this.game = game;
        // Start in the middle
        this.body = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
        this.dir = { x: 1, y: 0 };

        // Step timer controls speed (0.08s per step)
        this.timer = PC.makeTimer(0.08);

        this.inputBuffer = [];
    }

    update(dt, input) {
        // 1. Buffer Inputs: Capture all valid direction changes
        if (input.pressed.UP && (this.inputBuffer[0]?.y || this.dir.y) === 0) this.inputBuffer.push({ x: 0, y: -1 });
        if (input.pressed.DOWN && (this.inputBuffer[0]?.y || this.dir.y) === 0) this.inputBuffer.push({ x: 0, y: 1 });
        if (input.pressed.LEFT && (this.inputBuffer[0]?.x || this.dir.x) === 0) this.inputBuffer.push({ x: -1, y: 0 });
        if (input.pressed.RIGHT && (this.inputBuffer[0]?.x || this.dir.x) === 0) this.inputBuffer.push({ x: 1, y: 0 });

        // Limit buffer size to 2 to prevent "laggy" control feelings
        if (this.inputBuffer.length > 2) this.inputBuffer.length = 2;

        // 2. Wait for Timer
        if (!this.timer.tick(dt)) return;

        // 3. Apply the next move from the buffer
        if (this.inputBuffer.length > 0) {
            this.dir = this.inputBuffer.shift();
        }

        const head = { x: this.body[0].x + this.dir.x, y: this.body[0].y + this.dir.y };

        // 4. Collision: Walls
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            this.game.die(); return;
        }

        // 5. Logic: Eating
        const food = this.game.find(Food);
        const eating = (head.x === food.x && head.y === food.y);

        // 6. Collision: Self
        // We check if the head hits the body.
        // Exception: If we aren't eating, the tail will move out of the way, so it's safe to hit the tail tip.
        const hitSelf = this.body.some((p, i) => {
            if (!eating && i === this.body.length - 1) return false;
            return p.x === head.x && p.y === head.y;
        });
        if (hitSelf) { this.game.die(); return; }

        // 7. Apply Movement
        this.body.unshift(head); // Add new head position
        if (eating) {
            this.game.addScore(10);
            food.respawn(this.body);
            // Speed up slightly
            this.timer.max = Math.max(0.04, this.timer.max * 0.99);
        } else {
            this.body.pop(); // Remove tail if we didn't grow
        }
    }

    draw(gfx) {
        this.body.forEach((seg, i) => {
            // Head is white, body fades to blue
            const col = i === 0 ? '#1768da' : `hsl(210, 80%, ${Math.max(20, 60 - (i * 1.5))}%)`;
            gfx.rect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, col);
        });
    }
}

/**
 * GAME CONTROLLER
 */
class SnakeGame extends Game {

    static meta = {
        id: "snake",
        title: "Directional Efficiency Test",
        desc: "Pilot the ISWORM across spacetime. Collect delicious q-bits. Avoid recursion.",
        instructions: "Arrow Keys or Swipe to Move. Collect the orange q-bits."
    };

    constructor(api) {
        super(api);

    }

    onInit() {
        this.score = 0;

        this.api.setScore(0);
        this.api.setStatus('RUNNING');

        // Add Entities
        this.add(new Snake(this));
        this.add(new Food());
    }

    // Custom draw loop to handle background clearing
    draw(gfx) {
        // Clear screen with a subtle grid pattern
        gfx.clear('#fff');
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if ((x + y) % 2 === 0) gfx.rect(x * CELL, y * CELL, CELL, CELL, '#e8f2ff');
            }
        }
        // Draw entities on top
        super.draw(gfx);
    }

    addScore(pts) {
        this.score += pts;
        this.api.setScore(this.score);
    }

    die() {
        const highScore = this.api.getHighScore();
        // If we just beat the high score, show the new score as the best
        const best = Math.max(this.score, highScore);

        this.api.gameOver(`SCORE: ${this.score}  |  BEST: ${best}`);
    }
}

Interactive.register(SnakeGame);