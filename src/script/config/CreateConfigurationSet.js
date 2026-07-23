import { buildConfigJson } from "./writeJson";
import { ConfigInformationEnd } from "./ConfigInformationEnd";
import { ConfigInfortationStart } from "./ConfigInformationStart";
import { ConfigInformationPoint } from "./ConfigInformationPoint";


export class createConfigurationSet {
    constructor(viewer){
        this.viewer = viewer;
        this.root = document.querySelector("#control .control-inner") || document.querySelector("#control");
        this.informationStart = new ConfigInfortationStart(this.root);
        this.informationEnd = new ConfigInformationEnd(this.root);
        this.infoPoint = new ConfigInformationPoint(this.viewer.core, this.root);
    }
    

    start(configJson = null){
        this.informationStart.createInput();
        this.infoPoint.setTarget(this.viewer.core.modelRoot);
        this.informationEnd.createInput();
        this.populateFromJson(configJson);
        this.createExportButton(this.root);
    }


    populateFromJson(configJson) {
        const regole = Array.isArray(configJson?.regole) ? configJson.regole : [];
        if (!regole.length) return;

        const initialInformation = regole.find((regola) => regola?.tipologia === "information");
        const finalInformation = regole.find((regola) => regola?.tipologia === "finalInformation");
        const infoPointRule = regole.find((regola) => regola?.tipologia === "informationPoint");

        if (initialInformation) {
            this.informationStart.setInformation(initialInformation);
        }

        if (finalInformation) {
            this.informationEnd.setInformation(finalInformation);
        }

        if (infoPointRule?.infoPoint) {
            this.infoPoint.setInfoPoints(infoPointRule.infoPoint);
        }
    }

    
    createExportButton(root) {
        const esporta = document.createElement("button");
        esporta.textContent = "Salva esperienza";
        esporta.className = "btn btn-success w-100";

        esporta.addEventListener("click", () => {
            const configJson = buildConfigJson({
                information: this.informationStart.getInformation(),
                finalInformation: this.informationEnd.getInformation(),
                infoPoints: this.infoPoint.getInfoPoints()
            });

            window.dispatchEvent(new CustomEvent("experience:save", {
                detail: { configJson }
            }));
        });

        this.root.appendChild(esporta);
    }

    

}


