// RESPONSIBLE FOR DISPENSING INTERACTION LOGIC THAT WAS TOO COMPLICATED FOR ME TO CODE UP IN THE SHITTY INTERNAL EDITOR, PLUS I DON'T TRUST IT LOL.
import { Episode } from "../classes/PodCube_Episode.js";


export class BehaviorManager {
    constructor() {
        this.registeredSymbols = [];

    }


    EpisodeSymbol(episodeSymbol, episode) {

        if (episodeSymbol.initialized) {
            PodCube.log("EpisodeSymbol: Already initialized");
            return;
        }
        episodeSymbol.initialized = true;
        if (!episodeSymbol || !episode) {
            PodCube.log("EpisodeSymbol: Missing required parameters");
            return;
        }

        // Store episode reference
        episodeSymbol.episode = episode;


        Episode.propertyList.forEach(prop => {
            try {
                // Check if the property exists and is a text field
                if (episodeSymbol[prop]?.text !== undefined && episode[prop] !== undefined) {
                    let value;
                    if (Array.isArray(episode[prop])) {
                        value = episode[prop].join(", ");
                    } else {
                        value = episode[prop].toString();
                    }

                    
                    episodeSymbol[prop].text = value

                }
            } catch (err) {
                PodCube.log(`EpisodeSymbol: Error setting ${prop}:`, err);
            }
        });
    }

    // THIS IS THE BUTTON CLASS
    // IT'S A CLASS THAT HANDLES BUTTONS AND THEIR INTERACTIONS
    Button(thing) {
        thing.initialized = true;
        thing.isDebouncing = false;
        thing.debounceDelay = 80;
        thing.isPressed = false;
        thing.halfwayPoint = Math.floor(thing.totalFrames / 2) - 1;
        thing.hoverPoint = Math.ceil(thing.totalFrames / 3) - 1;
        thing.title = thing.keybind;

        // THE PRIMARY ACTION IS THE THING THAT HAPPENS WHEN YOU PRESS THE BUTTON
        thing.primaryAction = function () {
            thing.play();
            PodCube.MSG.publish("Pressed-" + thing.name, thing);
        };

        // Use the helper function to set up the hit area
        this.setHitArea(thing);

        // SET UP MOUSE STATES AND STUFF
        thing.handleDragLeave = function () {
            thing.gotoAndStop(0);
            thing.isPressed = false;
        }.bind(thing);

        thing.handleHover = function () {
            thing.gotoAndStop(thing.hoverPoint);
        }.bind(thing);

        thing.handleTouch = function () {
            thing.gotoAndStop(thing.halfwayPoint);
            thing.isPressed = true;
        }.bind(thing);

        thing.handleRelease = function () {
            if (thing.isDebouncing || !thing.isPressed) {
                return;
            }
            thing.isDebouncing = true;
            thing.primaryAction();

            setTimeout(() => {
                thing.isDebouncing = false;
            }, thing.debounceDelay);
        }.bind(thing);

        // MAPPING INPUT EVENTS
        thing.on("mouseover", thing.handleHover);
        thing.on("mousedown", thing.handleTouch);
        thing.on("touchstart", thing.handleTouch);
        thing.on("mouseout", thing.handleDragLeave);
        thing.on("touchcancel", thing.handleDragLeave);
        thing.on("pressup", thing.handleRelease);

        // SUBSCRIBE TO KEYBINDS
        if (thing.keybind) {
            const keybind = Array.isArray(thing.keybind) ? thing.keybind : [thing.keybind];
            keybind.forEach(function (key) {
                PodCube.MSG.subscribe("Keyboard-" + key, thing.primaryAction, false);
            });
        } else if (thing.attributes?.keybind) {
            thing.attributes.keybind.forEach(function (key) {
                PodCube.MSG.subscribe("Keyboard-" + key, thing.primaryAction, false);
            });
        }
    }

    // THIS SETS UP A HIT AREA FOR ANY SYMBOL THAT HAS NOMINAL BOUNDS

    setHitArea(thing) {
        if (!thing.nominalBounds) {
            console.error("BehaviorManager: 'nominalBounds' is missing on the thing object.");
            return;
        }

        const bounds = thing.nominalBounds;
        const hitArea = new createjs.Shape();
        hitArea.graphics.beginFill("#00000").drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
        thing.hitArea = hitArea;
    }
}
