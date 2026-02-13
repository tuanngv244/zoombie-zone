import * as THREE from 'three';
import { ArmyUnitDef, ARMY_UNIT_DEFS } from '../config/clientConfig';

/* ------------------------------------------------------------------ */
/*  Helper: bright emissive material                                  */
/* ------------------------------------------------------------------ */

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

/* ================================================================== */
/*  Procedural army unit mesh builders                                */
/* ================================================================== */

function createSwordsman(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.5);
  const armorMat = makeMat(0x6688bb, 0.5);

  // Body (armored tunic)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.25),
    armorMat,
  );
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    mat,
  );
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  // Helmet
  const helmetMat = makeMat(0x778899, 0.5);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    helmetMat,
  );
  helmet.position.y = 0.98;
  helmet.scale.set(1, 0.7, 1);
  helmet.castShadow = true;
  group.add(helmet);

  // Shield (left side)
  const shieldMat = makeMat(0x4466aa, 0.5);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.35, 0.25),
    shieldMat,
  );
  shield.position.set(-0.28, 0.55, 0);
  shield.castShadow = true;
  group.add(shield);

  // Sword (right side)
  const swordBlade = makeMat(0xcccccc, 0.6);
  const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.5, 0.04),
    swordBlade,
  );
  sword.position.set(0.3, 0.6, 0);
  sword.castShadow = true;
  group.add(sword);

  // Sword guard
  const guardMat = makeMat(0x8b6914, 0.5);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.04, 0.04),
    guardMat,
  );
  guard.position.set(0.3, 0.38, 0);
  group.add(guard);

  // Arms
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.4, 0.12),
    mat,
  );
  leftArm.position.set(-0.3, 0.55, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.4, 0.12),
    mat,
  );
  rightArm.position.set(0.3, 0.55, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.35, 0.14),
    mat,
  );
  leftLeg.position.set(-0.12, 0.175, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.35, 0.14),
    mat,
  );
  rightLeg.position.set(0.12, 0.175, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
}

function createArcher(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.5);

  // Body (lighter leather)
  const leatherMat = makeMat(0x5a8a4a, 0.5);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.45, 0.22),
    leatherMat,
  );
  body.position.y = 0.525;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    mat,
  );
  head.position.y = 0.9;
  head.castShadow = true;
  group.add(head);

  // Hood
  const hoodMat = makeMat(0x3a6a2a, 0.5);
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    hoodMat,
  );
  hood.position.set(0, 0.92, 0.02);
  hood.scale.set(1, 0.8, 1.1);
  hood.castShadow = true;
  group.add(hood);

  // Bow (left side)
  const bowMat = makeMat(0x8b6914, 0.5);
  const bowBody = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.02, 6, 12, Math.PI),
    bowMat,
  );
  bowBody.position.set(-0.28, 0.55, 0);
  bowBody.rotation.z = Math.PI / 2;
  bowBody.castShadow = true;
  group.add(bowBody);

  // Bowstring
  const stringMat = makeMat(0xdddddd, 0.4);
  const bowString = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.5, 0.01),
    stringMat,
  );
  bowString.position.set(-0.28, 0.55, 0);
  group.add(bowString);

  // Quiver (on back)
  const quiverMat = makeMat(0x6a4a2a, 0.5);
  const quiver = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.35, 6),
    quiverMat,
  );
  quiver.position.set(0.05, 0.65, 0.15);
  quiver.rotation.x = 0.15;
  quiver.castShadow = true;
  group.add(quiver);

  // Arrow tips sticking out
  const arrowMat = makeMat(0xcccccc, 0.5);
  for (let i = -1; i <= 1; i++) {
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.08, 4),
      arrowMat,
    );
    tip.position.set(0.05 + i * 0.03, 0.86, 0.15);
    group.add(tip);
  }

  // Arms
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.38, 0.1),
    mat,
  );
  leftArm.position.set(-0.26, 0.52, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.38, 0.1),
    mat,
  );
  rightArm.position.set(0.26, 0.52, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.35, 0.12),
    mat,
  );
  leftLeg.position.set(-0.1, 0.175, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.35, 0.12),
    mat,
  );
  rightLeg.position.set(0.1, 0.175, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
}

function createMage(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.6);

  // Robe body
  const robeMat = makeMat(0x6633aa, 0.6);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 0.7, 8),
    robeMat,
  );
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    mat,
  );
  head.position.y = 0.95;
  head.castShadow = true;
  group.add(head);

  // Wizard hat
  const hatMat = makeMat(0x5522aa, 0.6);
  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.03, 8),
    hatMat,
  );
  hatBrim.position.y = 1.05;
  hatBrim.castShadow = true;
  group.add(hatBrim);

  const hatCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 8),
    hatMat,
  );
  hatCone.position.y = 1.22;
  hatCone.castShadow = true;
  group.add(hatCone);

  // Staff (right side)
  const staffMat = makeMat(0x8b6914, 0.5);
  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6),
    staffMat,
  );
  staff.position.set(0.25, 0.55, 0);
  staff.castShadow = true;
  group.add(staff);

  // Staff orb
  const orbMat = makeMat(0xaa66ff, 0.9);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    orbMat,
  );
  orb.position.set(0.25, 1.1, 0);
  group.add(orb);

  // Arms (hidden inside robe sleeves)
  const sleeveMat = makeMat(0x5522aa, 0.5);
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.3, 0.12),
    sleeveMat,
  );
  leftArm.position.set(-0.22, 0.55, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.3, 0.12),
    sleeveMat,
  );
  rightArm.position.set(0.22, 0.55, 0);
  rightArm.castShadow = true;
  group.add(rightArm);
}

function createKnight(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.5);
  const armorMat = makeMat(0xbbaa55, 0.6);

  // Heavy armored body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.3),
    armorMat,
  );
  body.position.y = 0.575;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    mat,
  );
  head.position.y = 1.0;
  head.castShadow = true;
  group.add(head);

  // Full helm
  const helmMat = makeMat(0xccaa44, 0.6);
  const helm = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.28),
    helmMat,
  );
  helm.position.y = 1.02;
  helm.castShadow = true;
  group.add(helm);

  // Helm visor slit
  const visorMat = makeMat(0x222222, 0.3);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.04, 0.02),
    visorMat,
  );
  visor.position.set(0, 1.0, -0.15);
  group.add(visor);

  // Plume on top
  const plumeMat = makeMat(0xcc3333, 0.6);
  const plume = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.2, 0.2),
    plumeMat,
  );
  plume.position.set(0, 1.22, 0);
  plume.castShadow = true;
  group.add(plume);

  // Lance (right side)
  const lanceMat = makeMat(0xcccccc, 0.5);
  const lance = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.015, 1.2, 6),
    lanceMat,
  );
  lance.position.set(0.35, 0.8, 0);
  lance.castShadow = true;
  group.add(lance);

  // Shield (left side)
  const shieldMat = makeMat(0xccaa44, 0.5);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 0.3),
    shieldMat,
  );
  shield.position.set(-0.32, 0.55, 0);
  shield.castShadow = true;
  group.add(shield);

  // Shield emblem
  const emblemMat = makeMat(0xffd700, 0.7);
  const emblem = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.12, 0.12),
    emblemMat,
  );
  emblem.position.set(-0.35, 0.55, 0);
  group.add(emblem);

  // Pauldrons
  for (let i = -1; i <= 1; i += 2) {
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      armorMat,
    );
    pauldron.position.set(i * 0.3, 0.85, 0);
    pauldron.scale.set(1.2, 0.6, 1.0);
    pauldron.castShadow = true;
    group.add(pauldron);
  }

  // Arms
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.42, 0.14),
    mat,
  );
  leftArm.position.set(-0.34, 0.55, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.42, 0.14),
    mat,
  );
  rightArm.position.set(0.34, 0.55, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.35, 0.16),
    armorMat,
  );
  leftLeg.position.set(-0.13, 0.175, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.35, 0.16),
    armorMat,
  );
  rightLeg.position.set(0.13, 0.175, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
}

function createCommander(group: THREE.Group, color: number): void {
  const mat = makeMat(color, 0.7);
  const armorMat = makeMat(0xaa3333, 0.7);

  // Larger armored body
  const s = 1.3;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 * s, 0.6 * s, 0.35 * s),
    armorMat,
  );
  body.position.y = 0.6 * s;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * s, 8, 8),
    mat,
  );
  head.position.y = 1.1 * s;
  head.castShadow = true;
  group.add(head);

  // Crown
  const crownMat = makeMat(0xffd700, 1.0);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 0.1 * s, 6),
    crownMat,
  );
  crown.position.y = 1.28 * s;
  crown.castShadow = true;
  group.add(crown);

  // Cape
  const capeMat = makeMat(0xcc2222, 0.7);
  capeMat.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5 * s, 0.7 * s),
    capeMat,
  );
  cape.position.set(0, 0.55 * s, 0.2 * s);
  cape.castShadow = true;
  group.add(cape);

  // Great sword
  const swordMat = makeMat(0xdddddd, 0.8);
  const greatSword = new THREE.Mesh(
    new THREE.BoxGeometry(0.06 * s, 0.8 * s, 0.06 * s),
    swordMat,
  );
  greatSword.position.set(0.38 * s, 0.6 * s, 0);
  greatSword.castShadow = true;
  group.add(greatSword);

  // Sword guard
  const guardMat = makeMat(0xffd700, 0.6);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * s, 0.04 * s, 0.06 * s),
    guardMat,
  );
  guard.position.set(0.38 * s, 0.24 * s, 0);
  group.add(guard);

  // Pauldrons
  for (let i = -1; i <= 1; i += 2) {
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 * s, 6, 6),
      armorMat,
    );
    pauldron.position.set(i * 0.3 * s, 0.9 * s, 0);
    pauldron.scale.set(1.3, 0.6, 1.0);
    pauldron.castShadow = true;
    group.add(pauldron);
  }

  // Arms
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.45 * s, 0.14 * s),
    mat,
  );
  leftArm.position.set(-0.35 * s, 0.55 * s, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * s, 0.45 * s, 0.14 * s),
    mat,
  );
  rightArm.position.set(0.35 * s, 0.55 * s, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * s, 0.4 * s, 0.16 * s),
    armorMat,
  );
  leftLeg.position.set(-0.14 * s, 0.2 * s, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * s, 0.4 * s, 0.16 * s),
    armorMat,
  );
  rightLeg.position.set(0.14 * s, 0.2 * s, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
}

/* ================================================================== */
/*  Factory dispatch                                                  */
/* ================================================================== */

function createArmyUnitMesh(type: string, color: number): THREE.Group {
  const group = new THREE.Group();

  switch (type) {
    case 'swordsman':
      createSwordsman(group, color);
      break;
    case 'army_archer':
      createArcher(group, color);
      break;
    case 'mage':
      createMage(group, color);
      break;
    case 'knight':
      createKnight(group, color);
      break;
    case 'commander':
      createCommander(group, color);
      break;
    default:
      // Fallback: simple humanoid with the unit color
      createSwordsman(group, color);
      break;
  }

  return group;
}

/* ================================================================== */
/*  ArmyUnitRenderer                                                  */
/* ================================================================== */

export class ArmyUnitRenderer {
  /** Cached thumbnail data-URLs keyed by army unit type. */
  private static thumbnailCache: Map<string, string> = new Map();

  /**
   * Render a small 48x48 thumbnail of the given army unit type's procedural
   * model. Uses a temporary offscreen WebGLRenderer, scene and camera.
   * Results are cached so each type is only rendered once.
   */
  static generateThumbnail(def: ArmyUnitDef): string | null {
    const cached = ArmyUnitRenderer.thumbnailCache.get(def.type);
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

      // Create the procedural model
      const model = createArmyUnitMesh(def.type, def.color);
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
      model.traverse((child) => {
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

      ArmyUnitRenderer.thumbnailCache.set(def.type, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[ArmyUnitRenderer] Thumbnail generation failed for', def.type, err);
      return null;
    }
  }
}
