import { PodCubeScreen } from "../classes/PodCube_Screen.js";
export class SC_BUSTED extends PodCubeScreen {
    constructor(symbol) {
        super(symbol)
        symbol.errorText.text = PodCube.errorText;

    }

    onInit() {
        this.defineContext("SC_BUSTED", {
            up: "oops", handler: () => { PodCube.RESET(); },
            down: "uh-oh", handler: () => { PodCube.RESET(); },
            left: "whoops", handler: () => { PodCube.RESET(); },
            right: "yikes", handler: () => { PodCube.RESET(); }

        })
        this.switchContext("SC_BUSTED");
    };

}