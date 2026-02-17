// --- SNAKE GAME LOGIC ---
let snakeState = {
    running: false,
    ctx: null,
    grid: 20,
    snake: [],
    food: {x: 0, y: 0},
    dx: 20, // moving right
    dy: 0,
    score: 0,
    loop: null,
    speed: 100
};

function initSnakeGame() {
    window.removeEventListener('keydown', handleGameRestart);

    const canvas = document.getElementById('snakeCanvas');
    if (!canvas) return;
    
    initTouchControls();

    // UPDATE HIGH SCORE UI
    const savedScore = localStorage.getItem('podcube_snake_highscore');
    snakeState.highScore = savedScore ? parseInt(savedScore) : 0;
    const highScoreEl = document.getElementById('snakeHighScore');
    if(highScoreEl) highScoreEl.textContent = snakeState.highScore;

    // Setup
    snakeState.ctx = canvas.getContext('2d');
    snakeState.snake = [{x: 160, y: 160}, {x: 140, y: 160}, {x: 120, y: 160}];
    snakeState.score = 0;
    snakeState.dx = snakeState.grid;
    snakeState.dy = 0;
    snakeState.running = true;
    
    // Reset UI
    document.getElementById('snakeOverlay').classList.add('hidden');
    document.getElementById('snakeScore').textContent = "0";

    placeFood();
    
    if (snakeState.loop) clearInterval(snakeState.loop);
    snakeState.loop = setInterval(gameLoop, snakeState.speed);
    
    // Log "official" activity
    logCommand('// Subsystem: Spatial_Coordination_Test initiated');
}

function gameLoop() {
    if (!snakeState.running) return;

    // Move Head
    const head = { 
        x: snakeState.snake[0].x + snakeState.dx, 
        y: snakeState.snake[0].y + snakeState.dy 
    };

    const canvas = document.getElementById('snakeCanvas');
    
    // Wall Collision (Game Over)
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        endGame("CALIBRATION COMPLETE");
        return;
    }

    // Self Collision (Game Over)
    for (let i = 0; i < snakeState.snake.length; i++) {
        if (head.x === snakeState.snake[i].x && head.y === snakeState.snake[i].y) {
            endGame("RECURSIVE ERROR");
            return;
        }
    }

    snakeState.snake.unshift(head);

    // Eat Food
    if (head.x === snakeState.food.x && head.y === snakeState.food.y) {
        snakeState.score += 10;
        document.getElementById('snakeScore').textContent = snakeState.score;
        placeFood();
        // Slight speed up?
    } else {
        snakeState.snake.pop(); // Remove tail
    }

    drawSnake();
}

function drawSnake() {
    const ctx = snakeState.ctx;
    const canvas = document.getElementById('snakeCanvas');

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Food (Data Packet)
    ctx.fillStyle = '#f18701'; // var(--orange)
    ctx.fillRect(snakeState.food.x, snakeState.food.y, snakeState.grid - 2, snakeState.grid - 2);

    // Draw Snake
    ctx.fillStyle = '#1768da'; // var(--primary)
    snakeState.snake.forEach((part, index) => {
        // Head is slightly darker
        ctx.fillStyle = index === 0 ? '#0d4da1' : '#1768da';
        ctx.fillRect(part.x, part.y, snakeState.grid - 2, snakeState.grid - 2);
    });
}

function placeFood() {
    const canvas = document.getElementById('snakeCanvas');
    const cols = canvas.width / snakeState.grid;
    const rows = canvas.height / snakeState.grid;
    
    snakeState.food = {
        x: Math.floor(Math.random() * cols) * snakeState.grid,
        y: Math.floor(Math.random() * rows) * snakeState.grid
    };
    
    // Don't place food on snake
    snakeState.snake.forEach(part => {
        if (part.x === snakeState.food.x && part.y === snakeState.food.y) placeFood();
    });
}

function endGame(reason) {
    snakeState.running = false;
    clearInterval(snakeState.loop);

    if (snakeState.score > snakeState.highScore) {
        snakeState.highScore = snakeState.score;
        localStorage.setItem('podcube_snake_highscore', snakeState.highScore);
        
        // Update UI
        const highScoreEl = document.getElementById('snakeHighScore');
        if(highScoreEl) highScoreEl.textContent = snakeState.highScore;
        
        // Notify the user of new record in the overlay
        reason += `<br><span style="color:var(--orange); font-size:18px;">★ NEW PEAK EFFICIENCY ★</span>`;
    }
    
    const overlay = document.getElementById('snakeOverlay');
    const msg = document.getElementById('snakeMsg');
    
    // Show the Game Over screen
    overlay.classList.remove('hidden');
    msg.innerHTML = `${reason}<br><span style="font-size:14px; color:#555">FINAL EFFICIENCY: ${snakeState.score}</span>`;
    
    // 1. FOCUS THE BUTTON (Simple Method)
    // This allows Spacebar or Enter to work immediately if focus isn't lost
    const restartBtn = overlay.querySelector('button');
    if(restartBtn) restartBtn.focus();

    // 2. ADD RESTART LISTENER (Robust Method)
    // This ensures "Enter" works even if the user clicked away
    window.addEventListener('keydown', handleGameRestart);

    logCommand(`// Test Failed: ${reason} (Score: ${snakeState.score})`);
}

function handleGameRestart(e) {
    // Only restart if the "Interactive" tab is actually open
    const interactiveTab = document.getElementById('interactive');
    if (!interactiveTab || !interactiveTab.classList.contains('active')) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        initSnakeGame();
    }
}

// KEYBOARD CONTROLS
document.addEventListener('keydown', (e) => {
    const interactiveTab = document.getElementById('interactive');
    
    // 1. Safety Check: Is the game actually running and visible?
    if (!snakeState.running || !interactiveTab || !interactiveTab.classList.contains('active')) return;

    // 2. Prevent Scrolling: If it's a game key, stop the browser from scrolling
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
    if (gameKeys.includes(e.key)) {
        e.preventDefault();
    }

    // 3. Game Logic
    if (e.key === 'ArrowLeft' || e.key === 'a') changeDirection('LEFT');
    if (e.key === 'ArrowUp' || e.key === 'w') changeDirection('UP');
    if (e.key === 'ArrowRight' || e.key === 'd') changeDirection('RIGHT');
    if (e.key === 'ArrowDown' || e.key === 's') changeDirection('DOWN');
});

// --- TOUCH CONTROLS (SWIPE) ---
let touchStart = { x: 0, y: 0 };

function initTouchControls() {
    const canvas = document.getElementById('snakeCanvas');
    
    // 1. Touch Start: Record where the finger landed
    canvas.addEventListener('touchstart', function(e) {
        // Stop the browser from firing "click" or scrolling
        if(snakeState.running) e.preventDefault(); 
        
        // Stop the "explorer.js" tab swiper from seeing this event
        e.stopPropagation();

        touchStart.x = e.changedTouches[0].screenX;
        touchStart.y = e.changedTouches[0].screenY;
    }, { passive: false });

    // 2. Touch Move: VITAL for preventing "pull to refresh" or scroll behaviors
    canvas.addEventListener('touchmove', function(e) {
        if(snakeState.running) {
            e.preventDefault(); 
            e.stopPropagation();
        }
    }, { passive: false });

    // 3. Touch End: Calculate the swipe direction
    canvas.addEventListener('touchend', function(e) {
        if(!snakeState.running) return;
        
        e.preventDefault();
        e.stopPropagation();

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        handleSwipeInput(touchStart.x, touchStart.y, touchEndX, touchEndY);
    }, { passive: false });
}

function handleSwipeInput(startX, startY, endX, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    
    // Minimum distance to count as a swipe (prevents accidental taps)
    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

    // Determine which axis had the bigger movement
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal Swipe
        if (diffX > 0) changeDirection('RIGHT');
        else changeDirection('LEFT');
    } else {
        // Vertical Swipe
        if (diffY > 0) changeDirection('DOWN');
        else changeDirection('UP');
    }
}

// Helper to reuse logic between Keyboard and Touch
function changeDirection(dir) {
    const goingUp = snakeState.dy === -snakeState.grid;
    const goingDown = snakeState.dy === snakeState.grid;
    const goingRight = snakeState.dx === snakeState.grid;
    const goingLeft = snakeState.dx === -snakeState.grid;

    if (dir === 'LEFT' && !goingRight) {
        snakeState.dx = -snakeState.grid;
        snakeState.dy = 0;
    }
    if (dir === 'UP' && !goingDown) {
        snakeState.dx = 0;
        snakeState.dy = -snakeState.grid;
    }
    if (dir === 'RIGHT' && !goingLeft) {
        snakeState.dx = snakeState.grid;
        snakeState.dy = 0;
    }
    if (dir === 'DOWN' && !goingUp) {
        snakeState.dx = 0;
        snakeState.dy = snakeState.grid;
    }
}

// LOAD HIGH SCORE ON PAGE LOAD, RUN AUTOMATICALLY
function loadHighScore() {
    try {
        const saved = localStorage.getItem('podcube_snake_highscore');
        const display = document.getElementById('snakeHighScore');
        if (display) {
            display.textContent = saved ? saved : '0';
        }
    } catch (e) {
        console.warn("Could not load high score:", e);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    try {
        loadHighScore();
    } catch (e) {
        console.warn("Could not load high score:", e);
    }
});