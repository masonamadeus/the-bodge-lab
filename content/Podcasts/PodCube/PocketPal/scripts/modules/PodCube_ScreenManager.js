/**
 * ScreenManager.js
 * Handles the lifecycle and navigation of screens in the PodCube application.
 * 
 * This manager:
 * - Creates and caches screen instances
 * - Handles screen navigation and history
 * - Manages screen controllers
 * - Coordinates with Adobe Animate/CreateJS stage
 */

import * as ScreenList from '../screens/ScreenList.js'; // Import all screens

export class ScreenManager {
    /**
     * Initialize the ScreenManager and set up navigation event handlers
     */
    constructor() {

        // Core screen management properties
        this.currentScreen = null;  // Reference to currently displayed screen
        this.screenManager = null;            // CreateJS container for screens
        this.screenHistory = {};           // Track screen history
        this.needsInitialization = true;   // Flag for lazy initialization

        //subscribe to 'navigate-screen' event
        PodCube.MSG.subscribe("Navigate-Screen", (event) => {
            this.loadScreen(event.linkageName, event.url);
        })

        this.actions = ['up', 'down', 'left', 'right', 'yes', 'no'];

        this.actions.forEach(action => {
            PodCube.MSG.subscribe(`Pressed-BTN_${action.toUpperCase()}`, () => this.handleInput(action));
        });

        PodCube.MSG.subscribe("Ready-Animate", () => {
            this.init();
            this.mapHintSymbols();
            this.homeHint.text = "Home";
            this.transHint.text = "Transmissions";

            PodCube.MSG.subscribe("Pressed-BTN_MAIN", () => {
                PodCube.ScreenManager.loadScreen("SC_MAIN");
            });
            PodCube.MSG.subscribe("Pressed-BTN_TRANSMISSIONS", () => {
                PodCube.ScreenManager.loadScreen("SC_TRANSMISSIONS");
            });
        });
    }


    mapHintSymbols() {
        this.upHint = exportRoot.region_2.upHint.label;
        this.downHint = exportRoot.region_2.downHint.label;
        this.leftHint = exportRoot.region_2.leftHint.label;
        this.rightHint = exportRoot.region_2.rightHint.label;
        this.yesHint = exportRoot.region_3.yesHint.label;
        this.noHint = exportRoot.region_3.noHint.label;
        this.transHint = exportRoot.region_3.transHint.label;
        this.homeHint = exportRoot.region_3.homeHint.label;
    }
    /**
     * Initialize the screen manager container from Adobe Animate stage
     * This connects our JavaScript manager to the visual stage hierarchy
     */
    init() {
        // Only initialize once
        if (!this.needsInitialization) {
            return;
        }

        this.screenManager = exportRoot.region_1.screenManager;
        this.needsInitialization = false;

        // Publish initialization complete event
        PodCube.MSG.publish('ScreenManager-Ready', {
            timestamp: Date.now()
        });

    }

    /**
   * Creates a new screen instance with its associated controller.
   * 
   * The process:
   * 1. Checks if the symbol exists in the Adobe Animate library
   * 2. Creates the CreateJS/Animate symbol instance
   * 3. Looks for a matching controller class in the PodCube namespace
   * 4. If found, attaches and initializes the controller
   * 
   * @param {string} linkageName - The Adobe Animate linkage name (e.g., "SC_TRANSMISSIONS")
   * @returns {CreateJS.MovieClip|null} The created screen instance or null if creation fails
   */

    createScreen(linkageName, url) {
        let screenSymbol, controllerClass, controllerInstance
        // First, verify the symbol exists in the Adobe Animate library
        if (linkageName === "SC_IFRAME") {

            PodCube.log("Making SC_IFRAME for URL: "+url)

            // make new 'symbol' for this. need to adjust transform to match screenmanager
            screenSymbol = new createjs.Container();
            screenSymbol.url = url;

            
        } else if (!PodCube.lib?.[linkageName]) {
            
            console.error(`ScreenManager: Screen symbol '${linkageName}' not found in library.`);
            
        } else {
            // Create the CreateJS/Animate MovieClip instance
            screenSymbol = new PodCube.lib[linkageName]();
        }


        // Create an instance of the controller
        controllerClass = ScreenList[linkageName];
        controllerInstance = new controllerClass(screenSymbol);

        screenSymbol.linkageName = linkageName;
        controllerInstance.linkageName = linkageName;


        // Attach the controller to the screen symbol
        screenSymbol.control = controllerInstance;

        screenSymbol.control.init();


        return controllerInstance;


    }


    /**
     * Main screen loading function
     * Handles the entire process of switching from one screen to another
     * 
     * @param {string} linkageName - The Adobe Animate linkage name of the screen to load
     */
    loadScreen(linkageName, url ="") {

        // Verify we have our stage container
        if (!this.screenManager) {
            console.error("ScreenManager: _scManager is not initialized.");
            return;
        }

        // Never navigate to the same screen
        if (this.currentScreen?.linkageName === linkageName) {
            console.log(`ScreenManager: Already on screen ${linkageName}`);
            return;
        }

        // Unload current screen
        this.unloadCurrentScreen();

        let screen = this.createScreen(linkageName, url);
        // Exit if screen creation failed
        if (!screen) {
            console.error(`ScreenManager: Failed to create screen ${linkageName}`);
            return;
        }


        // Update our current screen reference
        this.currentScreen = screen;

        // Add to the CreateJS display list
        this.screenManager.addChild(screen.symbol);

        // Call the screen's onShow method if it exists
        this.currentScreen.onShow();

        this.currentScreen.currentContext.subscribe(ctx => {
            this.updateHints(ctx);
        });

        // Trigger a stage update to render changes
        stage.update();

        // Broadcast that screen is loaded and ready
        // This lets other systems react to screen changes
        PodCube.MSG.publish("Loaded-Screen", {
            name: linkageName,    // Screen identifier
            instance: screen      // Reference to actual screen
        });
    }

    updateHints(context) {
        this.actions.forEach(action => {
            const hintText = context[action]?.hint || "";
            const hintSymbol = this[`${action}Hint`];
            if (hintSymbol) hintSymbol.text = hintText;
        });
    }

    handleInput(action) {
        if (this.currentScreen?.handleInput) {
            this.currentScreen.handleInput(action);
        } else {
            PodCube.log(`Can't Handle Input ${action}. Current screen ${this.currentScreen.name}`)
        }
    }

    /**
     * Clean up and remove the current screen
     * This handles both visual cleanup and controller disposal
     */
    unloadCurrentScreen() {
        // Check if we actually have a screen to unload
        if (!this.currentScreen) {
            console.warn("ScreenManager: No current screen to unload.");
            return;
        }

        try {
            // If screen has a destroy method (from controller), call it
            if (typeof this.currentScreen.destroy === "function") {
                this.currentScreen.destroy();

                // Notify system that screen resources can be cleaned up
                PodCube.MSG.publish("SCREEN_DISPOSED", {
                    screen: this.currentScreen
                });
            }

            // Remove from visual hierarchy and clear reference

                this.screenManager.removeChild(this.currentScreen.symbol);
                this.currentScreen.symbol.removeAllEventListeners();


            // Clear strong references that might prevent garbage collection
            if (this.currentScreen.controller) {
                this.currentScreen.controller = null;
            }

            this.currentScreen = null;

        } catch (error) {
            console.error("ScreenManager: Error during screen cleanup:", error);
            // Even if cleanup fails, still remove from display list
            try {
                this.screenManager?.removeChild(this.currentScreen);
                this.currentScreen = null;
            } catch (e) {
                console.error("ScreenManager: Critical error during cleanup:", e);
            }
        }
    }

    dumpCache() {
        this.screenHistory = [];


    }
}