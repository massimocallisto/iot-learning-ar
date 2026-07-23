import { createMarkdownEditor } from "./createMarkdownEditor";

export class ConfigInfortationStart{
    constructor(root){
        this.root = root;
        this.testo = "";
        this.information = new Map();
        this.information.set("tipologia", "information");
        this.information.set("formato", "markdown");
        this.editor = null;
        this.feedback = null;


    }


    createInput(){
        const div = document.createElement("section");
        div.className = "ctrl-section";

        const title = document.createElement("div");
        title.textContent = "Testo iniziale";
        title.style.fontWeight = "600";
        title.style.marginBottom = "10px";

        const editor = createMarkdownEditor({
            id: "descrizione",
            placeholder: "Scrivi qui il testo iniziale..."
        });
        this.editor = editor;

        // bottone finale
        const confirm = document.createElement("button");
        confirm.textContent = "Salva";
        confirm.className = "btn btn-success w-100 mt-2";

        const feedback = document.createElement("small");
        feedback.className = "text-success d-block mt-1";
        this.feedback = feedback;

        confirm.addEventListener("click", () => {
            this.information.set("testo", editor.getValue());
            feedback.textContent = "Testo introduttivo salvato";
        })
        

        div.append(title,editor.wrapper,confirm,feedback);
        

        this.root.append(div);
    }

    getInformation(){
        return this.information;
    }

    setInformation(information = {}) {
        const testo = information.testo ?? "";
        this.information.set("tipologia", information.tipologia || "information");
        this.information.set("formato", information.formato || "markdown");
        this.information.set("testo", testo);
        this.editor?.setValue(testo);
        if (this.feedback) {
            this.feedback.textContent = testo ? "Testo introduttivo caricato" : "";
        }
    }
}
