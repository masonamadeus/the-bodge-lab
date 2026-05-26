export class PodCubeScreen {
    constructor(screenInstance) {
        if (this.constructor === PodCube.PodCubeScreen) {
            throw new Error('PodCubeScreen is an abstract class and cannot be instantiated directly');
        }
        this.symbol = screenInstance;
        this.contexts = {};
        
    }

    get context() {
        return {name: this.currentContextName, data: this.currentContext.get()}
    }


    init() {
        if (this.initialized) {
            console.warn(`${this.constructor.name}: Already initialized. Skipping re-initialization.`);
            return;
        }
        this.initialized = true;

        this.currentContext = PodCube.MSG.createObservable(null);

        this.defineContext("fallback", {
          up: {
            hint: "Upward",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
          down: {
            hint: "Down",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
          left: {
            hint: "Left",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
          right: {
            hint: "Right",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
          yes: {
            hint: "P Button",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
          no: {
            hint: "C Button",
            handler: () => {PodCube.log("Screen in fallback context")},
          },
        });
        this.switchContext("fallback")
        this.onInit();
    }

    // Override these methods in your screen classes
    onInit() {
        PodCube.log(`Class ${this.screenInstance.name} does not override base Screen onInit()`)

    }

    onShow() {

    }

    destroy() {
    }

    handleInput(action) {
        const ctx = this.currentContext.get();
        const handler = ctx[action].handler;
        if (handler) handler.call(this);
    }

    defineContext(name, actions) {
      this.contexts[name] = actions;
    }

    switchContext(name) {
        this.currentContext.set(this.contexts[name]);
        this.currentContextName = name;
    }

    // Utility method to find a child by name in the screen instance
    getChild(name) {
        return this.screenInstance[name] || null;
    }


};
