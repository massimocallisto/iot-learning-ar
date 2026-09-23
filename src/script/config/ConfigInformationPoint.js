import * as THREE from "three";
import { createMarkdownEditor } from "./createMarkdownEditor.js";

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
        this.selectedTelemetryTemp = "";
        this.labelSettingsTemp = this.getDefaultLabelSettings();
        this.actionsTemp = [];
        this.actionsEditorRender = null;
        this.editingIndex = -1;
        this.ready = false;

        this.telemetryKeys = [];
        this.telemetryValues = {};
        this.telemetryState = { deviceConnected: false, loading: false, error: "" };
        this.telemetrySelectEl = null;
        this.telemetryHintEl = null;
        this.descriptionEditor = null;
        this.onTelemetryCatalog = this.onTelemetryCatalog.bind(this);
        window.addEventListener("experience:telemetry-catalog", this.onTelemetryCatalog);

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
        window.removeEventListener("experience:telemetry-catalog", this.onTelemetryCatalog);
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
            this.selectedTelemetryTemp = "";
            this.labelSettingsTemp = this.getDefaultLabelSettings();
            this.actionsTemp = [];
            list.replaceChildren();
            this.showDescriptionInfoPoint();
        });

        confirm.addEventListener("click", () => {
            this.infoPointNameTemp = textBox.value.trim();

            if (!this.infoPointNameTemp) return;
            if (this.infoPointTemp.size === 0) return;
            if (this.actionsTemp.some((action) => !action.label.trim() || !/^[\p{L}\p{N}_.:-]{1,100}$/u.test(action.method.trim()))) {
                window.alert("Completa la label e usa un metodo RPC valido (lettere, numeri, punto, trattino, underscore o due punti).");
                return;
            }
            if (this.actionsTemp.some((action) => !action.controlTelemetry)) {
                window.alert("Seleziona una telemetria di controllo per ogni azione.");
                return;
            }

            const infoPoint = {
                name: this.infoPointNameTemp,
                parte: Array.from(this.infoPointTemp),
                descrizione: this.infoPointDescriptionTemp,
                telemetria: this.selectedTelemetryTemp || null,
                label: { ...this.labelSettingsTemp },
                actions: this.actionsTemp.map((action) => ({ ...action }))
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
        this.selectedTelemetryTemp = "";
        this.labelSettingsTemp = this.getDefaultLabelSettings();
        this.actionsTemp = [];
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
        this.selectedTelemetryTemp = infoPoint.telemetria || "";
        this.labelSettingsTemp = this.normalizeLabelSettings(infoPoint.label);
        this.actionsTemp = (infoPoint.actions || []).map((action) => this.normalizeAction(action, infoPoint.telemetria));
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
                descrizione: infoPoint.descrizione || "",
                telemetria: infoPoint.telemetria || "",
                label: this.normalizeLabelSettings(infoPoint.label),
                actions: Array.isArray(infoPoint.actions)
                    ? infoPoint.actions.map((action) => this.normalizeAction(action, infoPoint.telemetria))
                    : []
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

    onTelemetryCatalog(event){
        const detail = event.detail || {};
        const telemetryKeys = Array.isArray(detail.keys)
            ? [...new Set(detail.keys.filter((key) => typeof key === "string" && key.trim()))]
                .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
            : [];
        const catalogChanged = telemetryKeys.join("\0") !== this.telemetryKeys.join("\0");
        this.telemetryKeys = telemetryKeys;
        this.telemetryState = {
            deviceConnected: Boolean(detail.deviceConnected),
            loading: Boolean(detail.loading),
            error: detail.error || ""
        };
        this.telemetryValues = detail.values || {};
        this.updateTelemetrySelector();
        this.descriptionEditor?.setTelemetryKeys(this.telemetryKeys);
        this.descriptionEditor?.setTelemetryValues(this.telemetryValues);
        if(catalogChanged) this.actionsEditorRender?.();
    }

    updateTelemetrySelector(){
        if(!this.telemetrySelectEl || !this.telemetryHintEl) return;

        const selected = this.selectedTelemetryTemp;
        this.telemetrySelectEl.replaceChildren();

        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        if(this.telemetryState.loading){
            emptyOption.textContent = "Caricamento telemetrie...";
        }else if(!this.telemetryState.deviceConnected){
            emptyOption.textContent = "Nessun device collegato";
        }else if(!this.telemetryKeys.length){
            emptyOption.textContent = "Nessuna telemetria disponibile";
        }else{
            emptyOption.textContent = "Seleziona una telemetria";
        }
        this.telemetrySelectEl.appendChild(emptyOption);

        if(selected && !this.telemetryKeys.includes(selected)){
            const unavailable = document.createElement("option");
            unavailable.value = selected;
            unavailable.textContent = `${selected} (non disponibile)`;
            this.telemetrySelectEl.appendChild(unavailable);
        }

        for(const key of this.telemetryKeys){
            const option = document.createElement("option");
            option.value = key;
            option.textContent = key;
            this.telemetrySelectEl.appendChild(option);
        }

        this.telemetrySelectEl.value = selected;
        this.telemetrySelectEl.disabled = this.telemetryState.loading || !this.telemetryKeys.length;
        this.telemetryHintEl.textContent = this.telemetryState.error
            || (this.telemetryState.deviceConnected
                ? "Scegli una telemetria dal catalogo del device."
                : "Collega un device IoT per visualizzare il catalogo delle telemetrie.");
        this.telemetryHintEl.className = `form-text d-block${this.telemetryState.error ? " text-danger" : ""}`;
    }

    createDescrtionInfoPoint(initialValue = ""){
        const wrapper = document.createElement("div");
        wrapper.className = "mt-2";

        const feedback = document.createElement("small");
        feedback.className = "text-success d-block mt-1";

        const catalogWrapper = document.createElement("div");
        catalogWrapper.className = "telemetry-catalog mb-3";

        const catalogLabel = document.createElement("label");
        catalogLabel.className = "form-label fw-semibold";
        catalogLabel.setAttribute("for", "telemetriaInfoPoint");
        catalogLabel.textContent = "Telemetria selezionata";

        const telemetrySelect = document.createElement("select");
        telemetrySelect.id = "telemetriaInfoPoint";
        telemetrySelect.className = "form-select w-100";
        telemetrySelect.style.maxWidth = "none";
        this.telemetrySelectEl = telemetrySelect;

        const telemetryHint = document.createElement("small");
        this.telemetryHintEl = telemetryHint;

        telemetrySelect.addEventListener("change", () => {
            this.selectedTelemetryTemp = telemetrySelect.value;
        });
        catalogWrapper.append(catalogLabel, telemetrySelect, telemetryHint);
        this.updateTelemetrySelector();
        
        const editor = createMarkdownEditor({
            id: "descrizioneInfoPoint",
            labelText: "Descrizione",
            placeholder: "Scrivi qui la descrizione...",
            initialValue,
            highlightTelemetryPlaceholders: true,
            telemetryKeys: this.telemetryKeys,
            telemetryValues: this.telemetryValues,
            helperText: "Usa {{nome_telemetria}}: il placeholder diventa blu quando è presente nel catalogo.",
            onInput: (value) => {
                this.infoPointDescriptionTemp = value;
                feedback.textContent = "";
            }
        });
        this.descriptionEditor = editor;

        const labelSettings = this.createLabelSettings();
        editor.legend.insertAdjacentElement("afterend", labelSettings);

        const actionsSettings = this.createActionsSettings();
        labelSettings.insertAdjacentElement("afterend", actionsSettings);

        // bottone finale
        const confirm = document.createElement("button");
        confirm.textContent = "Salva";
        confirm.className = "btn btn-success w-100";

        confirm.addEventListener("click", () => {
            this.infoPointDescriptionTemp = editor.getValue();
            feedback.textContent = "Descrizione information point salvata";
        })
        
        wrapper.append(catalogWrapper, editor.wrapper, confirm, feedback);
        return wrapper;
    }

    getDefaultLabelSettings(){
        return {
            enabled: true,
            position: "sopra",
            alwaysVisible: true,
            onlyWhenNear: false,
            activationDistance: 2
        };
    }

    normalizeAction(action = {}, fallbackTelemetry = ""){
        const actionType = String(action.actionType || action.kind || "BOOLEAN").toUpperCase();
        const executionType = String(action.executionType || action.mode || "ASYNC").toUpperCase();
        return {
            label: String(action.label || ""),
            actionType: ["BOOLEAN", "NUMBER", "STRING"].includes(actionType) ? actionType : "BOOLEAN",
            method: String(action.method || ""),
            controlTelemetry: String(action.controlTelemetry || fallbackTelemetry || ""),
            executionType: executionType === "SYNC" ? "SYNC" : "ASYNC",
            successMessage: String(action.successMessage || "")
        };
    }

    actionTypeForTelemetry(key){
        const value = this.telemetryValues?.[key]?.value;
        if(value == null) return null;
        const normalized = typeof value === "string" ? value.trim() : value;
        if(typeof value === "boolean" || ["true", "false"].includes(String(normalized).toLowerCase())) return "BOOLEAN";
        if(normalized !== "" && Number.isFinite(Number(normalized))) return "NUMBER";
        return "STRING";
    }

    createActionsSettings(){
        const wrapper = document.createElement("section");
        wrapper.className = "poi-actions-config mt-3";

        const heading = document.createElement("div");
        heading.className = "fw-bold mb-2";
        heading.textContent = "Azioni";
        const list = document.createElement("div");
        const add = document.createElement("button");
        add.type = "button";
        add.className = "btn btn-success w-100";
        add.textContent = "Aggiungi azione";

        const createField = (labelText, input) => {
            const field = document.createElement("label");
            field.className = "telemetry-label-field";
            const label = document.createElement("span");
            label.textContent = labelText;
            input.classList.add(input.tagName === "SELECT" ? "form-select" : "form-control");
            field.append(label, input);
            return field;
        };
        const createSelect = (choices, value) => {
            const select = document.createElement("select");
            choices.forEach(([optionValue, optionLabel]) => select.add(new Option(optionLabel, optionValue)));
            select.value = value;
            return select;
        };

        const render = () => {
            list.replaceChildren();
            this.actionsTemp.forEach((action, index) => {
                const card = document.createElement("div");
                card.className = "ctrl-section mb-2";
                const grid = document.createElement("div");
                grid.className = "telemetry-label-options-grid";

                const label = document.createElement("input");
                label.type = "text";
                label.value = action.label;
                label.placeholder = "Nome dell'azione";
                label.addEventListener("input", () => { action.label = label.value; });

                const actionType = createSelect([["BOOLEAN", "ON/OFF"], ["NUMBER", "Valore"], ["STRING", "Stringa"]], action.actionType);
                actionType.addEventListener("change", () => { action.actionType = actionType.value; });

                const method = document.createElement("input");
                method.type = "text";
                method.value = action.method;
                method.placeholder = "nomeMetodoRPC";
                method.addEventListener("input", () => { action.method = method.value; });

                const catalogLoaded = this.telemetryState.deviceConnected
                    && !this.telemetryState.loading
                    && !this.telemetryState.error;
                if(catalogLoaded && !this.telemetryKeys.includes(action.controlTelemetry)){
                    action.controlTelemetry = "";
                }
                const emptyTelemetryLabel = this.telemetryState.loading
                    ? "Caricamento telemetrie..."
                    : !this.telemetryState.deviceConnected
                        ? "Nessun device collegato"
                        : this.telemetryKeys.length ? "Seleziona una telemetria" : "Nessuna telemetria disponibile";
                const telemetryChoices = [
                    ["", emptyTelemetryLabel],
                    ...this.telemetryKeys.map((key) => [key, key])
                ];
                const controlTelemetry = createSelect(telemetryChoices, action.controlTelemetry);
                controlTelemetry.disabled = this.telemetryState.loading || !this.telemetryKeys.length;
                controlTelemetry.addEventListener("change", () => {
                    action.controlTelemetry = controlTelemetry.value;
                    action.actionType = this.actionTypeForTelemetry(action.controlTelemetry) || action.actionType;
                    actionType.value = action.actionType;
                });

                const executionType = createSelect([["ASYNC", "Asincrona"], ["SYNC", "Sincrona"]], action.executionType);
                executionType.addEventListener("change", () => { action.executionType = executionType.value; });

                const success = document.createElement("input");
                success.type = "text";
                success.value = action.successMessage;
                success.placeholder = "Comando eseguito correttamente";
                success.addEventListener("input", () => { action.successMessage = success.value; });

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "btn btn-outline-danger btn-sm mt-2";
                remove.textContent = "Elimina azione";
                remove.addEventListener("click", () => {
                    this.actionsTemp.splice(index, 1);
                    render();
                });

                grid.append(
                    createField("Label", label),
                    createField("Azione", actionType),
                    createField("Metodo", method),
                    createField("Telemetria di controllo", controlTelemetry),
                    createField("Tipo", executionType),
                    createField("Messaggio di successo", success)
                );
                card.append(grid, remove);
                list.appendChild(card);
            });
        };

        add.addEventListener("click", () => {
            const action = this.normalizeAction({}, this.selectedTelemetryTemp);
            action.actionType = this.actionTypeForTelemetry(action.controlTelemetry) || action.actionType;
            this.actionsTemp.push(action);
            render();
        });
        this.actionsEditorRender = render;
        render();
        wrapper.append(heading, list, add);
        return wrapper;
    }

    normalizeLabelSettings(settings = {}){
        const defaults = this.getDefaultLabelSettings();
        const distance = Number(settings.activationDistance);
        return {
            enabled: settings.enabled ?? defaults.enabled,
            position: ["sopra", "sinistra", "destra"].includes(settings.position)
                ? settings.position
                : defaults.position,
            alwaysVisible: settings.alwaysVisible ?? defaults.alwaysVisible,
            onlyWhenNear: settings.onlyWhenNear ?? defaults.onlyWhenNear,
            activationDistance: Number.isFinite(distance) && distance >= 0
                ? distance
                : defaults.activationDistance
        };
    }

    createLabelSettings(){
        const settings = this.labelSettingsTemp;
        const wrapper = document.createElement("section");
        wrapper.className = "mt-3";

        const title = document.createElement("div");
        title.className = "fw-bold mb-2";
        title.textContent = "Anteprima label in tempo reale";

        const toggleRow = document.createElement("div");
        toggleRow.className = "telemetry-label-toggle ctrl-section form-check form-switch";
        const toggle = document.createElement("input");
        toggle.className = "form-check-input";
        toggle.type = "checkbox";
        toggle.role = "switch";
        toggle.id = "telemetryLabelEnabled";
        toggle.checked = settings.enabled;
        const toggleLabel = document.createElement("label");
        toggleLabel.className = "form-check-label";
        toggleLabel.htmlFor = toggle.id;
        toggleLabel.textContent = "Mostrare una label della telemetria?";
        toggleRow.append(toggle, toggleLabel);

        const heading = document.createElement("div");
        heading.className = "fw-semibold mt-3 mb-2";
        heading.textContent = "Impostazioni label";
        const options = document.createElement("div");
        options.className = "telemetry-label-options ctrl-section";

        const grid = document.createElement("div");
        grid.className = "telemetry-label-options-grid";
        const position = this.createLabelField("Posizione", "select", settings.position, [
            ["sopra", "Sopra"],
            ["sinistra", "Sinistra"],
            ["destra", "Destra"]
        ]);
        const alwaysVisible = this.createLabelField("Sempre visibile", "select", String(settings.alwaysVisible), [
            ["true", "Sì"],
            ["false", "No"]
        ]);
        const onlyWhenNear = this.createLabelField("Mostra solo quando vicino", "select", String(settings.onlyWhenNear), [
            ["true", "Sì"],
            ["false", "No"]
        ]);
        const distance = this.createLabelField("Distanza di attivazione", "number", settings.activationDistance);
        distance.input.min = "0";
        distance.input.step = "0.1";
        distance.input.inputMode = "decimal";
        distance.input.setAttribute("aria-label", "Distanza di attivazione in metri");
        distance.input.classList.add("telemetry-label-distance");
        const unit = document.createElement("span");
        unit.className = "telemetry-label-unit";
        unit.textContent = "metri";
        distance.field.appendChild(unit);
        grid.append(position.field, alwaysVisible.field, onlyWhenNear.field, distance.field);
        options.append(grid);

        const updateVisibility = () => {
            heading.hidden = !toggle.checked;
            options.hidden = !toggle.checked;
        };
        toggle.addEventListener("change", () => {
            this.labelSettingsTemp.enabled = toggle.checked;
            updateVisibility();
        });
        position.input.addEventListener("change", () => { this.labelSettingsTemp.position = position.input.value; });
        alwaysVisible.input.addEventListener("change", () => { this.labelSettingsTemp.alwaysVisible = alwaysVisible.input.value === "true"; });
        onlyWhenNear.input.addEventListener("change", () => { this.labelSettingsTemp.onlyWhenNear = onlyWhenNear.input.value === "true"; });
        distance.input.addEventListener("input", () => {
            const value = Number(distance.input.value);
            this.labelSettingsTemp.activationDistance = Number.isFinite(value) && value >= 0 ? value : 0;
        });
        updateVisibility();
        wrapper.append(title, toggleRow, heading, options);
        return wrapper;
    }

    createLabelField(labelText, type, value, choices = []){
        const field = document.createElement("div");
        field.className = "telemetry-label-field";
        const label = document.createElement("label");
        label.textContent = labelText;
        let input;
        if(type === "select"){
            input = document.createElement("select");
            input.className = "form-select";
            choices.forEach(([optionValue, optionLabel]) => {
                const option = document.createElement("option");
                option.value = optionValue;
                option.textContent = optionLabel;
                input.appendChild(option);
            });
        }else{
            input = document.createElement("input");
            input.type = type;
            input.className = "form-control";
        }
        const id = `telemetry-label-${labelText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        input.id = id;
        input.value = value;
        label.htmlFor = id;
        field.append(label, input);
        return { field, input };
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
        this.telemetrySelectEl = null;
        this.telemetryHintEl = null;
        this.descriptionEditor = null;
        this.actionsEditorRender = null;

    }

    
    
    
}
