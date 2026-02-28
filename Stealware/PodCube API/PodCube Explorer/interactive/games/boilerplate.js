// =============================================================================
// NEW GAME BOILERPLATE
// =============================================================================

class MyNewGame extends Game {

    static meta = { 
            title: "Game Title", 
            desc: "A short description of your adventure.",
            instructions: "Controls and goal go here." 
        };

    constructor(api) {
        super(api);
        // CONSTRUCTOR STUFF
    }

    /**
     * @param {object} api - The engine API (gameOps) passed in from the engine.
     */
    onInit() {

        this.api.setScore(0);
        this.api.setStatus('ACTIVE');

        // Initial UI or Game Setup
        // this.add(new Player());
    }

    /**
     * Logic loop (runs 60 times per second)
     */
    update(dt, input) {
        // Update all entities automatically
        super.update(dt, input);
        
        // Global game logic (timers, score checks, etc.)
    }

    /**
     * Render loop
     */
    draw(gfx) {
        // 1. Clear the background
        gfx.clear('#111'); 

        // 2. Draw world elements (grids, backgrounds)

        // 3. Draw all entities added via this.add()
        super.draw(gfx); 
    }

    /**
     * Custom Helper: Use this.api to interact with the engine HUD/State
     */
    addPoints(pts) {
        this.score += pts;
        this.api.setScore(this.score);
    }

    die() {
        const best = this.api.getHighScore();
        const msg = `Final Score: ${this.score} (Best: ${Math.max(this.score, best)})`;
        this.api.gameOver(msg);
    }

    /**
     * Cleanup: Runs when the game is exited/ejected
     */
    onCleanup() {
        console.log("Cleaning up game resources...");
    }
}

// Register the game with the engine
// Interactive.register('my-game-id', MyNewGame);