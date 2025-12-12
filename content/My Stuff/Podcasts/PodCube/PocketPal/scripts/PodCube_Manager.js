/**
 * PodCube_Manager
 * Core orchestrator for the PodCube application.
 * 
 * Responsibilities:
 * - Initializes and manages all core subsystems
 * - Provides global access to subsystems via window.PodCube
 * - Manages Adobe Animate library integration
 * - Handles feed data and caching
 * 
 * Architecture:
 * - MessageSystem: Event/message bus for system communication
 * - ContextManager: Handles input context and navigation
 * - ScreenManager: Manages screen lifecycle and transitions
 * - AudioPlayer: Handles podcast playback
 * - BehaviorManager: Manages UI component behaviors
 */

import { MessageSystem } from './modules/PodCube_MSG.js';
import { MemoryCartridge } from './modules/PodCube_MemoryCartridge.js';
import { PodCubeJSON } from './modules/PodCube_JSON.js';
import { ScreenManager } from './modules/PodCube_ScreenManager.js';
import { PodCubeAudioPlayer } from './modules/PodCube_AudioPlayer.js';
import { BehaviorManager } from './modules/PodCube_BehaviorManager.js';
import { PodCubeRSS } from './modules/PodCube_RSS.js';
import * as PodCubeClasses from './classes/ClassList.js'; // Import all PodCube object classes

class PodCube_Manager {

    get symbolPath() {
        // get the various hardcoded symbol paths we need
        return {
            audioPlayer: exportRoot.region_2.Player,
            backdrop: exportRoot.region_1.backdrop,

        }
    }
    constructor() {
        this.Class = {}   // Object classes will be attached here

        window.onerror = (message, source, lineno, colno, error) => this.handleError(message, source, lineno, colno, error);
        document.addEventListener("contextmenu", function (e) {
            e.preventDefault();
        });



        window.playSound = function (id) {
            return createjs.Sound.play(id);
        };

        window.PodCube = this; // Expose the instance globally for easy access
        this.fontFaces = [
            'Do Hyeon',
            'Rubik 80s Fade',
            'Share Tech Mono',
            'Share Tech',
            'Convection',
            'Libre Barcode 39',
            'Linear Beam',
            'Nova Square',
            'Sixtyfour:BLED,SCAN@13,-7',
            'Jersey 25 Charted',
            'VT323',
        ];
        this.loadFonts(); // Load fonts from Google Fonts

        //window.PodCube = this; // Expose the instance globally for easy access

        // System readiness flag
        this._isReady = false;
        this._feed = null; // Placeholder for feed data
        this._feedCache = {}; // Cache for feed data


        this._initializePodCubeModules(); // Initialize core subsystems in dependency order

        this.log = (...args) => this.MSG.debug(...args); // Create shorthand for debug logging

        this._attachClassDefinitions(); // Attach all object classes to this instance

        //
        // this._feed = this.Memory.load('feed'); // Try to load cached feed - MemoryCartridge handles TTL internally

        if (this._feed) {
            this.MSG.publish('Feed-Ready');
            this.log("PodCube_Manager: Using cached feed");

        } else {

            this.log("PodCube_Manager: fetching fresh feed");
            this.fetchFeed();
        }

        // Wait for Adobe Animate to initialize
        // This ensures all CreateJS symbols are ready before we start
        this.MSG.subscribe("Ready-Animate", this._handleAnimateReady.bind(this));
    }

    // Method to get the feed data
    get Feed() {
        return this._feed;
    }

    fetchFeed() {
        this.log("PodCube_Manager: fetching fresh feed");
        try {
            this.json.fetchFeed().then(feed => {
                this._feed = feed;
                this.Memory.save('feed', feed); // Uses MemoryCartridge's default 24h TTL
                this.MSG.publish('Feed-Ready');
                this.log("PodCube_Manager: Fetched and cached fresh feed");
            });
        }
        catch (e) {
            this.log("PodCube: Couldn't get JSON Feed");
        }
    }

    handleError(message, source, lineno, colno, error) {
        PodCube.errorText = this.formatErrorMsg(error || { message, source, lineno, colno });
        this.ScreenManager.loadScreen("SC_BUSTED");
    }

    formatErrorMsg(err) {
        if (!err) return "Unknown error";
        let msg = `Error: ${err.message || err.toString()}`;
        if (err.stack) {
            msg += `\nStack:\n${err.stack}`;
        } else if (err.lineno !== undefined && err.colno !== undefined && err.source) {
            msg += `\nAt ${err.source}:${err.lineno}:${err.colno}`;
        }
        return msg;
    }

    // Initialize core subsystems in dependency order:
    _initializePodCubeModules() {
        this.MSG = new MessageSystem();             // Message bus (needed by everything)
        this.Memory = new MemoryCartridge();        // Persistent storage
        this.json = new PodCubeJSON();              // Data provider
        this.ScreenManager = new ScreenManager();   // Screen management

        this.Behavior = new BehaviorManager();      // UI behaviors
    }

    // Attach all object classes to this instance using the barrel file import
    // This allows them to be referenced as PodCube.Episode, etc.
    _attachClassDefinitions() {

        for (const [name, obj] of Object.entries(PodCubeClasses)) {
            // Check if the object is a class
            if (typeof obj === 'function' && obj.prototype) {
                // Attach the class to this, so we can access it as PodCube.Episode, etc.
                this.Class[name] = obj;
                this.log(`PodCube_Manager: Attached class ${name}`);
            }
        }

    }

    _handleAnimateReady() {

        // Get reference to Adobe Animate library
        // This contains all exported symbols (screens, UI components, etc.)
        this.lib = AdobeAn.getComposition(AdobeAn.bootcompsLoaded[0]).getLibrary();
        this.lib.properties.manifest.forEach(item => {
            if (item.src.endsWith(".mp3") || item.src.endsWith(".wav")) {
                createjs.Sound.registerSound(item.src, item.id);
            }
        });

        // --- Custom playToLabel function for CreateJS MovieClip prototype ---
        /**
         * Extends the CreateJS MovieClip prototype to add a custom playToLabel function.
         * This function plays the MovieClip towards a specified frame label and stops when it reaches it.
         * It handles playing both forward and backward to reach the target label.
         *
         * @param {string} labelName The name of the label to play to.
         */
        createjs.MovieClip.prototype.playToLabel = function(labelName) {
            const movieClip = this; // Reference to the movie clip instance

            // Find the target frame position for the given label
            const targetLabel = movieClip.labels.find(label => label.label === labelName);

            if (!targetLabel) {
                console.warn(`Label "${labelName}" not found in MovieClip.`);
                return;
            }

            const targetFrame = targetLabel.position;

            if (targetFrame === movieClip.currentFrame) {movieClip.stop(); return;} // Already at target frame, no action needed

            
            console.log(`Playing to label: "${labelName}" (frame: ${targetFrame})`);

            // Clear any previous tick listeners to prevent multiple active playToLabel calls
            if (movieClip._playToLabelListener) {
                createjs.Ticker.removeEventListener("tick", movieClip._playToLabelListener);
                movieClip._playToLabelListener = null;
            }

            // Determine if we need to play forward or backward
            const playDirection = (targetFrame >= movieClip.currentFrame) ? 1 : -1;

            // Start playing the movie clip based on direction
            if (playDirection === 1) {
                movieClip.gotoAndPlay(movieClip.currentFrame); // Continue playing forward
            } else {
                movieClip.stop(); // Stop, and we will manually step backward
            }

            // Define the tick listener function
            const onTick = () => {
                if (playDirection === 1) {
                    // Playing forward
                    if (movieClip.currentFrame >= targetFrame) {
                        movieClip.gotoAndStop(targetFrame); // Ensure it's exactly on the target frame
                        movieClip.stop(); // Stop the playback
                        createjs.Ticker.removeEventListener("tick", onTick); // Remove the listener
                        movieClip._playToLabelListener = null;
                        console.log(`Stopped at label: "${labelName}" (frame: ${targetFrame})`);
                    }
                } else {
                    // Playing backward (manual stepping)
                    if (movieClip.currentFrame <= targetFrame) {
                        movieClip.gotoAndStop(targetFrame); // Ensure it's exactly on the target frame
                        movieClip.stop(); // Stop the playback
                        createjs.Ticker.removeEventListener("tick", onTick); // Remove the listener
                        movieClip._playToLabelListener = null;
                        console.log(`Stopped at label: "${labelName}" (frame: ${targetFrame})`);
                    } else if (movieClip.currentFrame > 0) {
                        // Manually go to the previous frame
                        movieClip.gotoAndStop(movieClip.currentFrame - 1);
                    } else { // Reached frame 0 without reaching target (target must be 0)
                        movieClip.gotoAndStop(0); // Ensure it's at frame 0
                        movieClip.stop();
                        createjs.Ticker.removeEventListener("tick", onTick);
                        movieClip._playToLabelListener = null;
                        console.log(`Stopped at label: "${labelName}" (frame: ${targetFrame})`);
                    }
                }
            };

            // Store the listener reference for future cleanup
            movieClip._playToLabelListener = onTick;
            // Add the tick listener to the Ticker
            createjs.Ticker.addEventListener("tick", onTick);
        };

        // =================================================================== \\
        // ANIMATE IS READY NOW. ALL THE FOLLOWING ACTIONS ARE SAFE TO EXECUTE \\
        // =================================================================== \\



        this.Player = new PodCubeAudioPlayer(this.symbolPath["audioPlayer"].screen);     // Audio playback

        // Mark system as ready for operation
        this._isReady = true;

        this.MSG.publish('Navigate-Screen', { linkageName: 'SC_TRANSMISSIONS' }); // Start at TRANSMISSIONS for now
    }

    loadFonts() {
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
    }

    RESET() {
        this.MemoryCartridge.format();
        PodCube.MSG("Navigate-Screen", { linkageName: "SC_MAIN" });
    }

    hideBackdrop() {
        this.symbolPath["backdrop"].visible = false;
    }

    showBackdrop() {
        this.symbolPath["backdrop"].visible = true;
    }


}

// Initialize the PodCube manager instance
const PodCube = new PodCube_Manager();
