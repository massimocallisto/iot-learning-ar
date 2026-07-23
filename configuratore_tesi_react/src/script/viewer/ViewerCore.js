import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class ViewerCore {
    constructor({canvas, container, onFrame}) {
        this.canvas = canvas;
        this.container = container;

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 20);
        this.camera.position.set(-1, -1, 2);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });

        this.renderer.xr.enabled = true;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.resetControls();

        this.modelRoot = new THREE.Group();
        this.scene.add(this.modelRoot);

        

        this.renderer.xr.addEventListener("sessionstart", () => {
            // In AR disabilita orbit controls desktop.
            if (this.controls) this.controls.enabled = false;
            this.occlusion?.onSessionStart?.();
        });

        this.renderer.xr.addEventListener("sessionend", () => {
            this.camera.matrixAutoUpdate = true;
            this.camera.updateMatrix();
            this.camera.updateMatrixWorld(true);

            if (this.controls) {
                this.controls.enabled = true;
                this.controls.update();
            }

            
            this.resize();
        });

        this.setupLights();

        this._onResize = () => this.resize();
        window.addEventListener("resize", this._onResize);

        this.resize();

    
        this.frameN = 0;

        this.resize();

        this.renderer.setAnimationLoop((time, frame) => {
            if (!this.renderer.xr.isPresenting) {
                if (this.controls) {
                    this.controls.enabled = true;
                    this.controls.update();
                }
            }

            onFrame?.(time, frame);

            this.renderer.render(this.scene, this.camera);
        });

    }

   

    resize() {
        const rect = this.container.getBoundingClientRect();

        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(w, h, false);
    }

    dispose() {
        window.removeEventListener("resize", this._onResize);
        this.controls.dispose();
        this.renderer.dispose();
    }

    setupLights() {
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            const obj = this.scene.children[i];
            if (obj.isLight) this.scene.remove(obj);
        }

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
        this.scene.add(hemi);

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(3, 4, 2);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xffffff, 1.2);
        fill.position.set(-3, 2, -2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffffff, 0.55);
        rim.position.set(0, 4, -4);
        this.scene.add(rim);
    }

    resetControls() {
        try { this.controls?.dispose?.(); } catch {}

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    debug(msg) {
        if (!this.debugEl || !this.debugEl.isConnected) {
            this.debugEl = document.querySelector("#gesture-debug");
        }
        if (this.debugEl) this.debugEl.textContent = msg;
    }

    _resizeFromXRFrame(frame) {
        // Ridimensiona renderer al viewport XR reale del device.
        const session = this.renderer.xr.getSession?.();
        const refSpace = this.renderer.xr.getReferenceSpace?.();
        if (!session || !refSpace || !frame) return false;

        const pose = frame.getViewerPose(refSpace);
        if (!pose || !pose.views || pose.views.length === 0) return false;

        const baseLayer = session.renderState?.baseLayer;
        if (!baseLayer || !baseLayer.getViewport) return false;

        const vp = baseLayer.getViewport(pose.views[0]);
        if (!vp) return false;

        this.renderer.setSize(vp.width, vp.height, false);

        this.camera.aspect = vp.width / vp.height;
        this.camera.updateProjectionMatrix();

        return true;
    }

}
