import * as THREE from 'three';
import { GRID } from '../config/clientConfig';

/**
 * Orbit-style camera controller with zoom, rotate, pan, and touch support.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private spherical: THREE.Spherical;

  // Damped values
  private dampedTarget: THREE.Vector3;
  private dampedSpherical: THREE.Spherical;

  // Input state
  private keys: Set<string> = new Set();
  private isRightDragging = false;
  private isMiddleDragging = false;
  private isLeftDragging = false;
  private lastMouse: { x: number; y: number } = { x: 0, y: 0 };

  // Touch state
  private lastTouchDist = 0;
  private lastTouchAngle = 0;
  private lastTouchCenter: { x: number; y: number } = { x: 0, y: 0 };
  private activeTouches = 0;

  // Limits
  private minDist = 8;
  private maxDist = 120;
  private minPhi = 0.3; // don't go fully top-down
  private maxPhi = Math.PI / 2 - 0.05;
  private panSpeed = 15;
  private rotateSpeed = 0.005;
  private dampFactor = 0.08;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;

    // Initial target is grid center
    this.target = new THREE.Vector3(GRID.width / 2, 0, GRID.height / 2);
    this.dampedTarget = this.target.clone();

    // Compute initial spherical from camera position relative to target
    const offset = new THREE.Vector3().subVectors(
      camera.position,
      this.target,
    );
    this.spherical = new THREE.Spherical().setFromVector3(offset);
    this.dampedSpherical = this.spherical.clone();

    this.bindEvents(domElement);
  }

  private bindEvents(el: HTMLElement): void {
    // Keyboard
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    // Mouse
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isLeftDragging = true;
      if (e.button === 2) this.isRightDragging = true;
      if (e.button === 1) this.isMiddleDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLeftDragging = false;
      if (e.button === 2) this.isRightDragging = false;
      if (e.button === 1) this.isMiddleDragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      if (this.isRightDragging || this.isMiddleDragging) {
        this.spherical.theta -= dx * this.rotateSpeed;
        this.spherical.phi -= dy * this.rotateSpeed;
        this.spherical.phi = THREE.MathUtils.clamp(
          this.spherical.phi,
          this.minPhi,
          this.maxPhi,
        );
      }

      if (this.isLeftDragging) {
        const panX = -dx * 0.05;
        const panZ = dy * 0.05;
        const forward = new THREE.Vector3(
          -Math.sin(this.spherical.theta),
          0,
          -Math.cos(this.spherical.theta),
        );
        const right = new THREE.Vector3(
          Math.cos(this.spherical.theta),
          0,
          -Math.sin(this.spherical.theta),
        );
        this.target.add(right.multiplyScalar(panX));
        this.target.add(forward.multiplyScalar(panZ));
      }
    });

    // Scroll zoom
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.spherical.radius += e.deltaY * 0.03;
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius,
          this.minDist,
          this.maxDist,
        );
      },
      { passive: false },
    );

    // Context menu
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch
    el.addEventListener('touchstart', (e) => {
      this.activeTouches = e.touches.length;
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        this.lastTouchDist = Math.hypot(
          t1.clientX - t0.clientX,
          t1.clientY - t0.clientY,
        );
        this.lastTouchAngle = Math.atan2(
          t1.clientY - t0.clientY,
          t1.clientX - t0.clientX,
        );
        this.lastTouchCenter = {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2,
        };
      } else if (e.touches.length === 1) {
        this.lastTouchCenter = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    });

    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(
          t1.clientX - t0.clientX,
          t1.clientY - t0.clientY,
        );
        const angle = Math.atan2(
          t1.clientY - t0.clientY,
          t1.clientX - t0.clientX,
        );

        // Pinch zoom
        const dDist = dist - this.lastTouchDist;
        this.spherical.radius -= dDist * 0.05;
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius,
          this.minDist,
          this.maxDist,
        );

        // Rotate
        const dAngle = angle - this.lastTouchAngle;
        this.spherical.theta -= dAngle;

        this.lastTouchDist = dist;
        this.lastTouchAngle = angle;
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastTouchCenter.x;
        const dy = e.touches[0].clientY - this.lastTouchCenter.y;
        // Pan
        const panX = -dx * 0.05;
        const panZ = dy * 0.05;
        const forward = new THREE.Vector3(
          -Math.sin(this.spherical.theta),
          0,
          -Math.cos(this.spherical.theta),
        );
        const right = new THREE.Vector3(
          Math.cos(this.spherical.theta),
          0,
          -Math.sin(this.spherical.theta),
        );
        this.target.add(right.multiplyScalar(panX));
        this.target.add(forward.multiplyScalar(panZ));
        this.lastTouchCenter = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      this.activeTouches = e.touches.length;
    });
  }

  update(dt: number): void {
    // Keyboard pan
    const panDelta = this.panSpeed * dt;
    const forward = new THREE.Vector3(
      -Math.sin(this.dampedSpherical.theta),
      0,
      -Math.cos(this.dampedSpherical.theta),
    );
    const right = new THREE.Vector3(
      Math.cos(this.dampedSpherical.theta),
      0,
      -Math.sin(this.dampedSpherical.theta),
    );

    if (this.keys.has('w') || this.keys.has('arrowup'))
      this.target.add(forward.clone().multiplyScalar(panDelta));
    if (this.keys.has('s') || this.keys.has('arrowdown'))
      this.target.add(forward.clone().multiplyScalar(-panDelta));
    if (this.keys.has('a') || this.keys.has('arrowleft'))
      this.target.add(right.clone().multiplyScalar(-panDelta));
    if (this.keys.has('d') || this.keys.has('arrowright'))
      this.target.add(right.clone().multiplyScalar(panDelta));

    // Damping
    this.dampedSpherical.radius = THREE.MathUtils.lerp(
      this.dampedSpherical.radius,
      this.spherical.radius,
      this.dampFactor,
    );
    this.dampedSpherical.phi = THREE.MathUtils.lerp(
      this.dampedSpherical.phi,
      this.spherical.phi,
      this.dampFactor,
    );
    // For theta, handle wrapping
    let dTheta = this.spherical.theta - this.dampedSpherical.theta;
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;
    if (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.dampedSpherical.theta += dTheta * this.dampFactor;

    this.dampedTarget.lerp(this.target, this.dampFactor);

    // Apply
    const offset = new THREE.Vector3().setFromSpherical(this.dampedSpherical);
    this.camera.position.copy(this.dampedTarget).add(offset);
    this.camera.lookAt(this.dampedTarget);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
