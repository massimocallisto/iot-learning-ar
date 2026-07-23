export async function loadModel(fileInputGlb) {
  if (!fileInputGlb) {
    alert('Seleziona il file GLB.');
    return null;
  }

  const glbBuffer = await fileInputGlb.arrayBuffer();
  const url = URL.createObjectURL(new Blob([glbBuffer], { type: 'model/gltf-binary' }));
  return url;
}
