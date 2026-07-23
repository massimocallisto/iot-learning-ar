import { WebIO } from 'https://esm.sh/@gltf-transform/core';
import { KHRMaterialsVariants, KHRMaterialsSpecular, KHRTextureTransform } from 'https://esm.sh/@gltf-transform/extensions';

export async function  loadModel(fileInputGlb) {

    const io = new WebIO().registerExtensions([KHRMaterialsVariants, KHRMaterialsSpecular,KHRTextureTransform]);
    if (!fileInputGlb) {
        alert("Seleziona entrambi i file!");
        return null;
    }
    
    // Lettura file GLB
    const glbFile = fileInputGlb;
    const glbBuffer = await glbFile.arrayBuffer();

    // Lettura del documento
    // Lettura/riscrittura documento: normalizza estensioni registrate.
    const gltfDoc = await io.readBinary(new Uint8Array(glbBuffer));
   
    const outBuffer = await io.writeBinary(gltfDoc);
    const url = URL.createObjectURL(new Blob([outBuffer], {type: 'model/gltf-binary'}));
    return url;
}





