import { getApiOrigin, readError } from './api.js';

class ViewerSession {
  glbFile = undefined;
  jsonFile = undefined;
  id = undefined;

  async setFiles(glb, json) {
    this.glbFile = glb;
    this.jsonFile = json;
    const data = await this.saveFiles();
    this.id = data.id;
  }

  async setFile(glb) {
    this.glbFile = glb;
    const data = await this.saveFile();
    this.id = data.id;
  }

  async getGlb(id) {
    if (!id) return undefined;
    const response = await fetch(`${getApiOrigin()}/api/uploads/${id}/glb`);
    if (!response.ok) throw new Error(await readError(response));
    return response;
  }

  async getJson(id) {
    if (!id) return undefined;
    const response = await fetch(`${getApiOrigin()}/api/uploads/${id}/json`);
    if (!response.ok) throw new Error(await readError(response));
    return response;
  }

  getId() {
    return this.id;
  }

  getGlbFile() {
    return this.glbFile;
  }

  clear() {
    this.glbFile = undefined;
    this.jsonFile = undefined;
    this.id = undefined;
  }

  async deleteUpload(id) {
    if (!id) return;

    const response = await fetch(`${getApiOrigin()}/api/uploads/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete upload fallita (${response.status})`);
    }

    this.clear();
  }

  async saveFiles() {
    if (!this.glbFile || !this.jsonFile) throw new Error('File GLB/JSON non disponibili.');
    const glbBase64 = await this.fileToBase64(this.glbFile);
    const jsonBase64 = await this.fileToBase64(this.jsonFile);

    const response = await fetch(`${getApiOrigin()}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        glbBase64,
        jsonBase64,
        glbName: 'model.glb',
        jsonName: 'config.json',
        glbMime: 'model/gltf-binary',
        jsonMime: 'application/json'
      })
    });

    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  }

  async saveFile() {
    if (!this.glbFile) throw new Error('File GLB non disponibile.');
    const glbBase64 = await this.fileToBase64(this.glbFile);

    const response = await fetch(`${getApiOrigin()}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        glbBase64,
        glbName: 'model.glb',
        glbMime: 'model/gltf-binary'
      })
    });

    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  }

  async fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
  }
}

export const viewerSession = new ViewerSession();
