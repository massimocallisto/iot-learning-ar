import * as handlerJson from "../handler/handlerJson";

class ConfJson {
   #data= null; 
   
 async setFromFileInput(inputEl) {
    // Legge JSON scelto da input file e lo mantiene in memoria.
    const file = inputEl;
    if (!file) return;

    const text = await file.text();      
    this.#data = JSON.parse(text);        
    return this.#data;
  }

 get(){
    return this.#data;
 }

 getRegole(){
    // Restituisce array regole (dim/color/visible/ar) dal JSON corrente.
    return  handlerJson.getRegole(this.#data);
 }

 

}

export const jsonStore = new ConfJson();
