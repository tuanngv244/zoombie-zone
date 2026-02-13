import * as THREE from 'three';
import { getBuildingDef, BuildingDef } from '../config/clientConfig';
import { BuildingSnapshot } from '../socket/StateSync';

/* ------------------------------------------------------------------ */
/*  Attack animation state                                            */
/* ------------------------------------------------------------------ */

interface AttackAnim {
  phase: number;   // 0 → 1 progress through the animation
  active: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helper: bright emissive material                                  */
/* ------------------------------------------------------------------ */

function makeMat(
  color: number,
  opts: {
    emissive?: number;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    roughness?: number;
    metalness?: number;
    side?: THREE.Side;
    depthWrite?: boolean;
  } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.emissiveIntensity ?? 0.5,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
  });
}

/* ================================================================== */
/*  BuildingRenderer – procedural geometry, bright emissive materials  */
/* ================================================================== */

export class BuildingRenderer {
  private scene: THREE.Scene;
  private buildings: Map<string, THREE.Group> = new Map();
  private ghost: THREE.Group | null = null;
  private ghostType: string | null = null;

  /** Per-building attack animation state. */
  private attackAnimations: Map<string, AttackAnim> = new Map();

  /** Cached thumbnail data-URLs keyed by building type. */
  private static thumbnailCache: Map<string, string> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /* ================================================================ */
  /*  Thumbnail generation (static, offscreen)                        */
  /* ================================================================ */

  /**
   * Render a small 48x48 thumbnail of the given building type's procedural
   * model. Uses a temporary offscreen WebGLRenderer, scene and camera.
   * Results are cached so each type is only rendered once.
   */
  static generateThumbnail(def: BuildingDef): string | null {
    const cached = BuildingRenderer.thumbnailCache.get(def.type);
    if (cached) return cached;

    try {
      const size = 96; // render at 2x for retina, display at 48
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);

      const thumbScene = new THREE.Scene();

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      thumbScene.add(ambient);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(2, 4, 3);
      thumbScene.add(dirLight);

      // Create the procedural model via a temporary instance
      const tempInstance = new BuildingRenderer(thumbScene);
      const model = tempInstance.createBuildingGroup(def, 1.0);
      thumbScene.add(model);

      // Compute bounding sphere to frame the camera
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const bSphere = new THREE.Sphere();
      box.getBoundingSphere(bSphere);
      const radius = bSphere.radius || 1;

      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      const dist = radius / Math.tan((35 * Math.PI) / 360) * 1.15;
      camera.position.set(
        center.x + dist * 0.6,
        center.y + dist * 0.5,
        center.z + dist * 0.7,
      );
      camera.lookAt(center);

      renderer.render(thumbScene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // Cleanup
      renderer.dispose();
      tempInstance.disposeGroup(model);

      BuildingRenderer.thumbnailCache.set(def.type, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[BuildingRenderer] Thumbnail generation failed for', def.type, err);
      return null;
    }
  }

  /* ================================================================ */
  /*  Public API                                                      */
  /* ================================================================ */

  addBuilding(snap: BuildingSnapshot): void {
    if (this.buildings.has(snap.id)) return;
    const def = getBuildingDef(snap.type);
    if (!def) return;

    const stackCount = snap.stackCount || 1;
    const mesh = this.createBuildingGroup(def, 1.0, stackCount);
    mesh.position.set(
      snap.gridX + def.gridWidth / 2,
      0,
      snap.gridY + def.gridHeight / 2,
    );
    mesh.userData['buildingId'] = snap.id;
    mesh.userData['buildingType'] = snap.type;
    mesh.userData['stackCount'] = stackCount;
    this.scene.add(mesh);
    this.buildings.set(snap.id, mesh);
  }

  removeBuilding(id: string): void {
    const mesh = this.buildings.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.disposeGroup(mesh);
      this.buildings.delete(id);
      this.attackAnimations.delete(id);
    }
  }

  updateBuilding(id: string, snap: BuildingSnapshot): void {
    const mesh = this.buildings.get(id);
    if (!mesh) {
      this.addBuilding(snap);
      return;
    }
    const def = getBuildingDef(snap.type);
    if (!def) return;

    // Check if stackCount changed — rebuild if so
    const oldStack = mesh.userData['stackCount'] || 1;
    if (oldStack !== (snap.stackCount || 1)) {
      this.removeBuilding(id);
      this.addBuilding(snap);
      return;
    }

    mesh.position.set(
      snap.gridX + def.gridWidth / 2,
      0,
      snap.gridY + def.gridHeight / 2,
    );
  }

  syncAll(snapshots: BuildingSnapshot[]): void {
    const ids = new Set(snapshots.map((s) => s.id));
    // Remove buildings no longer present
    for (const [id] of this.buildings) {
      if (!ids.has(id)) this.removeBuilding(id);
    }
    // Add / update
    for (const snap of snapshots) {
      if (this.buildings.has(snap.id)) {
        this.updateBuilding(snap.id, snap);
      } else {
        this.addBuilding(snap);
      }
    }
  }

  /** Sync a single building (add or update). */
  syncBuilding(snapshot: BuildingSnapshot): void {
    if (this.buildings.has(snapshot.id)) {
      this.updateBuilding(snapshot.id, snapshot);
    } else {
      this.addBuilding(snapshot);
    }
  }

  /** Remove all buildings. */
  clearAll(): void {
    for (const [id] of this.buildings) {
      this.removeBuilding(id);
    }
  }

  showGhost(type: string, x: number, y: number, valid: boolean): void {
    const def = getBuildingDef(type);
    if (!def) return;

    if (this.ghostType !== type || !this.ghost) {
      this.hideGhost();
      this.ghost = this.createGhostGroup(def, valid);
      this.ghostType = type;
      this.scene.add(this.ghost);
    }

    // Tint green / red based on placement validity
    const tint = valid ? 0x00ff44 : 0xff2222;
    this.ghost.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.setHex(tint);
          mat.emissiveIntensity = 0.8;
          mat.color.setHex(tint);
        }
      }
    });

    this.ghost.position.set(x + def.gridWidth / 2, 0, y + def.gridHeight / 2);
    this.ghost.visible = true;
  }

  hideGhost(): void {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.disposeGroup(this.ghost);
      this.ghost = null;
      this.ghostType = null;
    }
  }

  /* ================================================================ */
  /*  Attack animation API                                            */
  /* ================================================================ */

  /** Trigger an attack animation for the given building. */
  triggerAttack(buildingId: string): void {
    this.attackAnimations.set(buildingId, { phase: 0, active: true });
  }

  /** Advance all active attack animations by `dt` seconds. */
  updateAnimations(dt: number): void {
    const ANIM_DURATION = 0.45; // seconds for full cycle

    for (const [id, anim] of this.attackAnimations) {
      if (!anim.active) continue;

      anim.phase += dt / ANIM_DURATION;
      if (anim.phase >= 1) {
        anim.phase = 1;
        anim.active = false;
      }

      const group = this.buildings.get(id);
      if (!group) continue;

      const type = group.userData['buildingType'] as string;

      switch (type) {
        case 'arrow_tower':
          this.animateArrowTower(group, anim.phase);
          break;
        case 'cannon':
          this.animateCannon(group, anim.phase);
          break;
        case 'ballista':
          this.animateBallista(group, anim.phase);
          break;
        case 'hot_air_balloon':
          this.animateBalloon(group, anim.phase);
          break;
        case 'explosive_mine':
          this.animateMine(group, anim.phase);
          break;
      }
    }
  }

  /* ================================================================ */
  /*  Animation helpers                                               */
  /* ================================================================ */

  /** Arrow Tower: turret recoil (translate + rotate back then return). */
  private animateArrowTower(group: THREE.Group, t: number): void {
    const turret = group.getObjectByName('turret');
    if (!turret) return;
    // sharp recoil in first 30%, ease back in remaining 70%
    const recoil = t < 0.3
      ? (t / 0.3)
      : 1 - ((t - 0.3) / 0.7);
    turret.position.y = 1.6 - recoil * 0.15;
    turret.rotation.x = -recoil * 0.15;
  }

  /** Cannon: barrel recoil + smoke puff sphere. */
  private animateCannon(group: THREE.Group, t: number): void {
    const barrel = group.getObjectByName('barrel');
    if (barrel) {
      const recoil = t < 0.25
        ? (t / 0.25)
        : 1 - ((t - 0.25) / 0.75);
      barrel.position.z = 0.35 - recoil * 0.25;
    }

    // Smoke puff
    let smoke = group.getObjectByName('smoke') as THREE.Mesh | undefined;
    if (t < 0.05 && !smoke) {
      const geo = new THREE.SphereGeometry(0.15, 8, 8);
      const mat = makeMat(0xaaaaaa, {
        emissive: 0xcccccc,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7,
      });
      smoke = new THREE.Mesh(geo, mat);
      smoke.name = 'smoke';
      smoke.position.set(0, 1.0, 0.7);
      group.add(smoke);
    }
    if (smoke) {
      const scale = 1 + t * 2;
      smoke.scale.set(scale, scale, scale);
      const mat = smoke.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 0.7 * (1 - t));
      if (t >= 1) {
        group.remove(smoke);
        smoke.geometry.dispose();
        mat.dispose();
      }
    }
  }

  /** Ballista: bow arms flex inward then snap back. */
  private animateBallista(group: THREE.Group, t: number): void {
    const armL = group.getObjectByName('armL');
    const armR = group.getObjectByName('armR');
    if (!armL || !armR) return;

    // flex: quick pull (0-0.2) then snap back (0.2-1)
    const flex = t < 0.2
      ? (t / 0.2)
      : 1 - ((t - 0.2) / 0.8);
    const angle = flex * 0.35;
    armL.rotation.y = angle;
    armR.rotation.y = -angle;
  }

  /** Hot Air Balloon: sway side-to-side when dropping bomb. */
  private animateBalloon(group: THREE.Group, t: number): void {
    const envelope = group.getObjectByName('envelope');
    if (!envelope) return;
    // Damped sinusoidal sway
    const sway = Math.sin(t * Math.PI * 4) * (1 - t) * 0.18;
    envelope.rotation.z = sway;
  }

  /** Explosive Mine: pulsing glow before detonation. */
  private animateMine(group: THREE.Group, t: number): void {
    const light = group.getObjectByName('mineLight');
    if (!light) return;
    // Rapidly pulsing emissive brightness
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 10);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissiveIntensity = 0.5 + pulse * 1.5;
        }
      }
    });
    // Scale pulse
    const s = 1 + pulse * 0.08;
    group.scale.set(s, s, s);
    if (t >= 1) group.scale.set(1, 1, 1);
  }

  /* ================================================================ */
  /*  Building group factory – routes to specific creators            */
  /* ================================================================ */

  private createBuildingGroup(def: BuildingDef, opacity: number, stackCount: number = 1): THREE.Group {
    switch (def.type) {
      case 'wooden_wall':
      case 'stone_wall':
      case 'brick_wall':
        return this.createWallMesh(def, opacity, stackCount);
      case 'river_barrier':
        return this.createRiverBarrier(def, opacity, stackCount);
      case 'arrow_tower':
        return this.createArrowTower(def, opacity);
      case 'cannon':
        return this.createCannon(def, opacity);
      case 'ballista':
        return this.createBallista(def, opacity);
      case 'explosive_mine':
        return this.createMine(def, opacity);
      case 'hot_air_balloon':
        return this.createBalloon(def, opacity);
      default:
        return this.createFallbackBox(def, opacity);
    }
  }

  /* ================================================================ */
  /*  Procedural building meshes                                      */
  /* ================================================================ */

  /* ── Walls ────────────────────────────────────────────────────── */

  private createWallMesh(def: BuildingDef, opacity: number, stackCount: number = 1): THREE.Group {
    const group = new THREE.Group();
    const w = def.gridWidth * 0.9;
    const d = def.gridHeight * 0.9;
    const h = 1.4 * stackCount;

    const mat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });

    // Main wall body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Crenellations for stone and brick walls
    if (def.type === 'stone_wall' || def.type === 'brick_wall') {
      const crenW = w * 0.25;
      const crenH = 0.3;
      const crenMat = makeMat(def.color, {
        emissive: def.color,
        emissiveIntensity: 0.5,
        opacity,
        transparent: opacity < 1,
      });
      for (let i = -1; i <= 1; i += 2) {
        const cren = new THREE.Mesh(
          new THREE.BoxGeometry(crenW, crenH, d * 0.6),
          crenMat,
        );
        cren.position.set(i * w * 0.3, h + crenH / 2, 0);
        cren.castShadow = true;
        group.add(cren);
      }
    }

    // Horizontal planks for wooden wall
    if (def.type === 'wooden_wall') {
      const plankMat = makeMat(0x6b4f1a, {
        emissive: 0x6b4f1a,
        emissiveIntensity: 0.4,
        opacity,
        transparent: opacity < 1,
      });
      for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.02, 0.05, d * 0.15),
          plankMat,
        );
        plank.position.set(0, 0.3 + i * 0.45, d * 0.46);
        group.add(plank);
      }
    }

    // Stack layer lines — darker horizontal bands at each layer boundary
    if (stackCount > 1) {
      const darkerColor = def.color * 0.7;
      const lineMat = makeMat(darkerColor, {
        emissive: darkerColor,
        emissiveIntensity: 0.3,
        opacity,
        transparent: opacity < 1,
      });
      for (let i = 1; i < stackCount; i++) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.02, 0.04, d * 1.02),
          lineMat,
        );
        line.position.y = 1.4 * i;
        group.add(line);
      }
    }

    return group;
  }

  /* ── River Barrier ───────────────────────────────────────────── */

  private createRiverBarrier(def: BuildingDef, opacity: number, stackCount: number = 1): THREE.Group {
    const group = new THREE.Group();
    const w = def.gridWidth * 0.9;
    const d = def.gridHeight * 0.9;
    const h = 0.6 * stackCount;

    const baseMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });

    // Flat base slab
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    base.position.y = h / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Wavy water surface on top
    const waterMat = makeMat(0x66bbdd, {
      emissive: 0x44aacc,
      emissiveIntensity: 0.6,
      opacity: opacity * 0.7,
      transparent: true,
    });
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.95, 0.1, d * 0.8),
      waterMat,
    );
    water.position.y = h + 0.05;
    group.add(water);

    // Side posts
    const postMat = makeMat(0x7a6040, {
      emissive: 0x7a6040,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = -1; i <= 1; i += 2) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.9 * stackCount, 6),
        postMat,
      );
      post.position.set(i * w * 0.42, (0.9 * stackCount) / 2, 0);
      post.castShadow = true;
      group.add(post);
    }

    // Stack layer lines for river barriers
    if (stackCount > 1) {
      const darkerColor = def.color * 0.7;
      const lineMat = makeMat(darkerColor, {
        emissive: darkerColor,
        emissiveIntensity: 0.3,
        opacity,
        transparent: opacity < 1,
      });
      for (let i = 1; i < stackCount; i++) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.02, 0.04, d * 1.02),
          lineMat,
        );
        line.position.y = 0.6 * i;
        group.add(line);
      }
    }

    return group;
  }

  /* ── Arrow Tower ─────────────────────────────────────────────── */

  private createArrowTower(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();
    const w = def.gridWidth * 0.7;

    const baseMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });

    // Tapered tower body (cylinder)
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.35, w * 0.45, 1.6, 8),
      baseMat,
    );
    tower.position.y = 0.8;
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    // Platform
    const platformMat = makeMat(0x8b7355, {
      emissive: 0x8b7355,
      emissiveIntensity: 0.45,
      opacity,
      transparent: opacity < 1,
    });
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.12, 8),
      platformMat,
    );
    platform.position.y = 1.6;
    platform.castShadow = true;
    group.add(platform);

    // Turret (named for animation)
    const turretMat = makeMat(0x9a7b4a, {
      emissive: 0x9a7b4a,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });
    const turret = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.3, 0.5),
      turretMat,
    );
    turret.name = 'turret';
    turret.position.y = 1.6 + 0.15;
    turret.castShadow = true;
    group.add(turret);

    // Arrow slit
    const slitMat = makeMat(0x222222, {
      emissive: 0xffaa33,
      emissiveIntensity: 0.6,
      opacity,
      transparent: opacity < 1,
    });
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.3, 0.06),
      slitMat,
    );
    slit.position.set(0, 1.0, w * 0.46);
    group.add(slit);

    return group;
  }

  /* ── Cannon ──────────────────────────────────────────────────── */

  private createCannon(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();
    const w = def.gridWidth * 0.8;

    const baseMat = makeMat(0x555555, {
      emissive: 0x555555,
      emissiveIntensity: 0.45,
      opacity,
      transparent: opacity < 1,
      metalness: 0.4,
    });

    // Wheeled base platform
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 0.3, w * 0.65),
      baseMat,
    );
    platform.position.y = 0.15;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // Wheels
    const wheelMat = makeMat(0x4a3520, {
      emissive: 0x4a3520,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = -1; i <= 1; i += 2) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12),
        wheelMat,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(i * w * 0.42, 0.2, 0);
      wheel.castShadow = true;
      group.add(wheel);
    }

    // Barrel body
    const barrelMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
      metalness: 0.5,
    });
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.9, 10),
      barrelMat,
    );
    barrel.name = 'barrel';
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.55, 0.35);
    barrel.castShadow = true;
    group.add(barrel);

    // Barrel mouth ring
    const mouthMat = makeMat(0x222222, {
      emissive: 0xff6600,
      emissiveIntensity: 0.6,
      opacity,
      transparent: opacity < 1,
      metalness: 0.6,
    });
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.04, 8, 12),
      mouthMat,
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 0.55, 0.8);
    group.add(mouth);

    return group;
  }

  /* ── Ballista ────────────────────────────────────────────────── */

  private createBallista(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();
    const w = def.gridWidth * 0.85;

    const frameMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });

    // Main frame rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.12, w * 0.9),
      frameMat,
    );
    rail.position.set(0, 0.35, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);

    // Support legs
    const legMat = makeMat(0x6a5030, {
      emissive: 0x6a5030,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.35, 0.08),
          legMat,
        );
        leg.position.set(i * 0.15, 0.175, j * w * 0.3);
        leg.castShadow = true;
        group.add(leg);
      }
    }

    // Bow arms (named for animation)
    const armMat = makeMat(0x8b6914, {
      emissive: 0x8b6914,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });

    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 0.06),
      armMat,
    );
    armL.name = 'armL';
    armL.position.set(-0.3, 0.42, w * 0.35);
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 0.06),
      armMat,
    );
    armR.name = 'armR';
    armR.position.set(0.3, 0.42, w * 0.35);
    armR.castShadow = true;
    group.add(armR);

    // Bowstring
    const stringMat = makeMat(0xdddddd, {
      emissive: 0xcccccc,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    const string = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.02, 0.02),
      stringMat,
    );
    string.position.set(0, 0.42, w * 0.35);
    group.add(string);

    // Bolt
    const boltMat = makeMat(0xaaaa44, {
      emissive: 0xaaaa44,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6),
      boltMat,
    );
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0, 0.42, 0.1);
    group.add(bolt);

    return group;
  }

  /* ── Explosive Mine ──────────────────────────────────────────── */

  private createMine(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();

    const bodyMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
      metalness: 0.3,
    });

    // Disc body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16),
      bodyMat,
    );
    body.position.y = 0.075;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pressure plate on top
    const plateMat = makeMat(0x666666, {
      emissive: 0x888888,
      emissiveIntensity: 0.45,
      opacity,
      transparent: opacity < 1,
      metalness: 0.5,
    });
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
      plateMat,
    );
    plate.position.y = 0.175;
    group.add(plate);

    // Warning indicator light (named for animation)
    const lightMat = makeMat(0xff3300, {
      emissive: 0xff3300,
      emissiveIntensity: 0.6,
      opacity,
      transparent: opacity < 1,
    });
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      lightMat,
    );
    light.name = 'mineLight';
    light.position.y = 0.22;
    group.add(light);

    // Detonator spikes around the edge
    const spikeMat = makeMat(0x333333, {
      emissive: 0x555555,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 4),
        spikeMat,
      );
      spike.position.set(
        Math.cos(angle) * 0.3,
        0.15,
        Math.sin(angle) * 0.3,
      );
      group.add(spike);
    }

    return group;
  }

  /* ── Hot Air Balloon ─────────────────────────────────────────── */

  private createBalloon(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();

    // Basket
    const basketMat = makeMat(0x7a5c30, {
      emissive: 0x7a5c30,
      emissiveIntensity: 0.45,
      opacity,
      transparent: opacity < 1,
    });
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.4, 0.7),
      basketMat,
    );
    basket.position.y = 0.2;
    basket.castShadow = true;
    basket.receiveShadow = true;
    group.add(basket);

    // Ropes (4 corners)
    const ropeMat = makeMat(0xaa9960, {
      emissive: 0xaa9960,
      emissiveIntensity: 0.4,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 2.2, 4),
          ropeMat,
        );
        rope.position.set(i * 0.28, 1.5, j * 0.28);
        group.add(rope);
      }
    }

    // Envelope (named for animation)
    const envMat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.55,
      opacity,
      transparent: opacity < 1,
    });
    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 12),
      envMat,
    );
    envelope.name = 'envelope';
    envelope.scale.set(1, 1.3, 1);
    envelope.position.y = 3.2;
    envelope.castShadow = true;
    group.add(envelope);

    // Decorative stripes on the envelope
    const stripeMat = makeMat(0xffcc44, {
      emissive: 0xffcc44,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });
    for (let i = -1; i <= 1; i += 2) {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.04, 6, 16),
        stripeMat,
      );
      stripe.position.set(0, 3.2 + i * 0.35, 0);
      group.add(stripe);
    }

    // Burner glow
    const burnerMat = makeMat(0xff6600, {
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
      opacity,
      transparent: opacity < 1,
    });
    const burner = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      burnerMat,
    );
    burner.position.y = 2.5;
    group.add(burner);

    return group;
  }

  /* ── Fallback box ────────────────────────────────────────────── */

  private createFallbackBox(def: BuildingDef, opacity: number): THREE.Group {
    const group = new THREE.Group();
    const h = 1.5;
    const w = def.gridWidth * 0.85;
    const d = def.gridHeight * 0.85;

    const mat = makeMat(def.color, {
      emissive: def.color,
      emissiveIntensity: 0.5,
      opacity,
      transparent: opacity < 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  /* ================================================================ */
  /*  Ghost mesh (transparent placement preview)                      */
  /* ================================================================ */

  private createGhostGroup(def: BuildingDef, valid: boolean): THREE.Group {
    const ghostGroup = this.createBuildingGroup(def, 0.4);
    const tint = valid ? 0x00ff44 : 0xff2222;

    ghostGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const newMat = makeMat(tint, {
          emissive: tint,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        // Dispose old material(s)
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
        mesh.material = newMat;
      }
    });

    return ghostGroup;
  }

  /* ================================================================ */
  /*  Cleanup                                                         */
  /* ================================================================ */

  private disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          (m.material as THREE.Material).dispose();
        }
      }
    });
  }
}
