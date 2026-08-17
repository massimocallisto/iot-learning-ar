import { createMarkdownEditor } from "./createMarkdownEditor.js";

export class ConfigInformation {
  constructor(root, options) {
    this.root = root;
    this.options = options;
    this.information = new Map([
      ["tipologia", options.type],
      ["formato", "markdown"]
    ]);
  }

  createInput() {
    const section = document.createElement("section");
    section.className = "ctrl-section";

    const title = document.createElement("div");
    title.textContent = this.options.title;
    title.style.fontWeight = "600";
    title.style.marginBottom = "10px";

    this.editor = createMarkdownEditor({
      id: this.options.id,
      placeholder: this.options.placeholder
    });

    const confirm = document.createElement("button");
    confirm.textContent = "Salva";
    confirm.className = "btn btn-success w-100 mt-2";

    this.feedback = document.createElement("small");
    this.feedback.className = "text-success d-block mt-1";
    confirm.addEventListener("click", () => {
      this.information.set("testo", this.editor.getValue());
      this.feedback.textContent = this.options.savedMessage;
    });

    section.append(title, this.editor.wrapper, confirm, this.feedback);
    this.root.append(section);
  }

  getInformation() {
    return this.information;
  }

  setInformation(information = {}) {
    const testo = information.testo ?? "";
    this.information.set("tipologia", information.tipologia || this.options.type);
    this.information.set("formato", information.formato || "markdown");
    this.information.set("testo", testo);
    this.editor?.setValue(testo);
    if (this.feedback) this.feedback.textContent = testo ? this.options.loadedMessage : "";
  }
}
