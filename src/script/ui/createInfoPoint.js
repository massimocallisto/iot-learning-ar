import * as THREE from "three";
import { renderMarkdownToElement } from "./renderMarkdown.js";

const MARKER_RADIUS_RATIO = 0.014;
const MIN_MARKER_RADIUS = 0.01;
const MAX_MARKER_RADIUS = 0.03;
const FALLBACK_MARKER_RADIUS = 0.018;

export function createInfoPoint(viewer, infoPoint) {
  if (viewer._infoPointRuntime) {
    viewer._infoPointRuntime.dispose();
  }

  viewer._infoPointRuntime = new InfoPointRuntime(viewer, infoPoint);
}

class InfoPointRuntime {
  constructor(viewer, infoPoints = []) {
    this.viewer = viewer;
    this.core = viewer.core;
    this.camera = this.core.camera;
    this.renderer = this.core.renderer;
    this.modelRoot = this.core.modelRoot;
    this.markerRoot = viewer.model?.pivot || this.modelRoot;
    this.root = document.querySelector("#control .control-inner") || document.querySelector("#control");



    this.infoPoints = Array.isArray(infoPoints) ? infoPoints : [infoPoints].filter(Boolean);
    this.markers = [];

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.tmpWorldPosition = new THREE.Vector3();
    this.tmpScreenPosition = new THREE.Vector3();
    this.tmpScale = new THREE.Vector3();
    this.modelSize = new THREE.Vector3();
    this.markerRadius = this.computeMarkerRadius();

    this.panel = this.createPanel();

    this.onPointerDown = this.onPointerDown.bind(this);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);

    this.onXRSelect = this.onXRSelect.bind(this);
    this.onAROverlayPointerDown = this.onAROverlayPointerDown.bind(this);
    this.onAROverlayPointerUp = this.onAROverlayPointerUp.bind(this);
    this.arTapStart = null;
    this.suppressSelectionUntil = 0;

    viewer.xr.addEventListener("sessionstart", () => {
      const session = viewer.xr.getSession();
      session?.addEventListener("select", this.onXRSelect);

      const overlay = document.querySelector("#ar-overlay");
      overlay?.addEventListener("pointerdown", this.onAROverlayPointerDown);
      overlay?.addEventListener("pointerup", this.onAROverlayPointerUp);
    });

    viewer.xr.addEventListener("sessionend", () => {
      const session = viewer.xr.getSession();
      session?.removeEventListener("select", this.onXRSelect);

      const overlay = document.querySelector("#ar-overlay");
      overlay?.removeEventListener("pointerdown", this.onAROverlayPointerDown);
      overlay?.removeEventListener("pointerup", this.onAROverlayPointerUp);
      this.arTapStart = null;
    });


    this.createMarkers();
  }

  createMarkers() {
    const modelBox = new THREE.Box3().setFromObject(this.modelRoot);
    const modelCenter = modelBox.getCenter(new THREE.Vector3());

    this.infoPoints.forEach((info) => {
      const parts = normalizeParts(info.parte);
      const targets = parts
        .map((name) => this.findObjectByName(name))
        .filter(Boolean);

      if (!targets.length) {
        console.warn("Information point senza mesh valide:", info);
        return;
      }

      const box = new THREE.Box3();

      targets.forEach((target) => {
        target.updateMatrixWorld(true);
        box.union(new THREE.Box3().setFromObject(target));
      });

      if (box.isEmpty()) return;

      const worldCenter = box.getCenter(new THREE.Vector3());

      const size = box.getSize(new THREE.Vector3());
      const radius = this.markerRadius;
      const markerPosition = this.computeMarkerPosition({
        box,
        modelCenter,
        size,
        radius,
        worldCenter
      });
      const localPosition = this.markerRoot.worldToLocal(markerPosition);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0x1e88ff,
          emissive: 0x0b3d91,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.0,
          depthTest: true,
          depthWrite: true
        })
      );

      marker.name = `info-point-${info.name || "unnamed"}`;

      marker.position.copy(localPosition);

      marker.userData.infoPoint = info;
      marker.userData.pickRadius = radius;

      // Figlio dello stesso pivot ruotato dai gesti AR: resta agganciato al modello.
      this.markerRoot.add(marker);
      this.markers.push(marker);
    });
  }

  computeMarkerPosition({ box, modelCenter, size, radius, worldCenter }) {
    const direction = worldCenter.y < modelCenter.y ? -1 : 1;
    const clearance = this.clamp(size.y * 0.25, radius * 2.5, radius * 6);
    const edgeY = direction > 0 ? box.max.y : box.min.y;
    const markerPosition = worldCenter.clone();

    markerPosition.y = edgeY + direction * (radius + clearance);

    return markerPosition;
  }

  findObjectByName(name) {
    let found = null;

    this.modelRoot.traverse((obj) => {
      if (found) return;
      if (obj.name === name) found = obj;
    });

    return found;
  }

  onPointerDown(event) {
    if (this.isSelectionSuppressed()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cameraToUse = this.renderer.xr.isPresenting
      ? this.renderer.xr.getCamera(this.camera)
      : this.camera;

    this.raycaster.setFromCamera(this.pointer, cameraToUse);

    const hits = this.raycaster.intersectObjects(this.markers, false);

    if (!hits.length) {
      this.hidePanel();
      return;
    }

    this.showPanel(hits[0].object.userData.infoPoint);
  }

  onXRSelect() {
    if (!this.viewer.xr.isPresenting) return;
    if (this.isSelectionSuppressed()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.selectMarkerNearClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  onAROverlayPointerDown(event) {
    if (!this.viewer.xr.isPresenting) return;
    if (this.isOverlayUIEvent(event)) {
      this.suppressSelection(450);
      this.arTapStart = null;
      return;
    }
    if (this.isSelectionSuppressed()) return;

    this.arTapStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }

  onAROverlayPointerUp(event) {
    if (!this.viewer.xr.isPresenting || !this.arTapStart) return;
    if (this.isOverlayUIEvent(event)) {
      this.suppressSelection(450);
      this.arTapStart = null;
      return;
    }
    if (this.isSelectionSuppressed()) {
      this.arTapStart = null;
      return;
    }

    const dx = event.clientX - this.arTapStart.x;
    const dy = event.clientY - this.arTapStart.y;
    const dt = performance.now() - this.arTapStart.time;
    this.arTapStart = null;

    if (Math.hypot(dx, dy) > 10 || dt > 280) return;

    if (this.viewer.xr.isPresenting) {
      this.selectMarkerNearClientPoint(event.clientX, event.clientY);
      return;
    }

    this.raycastFromClientPoint(event.clientX, event.clientY);
  }

  raycastFromClientPoint(clientX, clientY) {
    if (this.isSelectionSuppressed()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const cameraToUse = this.viewer.xr.isPresenting
      ? this.viewer.xr.getCamera(this.camera)
      : this.camera;

    this.raycaster.setFromCamera(this.pointer, cameraToUse);

    const hits = this.raycaster.intersectObjects(this.markers, false);

    if (!hits.length) {
      this.hidePanel();
      return;
    }

    this.showPanel(hits[0].object.userData.infoPoint);
  }

  selectMarkerNearClientPoint(clientX, clientY) {
    if (this.isSelectionSuppressed()) return;

    const marker = this.pickMarkerByScreenDistance(clientX, clientY);
    if (!marker) return;

    this.showPanel(marker.userData.infoPoint);
  }

  pickMarkerByScreenDistance(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const cameraToUse = this.viewer.xr.isPresenting
      ? this.viewer.xr.getCamera(this.camera)
      : this.camera;
    const projectionCamera = getProjectionCamera(cameraToUse);
    const maxDistancePx = this.viewer.xr.isPresenting ? 34 : 28;

    let best = null;
    let bestScore = Infinity;

    for (const marker of this.markers) {
      marker.updateMatrixWorld(true);
      marker.getWorldPosition(this.tmpWorldPosition);
      this.tmpScreenPosition.copy(this.tmpWorldPosition).project(projectionCamera);

      if (this.tmpScreenPosition.z < -1 || this.tmpScreenPosition.z > 1) continue;

      const x = rect.left + (this.tmpScreenPosition.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-this.tmpScreenPosition.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(clientX - x, clientY - y);
      const projectedRadius = this.getProjectedMarkerRadiusPx(marker, projectionCamera, rect);
      const hitRadius = Math.max(maxDistancePx, projectedRadius * 1.25);

      if (distance > hitRadius) continue;

      const score = distance + this.tmpScreenPosition.z * 8;
      if (score < bestScore) {
        bestScore = score;
        best = marker;
      }
    }

    return best;
  }

  computeMarkerRadius() {
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const maxModelDim = Math.max(...box.getSize(this.modelSize).toArray());
    if (!Number.isFinite(maxModelDim) || maxModelDim <= 0) {
      return FALLBACK_MARKER_RADIUS;
    }
    return this.clamp(
      maxModelDim * MARKER_RADIUS_RATIO,
      MIN_MARKER_RADIUS,
      MAX_MARKER_RADIUS
    );
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  getProjectedMarkerRadiusPx(marker, camera, rect) {
    marker.getWorldScale(this.tmpScale);
    const worldRadius = (marker.userData.pickRadius || 0.025) * Math.max(
      this.tmpScale.x,
      this.tmpScale.y,
      this.tmpScale.z
    );

    const distance = camera.getWorldPosition(new THREE.Vector3()).distanceTo(this.tmpWorldPosition);
    if (!Number.isFinite(distance) || distance <= 0) return 0;

    const verticalFov = THREE.MathUtils.degToRad(camera.fov || 60);
    return (worldRadius / distance) * (rect.height / (2 * Math.tan(verticalFov / 2)));
  }

  isOverlayUIEvent(event) {
    return Boolean(
      event.target?.closest?.("#control, #ui-fab, .ar-button")
    );
  }

  createPanel() {
    const panel = document.createElement("div");
    panel.className = "info-point-panel";

    Object.assign(panel.style, {
      width: "100%",
      maxWidth: "100%",
      marginTop: "12px",
      padding: "16px",
      borderRadius: "8px",
      background: "rgba(18, 22, 28, 0.94)",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
      display: "none"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      marginBottom: "8px"
    });

    const title = document.createElement("div");
    title.className = "info-point-panel-title";
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "700"
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "x";
    closeButton.setAttribute("aria-label", "Chiudi pannello information point");
    Object.assign(closeButton.style, {
      width: "32px",
      height: "32px",
      border: "0",
      borderRadius: "6px",
      background: "rgba(255, 255, 255, 0.14)",
      color: "#fff",
      fontSize: "18px",
      lineHeight: "1",
      cursor: "pointer",
      flex: "0 0 auto"
    });
    closeButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.arTapStart = null;
      this.suppressSelection(450);
    });
    closeButton.addEventListener("pointerup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.arTapStart = null;
      this.suppressSelection(450);
    });
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.suppressSelection(450);
      this.hidePanel();
    });

    header.append(title, closeButton);

    const description = document.createElement("div");
    description.className = "info-point-panel-description";
    Object.assign(description.style, {
      fontSize: "14px",
      lineHeight: "1.45"
    });

    panel.append(header, description);
    this.root.appendChild(panel);

    return panel;
  }

  showPanel(info) {
    const parts = normalizeParts(info.parte);

    this.panel.querySelector(".info-point-panel-title").textContent =
      info.name || parts[0] || "Information point";

    renderMarkdownToElement(
      this.panel.querySelector(".info-point-panel-description"),
      info.descrizione || ""
    );

    this.panel.style.display = "block";

    if (this.viewer.xr.isPresenting) {
      document.querySelector("#control")?.classList.add("open");
    }
  }

  hidePanel() {
    this.panel.style.display = "none";
    document.querySelector("#control")?.classList.remove("open");
  }

  suppressSelection(durationMs = 350) {
    this.suppressSelectionUntil = performance.now() + durationMs;
  }

  isSelectionSuppressed() {
    return performance.now() < this.suppressSelectionUntil;
  }

  dispose() {
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);

    const overlay = document.querySelector("#ar-overlay");
    overlay?.removeEventListener("pointerdown", this.onAROverlayPointerDown);
    overlay?.removeEventListener("pointerup", this.onAROverlayPointerUp);

    this.markers.forEach((marker) => {
      marker.parent?.remove(marker);
      marker.geometry.dispose();
      marker.material.dispose();
    });

    this.markers = [];
    this.panel.remove();
  }
}

function normalizeParts(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getProjectionCamera(camera) {
  if (camera?.isArrayCamera && camera.cameras?.length) {
    return camera.cameras[0];
  }

  return camera;
}
