import * as THREE from 'three';
import { GRID, COLORS, CASTLE_ORIGIN } from '../config/clientConfig';
import { CastleSnapshot } from '../socket/StateSync';

// ── Emissive colors for HP states ──
const EMISSIVE_HEALTHY = new THREE.Color(0x6b5540);
const EMISSIVE_DAMAGED = new THREE.Color(0x7a4a30);
const EMISSIVE_CRITICAL = new THREE.Color(0x8b2a1a);

// ── Dimension constants ──
const KEEP_WIDTH = 1.6;
const KEEP_DEPTH = 1.6;
const KEEP_HEIGHT = 3.5;

const TOWER_RADIUS = 0.45;
const TOWER_HEIGHT = 4.5;
const TOWER_ROOF_HEIGHT = 1.0;

const WALL_HEIGHT = 2.0;
const WALL_THICKNESS = 0.25;

const MERLON_WIDTH = 0.2;
const MERLON_HEIGHT = 0.35;
const MERLON_DEPTH = 0.28;

const GATE_WIDTH = 0.9;
const GATE_HEIGHT = 1.6;

const MOAT_INNER = 2.2;
const MOAT_OUTER = 2.8;

const FLAG_POLE_HEIGHT = 1.4;
const FLAG_WIDTH = 0.6;
const FLAG_HEIGHT = 0.35;

/**
 * Procedural medieval castle rendered at the map center (4x4 tiles).
 * Bright emissive materials ensure visibility against the dark scene.
 * HP-based damage states change color, add cracks, and fire effects.
 */
export class CastleRenderer {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private hpRatio = 1;

  // References for damage state changes
  private stoneMaterials: THREE.MeshStandardMaterial[] = [];
  private roofMaterials: THREE.MeshStandardMaterial[] = [];
  private crackMeshes: THREE.Mesh[] = [];
  private fireLights: THREE.PointLight[] = [];
  private torchLights: THREE.PointLight[] = [];

  // Flag animation
  private flagMesh: THREE.Mesh | null = null;
  private flagPivot: THREE.Group | null = null;
  private flagTime = 0;

  // Fire flicker
  private fireTime = 0;

  // King model
  private kingGroup: THREE.Group | null = null;

  // Lightning bolts (temporary visual effects)
  private lightningBolts: { mesh: THREE.Group; life: number }[] = [];

  // Extra castle groups for multiplayer
  private extraCastles: Map<string, THREE.Group> = new Map();
  private knownCastleIds: Set<string> = new Set();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'castle';

    this.buildCastle();

    // Position at castle zone center
    const cx = CASTLE_ORIGIN.x + GRID.castleSize / 2;
    const cz = CASTLE_ORIGIN.y + GRID.castleSize / 2;
    this.group.position.set(cx, 0, cz);

    scene.add(this.group);
  }

  // ────────────────────────── Build ──────────────────────────

  private buildCastle(): void {
    this.buildMoat();
    this.buildKeep();
    this.buildCornerTowers();
    this.buildCurtainWalls();
    this.buildGate();
    this.buildFlagPole();
    this.buildCracks();
    this.buildFireLights();
    this.buildKing();
  }

  // ── Materials ──

  private makeStoneMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.castleStone,
      emissive: EMISSIVE_HEALTHY,
      emissiveIntensity: 0.6,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.stoneMaterials.push(mat);
    return mat;
  }

  private makeRoofMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.castleRoof,
      emissive: new THREE.Color(0x3a2010),
      emissiveIntensity: 0.4,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.roofMaterials.push(mat);
    return mat;
  }

  private makeDarkMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      roughness: 1.0,
      metalness: 0.0,
    });
  }

  // ── Moat ──

  private buildMoat(): void {
    const shape = new THREE.Shape();
    shape.moveTo(-MOAT_OUTER, -MOAT_OUTER);
    shape.lineTo(MOAT_OUTER, -MOAT_OUTER);
    shape.lineTo(MOAT_OUTER, MOAT_OUTER);
    shape.lineTo(-MOAT_OUTER, MOAT_OUTER);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-MOAT_INNER, -MOAT_INNER);
    hole.lineTo(MOAT_INNER, -MOAT_INNER);
    hole.lineTo(MOAT_INNER, MOAT_INNER);
    hole.lineTo(-MOAT_INNER, MOAT_INNER);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5a,
      emissive: new THREE.Color(0x0a2040),
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.group.add(mesh);
  }

  // ── Keep (main building) ──

  private buildKeep(): void {
    const stoneMat = this.makeStoneMaterial();

    // Main body
    const keepGeo = new THREE.BoxGeometry(KEEP_WIDTH, KEEP_HEIGHT, KEEP_DEPTH);
    const keep = new THREE.Mesh(keepGeo, stoneMat);
    keep.position.y = KEEP_HEIGHT / 2;
    keep.castShadow = true;
    keep.receiveShadow = true;
    this.group.add(keep);

    // Flat roof cap
    const roofMat = this.makeRoofMaterial();
    const roofGeo = new THREE.BoxGeometry(KEEP_WIDTH + 0.1, 0.1, KEEP_DEPTH + 0.1);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = KEEP_HEIGHT + 0.05;
    roof.castShadow = true;
    this.group.add(roof);

    // Window recesses on each side
    this.addWindowRecesses();
  }

  private addWindowRecesses(): void {
    const darkMat = this.makeDarkMaterial();
    const windowGeo = new THREE.BoxGeometry(0.18, 0.35, 0.08);

    const sides: { pos: THREE.Vector3; rot: number }[] = [
      // North face
      { pos: new THREE.Vector3(-0.35, KEEP_HEIGHT * 0.7, KEEP_DEPTH / 2 + 0.01), rot: 0 },
      { pos: new THREE.Vector3(0.35, KEEP_HEIGHT * 0.7, KEEP_DEPTH / 2 + 0.01), rot: 0 },
      // South face
      { pos: new THREE.Vector3(-0.35, KEEP_HEIGHT * 0.7, -KEEP_DEPTH / 2 - 0.01), rot: 0 },
      { pos: new THREE.Vector3(0.35, KEEP_HEIGHT * 0.7, -KEEP_DEPTH / 2 - 0.01), rot: 0 },
      // East face
      { pos: new THREE.Vector3(KEEP_WIDTH / 2 + 0.01, KEEP_HEIGHT * 0.7, -0.35), rot: Math.PI / 2 },
      { pos: new THREE.Vector3(KEEP_WIDTH / 2 + 0.01, KEEP_HEIGHT * 0.7, 0.35), rot: Math.PI / 2 },
      // West face
      { pos: new THREE.Vector3(-KEEP_WIDTH / 2 - 0.01, KEEP_HEIGHT * 0.7, -0.35), rot: Math.PI / 2 },
      { pos: new THREE.Vector3(-KEEP_WIDTH / 2 - 0.01, KEEP_HEIGHT * 0.7, 0.35), rot: Math.PI / 2 },
    ];

    for (const side of sides) {
      const win = new THREE.Mesh(windowGeo, darkMat);
      win.position.copy(side.pos);
      win.rotation.y = side.rot;
      this.group.add(win);
    }
  }

  // ── Corner Towers ──

  private buildCornerTowers(): void {
    const halfSpan = MOAT_INNER * 0.72; // Place towers inside the moat ring
    const positions = [
      new THREE.Vector3(-halfSpan, 0, -halfSpan),
      new THREE.Vector3(halfSpan, 0, -halfSpan),
      new THREE.Vector3(-halfSpan, 0, halfSpan),
      new THREE.Vector3(halfSpan, 0, halfSpan),
    ];

    for (const pos of positions) {
      this.buildSingleTower(pos);
    }
  }

  private buildSingleTower(base: THREE.Vector3): void {
    const stoneMat = this.makeStoneMaterial();
    const roofMat = this.makeRoofMaterial();

    // Cylindrical tower body
    const bodyGeo = new THREE.CylinderGeometry(
      TOWER_RADIUS,
      TOWER_RADIUS + 0.05,
      TOWER_HEIGHT,
      12,
    );
    const body = new THREE.Mesh(bodyGeo, stoneMat);
    body.position.set(base.x, TOWER_HEIGHT / 2, base.z);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Conical roof
    const roofGeo = new THREE.ConeGeometry(TOWER_RADIUS + 0.12, TOWER_ROOF_HEIGHT, 12);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(base.x, TOWER_HEIGHT + TOWER_ROOF_HEIGHT / 2, base.z);
    roof.castShadow = true;
    this.group.add(roof);

    // Tower top ring (battlement lip)
    const ringGeo = new THREE.TorusGeometry(TOWER_RADIUS + 0.06, 0.04, 6, 12);
    const ring = new THREE.Mesh(ringGeo, stoneMat);
    ring.position.set(base.x, TOWER_HEIGHT, base.z);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    // Torch point light at tower top
    const torchLight = new THREE.PointLight(0xff6622, 1.5, 6);
    torchLight.position.set(base.x, TOWER_HEIGHT + 0.3, base.z);
    torchLight.castShadow = false;
    this.torchLights.push(torchLight);
    this.group.add(torchLight);

    // Small torch flame visual (tiny emissive sphere)
    const flameGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: new THREE.Color(0xff6622),
      emissiveIntensity: 2.0,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(base.x, TOWER_HEIGHT + 0.3, base.z);
    this.group.add(flame);
  }

  // ── Curtain Walls ──

  private buildCurtainWalls(): void {
    const halfSpan = MOAT_INNER * 0.72;
    const stoneMat = this.makeStoneMaterial();

    // Wall segments connecting adjacent towers (4 sides)
    const walls: { from: THREE.Vector2; to: THREE.Vector2 }[] = [
      // North
      { from: new THREE.Vector2(-halfSpan, -halfSpan), to: new THREE.Vector2(halfSpan, -halfSpan) },
      // South
      { from: new THREE.Vector2(-halfSpan, halfSpan), to: new THREE.Vector2(halfSpan, halfSpan) },
      // East
      { from: new THREE.Vector2(halfSpan, -halfSpan), to: new THREE.Vector2(halfSpan, halfSpan) },
      // West
      { from: new THREE.Vector2(-halfSpan, -halfSpan), to: new THREE.Vector2(-halfSpan, halfSpan) },
    ];

    for (const wall of walls) {
      const dx = wall.to.x - wall.from.x;
      const dz = wall.to.y - wall.from.y;
      const length = Math.sqrt(dx * dx + dz * dz);
      const cx = (wall.from.x + wall.to.x) / 2;
      const cz = (wall.from.y + wall.to.y) / 2;
      const angle = Math.atan2(dx, dz);

      // Wall body (shorter than towers, goes between them)
      const innerLength = length - TOWER_RADIUS * 2;
      if (innerLength <= 0) continue;

      const wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, innerLength);
      const wallMesh = new THREE.Mesh(wallGeo, stoneMat);
      wallMesh.position.set(cx, WALL_HEIGHT / 2, cz);
      wallMesh.rotation.y = angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.group.add(wallMesh);

      // Merlons (crenellations) on top
      const merlonCount = Math.floor(innerLength / (MERLON_WIDTH * 2.5));
      const merlonGeo = new THREE.BoxGeometry(MERLON_DEPTH, MERLON_HEIGHT, MERLON_WIDTH);

      for (let i = 0; i < merlonCount; i++) {
        const t = (i + 0.5) / merlonCount - 0.5;
        const offset = t * innerLength;

        const merlon = new THREE.Mesh(merlonGeo, stoneMat);

        // Position along wall direction
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        merlon.position.set(
          cx + offset * sinA,
          WALL_HEIGHT + MERLON_HEIGHT / 2,
          cz + offset * cosA,
        );
        merlon.rotation.y = angle;
        merlon.castShadow = true;
        this.group.add(merlon);
      }
    }
  }

  // ── Grand Entrance Gate (south side) ──

  private buildGate(): void {
    const halfSpan = MOAT_INNER * 0.72;
    const darkMat = this.makeDarkMaterial();
    const stoneMat = this.makeStoneMaterial();

    // Dark opening (portcullis)
    const openingGeo = new THREE.BoxGeometry(GATE_WIDTH, GATE_HEIGHT, WALL_THICKNESS + 0.1);
    const opening = new THREE.Mesh(openingGeo, darkMat);
    opening.position.set(0, GATE_HEIGHT / 2, halfSpan);
    this.group.add(opening);

    // Arch above gate (half-torus)
    const archGeo = new THREE.TorusGeometry(GATE_WIDTH / 2, 0.06, 8, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, stoneMat);
    arch.position.set(0, GATE_HEIGHT, halfSpan);
    arch.rotation.x = Math.PI;
    arch.rotation.z = Math.PI;
    this.group.add(arch);

    // Gate pillars on each side
    const pillarGeo = new THREE.BoxGeometry(0.18, GATE_HEIGHT + 0.3, 0.3);
    const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
    leftPillar.position.set(-GATE_WIDTH / 2 - 0.09, (GATE_HEIGHT + 0.3) / 2, halfSpan);
    leftPillar.castShadow = true;
    this.group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
    rightPillar.position.set(GATE_WIDTH / 2 + 0.09, (GATE_HEIGHT + 0.3) / 2, halfSpan);
    rightPillar.castShadow = true;
    this.group.add(rightPillar);

    // Portcullis bars (vertical lines across the opening)
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      emissive: new THREE.Color(0x1a1a1a),
      emissiveIntensity: 0.3,
      metalness: 0.6,
      roughness: 0.4,
    });
    const barGeo = new THREE.CylinderGeometry(0.015, 0.015, GATE_HEIGHT - 0.1, 4);
    const barCount = 5;
    for (let i = 0; i < barCount; i++) {
      const t = (i + 1) / (barCount + 1);
      const x = -GATE_WIDTH / 2 + t * GATE_WIDTH;
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(x, GATE_HEIGHT / 2, halfSpan);
      this.group.add(bar);
    }

    // Horizontal bar across portcullis
    const hBarGeo = new THREE.CylinderGeometry(0.012, 0.012, GATE_WIDTH - 0.05, 4);
    const hBar1 = new THREE.Mesh(hBarGeo, barMat);
    hBar1.rotation.z = Math.PI / 2;
    hBar1.position.set(0, GATE_HEIGHT * 0.35, halfSpan);
    this.group.add(hBar1);

    const hBar2 = new THREE.Mesh(hBarGeo, barMat);
    hBar2.rotation.z = Math.PI / 2;
    hBar2.position.set(0, GATE_HEIGHT * 0.65, halfSpan);
    this.group.add(hBar2);
  }

  // ── Flag Pole & Banner ──

  private buildFlagPole(): void {
    // Pole
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      emissive: new THREE.Color(0x444444),
      emissiveIntensity: 0.3,
      metalness: 0.7,
      roughness: 0.3,
    });
    const poleGeo = new THREE.CylinderGeometry(0.025, 0.03, FLAG_POLE_HEIGHT, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = KEEP_HEIGHT + FLAG_POLE_HEIGHT / 2;
    this.group.add(pole);

    // Flag pivot (for sway animation)
    this.flagPivot = new THREE.Group();
    this.flagPivot.position.set(0, KEEP_HEIGHT + FLAG_POLE_HEIGHT * 0.85, 0);
    this.group.add(this.flagPivot);

    // Banner
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xcc1111,
      emissive: new THREE.Color(0x881111),
      emissiveIntensity: 0.7,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const bannerGeo = new THREE.BoxGeometry(FLAG_WIDTH, FLAG_HEIGHT, 0.02);
    this.flagMesh = new THREE.Mesh(bannerGeo, bannerMat);
    this.flagMesh.position.set(FLAG_WIDTH / 2 + 0.03, 0, 0);
    this.flagPivot.add(this.flagMesh);

    // Small gold tip on top of pole
    const tipGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xd4a857,
      emissive: new THREE.Color(0x907030),
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = KEEP_HEIGHT + FLAG_POLE_HEIGHT + 0.02;
    this.group.add(tip);
  }

  // ── King Figure on Keep Roof ──

  private buildKing(): void {
    this.kingGroup = new THREE.Group();
    this.kingGroup.position.set(0, KEEP_HEIGHT + 0.1, 0);

    // Body (royal robe)
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x6622aa,
      emissive: new THREE.Color(0x4411aa),
      emissiveIntensity: 0.6,
      roughness: 0.7,
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 0.4, 8),
      robeMat,
    );
    body.position.y = 0.25;
    body.castShadow = true;
    this.kingGroup.add(body);

    // Head
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xeebb88,
      emissive: new THREE.Color(0xaa8855),
      emissiveIntensity: 0.4,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      skinMat,
    );
    head.position.y = 0.52;
    head.castShadow = true;
    this.kingGroup.add(head);

    // Crown
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: new THREE.Color(0xddaa00),
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.6,
    });
    const crownBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.06, 6),
      crownMat,
    );
    crownBase.position.y = 0.59;
    this.kingGroup.add(crownBase);

    // Crown points
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const point = new THREE.Mesh(
        new THREE.ConeGeometry(0.015, 0.05, 4),
        crownMat,
      );
      point.position.set(
        Math.cos(angle) * 0.06,
        0.645,
        Math.sin(angle) * 0.06,
      );
      this.kingGroup.add(point);
    }

    // Staff (lightning rod)
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      emissive: new THREE.Color(0x444488),
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
      staffMat,
    );
    staff.position.set(0.12, 0.35, 0);
    staff.castShadow = true;
    this.kingGroup.add(staff);

    // Staff orb (lightning energy)
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x6666ff,
      emissive: new THREE.Color(0x4444ff),
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      orbMat,
    );
    orb.position.set(0.12, 0.68, 0);
    this.kingGroup.add(orb);

    // King glow light
    const kingLight = new THREE.PointLight(0x6666ff, 0.5, 3);
    kingLight.position.set(0.12, 0.68, 0);
    this.kingGroup.add(kingLight);

    this.group.add(this.kingGroup);
  }

  /**
   * Fire a lightning bolt visual from the king to a target position.
   * The bolt is a jagged line that fades out over 0.4 seconds.
   */
  fireLightning(targetX: number, targetY: number, targetZ: number): void {
    const boltGroup = new THREE.Group();

    // King staff orb world position
    const startX = this.group.position.x + 0.12;
    const startY = KEEP_HEIGHT + 0.1 + 0.68;
    const startZ = this.group.position.z;

    // Create jagged lightning segments
    const segments = 8;
    const points: THREE.Vector3[] = [new THREE.Vector3(startX, startY, startZ)];

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dz = targetZ - startZ;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitterX = (Math.random() - 0.5) * 0.6;
      const jitterY = (Math.random() - 0.5) * 0.4;
      const jitterZ = (Math.random() - 0.5) * 0.6;
      points.push(new THREE.Vector3(
        startX + dx * t + jitterX,
        startY + dy * t + jitterY,
        startZ + dz * t + jitterZ,
      ));
    }
    points.push(new THREE.Vector3(targetX, targetY, targetZ));

    // Main bolt
    const boltMat = new THREE.LineBasicMaterial({
      color: 0x88aaff,
      linewidth: 2,
      transparent: true,
      opacity: 1.0,
    });
    const boltGeo = new THREE.BufferGeometry().setFromPoints(points);
    const bolt = new THREE.Line(boltGeo, boltMat);
    boltGroup.add(bolt);

    // Glow bolt (wider, more transparent)
    const glowMat = new THREE.LineBasicMaterial({
      color: 0xccddff,
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
    });
    // Offset points slightly for glow
    const glowPoints = points.map(p => new THREE.Vector3(
      p.x + (Math.random() - 0.5) * 0.15,
      p.y + (Math.random() - 0.5) * 0.1,
      p.z + (Math.random() - 0.5) * 0.15,
    ));
    const glowGeo = new THREE.BufferGeometry().setFromPoints(glowPoints);
    const glow = new THREE.Line(glowGeo, glowMat);
    boltGroup.add(glow);

    // Impact flash at target
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xaabbff,
      emissive: new THREE.Color(0x8899ff),
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
    });
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      flashMat,
    );
    flash.position.set(targetX, targetY, targetZ);
    boltGroup.add(flash);

    // Impact light
    const impactLight = new THREE.PointLight(0x8888ff, 2.0, 5);
    impactLight.position.set(targetX, targetY, targetZ);
    boltGroup.add(impactLight);

    this.scene.add(boltGroup);
    this.lightningBolts.push({ mesh: boltGroup, life: 0.4 });
  }

  // ── Damage Crack Meshes (hidden initially) ──

  private buildCracks(): void {
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1008,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      roughness: 1.0,
    });

    // Cracks on the keep surfaces
    const crackPositions: THREE.Vector3[] = [
      // North face cracks
      new THREE.Vector3(0.2, KEEP_HEIGHT * 0.4, KEEP_DEPTH / 2 + 0.015),
      new THREE.Vector3(-0.4, KEEP_HEIGHT * 0.55, KEEP_DEPTH / 2 + 0.015),
      // South face
      new THREE.Vector3(0.3, KEEP_HEIGHT * 0.35, -KEEP_DEPTH / 2 - 0.015),
      new THREE.Vector3(-0.2, KEEP_HEIGHT * 0.6, -KEEP_DEPTH / 2 - 0.015),
      // East face
      new THREE.Vector3(KEEP_WIDTH / 2 + 0.015, KEEP_HEIGHT * 0.45, 0.3),
      new THREE.Vector3(KEEP_WIDTH / 2 + 0.015, KEEP_HEIGHT * 0.3, -0.2),
      // West face
      new THREE.Vector3(-KEEP_WIDTH / 2 - 0.015, KEEP_HEIGHT * 0.5, -0.3),
      new THREE.Vector3(-KEEP_WIDTH / 2 - 0.015, KEEP_HEIGHT * 0.25, 0.15),
    ];

    for (let i = 0; i < crackPositions.length; i++) {
      // Varied crack sizes
      const w = 0.08 + Math.random() * 0.12;
      const h = 0.15 + Math.random() * 0.25;
      const crackGeo = new THREE.BoxGeometry(w, h, 0.03);
      const crack = new THREE.Mesh(crackGeo, darkMat);
      crack.position.copy(crackPositions[i]);
      crack.visible = false;
      this.crackMeshes.push(crack);
      this.group.add(crack);
    }
  }

  // ── Fire Effect Lights (hidden initially) ──

  private buildFireLights(): void {
    const firePositions: THREE.Vector3[] = [
      new THREE.Vector3(0.5, KEEP_HEIGHT * 0.3, 0.5),
      new THREE.Vector3(-0.5, KEEP_HEIGHT * 0.4, -0.5),
      new THREE.Vector3(0.6, KEEP_HEIGHT * 0.2, -0.3),
      new THREE.Vector3(-0.4, KEEP_HEIGHT * 0.5, 0.4),
    ];

    for (const pos of firePositions) {
      const light = new THREE.PointLight(0xff4400, 0, 4);
      light.position.copy(pos);
      this.fireLights.push(light);
      this.group.add(light);
    }
  }

  // ────────────────────────── Update ──────────────────────────

  /**
   * Call every frame with the delta time for flag sway and fire flicker.
   */
  update(dt: number): void {
    // Flag sway
    this.flagTime += dt;
    if (this.flagPivot) {
      this.flagPivot.rotation.y = Math.sin(this.flagTime * 1.5) * 0.15;
      this.flagPivot.rotation.z = Math.sin(this.flagTime * 2.2) * 0.05;
    }

    // Torch flicker (subtle intensity variation)
    for (const torch of this.torchLights) {
      torch.intensity = 1.5 + Math.sin(this.flagTime * 8 + torch.position.x * 10) * 0.3;
    }

    // Fire effect when critical
    if (this.hpRatio < 0.3) {
      this.fireTime += dt;
      for (let i = 0; i < this.fireLights.length; i++) {
        const light = this.fireLights[i];
        light.intensity = 1.0 + Math.sin(this.fireTime * 10 + i * 2.5) * 0.8
          + Math.sin(this.fireTime * 17 + i * 1.3) * 0.4;
      }
    }

    // King idle sway
    if (this.kingGroup) {
      this.kingGroup.rotation.y = Math.sin(this.flagTime * 0.8) * 0.1;
    }

    // Lightning bolt lifecycle
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life -= dt;
      if (bolt.life <= 0) {
        this.scene.remove(bolt.mesh);
        bolt.mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              (m.material as THREE.Material).dispose();
            }
          }
          if ((child as THREE.Line).isLine) {
            const l = child as THREE.Line;
            l.geometry.dispose();
            (l.material as THREE.Material).dispose();
          }
        });
        this.lightningBolts.splice(i, 1);
      } else {
        // Fade out
        const alpha = bolt.life / 0.4;
        bolt.mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat.transparent) mat.opacity = alpha * 0.8;
          }
          if ((child as THREE.Line).isLine) {
            const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
            mat.opacity = alpha;
          }
          if ((child as THREE.PointLight).isLight) {
            (child as THREE.PointLight).intensity = alpha * 2.0;
          }
        });
      }
    }
  }

  // ────────────────────────── HP ──────────────────────────

  updateHp(hp: number, maxHp: number): void {
    const prevRatio = this.hpRatio;
    this.hpRatio = maxHp > 0 ? hp / maxHp : 0;

    // Avoid redundant updates if still in the same bracket
    const prevBracket = prevRatio > 0.6 ? 2 : prevRatio > 0.3 ? 1 : 0;
    const newBracket = this.hpRatio > 0.6 ? 2 : this.hpRatio > 0.3 ? 1 : 0;
    if (prevBracket === newBracket && prevRatio !== 1) return;

    if (this.hpRatio > 0.6) {
      // Healthy: warm stone glow
      this.setStoneEmissive(EMISSIVE_HEALTHY, 0.6);
      this.setCracksVisible(false);
      this.setFireActive(false);
    } else if (this.hpRatio > 0.3) {
      // Damaged: orange tint, some cracks
      this.setStoneEmissive(EMISSIVE_DAMAGED, 0.8);
      this.setCracksVisible(true, 4); // show first 4 cracks
      this.setFireActive(false);
    } else {
      // Critical: red glow, all cracks, fire
      this.setStoneEmissive(EMISSIVE_CRITICAL, 1.0);
      this.setCracksVisible(true, this.crackMeshes.length);
      this.setFireActive(true);
    }
  }

  private setStoneEmissive(color: THREE.Color, intensity: number): void {
    for (const mat of this.stoneMaterials) {
      mat.emissive.copy(color);
      mat.emissiveIntensity = intensity;
      mat.needsUpdate = true;
    }
  }

  private setCracksVisible(visible: boolean, count = 0): void {
    for (let i = 0; i < this.crackMeshes.length; i++) {
      this.crackMeshes[i].visible = visible && i < count;
    }
  }

  private setFireActive(active: boolean): void {
    for (const light of this.fireLights) {
      if (!active) {
        light.intensity = 0;
      }
      // When active, the update() loop handles the flickering intensity
    }
  }

  // ────────────────────────── Public API ──────────────────────────

  getObject3D(): THREE.Group {
    return this.group;
  }

  /**
   * Render additional castles for other players at their positions.
   * The first castle is the default one already rendered.
   */
  updateMultipleCastles(castles: CastleSnapshot[]): void {
    for (const castle of castles) {
      if (this.knownCastleIds.has(castle.playerId)) continue;

      // Skip the first castle (already rendered at default position)
      const defaultCX = CASTLE_ORIGIN.x + GRID.castleSize / 2;
      const defaultCZ = CASTLE_ORIGIN.y + GRID.castleSize / 2;
      const cx = castle.centerX;
      const cy = castle.centerY;
      if (Math.abs(cx - defaultCX) < 1 && Math.abs(cy - defaultCZ) < 1) {
        this.knownCastleIds.add(castle.playerId);
        continue;
      }

      // Create a simplified castle at this position
      const group = new THREE.Group();
      group.name = `castle_${castle.playerId}`;

      const stoneMat = new THREE.MeshStandardMaterial({
        color: COLORS.castleStone,
        emissive: new THREE.Color(0x6b5540),
        emissiveIntensity: 0.6,
        roughness: 0.85,
        metalness: 0.05,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: COLORS.castleRoof,
        emissive: new THREE.Color(0x3a2010),
        emissiveIntensity: 0.4,
        roughness: 0.9,
      });

      // Keep (main building)
      const keepGeo = new THREE.BoxGeometry(1.6, 3.5, 1.6);
      const keep = new THREE.Mesh(keepGeo, stoneMat);
      keep.position.y = 1.75;
      keep.castShadow = true;
      group.add(keep);

      // Roof
      const roofGeo = new THREE.BoxGeometry(1.7, 0.1, 1.7);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 3.55;
      group.add(roof);

      // Corner towers
      const halfSpan = 2.2 * 0.72;
      const towerPositions = [
        [-halfSpan, -halfSpan], [halfSpan, -halfSpan],
        [-halfSpan, halfSpan], [halfSpan, halfSpan],
      ];
      for (const [tx, tz] of towerPositions) {
        const bodyGeo = new THREE.CylinderGeometry(0.45, 0.5, 4.5, 12);
        const body = new THREE.Mesh(bodyGeo, stoneMat);
        body.position.set(tx, 2.25, tz);
        body.castShadow = true;
        group.add(body);

        const coneGeo = new THREE.ConeGeometry(0.57, 1.0, 12);
        const cone = new THREE.Mesh(coneGeo, roofMat);
        cone.position.set(tx, 5.0, tz);
        group.add(cone);
      }

      group.position.set(cx, 0, cy);
      this.scene.add(group);
      this.extraCastles.set(castle.playerId, group);
      this.knownCastleIds.add(castle.playerId);
    }
  }
}
