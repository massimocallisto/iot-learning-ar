import {loadModel} from './handler/handlerModel.js';
import { loadVariant } from './handler/handlerVarianti.js';
import { jsonStore } from './config/ConfJson.js';
import {createConfigurationSet} from './config/CreateConfigurationSet.js';


export async function uploadViewe(glb, viewer, json)
{
    // 1) Carica configurazione JSON nel singleton store.
    await jsonStore.setFromFileInput(json);

    // 2) Normalizza/ricodifica GLB e ottiene object URL.
    const url = await loadModel(glb);

    // 3) Resize differito per attendere layout definitivo del canvas.
    requestAnimationFrame(() => {
        viewer.resize();
    }); 
    // 4) Load effettivo in Three.js.
    if(url){await viewer.loadGLB(url)}; 
    viewer.mode="visualizzatore";
}


export async function load(viewer, options = {}) {
    // Costruzione UI varianti in base alle regole del JSON caricato.
    await loadVariant(viewer, options);
}


export async function uploadConfigurazione(glb, viewer, configJson = null) {

    const url = await loadModel(glb);

    requestAnimationFrame(() => {
        viewer.resize();
    });

    if(!url) return;
    await viewer.loadGLB(url);
    //viewer.mode="configuratore";
    viewer._configurationRuntime?.dispose?.();
    const createConf = new createConfigurationSet(viewer);
    viewer._configurationRuntime = createConf;

    createConf.start(configJson);

    
}
