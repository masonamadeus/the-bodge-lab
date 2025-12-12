export class MessageSystem {
    constructor() {
        this._subscriptions = {};
        this.debugEnabled = true;
        this.logDefault = true;

        // Add keyboard listener
        window.addEventListener("keydown", this.keyboard.bind(this));
    }

    // Enable debug mode
    enableDebug() {
        this.debugEnabled = true;
    }

    // Disable debug mode
    disableDebug() {
        this.debugEnabled = false;
    }

    // Debug method
    debug(...args) {
        if (!this.debugEnabled) {
            return; // Suppress debug messages if debug mode is disabled
        }
        console.log("[DEBUG]", ...args); // Prefix debug messages with "[DEBUG]"
    }

    subscribe(eventType, handler, log = this.logDefault) {
        if (log) {
            console.log("MSG.subscribe: " + eventType.toString());
        }
        if (!this._subscriptions[eventType]) {
            this._subscriptions[eventType] = [];
        }
        this._subscriptions[eventType].push(handler);
    }

    publish(eventType, data, log = this.logDefault) {

        if (log) {
            console.log("MSG.publish: " + eventType.toString());
        }

        if (!this._subscriptions[eventType]) {
            return;
        }
        this._subscriptions[eventType].forEach(handler => {
            handler(data);
        });
    }

    unsubscribe(eventType, handler) {
        if (!this._subscriptions[eventType]) return;
        this._subscriptions[eventType] = this._subscriptions[eventType].filter(h => h !== handler);
    }

    keyboard(e) {
        let k = e.key;
        if (k == " ") {
            k = "space";
        }
        this.publish("Keyboard-" + k, e);
    }

    createObservable(initialValue) {
        let value = initialValue;
        const subscribers = new Set();

        return {
            get: () => value,
            set: (newValue) => {
                value = newValue;
                subscribers.forEach((fn) => fn(newValue));
            },
            subscribe: (fn) => {
                subscribers.add(fn);
                fn(value); // Optional: immediately call with current value
                return () => subscribers.delete(fn); // unsubscribe
            }
        };
    }

    // Aliases as class methods
    sub(...args) { return this.subscribe(...args); }
    pub(...args) { return this.publish(...args); }
    log(...args) { return this.debug(...args); }
}







