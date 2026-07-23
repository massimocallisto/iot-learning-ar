// viewer-session.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewerSessionService {
  private glbFile?: File;
  private jsonFile?: File;
  private id?: String;
  private HOST = window.location.hostname;
  private PORT = "3001";



  async setFiles(glb: File, json: File) {
    this.glbFile = glb;
    this.jsonFile = json;
    const data = await this.saveFiles();
    console.log("data", data);
    this.id = data.id;
     
  }


  async setFile(glb: File){
    this.glbFile = glb;
    const data = await this.saveFile();
    this.id = data.id;
  }







  async getGlb(id: String) {

    if(!id) return;

    const response = await fetch(`https://${this.HOST}:${this.PORT}/api/uploads/${id}/glb`);

    return response;



    
  }

  async getJson(id: String){
    if(!id) return;


    const response = await fetch(`https://${this.HOST}:${this.PORT}/api/uploads/${id}/json`);
    return response;
  }


  getId(){
    return this.id;
  }

  getGlbFile(){
    return this.glbFile;
  }

  clear() {
    this.glbFile = undefined;
    this.jsonFile = undefined;
    this.id = undefined;
    
  }


    async deleteUpload(id: String): Promise<void> {
    if (!id) return;

    const response = await fetch(`https://${this.HOST}:${this.PORT}/api/uploads/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete upload fallita (${response.status})`);
    }
    this.clear();
  }


  


  async saveFiles(){
    if(!this.glbFile || !this.jsonFile) return;
    const glbBase64 = await this.fileToBase64(this.glbFile);
    const jsonBase64 = await this.fileToBase64(this.jsonFile);

  

    const response = await fetch(`https://${this.HOST}:${this.PORT}/api/uploads`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        glbBase64: glbBase64,
        jsonBase64: jsonBase64,
        glbName: 'model.glb',
        jsonName: 'config.json',
        glbMime: 'model/gltf-binary',
        jsonMime: 'application/json'
      })
    });

    return  await response.json();
 

  }





  async saveFile(){
    if(!this.glbFile) return;
    const glbBase64 = await this.fileToBase64(this.glbFile);

    const response = await fetch(`https://${this.HOST}:${this.PORT}/api/upload`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        glbBase64: glbBase64,
        glbName: 'model.glb',
        glbMime: 'model/gltf-binary'
      })
    });

    return await response.json();


  }




 async  fileToBase64(file: File): Promise<string> {
  const buf: ArrayBuffer = await file.arrayBuffer();

  let binary = '';
  const bytes = new Uint8Array(buf);

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary); // base64 puro
}










}
