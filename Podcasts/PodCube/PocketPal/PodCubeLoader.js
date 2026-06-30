/**
 * PodCubeLoader - Loads and initializes the PodCube application.
 * This class manages the loading of scripts, fonts, and initializes the core PodCube functionality.
 */


// OUTDATED IF WE ARE USING THE NEW MODULES

const PodCubeLoader = {

    // Object classes load first
    objectScripts: [
        'scripts/objects/PodCube_Episode.js',
        'scripts/objects/PodCube_Feed.js',
        'scripts/objects/PodCube_Screen.js', // Base screen class - Defines the base class for all Pod
    ],

    // Load module classes first
    moduleScripts: [
        'scripts/modules/PodCubeJSON.js',          // JSON feed parser - Parses podcast feeds from JSON format.
        'scripts/modules/PodCubeRSS.js',           // RSS feed parser - Parses podcast feeds from RSS format.
        'scripts/modules/PodCubeAudioPlayer.js',   // Audio player - Handles audio playback functionality.
        'scripts/modules/PodCubeBehaviorDispenser.js', // UI behaviors - Manages UI behaviors and interactions.
        'scripts/modules/PodCubeContextManager.js', // Navigation contexts - Manages navigation contexts and screen transitions.
        'scripts/modules/PodCubeScreenManager.js',  // Screen management - Handles screen management and display logic.
        'scripts/modules/PodCube_MemoryCartridge.js', // Persistent storage - Provides persistent storage for user data and settings.
        'scripts/modules/PodCubeMSG.js',          // Base messaging system - Handles communication between PodCube components.
    ],

    // Manager and screens load after modules
    screenScripts: [
        'scripts/PodCube_Manager.js',      // Core manager (creates global instance) - Creates and manages the core PodCube manager instance.
        'scripts/screens/SC_TRANSMISSIONS.js',
        'scripts/screens/SC_QUEUE.js',
        'scripts/screens/SC_MAIN.js',
    ],

    fontFaces: [
        'Do Hyeon',
        'Rubik 80s Fade',
        'Share Tech Mono',
        'Share Tech',
        'Convection',
        'Libre Barcode 39',
        'Linear Beam',
        'Nova Square',
        'Sixtyfour:BLED,SCAN@13,-7',
    ],

    /**
     * Loads a script from a given URL.
     * @param {string} scriptPath - The URL of the script to load.
     * @returns {Promise} - A promise that resolves when the script is loaded successfully.
     */
    loadScript: function(scriptPath) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.onload = () => {
                console.log(`Loaded: ${scriptPath}`);
                resolve();
            };
            script.onerror = () => reject(`Failed to load: ${scriptPath}`);
            document.head.appendChild(script);
        });
    },

    /**
     * Loads an array of scripts in order.
     * @param {string[]} scripts - An array of script paths to load.
     * @returns {Promise[]} - An array of promises, one for each script.
     */
    loadScriptsInOrder: async function(scripts) {
        for (const script of scripts) {
            await this.loadScript(script);
        }
    },

    /**
     * Initializes the PodCube application.
     * This function loads all necessary scripts and initializes the core PodCube functionality.
     * @returns {Promise} - A promise that resolves when the initialization is complete.
     */
    init: async function() {
        try {

            console.log("://INITIALIZING PODCUBE(pocketpal);")
            console.log("://STATUS(...) {Defrigulating Object Classes...}");
            await this.loadScriptsInOrder(this.objectScripts);

            // Load module classes first
            console.log("://STATUS(...) {Preparing PocketPal Modules...}");
            await this.loadScriptsInOrder(this.moduleScripts);

            // Load manager and screens
            console.log("://STATUS(...) {Booting PodCube Manager Components...}");
            await this.loadScriptsInOrder(this.screenScripts);

            // Initialize PodCube (but it will wait for Animate)
            console.log("://STATUS(...) {Initializing PodCube Manager...}");
            new PodCube_Manager(); // Create the manager instance

            // Signal core scripts are ready
            console.log("://STATUS(...) {PodCube™ PocketPal is ready!}");

        } catch (error) {
            console.error("Script loading failed:", error);
        }
    },

    /**
     * Loads fonts from Google Fonts and other sources.
     * This function fetches and links the necessary font stylesheets.
     */

    loadFonts: function() {
        const preconnectGoogleApis = document.createElement('link');
        preconnectGoogleApis.rel = 'preconnect';
        preconnectGoogleApis.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnectGoogleApis);

        const preconnectGstatic = document.createElement('link');
        preconnectGstatic.rel = 'preconnect';
        preconnectGstatic.href = 'https://fonts.gstatic.com';
        preconnectGstatic.crossOrigin = 'anonymous';
        document.head.appendChild(preconnectGstatic);

        const fontQuery = this.fontFaces.map(font => font.replace(/ /g, '+')).join('&family=');
        const fontUrl = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;

        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.href = fontUrl;
        document.head.appendChild(linkElement);
        console.log(`Font linked: ${fontUrl}`);
    },
};

// Start loading everything
document.addEventListener('DOMContentLoaded', () => {
    PodCubeLoader.loadFonts();
    PodCubeLoader.init();
});