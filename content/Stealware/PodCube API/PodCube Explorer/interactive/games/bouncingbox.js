

/**
 * 1. DEFINE AN ENTITY
 * Entities are objects in your game (player, enemies, bullets).
 */
class BouncingBox extends Entity {
    constructor(game) {
        super(200, 150); // Start x, y
        this.game = game;
        this.api = game.api;
        this.size = 30;
        
        // Velocity (pixels per second)
        this.vx = 100;
        this.vy = 100;
    }

    /**
     * UPDATE LOOP
     * Called 60 times per second. Put logic here.
     * @param {number} dt - Time in seconds since last frame (approx 0.016)
     * @param {object} input - Object containing { pressed, held, mouse }
     */
    update(dt, input) {
        // 1. Move based on velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 2. Input Example: Speed up when SPACE is held
        if (input.held.ACTION) {
            this.x += this.vx * dt; // Double speed!
            this.y += this.vy * dt;
        }

        // 3. Collision: Bounce off walls
        // api.gameOps.W and H are the canvas width/height (400x300)
        const W = this.api.W;
        const H = this.api.H;

        if (this.x < 0 || this.x + this.size > W) {
            this.vx *= -1; // Reverse horizontal direction
            this.game.addPoints(1); // Call a method on the main game class
        }
        if (this.y < 0 || this.y + this.size > H) {
            this.vy *= -1; // Reverse vertical direction
            this.game.addPoints(1);
        }
    }

    /**
     * DRAW LOOP
     * Called after update. Draw your shape here.
     * @param {object} gfx - The drawing toolkit
     */
    draw(gfx) {


        gfx.rect(this.x, this.y, this.size, this.size, '#1768da');

        // 2. Calculate the center of the box
        const centerX = this.x + (this.size / 2);
        const centerY = this.y + (this.size / 2);

        // 3. Draw centered text
        gfx.text("P™", centerX, centerY + 6, {
            color: '#fff',
            size: 16,
            align: 'center' // This makes the horizontal math work
        });
        
    }
}

/**
 * 2. DEFINE THE GAME CARTRIDGE
 * This manages the game state and list of entities.
 */
class BouncingBoxGame extends Game {
    
    // Metadata displayed in the menu
    static meta = { 
        title: "Bouncing Box", 
        desc: "Watch the box bounce. Maybe it will hit a corner.",
        instructions: "Hold SPACE to speed up. Watch it bounce." 
    };
    
    constructor(api) {
        super(api);
    }

    

    /**
     * INIT
     * Called when the game starts. Create your entities here.
     */
    onInit() {

        this.api.setScore(0);
        this.api.setStatus('ACTIVE');

        // Add our player entity to the world
        this.add(new BouncingBox(this));
    }

    /**
     * CUSTOM HELPER
     * You can add your own methods to manage game logic.
     */
    addPoints(n) {
        this.score += n;
        this.api.setScore(this.score);
        
        // Win condition example
        if (this.score >= 10) {
            //this.api.win("You reached 10 bounces!");
        }
    }

    /**
     * BACKGROUND DRAWING
     * Overwrite draw() if you want to clear the screen with a specific color
     * or draw a background image before the entities.
     */
    draw(gfx) {
        // Clear screen with a dark blue color
        gfx.clear('#fff');
        
        // Draw entities on top (required!)
        super.draw(gfx);
    }
}

// 3. REGISTER THE GAME
// This adds it to the PodCube menu.
Interactive.register('bouncingbox', BouncingBoxGame);