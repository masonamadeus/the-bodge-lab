// =============================================================================
// CARTRIDGE: Directional Efficiency (Snake)
//
// Demonstrates: flat API pattern (onInit / onUpdate / onDraw), PC.makeTimer,
// canvas drawing, collision detection
//
// All game state lives in IIFE closure vars, safely reset by onInit each run.
// =============================================================================
/*
Interactive.register('snake', (() => {

    // Grid: 20 columns × 15 rows × 20px cell = 400×300 logical canvas
    const COLS = 40;
    const ROWS = 30;
    const CELL = 10;

    // Closure state — reset in onInit, shared between onUpdate and onDraw
    let snake, dir, nextDir, food, score, level, stepTimer;

    function spawnFood(body = []) {
        // Keep trying until we find a cell not occupied by the snake
        let f;
        do { f = { x: PC.randInt(0, COLS - 1), y: PC.randInt(0, ROWS - 1) }; }
        while (body.some(p => p.x === f.x && p.y === f.y));
        return f;
    }

    return {
        meta: {
            title: "Directional Efficiency",
            desc: "Navigate the isWORM across the spatial grid. Consume data packets. Avoid recursion.",
            instructions: "Eat orange Q-Bits to grow. Don't crash into walls or yourself.",
            controls: "SWIPE  /  ARROWS  /  WASD  to turn",
        },

        onInit(api) {
            snake = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
            dir = { x: 1, y: 0 };
            nextDir = { x: 1, y: 0 };
            food = spawnFood(snake);
            score = 0;
            level = 1;
            stepTimer = PC.makeTimer(0.1); // advances snake once per interval
            api.setScore(0);
            api.setLabel('LV 1');
        },

        onUpdate(dt, input, api) {

            

            // input.pressed fires only on the FIRST frame of a keydown.
            // This prevents buffering a 180° turn that would kill the snake.
            if (input.pressed.UP && dir.y === 0) nextDir = { x: 0, y: -1 };
            if (input.pressed.DOWN && dir.y === 0) nextDir = { x: 0, y: 1 };
            if (input.pressed.LEFT && dir.x === 0) nextDir = { x: -1, y: 0 };
            if (input.pressed.RIGHT && dir.x === 0) nextDir = { x: 1, y: 0 };

            // Advance the snake only once per step interval
            if (!stepTimer.tick(dt)) return;

            dir = nextDir;
            const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

            // Collision: walls or self
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
                snake.some(p => p.x === head.x && p.y === head.y)) {
                api.gameOver(`EFFICIENCY: ${score}`, `High score: ${api.getHighScore()} pts`);
                return;
            }


            snake.unshift(head);

            if (head.x === food.x && head.y === food.y) {
                // Eat: grow, score, speed up, level up
                score += 10;
                level = Math.floor(score / 50) + 1;
                stepTimer.max = Math.max(0.04, 0.1 - (level - 1) * 0.008);
                food = spawnFood(snake);
                api.setScore(score);
                api.setLabel(`LV ${level}`);
            } else {
                snake.pop(); // only remove tail if we didn't eat
            }
        },

        onDraw(gfx) {
            // Dark background with subtle checkerboard
            gfx.clear('#ffffffff');
            for (let x = 0; x < COLS; x++)
                for (let y = 0; y < ROWS; y++)
                    gfx.rect(x * CELL, y * CELL, CELL, CELL, (x + y) % 2 === 0 ? '#f6f8ffff' : '#ffffffff');

            // Food with glow ring
            const fx = food.x * CELL + CELL / 2;
            const fy = food.y * CELL + CELL / 2;
            gfx.circle(fx, fy, CELL / 2 + 2, null, 'rgba(241,135,1,0.2)', 4);
            gfx.circle(fx, fy, CELL / 2 - 2, '#f18701');

            // Snake body — head is bright, tail fades dark
            snake.forEach((seg, i) => {
                const brightness = Math.round(60 - (i / snake.length) * 30);
                const pad = i === 0 ? 1 : 2;
                gfx.roundRect(
                    seg.x * CELL + pad, seg.y * CELL + pad,
                    CELL - pad * 2, CELL - pad * 2,
                    i === 0 ? 4 : 3,
                    `hsl(215, 70%, ${brightness}%)`
                );
            });

            // Head eyes — point in direction of travel
            const hx = snake[0].x * CELL + CELL / 2;
            const hy = snake[0].y * CELL + CELL / 2;
            const perp = { x: -dir.y, y: dir.x }; // perpendicular to movement direction
            const eo = CELL * 0.22;
            gfx.circle(hx + dir.x * eo + perp.x * 3, hy + dir.y * eo + perp.y * 3, 2, '#ffb223');
            gfx.circle(hx + dir.x * eo - perp.x * 3, hy + dir.y * eo - perp.y * 3, 2, '#ffb223');
        },
    };

})());

//*/