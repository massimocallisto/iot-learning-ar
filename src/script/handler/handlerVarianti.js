import { jsonStore } from "../config/ConfJson";
import { createARButton } from "../ui/createARButton";
import { createFinalInfo } from "../ui/createFinalInfo";
import { createInizialInfo } from "../ui/createInizialInfo";
import { createInfoPoint } from "../ui/createInfoPoint";

export async function loadVariant(viewer){
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
                 createInfoPoint(viewer, variante.infoPoint);
            break;

            case "ar":
                createARButton(viewer);
            break;

            default:
            break;
        }

    }
}
