import { jsonStore } from "../config/ConfJson.js";
import { createARButton } from "../ui/createARButton.js";
import { createFinalInfo } from "../ui/createFinalInfo.js";
import { createInizialInfo } from "../ui/createInizialInfo.js";
import { createInfoPoint } from "../ui/createInfoPoint.js";

export async function loadVariant(viewer, options = {}){
    // Interpreta le regole in ordine e costruisce UI/comportamenti runtime.
    const varianti = await jsonStore.getRegole();
    for (const variante of varianti) {
        switch (variante.tipologia) {
            
            case "information":
                 createInizialInfo(viewer, variante.testo);
            break;

            case "finalInformation":
                 createFinalInfo(viewer, variante.testo);
            break;

            case "informationPoint":
                 createInfoPoint(viewer, variante.infoPoint, options);
            break;

            case "ar":
                createARButton(viewer);
            break;

            default:
            break;
        }

    }
}
