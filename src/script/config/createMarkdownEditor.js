import { renderMarkdownToElement } from "../ui/renderMarkdown.js";

export function createMarkdownEditor({
  id,
  labelText = "Contenuto",
  placeholder,
  initialValue = "",
  rows = 4,
  highlightTelemetryPlaceholders = false,
  telemetryKeys = [],
  telemetryValues = {},
  helperText = "",
  onInput
}) {
  const wrapper = document.createElement("div");

  const label = document.createElement("label");
  label.className = "form-label fw-semibold";
  label.setAttribute("for", id);
  label.textContent = labelText;

  const textarea = document.createElement("textarea");
  textarea.className = "form-control";
  textarea.id = id;
  textarea.rows = rows;
  textarea.placeholder = placeholder;
  textarea.value = initialValue;

  let telemetryKeySet = new Set(telemetryKeys);
  let currentTelemetryValues = telemetryValues;
  let editorSurface = textarea;
  let highlightLayer = null;

  if (highlightTelemetryPlaceholders) {
    editorSurface = document.createElement("div");
    editorSurface.className = "telemetry-editor-surface";

    highlightLayer = document.createElement("div");
    highlightLayer.className = "telemetry-editor-highlight";
    highlightLayer.setAttribute("aria-hidden", "true");

    textarea.classList.add("telemetry-editor-input");
    editorSurface.append(highlightLayer, textarea);
  }

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

  const helper = document.createElement("small");
  helper.className = "form-text d-block mt-2";
  helper.textContent = helperText;

  const previewTitle = document.createElement("div");
  previewTitle.className = "markdown-preview-title";
  previewTitle.textContent = "Anteprima";

  const preview = document.createElement("div");
  preview.className = "markdown-preview markdown-content";

  const updatePreview = () => {
    updateTelemetryHighlight();
    renderMarkdownToElement(preview, replaceTelemetryPlaceholders(textarea.value, currentTelemetryValues));
    onInput?.(textarea.value);
  };

  const updateTelemetryHighlight = () => {
    if (!highlightLayer) return;
    highlightLayer.replaceChildren();

    if (!textarea.value) {
      const hint = document.createElement("span");
      hint.className = "telemetry-editor-placeholder";
      hint.textContent = textarea.placeholder;
      highlightLayer.appendChild(hint);
      return;
    }

    const pattern = /{{\s*([A-Za-z0-9_.:-]+)\s*}}/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(textarea.value)) !== null) {
      highlightLayer.append(document.createTextNode(textarea.value.slice(cursor, match.index)));
      const token = document.createElement("span");
      token.className = telemetryKeySet.has(match[1])
        ? "telemetry-placeholder-valid"
        : "telemetry-placeholder-unknown";
      token.textContent = match[0];
      highlightLayer.appendChild(token);
      cursor = match.index + match[0].length;
    }
    highlightLayer.append(document.createTextNode(textarea.value.slice(cursor) || "\u200b"));
  };

  textarea.addEventListener("input", updatePreview);
  textarea.addEventListener("scroll", () => {
    if (!highlightLayer) return;
    highlightLayer.scrollTop = textarea.scrollTop;
    highlightLayer.scrollLeft = textarea.scrollLeft;
  });
  updatePreview();

  wrapper.append(label, editorSurface);
  if (helperText) wrapper.appendChild(helper);
  wrapper.append(legend, previewTitle, preview);

  return {
    wrapper,
    legend,
    textarea,
    preview,
    getValue: () => textarea.value,
    setValue: (value) => {
      textarea.value = value ?? "";
      updatePreview();
    },
    setTelemetryKeys: (keys = []) => {
      telemetryKeySet = new Set(keys);
      updateTelemetryHighlight();
    },
    setTelemetryValues: (values = {}) => {
      currentTelemetryValues = values || {};
      updatePreview();
    }
  };
}

function replaceTelemetryPlaceholders(text, telemetry) {
  return String(text ?? "").replace(/{{\s*([A-Za-z0-9_.:-]+)\s*}}/g, (placeholder, key) => {
    const point = telemetry?.[key];
    if (!point || point.value === undefined || point.value === null) return placeholder;
    return String(point.value);
  });
}
