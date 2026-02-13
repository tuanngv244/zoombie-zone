import * as THREE from 'three';
import { COLORS, GRID } from '../config/clientConfig';

/**
 * Creates and manages the Three.js scene, renderer, lights, and ground.
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private animateCallbacks: Array<(dt: number) => void> = [];

  constructor(container: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.fogColor);
    this.scene.fog = new THREE.Fog(COLORS.fogColor, 60, 200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    this.camera.position.set(GRID.width / 2, 20, GRID.height / 2 + 18);
    this.camera.lookAt(GRID.width / 2, 0, GRID.height / 2);

    // Lights
    this.setupLights();

    // Ground
    this.setupGround();

    // Clock
    this.clock = new THREE.Clock();

    // Resize
    window.addEventListener('resize', () => this.onResize(container));

    // Start loop
    this.animate();
  }

  private setupLights(): void {
    // Ambient
    const ambient = new THREE.AmbientLight(COLORS.ambientLight, 0.7);
    ambient.name = 'ambientLight';
    this.scene.add(ambient);

    // Directional (moonlight)
    const dir = new THREE.DirectionalLight(COLORS.moonLight, 0.9);
    dir.name = 'directionalLight';
    dir.position.set(-15, 30, -10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -30;
    dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -30;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 80;
    dir.shadow.bias = -0.001;
    this.scene.add(dir);
    this.scene.add(dir.target);
    dir.target.position.set(GRID.width / 2, 0, GRID.height / 2);

    // Torch point lights around castle
    const cx = GRID.castleCenterX;
    const cy = GRID.castleCenterY;
    const torchPositions = [
      [cx - 3, cy - 3],
      [cx + 3, cy - 3],
      [cx - 3, cy + 3],
      [cx + 3, cy + 3],
    ];
    for (const [tx, ty] of torchPositions) {
      const torch = new THREE.PointLight(0xff6622, 1.2, 8, 2);
      torch.position.set(tx, 2.5, ty);
      torch.castShadow = false;
      this.scene.add(torch);
    }
  }

  private setupGround(): void {
    const geo = new THREE.PlaneGeometry(500, 500);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.ground,
      roughness: 1.0,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GRID.width / 2, -0.01, GRID.height / 2);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    for (const cb of this.animateCallbacks) {
      cb(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  // ── Public API ──

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  addToScene(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  removeFromScene(obj: THREE.Object3D): void {
    this.scene.remove(obj);
  }

  onAnimate(cb: (dt: number) => void): void {
    this.animateCallbacks.push(cb);
  }

  getAmbientLight(): THREE.AmbientLight | null {
    return this.scene.getObjectByName('ambientLight') as THREE.AmbientLight | null;
  }

  getDirectionalLight(): THREE.DirectionalLight | null {
    return this.scene.getObjectByName('directionalLight') as THREE.DirectionalLight | null;
  }
}
