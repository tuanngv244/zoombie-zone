import * as THREE from 'three';
import { ENEMY_COLORS } from '../config/clientConfig';
import { EnemySnapshot } from '../socket/StateSync';

// ── Helper: create a bright emissive MeshStandardMaterial ──

function makeMat(
  color: number,
  emissiveIntensity = 0.5,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity,
    roughness: 0.6,
    metalness: 0.1,
  });
}

// ── Procedural geometry builders ──

function createZombieBase(
  group: THREE.Group,
  color: number,
  scale: number,
  emissiveIntensity = 0.5,
): void {
  const mat = makeMat(color, emissiveIntensity);
  const s = scale;

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4 * s, 0.5 * s, 0.25 * s),
    mat,
  );
  body.position.y = 0.55 * s;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * s, 8, 8),
    mat,
  );
  head.position.y = 0.95 * s;
  head.castShadow = true;
  group.add(head);

  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12 * s, 0.4 * s, 0.12 * s),
    mat,
  );
  leftArm.position.set(-0.3 * s, 0.55 * s, 0);
  leftArm.castShadow = true;
  leftArm.userData.partName = 'leftArm';
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12 * s, 0.4 * s, 0.12 * s),
    mat,
  );
  rightArm.position.set(0.3 * s, 0.55 * s, 0);
  rightArm.castShadow = true;
  rightArm.userData.partName = 'rightArm';
  group.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.35 * s, 0.14 * s),
    mat,
  );
  leftLeg.position.set(-0.12 * s, 0.175 * s, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.partName = 'leftLeg';
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.35 * s, 0.14 * s),
    mat,
  );
  rightLeg.position.set(0.12 * s, 0.175 * s, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.partName = 'rightLeg';
  group.add(rightLeg);
}

function createFastZombie(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.6);
  const s = 0.85;

  // Thinner, hunched body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.3 * s, 0.4 * s, 0.2 * s),
    mat,
  );
  body.position.y = 0.5 * s;
  body.rotation.x = 0.3; // hunched forward
  body.castShadow = true;
  group.add(body);

  // Head (smaller)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12 * s, 8, 8),
    mat,
  );
  head.position.set(0, 0.8 * s, -0.08 * s);
  head.castShadow = true;
  group.add(head);

  // Left arm (thinner, longer)
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * s, 0.45 * s, 0.08 * s),
    mat,
  );
  leftArm.position.set(-0.22 * s, 0.45 * s, 0);
  leftArm.castShadow = true;
  leftArm.userData.partName = 'leftArm';
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * s, 0.45 * s, 0.08 * s),
    mat,
  );
  rightArm.position.set(0.22 * s, 0.45 * s, 0);
  rightArm.castShadow = true;
  rightArm.userData.partName = 'rightArm';
  group.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * s, 0.35 * s, 0.1 * s),
    mat,
  );
  leftLeg.position.set(-0.1 * s, 0.175 * s, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.partName = 'leftLeg';
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * s, 0.35 * s, 0.1 * s),
    mat,
  );
  rightLeg.position.set(0.1 * s, 0.175 * s, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.partName = 'rightLeg';
  group.add(rightLeg);
}

function createHeavyZombie(group: THREE.Group, color: number): void {
  createZombieBase(group, color, 1.5, 0.6);
}

function createZombieBoss(group: THREE.Group, color: number): void {
  createZombieBase(group, color, 2.2, 0.8);

  // Glowing red eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: new THREE.Color(0xff0000),
    emissiveIntensity: 2.0,
  });
  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    eyeMat,
  );
  leftEye.position.set(-0.08, 2.2 * 0.95, -0.12);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    eyeMat,
  );
  rightEye.position.set(0.08, 2.2 * 0.95, -0.12);
  group.add(rightEye);

  // Point light for boss glow
  const light = new THREE.PointLight(0xff2200, 0.8, 4);
  light.position.set(0, 1.5, 0);
  group.add(light);
}

function createSoldier(group: THREE.Group, color: number, emissiveIntensity = 0.5): void {
  const mat = makeMat(color, emissiveIntensity);
  const armorMat = makeMat(0x999999, emissiveIntensity);

  // Armored body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.55, 0.3),
    armorMat,
  );
  body.position.y = 0.575;
  body.castShadow = true;
  group.add(body);

  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    armorMat,
  );
  helmet.position.y = 1.0;
  helmet.scale.set(1, 0.8, 1);
  helmet.castShadow = true;
  group.add(helmet);

  // Shield (left side)
  const shieldMat = makeMat(0x666688, emissiveIntensity);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.4, 0.3),
    shieldMat,
  );
  shield.position.set(-0.3, 0.55, 0);
  shield.castShadow = true;
  group.add(shield);

  // Sword (right side)
  const swordMat = makeMat(0xcccccc, emissiveIntensity);
  const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.5, 0.04),
    swordMat,
  );
  sword.position.set(0.32, 0.55, 0);
  sword.castShadow = true;
  group.add(sword);

  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.4, 0.12),
    mat,
  );
  leftArm.position.set(-0.32, 0.55, 0);
  leftArm.castShadow = true;
  leftArm.userData.partName = 'leftArm';
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.4, 0.12),
    mat,
  );
  rightArm.position.set(0.32, 0.55, 0);
  rightArm.castShadow = true;
  rightArm.userData.partName = 'rightArm';
  group.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.35, 0.14),
    mat,
  );
  leftLeg.position.set(-0.12, 0.175, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.partName = 'leftLeg';
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.35, 0.14),
    mat,
  );
  rightLeg.position.set(0.12, 0.175, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.partName = 'rightLeg';
  group.add(rightLeg);
}

function createEliteSoldier(group: THREE.Group, color: number): void {
  createSoldier(group, color, 0.6);

  // Gold pauldrons
  const goldMat = makeMat(0xffd700, 0.8);
  const leftPauldron = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    goldMat,
  );
  leftPauldron.position.set(-0.3, 0.85, 0);
  leftPauldron.scale.set(1.2, 0.6, 1.0);
  leftPauldron.castShadow = true;
  group.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    goldMat,
  );
  rightPauldron.position.set(0.3, 0.85, 0);
  rightPauldron.scale.set(1.2, 0.6, 1.0);
  rightPauldron.castShadow = true;
  group.add(rightPauldron);
}

function createGeneral(group: THREE.Group, color: number): void {
  const s = 1.4;
  const mat = makeMat(color, 0.7);
  const armorMat = makeMat(0xaaaaaa, 0.7);

  // Larger armored body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 * s, 0.6 * s, 0.35 * s),
    armorMat,
  );
  body.position.y = 0.6 * s;
  body.castShadow = true;
  group.add(body);

  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.2 * s, 8, 8),
    armorMat,
  );
  helmet.position.y = 1.1 * s;
  helmet.scale.set(1, 0.8, 1);
  helmet.castShadow = true;
  group.add(helmet);

  // Crown on top of helmet
  const crownMat = makeMat(0xffd700, 1.0);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 0.1 * s, 6),
    crownMat,
  );
  crown.position.y = 1.3 * s;
  crown.castShadow = true;
  group.add(crown);

  // Cape (plane behind the body)
  const capeMat = makeMat(0x880000, 0.7);
  capeMat.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5 * s, 0.7 * s),
    capeMat,
  );
  cape.position.set(0, 0.55 * s, 0.2 * s);
  cape.userData.partName = 'cape';
  cape.castShadow = true;
  group.add(cape);

  // Great sword (right side)
  const swordMat = makeMat(0xdddddd, 0.8);
  const greatSword = new THREE.Mesh(
    new THREE.BoxGeometry(0.06 * s, 0.8 * s, 0.06 * s),
    swordMat,
  );
  greatSword.position.set(0.38 * s, 0.6 * s, 0);
  greatSword.castShadow = true;
  group.add(greatSword);

  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.45 * s, 0.14 * s),
    mat,
  );
  leftArm.position.set(-0.35 * s, 0.55 * s, 0);
  leftArm.castShadow = true;
  leftArm.userData.partName = 'leftArm';
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.45 * s, 0.14 * s),
    mat,
  );
  rightArm.position.set(0.35 * s, 0.55 * s, 0);
  rightArm.castShadow = true;
  rightArm.userData.partName = 'rightArm';
  group.add(rightArm);

  // Left leg
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * s, 0.4 * s, 0.16 * s),
    mat,
  );
  leftLeg.position.set(-0.14 * s, 0.2 * s, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.partName = 'leftLeg';
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * s, 0.4 * s, 0.16 * s),
    mat,
  );
  rightLeg.position.set(0.14 * s, 0.2 * s, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.partName = 'rightLeg';
  group.add(rightLeg);

  // Point light for general glow
  const light = new THREE.PointLight(0xff4400, 0.6, 5);
  light.position.set(0, 1.2, 0);
  group.add(light);
}

// ── Per-enemy mesh data ──

interface EnemyMeshData {
  group: THREE.Group;
  targetX: number;
  targetZ: number;
  currentX: number;
  currentZ: number;
  type: string;
  speed: number;
  distanceTraveled: number;
  prevX: number;
  prevZ: number;
  /** Time accumulator for boss slam animation */
  bossTimer: number;
  /** Time accumulator for general cape flutter */
  capeTimer: number;
  /** Cached part references for fast animation */
  parts: {
    leftArm: THREE.Object3D | null;
    rightArm: THREE.Object3D | null;
    leftLeg: THREE.Object3D | null;
    rightLeg: THREE.Object3D | null;
    cape: THREE.Object3D | null;
  };
}

// ── Factory dispatch ──

function createEnemyMesh(type: string): THREE.Group {
  const color = ENEMY_COLORS[type] ?? 0x556b2f;
  const group = new THREE.Group();

  switch (type) {
    case 'fast_zombie':
      createFastZombie(group, color);
      break;
    case 'heavy_zombie':
      createHeavyZombie(group, color);
      break;
    case 'zombie_boss':
      createZombieBoss(group, color);
      break;
    case 'soldier':
      createSoldier(group, color);
      break;
    case 'elite_soldier':
      createEliteSoldier(group, color);
      break;
    case 'general':
      createGeneral(group, color);
      break;
    case 'normal_zombie':
    default:
      createZombieBase(group, color, 1.0, 0.5);
      break;
  }

  return group;
}

/** Collect tagged part references from a group for animation. */
function collectParts(group: THREE.Group): EnemyMeshData['parts'] {
  const parts: EnemyMeshData['parts'] = {
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
    cape: null,
  };
  group.traverse((child) => {
    const name = child.userData.partName as string | undefined;
    if (name === 'leftArm') parts.leftArm = child;
    else if (name === 'rightArm') parts.rightArm = child;
    else if (name === 'leftLeg') parts.leftLeg = child;
    else if (name === 'rightLeg') parts.rightLeg = child;
    else if (name === 'cape') parts.cape = child;
  });
  return parts;
}

// ── Main renderer class ──

/**
 * Manages all enemy 3D objects using procedural geometry with smooth
 * position interpolation and walking/attack animations.
 */
export class EnemyRenderer {
  private scene: THREE.Scene;
  private enemies: Map<string, EnemyMeshData> = new Map();
  private interpSpeed = 8;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * No-op kept for API compatibility (previously loaded GLB models).
   */
  static preload(): Promise<void> {
    return Promise.resolve();
  }

  // ── Public API ──

  addEnemy(snap: EnemySnapshot): void {
    if (this.enemies.has(snap.id)) return;
    const group = createEnemyMesh(snap.type);
    group.position.set(snap.x, 0, snap.y);
    group.userData['enemyId'] = snap.id;
    this.scene.add(group);

    this.enemies.set(snap.id, {
      group,
      targetX: snap.x,
      targetZ: snap.y,
      currentX: snap.x,
      currentZ: snap.y,
      type: snap.type,
      speed: snap.speed,
      distanceTraveled: 0,
      prevX: snap.x,
      prevZ: snap.y,
      bossTimer: 0,
      capeTimer: 0,
      parts: collectParts(group),
    });
  }

  removeEnemy(id: string): void {
    const data = this.enemies.get(id);
    if (data) {
      this.scene.remove(data.group);
      this.disposeGroup(data.group);
      this.enemies.delete(id);
    }
  }

  updateEnemies(snapshots: EnemySnapshot[]): void {
    const ids = new Set(snapshots.map((s) => s.id));

    // Remove enemies no longer present
    for (const [id] of this.enemies) {
      if (!ids.has(id)) {
        this.removeEnemy(id);
      }
    }

    // Add / update
    for (const snap of snapshots) {
      const existing = this.enemies.get(snap.id);
      if (existing) {
        existing.targetX = snap.x;
        existing.targetZ = snap.y;
        existing.speed = snap.speed;
      } else {
        this.addEnemy(snap);
      }
    }
  }

  update(dt: number): void {
    for (const [, data] of this.enemies) {
      // Interpolate position
      const lerpFactor = 1 - Math.exp(-this.interpSpeed * dt);
      data.currentX += (data.targetX - data.currentX) * lerpFactor;
      data.currentZ += (data.targetZ - data.currentZ) * lerpFactor;
      data.group.position.x = data.currentX;
      data.group.position.z = data.currentZ;

      // Accumulate distance traveled
      const dx = data.currentX - data.prevX;
      const dz = data.currentZ - data.prevZ;
      const stepDist = Math.sqrt(dx * dx + dz * dz);
      data.distanceTraveled += stepDist;
      data.prevX = data.currentX;
      data.prevZ = data.currentZ;

      // Face direction of movement
      const fdx = data.targetX - data.currentX;
      const fdz = data.targetZ - data.currentZ;
      if (Math.abs(fdx) > 0.01 || Math.abs(fdz) > 0.01) {
        data.group.rotation.y = Math.atan2(fdx, fdz);
      }
    }

    // Run animations after position updates
    this.updateAnimations(dt);
  }

  getEnemyPosition(id: string): THREE.Vector3 | null {
    const data = this.enemies.get(id);
    if (!data) return null;
    return data.group.position.clone();
  }

  /** Alias for addEnemy for local game engine compatibility. */
  spawnEnemy(snap: EnemySnapshot): void {
    this.addEnemy(snap);
  }

  /** Remove all enemies. */
  clearAll(): void {
    for (const [id] of this.enemies) {
      this.removeEnemy(id);
    }
  }

  // ── Animations ──

  private updateAnimations(dt: number): void {
    for (const [, data] of this.enemies) {
      const { parts, type } = data;

      // Determine if the enemy is "attacking" (near wall / barely moving)
      const velocityX = data.targetX - data.currentX;
      const velocityZ = data.targetZ - data.currentZ;
      const velocityMag = Math.sqrt(velocityX * velocityX + velocityZ * velocityZ);
      const isAttacking = velocityMag < 0.02 && data.speed > 0;

      // Walking animation frequency scales with speed
      const freq = 8.0;
      const t = data.distanceTraveled * freq;

      if (isAttacking) {
        // Attack animation: swing arms forward
        const attackSwing = Math.sin(Date.now() * 0.008) * 0.6;
        if (parts.leftArm) parts.leftArm.rotation.x = -0.8 + attackSwing;
        if (parts.rightArm) parts.rightArm.rotation.x = -0.8 - attackSwing;
        // Legs stay still during attack
        if (parts.leftLeg) parts.leftLeg.rotation.x = 0;
        if (parts.rightLeg) parts.rightLeg.rotation.x = 0;
      } else {
        // Walking animation: bob arms and legs alternately
        const armSwing = Math.sin(t) * 0.4;
        const legSwing = Math.sin(t) * 0.3;

        if (parts.leftArm) parts.leftArm.rotation.x = armSwing;
        if (parts.rightArm) parts.rightArm.rotation.x = -armSwing;
        if (parts.leftLeg) parts.leftLeg.rotation.x = -legSwing;
        if (parts.rightLeg) parts.rightLeg.rotation.x = legSwing;
      }

      // Zombie boss: periodic ground slam
      if (type === 'zombie_boss') {
        data.bossTimer += dt;
        // Slam every 3 seconds: quick drop (0.2s) then rise (0.3s)
        const cycle = data.bossTimer % 3.0;
        if (cycle < 0.2) {
          // Dropping phase
          const progress = cycle / 0.2;
          data.group.position.y = -0.3 * progress;
        } else if (cycle < 0.5) {
          // Rising phase
          const progress = (cycle - 0.2) / 0.3;
          data.group.position.y = -0.3 * (1 - progress);
        } else {
          data.group.position.y = 0;
        }
      }

      // General: cape flutter
      if (type === 'general' && parts.cape) {
        data.capeTimer += dt;
        const flutter = Math.sin(data.capeTimer * 5.0) * 0.15;
        const flutter2 = Math.sin(data.capeTimer * 7.3) * 0.08;
        parts.cape.rotation.x = flutter + flutter2;
        parts.cape.rotation.y = Math.sin(data.capeTimer * 3.2) * 0.05;
      }
    }
  }

  // ── Cleanup ──

  private disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  }
}
