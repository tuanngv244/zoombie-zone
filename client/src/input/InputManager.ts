import * as THREE from 'three';
import { GRID } from '../config/clientConfig';

export type GridClickCallback = (gridX: number, gridY: number) => void;

/**
 * Central input manager: mouse tracking, raycasting, keyboard state.
 */
export class InputManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private groundPlane: THREE.Plane;
  private keysDown: Set<string> = new Set();
  private gridClickCallbacks: GridClickCallback[] = [];
  private gridRightClickCallbacks: GridClickCallback[] = [];
  private gridDoubleClickCallbacks: GridClickCallback[] = [];
  private mouseScreenPos: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDownPos: { x: number; y: number } | null = null;

  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.bindEvents();
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousemove', (e) => {
      this.mouseScreenPos = { x: e.clientX, y: e.clientY };
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDownPos = { x: e.clientX, y: e.clientY };
      }
    });

    canvas.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      // Ignore if mouse was dragged (panning)
      if (this.mouseDownPos) {
        const dx = e.clientX - this.mouseDownPos.x;
        const dy = e.clientY - this.mouseDownPos.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.mouseDownPos = null;
          return;
        }
      }
      this.mouseDownPos = null;
      const pos = this.getMouseGridPosition();
      if (pos) {
        this.gridClickCallbacks.forEach((cb) => cb(pos.x, pos.y));
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      if (e.button !== 0) return;
      const pos = this.getMouseGridPosition();
      if (pos) {
        this.gridDoubleClickCallbacks.forEach((cb) => cb(pos.x, pos.y));
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = this.getMouseGridPosition();
      if (pos) {
        this.gridRightClickCallbacks.forEach((cb) => cb(pos.x, pos.y));
      }
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        this.mouseScreenPos = { x: touch.clientX, y: touch.clientY };
      }
    });

    canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const pos = this.getMouseGridPosition();
        if (pos) {
          this.gridClickCallbacks.forEach((cb) => cb(pos.x, pos.y));
        }
      }
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key.toLowerCase());
    });
  }

  getMouseGridPosition(): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersect = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersect);
    if (!hit) return null;

    const gx = Math.floor(intersect.x);
    const gy = Math.floor(intersect.z);

    if (gx < 0 || gx >= GRID.width || gy < 0 || gy >= GRID.height) {
      return null;
    }

    return { x: gx, y: gy };
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase());
  }

  onGridClick(callback: GridClickCallback): void {
    this.gridClickCallbacks.push(callback);
  }

  onGridRightClick(callback: GridClickCallback): void {
    this.gridRightClickCallbacks.push(callback);
  }

  onGridDoubleClick(callback: GridClickCallback): void {
    this.gridDoubleClickCallbacks.push(callback);
  }

  update(): void {
    // Currently a no-op; raycasting is done on demand via getMouseGridPosition
  }
}
