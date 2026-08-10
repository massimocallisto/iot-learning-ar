import { getApiOrigin, readError } from './api.js';

class ViewerSession {
  glbFile = undefined;
  id = undefined;
  deviceId = null;

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

  setDeviceId(deviceId) {
    this.deviceId = deviceId || null;
  }

  getDeviceId() {
    return this.deviceId;
  }

  clear() {
    this.glbFile = undefined;
    this.id = undefined;
    this.deviceId = null;
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
