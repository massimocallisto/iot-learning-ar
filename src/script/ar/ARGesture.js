// ARGestures.js
import * as THREE from "three";

export class ARGestures {
  constructor(core) {
    this.core = core;
    this.el = core.renderer.domElement;
    this.enabled = false;

    this.target = null;
    this.targetRot = null;
    this.initialTargetPosition = new THREE.Vector3();
    this.initialTargetScale = new THREE.Vector3(1, 1, 1);
    this.initialTargetQuaternion = new THREE.Quaternion();
    this.initialRotQuaternion = new THREE.Quaternion();

    this._activePointers = new Map();
    this.active = false;
    this.mode = null; // "place" | "rotate" | "pan"

    this.hasPlacedModel = false;
    this.initialDistance = 1.8;
    this.initialYOffset = -0.25;
    this.previousTouchAction = "";
    this.previousPointerEvents = "";

    this.lastX = 0;
    this.lastY = 0;

    this.panLastCenterX = 0;
    this.panLastCenterY = 0;
    this.panSpeed = 0.0015;
    this.verticalPanSpeed = 0.0015;
    this.rotateSpeed = 0.006;
    this.minScale = 0.05;
    this.maxScale = 20;
    this.panLastDistance = 0;

    this.right = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();

    this.tapStartX = 0;
    this.tapStartY = 0;
    this.tapStartTime = 0;
    this.tapMoved = false;
    this.tapMaxMovePx = 10;
    this.tapMaxDurationMs = 320;

    this.debugEl = document.querySelector("#gesture-debug");

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  setTarget(posObj3d, rotObj3d = posObj3d) {
    this.target = posObj3d;
    this.targetRot = rotObj3d;
    if (this.targetRot?.rotation) this.targetRot.rotation.order = "YXZ";
    this.captureInitialTransform();
  }

  setInputElement(nextEl) {
    if (!nextEl || nextEl === this.el) return;
    const wasEnabled = this.enabled;
    if (wasEnabled) this.detachListeners();
    this.el = nextEl;
    if (wasEnabled) this.attachListeners();
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.hasPlacedModel = false;
    if (this.target) this.target.visible = false;
    this.attachListeners();
    this.debug("Tocca lo schermo per posizionare il modello");
  }

  dispose() {
    if (!this.enabled) return;
    this.enabled = false;
    this.detachListeners();
    this._activePointers.clear();
    this.active = false;
    this.mode = null;
    this.resetTargetTransform();
  }

  attachListeners() {
    this.previousTouchAction = this.el.style.touchAction;
    this.previousPointerEvents = this.el.style.pointerEvents;
    this.el.style.touchAction = "none";
    this.el.style.pointerEvents = "auto";
    this.el.addEventListener("pointerdown", this.onPointerDown);
    this.el.addEventListener("pointermove", this.onPointerMove);
    this.el.addEventListener("pointerup", this.onPointerUp);
    this.el.addEventListener("pointercancel", this.onPointerCancel);
  }

  detachListeners() {
    this.el.style.touchAction = this.previousTouchAction;
    this.el.style.pointerEvents = this.previousPointerEvents;
    this.el.removeEventListener("pointerdown", this.onPointerDown);
    this.el.removeEventListener("pointermove", this.onPointerMove);
    this.el.removeEventListener("pointerup", this.onPointerUp);
    this.el.removeEventListener("pointercancel", this.onPointerCancel);
  }

  debug(msg) {
    if (!this.debugEl || !this.debugEl.isConnected) {
      this.debugEl = document.querySelector("#gesture-debug");
    }
    if (this.debugEl) this.debugEl.textContent = msg;
  }

  onPointerDown(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this._activePointers.set(e.pointerId, e);
    this.active = true;

    const pointers = this.getPointers();

    if (!this.hasPlacedModel) {
      if (pointers.length === 1) this.startPlacementTap(pointers[0]);
      return;
    }

    if (pointers.length === 1) {
      this.startRotate(pointers[0]);
      return;
    }

    if (pointers.length >= 2) {
      this.startPan(pointers);
    }
  }

  onPointerMove(e) {
    if (!this.active) return;
    if (this._activePointers.has(e.pointerId)) {
      this._activePointers.set(e.pointerId, e);
    }
    if (!this.target) return;

    const pointers = this.getPointers();

    if (!this.hasPlacedModel && this.mode === "place" && pointers.length === 1) {
      this.updatePlacementTap(pointers[0]);
      return;
    }

    if (!this.hasPlacedModel) return;

    if (this.mode === "rotate" && pointers.length === 1) {
      this.handleRotateMove(pointers[0]);
      return;
    }

    if (this.mode === "pan" && pointers.length >= 2) {
      this.handlePanMove(pointers);
    }
  }

  onPointerUp(e) {
    this.handlePointerEnd(e, true);
  }

  onPointerCancel(e) {
    this.handlePointerEnd(e, false);
  }

  startPlacementTap(pointer) {
    this.mode = "place";
    this.tapStartX = pointer.clientX;
    this.tapStartY = pointer.clientY;
    this.tapStartTime = performance.now();
    this.tapMoved = false;
  }

  updatePlacementTap(pointer) {
    const moved = Math.hypot(
      pointer.clientX - this.tapStartX,
      pointer.clientY - this.tapStartY
    );
    if (moved > this.tapMaxMovePx) this.tapMoved = true;
  }

  placeModelInFrontOfCamera() {
    if (!this.target || !this.core.renderer.xr.isPresenting) return false;

    const xrCamera = this.core.renderer.xr.getCamera(this.core.camera);
    xrCamera.getWorldPosition(this.cameraPosition);
    xrCamera.getWorldDirection(this.cameraDirection);

    this.target.position.copy(this.cameraPosition);
    this.target.position.addScaledVector(this.cameraDirection, this.initialDistance);
    this.target.position.y = this.cameraPosition.y + this.initialYOffset;
    this.target.visible = true;
    this.target.updateMatrixWorld(true);

    this.hasPlacedModel = true;
    this.core.hasPlacedModel = true;
    this.debug("Modello posizionato");
    return true;
  }

  captureInitialTransform() {
    if (this.target) {
      this.initialTargetPosition.copy(this.target.position);
      this.initialTargetScale.copy(this.target.scale);
      this.initialTargetQuaternion.copy(this.target.quaternion);
    }

    if (this.targetRot) {
      this.initialRotQuaternion.copy(this.targetRot.quaternion);
    }
  }

  resetTargetTransform() {
    if (this.target) {
      this.target.position.copy(this.initialTargetPosition);
      this.target.scale.copy(this.initialTargetScale);
      this.target.quaternion.copy(this.initialTargetQuaternion);
      this.target.visible = true;
      this.target.updateMatrixWorld(true);
    }

    if (this.targetRot && this.targetRot !== this.target) {
      this.targetRot.quaternion.copy(this.initialRotQuaternion);
      this.targetRot.updateMatrixWorld(true);
    }

    this.hasPlacedModel = false;
    this.core.hasPlacedModel = false;
  }

  startRotate(pointer) {
    this.mode = "rotate";
    this.lastX = pointer.clientX;
    this.lastY = pointer.clientY;
  }

  startPan(pointers) {
    this.mode = "pan";
    const c = this.getCenter(pointers);
    this.panLastCenterX = c.x;
    this.panLastCenterY = c.y;
    this.panLastDistance = this.getDistance(pointers);
  }

  handleRotateMove(pointer) {
    if (!this.core.renderer.xr.isPresenting || !this.targetRot) return;

    const dx = pointer.clientX - this.lastX;
    const dy = pointer.clientY - this.lastY;
    this.lastX = pointer.clientX;
    this.lastY = pointer.clientY;

    const xrCam = this.core.renderer.xr.getCamera(this.core.camera);
    this.cameraRight.setFromMatrixColumn(xrCam.matrixWorld, 0).normalize();

    this.targetRot.rotateOnWorldAxis(this.worldUp, dx * this.rotateSpeed);
    this.targetRot.rotateOnWorldAxis(this.cameraRight, dy * this.rotateSpeed);
  }

  handlePanMove(pointers) {
    if (!this.core.renderer.xr.isPresenting || !this.target) return;

    const c = this.getCenter(pointers);
    const dx = c.x - this.panLastCenterX;
    const dy = c.y - this.panLastCenterY;
    const distance = this.getDistance(pointers);
    const distanceDelta = distance - this.panLastDistance;

    this.panLastCenterX = c.x;
    this.panLastCenterY = c.y;
    this.panLastDistance = distance;

    const xrCam = this.core.renderer.xr.getCamera(this.core.camera);
    xrCam.getWorldDirection(this.forward);

    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();

    this.right.crossVectors(this.forward, this.worldUp).normalize();

    this.target.position.addScaledVector(this.right, dx * this.panSpeed);

    if (pointers.length >= 3) {
      this.target.position.addScaledVector(this.worldUp, -dy * this.verticalPanSpeed);
      return;
    }

    this.target.position.addScaledVector(this.forward, -dy * this.panSpeed);
    this.applyPinchScale(distance, distanceDelta);
  }

  handlePointerEnd(e, allowPlacement) {
    const prevCount = this._activePointers.size;
    this._activePointers.delete(e.pointerId);
    const pointers = this.getPointers();
    const nextCount = pointers.length;

    if (!this.hasPlacedModel && this.mode === "place") {
      const isTap = allowPlacement
        && !this.tapMoved
        && performance.now() - this.tapStartTime <= this.tapMaxDurationMs;

      if (isTap) this.placeModelInFrontOfCamera();

      this._activePointers.clear();
      this.active = false;
      this.mode = null;
      return;
    }

    if (prevCount >= 2 && nextCount >= 2 && prevCount !== nextCount) {
      this.startPan(pointers);
      return;
    }

    if (prevCount >= 2 && nextCount < 2) {
      if (nextCount > 0) {
        this.mode = "rotate";
        this.lastX = pointers[0].clientX;
        this.lastY = pointers[0].clientY;
        return;
      }

      this._activePointers.clear();
      this.active = false;
      this.mode = null;
      return;
    }

    if (nextCount === 0) {
      this._activePointers.clear();
      this.active = false;
      this.mode = null;
      return;
    }

    if (nextCount >= 2) this.handlePanMove(pointers);
  }

  getPointers() {
    return Array.from(this._activePointers.values());
  }

  getCenter(pointers) {
    let x = 0;
    let y = 0;
    for (const p of pointers) {
      x += p.clientX;
      y += p.clientY;
    }
    return { x: x / pointers.length, y: y / pointers.length };
  }

  getDistance(pointers) {
    if (pointers.length < 2) return 0;
    return Math.hypot(
      pointers[1].clientX - pointers[0].clientX,
      pointers[1].clientY - pointers[0].clientY
    );
  }

  applyPinchScale(distance, distanceDelta) {
    if (!Number.isFinite(distance) || !Number.isFinite(distanceDelta)) return;
    const previousDistance = distance - distanceDelta;
    if (previousDistance <= 0) return;

    const factor = distance / previousDistance;
    if (!Number.isFinite(factor) || factor <= 0) return;

    const nextX = this.clamp(this.target.scale.x * factor, this.minScale, this.maxScale);
    const appliedFactor = nextX / this.target.scale.x;
    this.target.scale.multiplyScalar(appliedFactor);
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}
