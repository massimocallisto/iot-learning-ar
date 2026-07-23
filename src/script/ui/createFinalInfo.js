import { renderMarkdownToElement } from "./renderMarkdown.js";

export function createFinalInfo(viewer, testo) {
  const panel = createFinalPanel(testo);

  viewer?.xr?.addEventListener?.("sessionend", () => {
    showFinalPanel(panel);
  });

  document.body.append(panel);
}

function createFinalPanel(testo) {
  const overlay = document.createElement("div");
  overlay.className = "final-info-overlay";
  overlay.style.display = "none";

  const panel = document.createElement("section");
  panel.className = "final-info-panel";

  const title = document.createElement("h2");
  title.textContent = "Esperienza conclusa";

  const content = document.createElement("div");
  renderMarkdownToElement(content, testo);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn btn-primary";
  close.textContent = "Chiudi";
  close.addEventListener("click", () => {
    overlay.style.display = "none";
    window.dispatchEvent(new CustomEvent("experience:close"));
  });

  panel.append(title, content, close);
  overlay.append(panel);

  return overlay;
}

function showFinalPanel(panel) {
  panel.style.display = "flex";
}
