import { PodCubeScreen } from "../classes/PodCube_Screen.js";

export class SC_MAIN extends PodCubeScreen {
    constructor(screenSymbol) {
        // call constructor of the parent class
        super(screenSymbol);
    }


    registerContexts() {
        this.defineContext("Main:Default", {
          up: {
            hint: "Upward",
            handler: () => {PodCube.log("Empty Handler")},
          },
          down: {
            hint: "Down",
            handler: () => {PodCube.log("Empty Handler")},
          },
          left: {
            hint: "Left",
            handler: () => {PodCube.log("Empty Handler")},
          },
          right: {
            hint: "Right",
            handler: () => {PodCube.log("Empty Handler")},
          },
          yes: {
            hint: "Slideshow",
            handler: () => {PodCube.MSG.pub("Navigate-Screen", {
                linkageName: "SC_IFRAME",
                url: "https://docs.google.com/presentation/d/e/2PACX-1vTuI3XqVfEmZml6dlZaWHK5ISB0hpXXKGisTVFLc9QT5BHfdjV9_TUkHGQqb8ueP-9fsnbk4xiQvio1/pubembed?rm=minimal"
            })},
          },
          no: {
            hint: "C Button",
            handler: () => {PodCube.log("Empty Handler")},
          },
        });
    }

    onInit() {

        // Register navigation contexts
         this.registerContexts();
         this.switchContext("Main:Default");
        


    }


}
