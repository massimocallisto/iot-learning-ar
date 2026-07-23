import { ARButton} from "three/addons/webxr/ARButton.js";

export class ARController {
    constructor(core, events) {
        this.core = core;
        this.events = events;
    }

    createARButton(domRoot){
        if(!navigator.xr) return null;
        
        const btn = ARButton.createButton(this.core.renderer, {
            optionalFeatures: ["dom-overlay"],

            domOverlay: { root: domRoot },
        });


        this.core.renderer.xr.addEventListener("sessionstart", () => {
            document.body.classList.add("ar-mode");
            this.events.dispatchEvent(new Event("ar:sessionstart"));
        });

        this.core.renderer.xr.addEventListener("sessionend", () => {
            document.body.classList.remove("ar-mode");
            this.events.dispatchEvent(new Event("ar:sessionend"));
        });
        

        return btn;
    }
}
