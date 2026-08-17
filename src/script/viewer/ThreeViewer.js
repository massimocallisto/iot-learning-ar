import { ViewerCore } from "./ViewerCore.js";
import { ModelController } from "./ModelController.js";
import { ARController } from "../ar/ARController.js";
import { ARGestures } from "../ar/ARGesture.js";



export class ThreeViewer {
    constructor({ canvas, container }) {
        this.mode = "";
        this.events = new EventTarget();

        // Core rendering loop: delega update frame ai moduli AR attivi.
        this.core = new ViewerCore({ canvas, container });

        this.model = new ModelController(this.core, this.events);
        this.ar = new ARController(this.core, this.events);
        this.gestures = new ARGestures(this.core);
        
        
        
        this.events.addEventListener("model:loaded", () => {
            this.gestures.setTarget(this.core.modelRoot, this.model.pivot);
            //this.confGroupMesh.setTarget(this.core.modelRoot);

            
        });

        this.events.addEventListener("ar:sessionstart", () => {
            const overlay = document.querySelector("#ar-overlay");
            if (overlay) this.gestures.setInputElement(overlay);
            this.gestures.enable();
        });

        this.events.addEventListener("ar:sessionend", () => {
            this.gestures.setInputElement(this.core.renderer.domElement);
            this.gestures.dispose();
        });
    }

    loadGLB(url) { return this.model.loadGLB(url); }
    getDimensions() { return this.model.getDimensions(); }
    createARButton(domRoot) { return this.ar.createARButton(domRoot); }

    get scene() { return this.core.scene; }
    get renderer() { return this.core.renderer; }
    get controls() { return this.core.controls; }
    get xr() { return this.core.renderer.xr; }

    resize() { return this.core.resize(); }

    dispose() {
        this._configurationRuntime?.dispose?.();
        this._configurationRuntime = null;
        this._infoPointRuntime?.dispose?.();
        this._infoPointRuntime = null;
        this.gestures.dispose();
        this.core.dispose();
    }
}
