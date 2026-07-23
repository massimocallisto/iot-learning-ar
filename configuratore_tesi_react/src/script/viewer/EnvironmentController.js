import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export class EnvironmentController {
    constructor(core) {
        this.core = core;
        this.pmrem = new THREE.PMREMGenerator(core.renderer);
        this.pmrem.compileEquirectangularShader();
        this.envMap = null;
        
    }

    async setEnviromentHDR(hdrUrl){
        // Carica HDR e lo converte in envMap PMREM (PBR-ready).
        const hdrTexture = await new RGBELoader().loadAsync(hdrUrl);
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

        const envRT = this.pmrem.fromEquirectangular(hdrTexture);
        hdrTexture.dispose();

        if(this.envMap) this.envMap.dispose();
        this.envMap = envRT.texture;
        envRT.dispose();

        this.core.scene.environment = this.envMap;
    }

    dispose(){
        // Cleanup texture PMREM allocata.
        if(this.envMap) this.envMap.dispose();
        this.pmrem.dispose();
    }
}
