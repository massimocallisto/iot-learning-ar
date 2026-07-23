export function createARButton(viewer) {
  const panel = document.querySelector("#control");
  const fab = document.querySelector("#ui-fab");
  const layout = document.querySelector(".layout");
  const viewerHost = document.querySelector("#viewerHost");

  if (!panel || !fab || !layout || !viewerHost) {
    console.warn("[UI] Missing DOM nodes.");
    return;
  }

  // 1) overlay root (DOM overlay in AR)
  let overlay = document.querySelector("#ar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ar-overlay";
    document.body.appendChild(overlay);
  }
  overlay.style.display = "none"; // IMPORTANT: fuori AR deve essere spento
  overlay.style.pointerEvents = "none";

  // wrapper per il bottone DENTRO overlay (visibile in AR)
  let arOverlayBtnWrap = overlay.querySelector(".ar-button");
  if (!arOverlayBtnWrap) {
    arOverlayBtnWrap = document.createElement("div");
    arOverlayBtnWrap.className = "ar-button";
    overlay.appendChild(arOverlayBtnWrap);
  }

  // 2) host bottone FUORI overlay (visibile fuori AR)
  let arBtnHost = document.querySelector("#ar-btn-host");
  if (!arBtnHost) {
    arBtnHost = document.createElement("div");
    arBtnHost.id = "ar-btn-host";
    viewerHost.appendChild(arBtnHost);
  }

  
  const debug = document.querySelector('#gesture-debug');
  if (debug) overlay.appendChild(debug);


  // 3) crea ARButton con domOverlay.root = overlay
  const btn = viewer.createARButton(overlay);
  if (!btn) return;

  // fuori AR: bottone nel viewer
  arBtnHost.innerHTML = "";
  arBtnHost.appendChild(btn);

  const moveUIIntoOverlay = () => {
    if (fab.parentElement !== overlay) overlay.appendChild(fab);
    if (panel.parentElement !== overlay) overlay.appendChild(panel);
  };

  const moveUIBackToLayout = () => {
    if (fab.parentElement !== layout) layout.insertBefore(fab, layout.firstChild);
    const afterFab = fab.nextSibling;
    if (panel.parentElement !== layout) layout.insertBefore(panel, afterFab);
  };

  // 4) session start/end
  viewer.xr.addEventListener("sessionstart", () => {
    document.body.classList.remove("experience-ended");
    overlay.style.display = "";             //  accendi overlay
    // Keep XR surface tappable: only explicit overlay children remain interactive.
    overlay.style.pointerEvents = "auto";
    arOverlayBtnWrap.appendChild(btn);      //  bottone visibile IN AR (exit incluso)
    moveUIIntoOverlay();

    // ridimensiona dopo lo spostamento DOM
    //viewer.resize?.();
  });

  viewer.xr.addEventListener("sessionend", () => {
    document.body.classList.add("experience-ended");
    // rimetti UI fuori overlay
    moveUIBackToLayout();

    // fuori AR: bottone torna nel viewer
    arBtnHost.appendChild(btn);

    // spegni overlay così non “mangia” gesture sul canvas
    overlay.style.pointerEvents = "none";
    overlay.style.display = "none";

    panel.classList.remove("open");
    fab.textContent = "☰";

    viewer.resize?.();
    viewer.controls?.update?.();
  });

  // 5) toggle pannello
  fab.onclick = () => {
    // In AR apre/chiude pannello controlli flottante.
    panel.classList.toggle("open");
  };

  // 6) chiudi cliccando fuori (solo in AR)
  document.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("ar-mode")) return;
    if (!panel.classList.contains("open")) return;

    const clickedInside = panel.contains(e.target) || fab.contains(e.target);
    if (!clickedInside) panel.classList.remove("open");
  });
}
