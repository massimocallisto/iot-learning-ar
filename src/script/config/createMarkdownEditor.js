import { renderMarkdownToElement } from "../ui/renderMarkdown.js";

export function createMarkdownEditor({
  id,
  labelText = "Contenuto",
  placeholder,
  initialValue = "",
  rows = 4,
  onInput
}) {
  const wrapper = document.createElement("div");

  const label = document.createElement("label");
  label.className = "form-label";
  label.setAttribute("for", id);
  label.textContent = labelText;

  const textarea = document.createElement("textarea");
  textarea.className = "form-control";
  textarea.id = id;
  textarea.rows = rows;
  textarea.placeholder = placeholder;
  textarea.value = initialValue;

  const legend = document.createElement("details");
  legend.className = "markdown-legend";

  const summary = document.createElement("summary");
  summary.textContent = "Legenda Markdown";

  const list = document.createElement("div");
  list.className = "markdown-legend-content";
  list.innerHTML = [
    "<code># Titolo</code>",
    "<code>**grassetto**</code>",
    "<code>*corsivo*</code>",
    "<code>- elemento lista</code>",
    "<code>1. elemento numerato</code>",
    "<code>[link](https://...)</code>",
    "<code>`codice`</code>"
  ].join("");

  legend.append(summary, list);

  const previewTitle = document.createElement("div");
  previewTitle.className = "markdown-preview-title";
  previewTitle.textContent = "Anteprima";

  const preview = document.createElement("div");
  preview.className = "markdown-preview markdown-content";

  const updatePreview = () => {
    renderMarkdownToElement(preview, textarea.value);
    onInput?.(textarea.value);
  };

  textarea.addEventListener("input", updatePreview);
  updatePreview();

  wrapper.append(label, textarea, legend, previewTitle, preview);

  return {
    wrapper,
    textarea,
    preview,
    getValue: () => textarea.value,
    setValue: (value) => {
      textarea.value = value ?? "";
      updatePreview();
    }
  };
}
