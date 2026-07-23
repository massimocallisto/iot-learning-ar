import * as THREE from "three";
import { createMarkdownEditor } from "./createMarkdownEditor";

export class ConfigInformationPoint{
    constructor(core, root){
        this.core = core;
        this.root = root;

        this.infoPoints = [];

        this.cam = this.core.camera;
        this.el = this.core.renderer.domElement;
        this.target = this.core.scene;

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.onPointerDown = this.onPointerDown.bind(this);
        this.el.addEventListener("pointerdown", this.onPointerDown);
        this.infoPointNameTemp = "";
        this.infoPointTemp = new Set();
        this.infoPointDescriptionTemp = "";
        this.editingIndex = -1;
        this.ready = false;

        this.section = document.createElement("section");
        this.descriptionInfoPointEl = null;
        this.infoPointListEl = null;
        this.nameInputEl = null;
        this.confirmButtonEl = null;


        this.rep = new Map();
        this.reportListEl = null;
        this.createInput();


    }


    setTarget(obj){
        this.target = obj || this.core.scene;
    }




    onPointerDown(event){
        const rect = this.el.getBoundingClientRect();

        const clientX = event.clientX ?? event.touches?.[0]?.clientX;
        const clientY = event.clientY ?? event.touches?.[0]?.clientY;

        if(clientX == null || clientY == null) return;

        this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.cam);

        const root = this.target || this.core.scene;
        const queryRoot = Array.isArray(root) ? root : [root];
        const intersects = this.raycaster.intersectObjects(queryRoot, true);

        if(!intersects.length) return;
        const hit = intersects[0];

        if(this.ready == true && this.canSelectMesh(hit.object.name)) {
            if(!this.infoPointTemp.has(hit.object.name)){
                this.createMeshElementView(hit.object.name);

                const mat = hit.object.material;
                this.rep.set(hit.object.name, mat);
                this.applySelectionMaterial(hit.object);
                this.infoPointTemp.add(hit.object.name);

            }else{
                this.replaceMaterial(hit.object);
                this.infoPointTemp.delete(hit.object.name);
                this.removeMeshElementView(hit.object.name);
            }
        }
    

    }


    dispose() {
        this.el.removeEventListener("pointerdown", this.onPointerDown);
    }


    createInput() {
        if (!this.root) return;

        this.section.className = "ctrl-section";

        // titolo
        const title = document.createElement("div");
        title.textContent = "Creazione information point";
        title.style.fontWeight = "600";
        title.style.marginBottom = "10px";

        // riga input
        const row = document.createElement("div");
        row.className = "d-flex gap-2 mb-2";

        const textBox = document.createElement("input");
        textBox.type = "text";
        textBox.placeholder = "Nome info point";
        textBox.className = "form-control";
        this.nameInputEl = textBox;

        const startBtn = document.createElement("button");
        startBtn.textContent = "Seleziona";
        startBtn.className = "btn btn-primary";

        row.appendChild(textBox);
        row.appendChild(startBtn);

        // lista mesh selezionate
        const listTitle = document.createElement("div");
        listTitle.textContent = "Parte selezionata:";
        listTitle.style.marginTop = "10px";
        listTitle.style.fontWeight = "500";

        const list = document.createElement("div");
        list.id = "infoPointList";
        list.style.fontSize = "14px";
        list.style.marginBottom = "10px";
        this.infoPointListEl = list;

       

        // bottone finale
        const confirm = document.createElement("button");
        confirm.textContent = "Crea information point";
        confirm.className = "btn btn-success w-100";
        this.confirmButtonEl = confirm;

        const listrep = document.createElement("div");
        listrep.id = "reportList";
        listrep.style.fontSize = "12px";
        listrep.style.marginBottom = "10px";
        this.reportListEl = listrep;

        const el = document.createElement("small");
        el.className = "text-muted d-block mt-1";
        el.textContent ="Nessun information point salvato";

        listrep.appendChild(el);


        // EVENTI

        startBtn.addEventListener("click", () => {
            const nextName = textBox.value.trim();
            this.cancelEdit();
            this.infoPointNameTemp = nextName;
            if (!this.infoPointNameTemp) return;
            textBox.value = this.infoPointNameTemp;

            this.ready = true;
            this.infoPointTemp.clear();
            this.infoPointDescriptionTemp = "";
            list.replaceChildren();
            this.showDescriptionInfoPoint();
        });

        confirm.addEventListener("click", () => {
            this.infoPointNameTemp = textBox.value.trim();

            if (!this.infoPointNameTemp) return;
            if (this.infoPointTemp.size === 0) return;

            const infoPoint = {
                name: this.infoPointNameTemp,
                parte: Array.from(this.infoPointTemp),
                descrizione: this.infoPointDescriptionTemp
            };

            if(this.editingIndex >= 0){
                this.infoPoints[this.editingIndex] = infoPoint;
            }else{
                this.infoPoints.push(infoPoint);
            }

            this.report();
            this.resetDraft();
            this.replace();
        });

        this.section.append(title, row, listTitle, list, confirm, listrep);
        

        this.root.appendChild(this.section);
    }

    createMeshElementView(name){
        const list = document.querySelector("#infoPointList");
        if(!list) return;

        const el = document.createElement("div");
        el.dataset.meshName = name;
        el.textContent = "- " + name;

        list.appendChild(el);
    }

    removeMeshElementView(name){
        const list = document.querySelector("#infoPointList");
        if(!list) return;

        const el = Array.from(list.children).find(
            (child) => child.dataset.meshName === name
        );

        if(el) el.remove();
    }



    getInfoPoints(){
        return this.infoPoints;
    }

    canSelectMesh(meshName){
        return !this.infoPoints.some((infoPoint, index) => (
            index !== this.editingIndex && infoPoint.parte.includes(meshName)
        ));
    }

    resetDraft(){
        this.infoPointTemp.clear();
        this.infoPointDescriptionTemp = "";
        this.infoPointNameTemp = "";
        this.editingIndex = -1;
        this.ready = false;
        this.infoPointListEl?.replaceChildren();
        if(this.nameInputEl) this.nameInputEl.value = "";
        if(this.confirmButtonEl) this.confirmButtonEl.textContent = "Crea information point";
        this.hideDescriptionInfoPoint();
    }

    cancelEdit(){
        if(this.editingIndex < 0 && !this.infoPointTemp.size) return;
        this.replace();
        this.resetDraft();
    }

    editInfoPoint(index){
        const infoPoint = this.infoPoints[index];
        if(!infoPoint) return;

        this.replace();
        this.editingIndex = index;
        this.ready = true;
        this.infoPointNameTemp = infoPoint.name;
        this.infoPointDescriptionTemp = infoPoint.descrizione || "";
        this.infoPointTemp = new Set(infoPoint.parte || []);

        if(this.nameInputEl) this.nameInputEl.value = this.infoPointNameTemp;
        if(this.confirmButtonEl) this.confirmButtonEl.textContent = "Aggiorna information point";

        this.infoPointListEl?.replaceChildren();
        for(const name of this.infoPointTemp){
            this.createMeshElementView(name);
            this.highlightMeshByName(name);
        }

        this.showDescriptionInfoPoint(this.infoPointDescriptionTemp);
    }

    deleteInfoPoint(index){
        const infoPoint = this.infoPoints[index];
        if(!infoPoint) return;

        const confirmed = window.confirm(`Eliminare l'information point "${infoPoint.name}"?`);
        if(!confirmed) return;

        this.infoPoints.splice(index, 1);
        this.replace();

        if(this.editingIndex === index){
            this.resetDraft();
        }else if(this.editingIndex > index){
            this.editingIndex -= 1;
        }

        this.report();
    }

    setInfoPoints(infoPoints = []){
        this.infoPoints = infoPoints
            .filter((infoPoint) => infoPoint && infoPoint.name)
            .map((infoPoint) => ({
                name: infoPoint.name,
                parte: Array.isArray(infoPoint.parte)
                    ? infoPoint.parte
                    : (infoPoint.parte ? [infoPoint.parte] : []),
                descrizione: infoPoint.descrizione || ""
            }));

        this.report();
    }

    getInfoPointName(){
        return this.infoPoints.map((infoPoint) => infoPoint.name);
    }

    applySelectionMaterial(mesh) {
        const mat = new THREE.MeshStandardMaterial({
            color: "red",
            roughness: 0.7,
            metalness: 0.0,
        });

        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(() => mat);
        } else {
            mesh.material = mat;
        }

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => (m.needsUpdate = true));
        } else if (mesh.material) {
            mesh.material.needsUpdate = true;
        }
    }

    replace(){

        for(const [k,v] of this.rep){

            this.core.modelRoot.traverse((obj) => {
                if(!obj.isMesh) return;

                if(k == obj.name){
                    obj.material = v;
                }
            })
        }

    }

    report(){
        const reportList = this.reportListEl;
        if(!reportList) return;
        reportList.replaceChildren();

        if(!this.infoPoints.length){
            const el = document.createElement("small");
            el.className = "text-muted d-block mt-1";
            el.textContent ="Nessun information point salvato";
            reportList.appendChild(el);
            return;
        }

        this.infoPoints.forEach((infoPoint, index) => {
            
            const row = document.createElement("div");
            row.className = "border rounded p-2 mt-2 bg-white";

            const el = document.createElement("small");
            el.className = "text-muted d-block mb-2";
            const names = infoPoint.parte;
            const preview = names.slice(0, 3).join(", ");
            const remaining = names.length - Math.min(names.length, 3);
            const suffix = remaining > 0 ? ` +${remaining}` : "";
            el.textContent = `Salvato "${infoPoint.name}" (${names.length} mesh): ${preview}${suffix}`;

            const actions = document.createElement("div");
            actions.className = "d-flex gap-2";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "btn btn-outline-primary btn-sm";
            editBtn.textContent = "Modifica";
            editBtn.addEventListener("click", () => this.editInfoPoint(index));

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-outline-danger btn-sm";
            deleteBtn.textContent = "Elimina";
            deleteBtn.addEventListener("click", () => this.deleteInfoPoint(index));

            actions.append(editBtn, deleteBtn);
            row.append(el, actions);
            reportList.appendChild(row);
        });
    }

    replaceMaterial(mesh){

        const v = this.rep.get(mesh.name);
        this.core.modelRoot.traverse((obj) => {
            if(!obj.isMesh) return;

            if(mesh === obj){
                obj.material = v;
            }
        })
    }

    highlightMeshByName(name){
        this.core.modelRoot.traverse((obj) => {
            if(!obj.isMesh || obj.name !== name) return;
            if(!this.rep.has(name)) this.rep.set(name, obj.material);
            this.applySelectionMaterial(obj);
        });
    }

    createDescrtionInfoPoint(initialValue = ""){
        const wrapper = document.createElement("div");
        wrapper.className = "mt-2";

        const feedback = document.createElement("small");
        feedback.className = "text-success d-block mt-1";
        
        const editor = createMarkdownEditor({
            id: "descrizioneInfoPoint",
            labelText: "Descrizione",
            placeholder: "Scrivi qui la descrizione...",
            initialValue,
            onInput: (value) => {
                this.infoPointDescriptionTemp = value;
                feedback.textContent = "";
            }
        });

        // bottone finale
        const confirm = document.createElement("button");
        confirm.textContent = "Salva";
        confirm.className = "btn btn-success w-100";

        confirm.addEventListener("click", () => {
            this.infoPointDescriptionTemp = editor.getValue();
            feedback.textContent = "Descrizione information point salvata";
        })
        
        wrapper.append(editor.wrapper, confirm, feedback);
        return wrapper;
    }

    showDescriptionInfoPoint(initialValue = ""){
        this.hideDescriptionInfoPoint();
        this.descriptionInfoPointEl = this.createDescrtionInfoPoint(initialValue);
        if(this.infoPointListEl){
            this.section.insertBefore(this.descriptionInfoPointEl, this.infoPointListEl.nextSibling);
        }else{
            this.section.append(this.descriptionInfoPointEl);
        }
    }

    hideDescriptionInfoPoint(){
        if(!this.descriptionInfoPointEl) return;
        this.descriptionInfoPointEl.remove();
        this.descriptionInfoPointEl = null;

    }

    
    
    
}
