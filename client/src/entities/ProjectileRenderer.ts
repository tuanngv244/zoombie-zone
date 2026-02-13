import * as THREE from 'three';

type ProjectileType = 'arrow' | 'cannonball' | 'bolt' | 'bomb';

interface TrailMesh {
  mesh: THREE.Mesh;
  lifetime: number;
  maxLifetime: number;
  initialScale: number;
}

interface ActiveProjectile {
  mesh: THREE.Object3D;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  elapsed: number;
  duration: number;
  type: ProjectileType;
  arcHeight: number;
  prevPosition: THREE.Vector3;
  trailTimer: number;
}

// Shared geometries - created once, reused across all projectiles
let sharedGeometries: {
  arrowShaft: THREE.CylinderGeometry;
  arrowTip: THREE.ConeGeometry;
  cannonball: THREE.SphereGeometry;
  fuseSpark: THREE.SphereGeometry;
  boltShaft: THREE.CylinderGeometry;
  boltTip: THREE.ConeGeometry;
  boltFin: THREE.BoxGeometry;
  bomb: THREE.SphereGeometry;
  bombFuse: THREE.CylinderGeometry;
  bombSpark: THREE.SphereGeometry;
  trail: THREE.SphereGeometry;
  smokeTrail: THREE.SphereGeometry;
  shockwaveRing: THREE.TorusGeometry;
  explosionSphere: THREE.SphereGeometry;
} | null = null;

function getSharedGeometries() {
  if (!sharedGeometries) {
    sharedGeometries = {
      arrowShaft: new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4),
      arrowTip: new THREE.ConeGeometry(0.03, 0.1, 4),
      cannonball: new THREE.SphereGeometry(0.1, 8, 6),
      fuseSpark: new THREE.SphereGeometry(0.035, 4, 4),
      boltShaft: new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6),
      boltTip: new THREE.ConeGeometry(0.045, 0.14, 4),
      boltFin: new THREE.BoxGeometry(0.06, 0.002, 0.12),
      bomb: new THREE.SphereGeometry(0.15, 8, 6),
      bombFuse: new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4),
      bombSpark: new THREE.SphereGeometry(0.025, 4, 4),
      trail: new THREE.SphereGeometry(0.02, 4, 3),
      smokeTrail: new THREE.SphereGeometry(0.04, 5, 4),
      shockwaveRing: new THREE.TorusGeometry(0.3, 0.06, 6, 16),
      explosionSphere: new THREE.SphereGeometry(0.5, 10, 8),
    };
  }
  return sharedGeometries;
}

/**
 * Visual projectile animations from buildings to enemies.
 * Supports arrow, cannonball, bolt, and bomb projectile types with
 * realistic trails, rotation, and impact effects.
 */
export class ProjectileRenderer {
  private scene: THREE.Scene;
  private active: ActiveProjectile[] = [];
  private trails: TrailMesh[] = [];
  private impactEffects: TrailMesh[] = [];

  onImpactCallback: ((x: number, y: number, z: number, type: ProjectileType) => void) | null =
    null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  fireProjectile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    type: ProjectileType,
  ): void {
    const mesh = this.createProjectileMesh(type);
    const startPos = new THREE.Vector3(fromX, this.getStartHeight(type), fromY);
    const endPos = new THREE.Vector3(toX, 0.3, toY);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    const dist = startPos.distanceTo(endPos);
    const speed = this.getProjectileSpeed(type);
    const duration = Math.max(dist / speed, 0.15);
    const arcHeight = this.getArcHeight(type, dist);

    this.active.push({
      mesh,
      startPos,
      endPos,
      elapsed: 0,
      duration,
      type,
      arcHeight,
      prevPosition: startPos.clone(),
      trailTimer: 0,
    });
  }

  update(dt: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      p.elapsed += dt;
      const t = Math.min(p.elapsed / p.duration, 1);

      // Store previous position for direction calculation
      p.prevPosition.copy(p.mesh.position);

      // Lerp XZ
      p.mesh.position.x = THREE.MathUtils.lerp(p.startPos.x, p.endPos.x, t);
      p.mesh.position.z = THREE.MathUtils.lerp(p.startPos.z, p.endPos.z, t);

      // Arc Y
      const baseY = THREE.MathUtils.lerp(p.startPos.y, p.endPos.y, t);
      const arc = Math.sin(t * Math.PI) * p.arcHeight;
      p.mesh.position.y = baseY + arc;

      // Type-specific updates
      this.updateProjectileBehavior(p, t, dt);

      // Trail spawning
      p.trailTimer += dt;
      const trailInterval = this.getTrailInterval(p.type);
      if (p.trailTimer >= trailInterval && t < 0.95) {
        p.trailTimer = 0;
        this.spawnTrail(p);
      }

      if (t >= 1) {
        toRemove.push(i);
        this.handleImpact(p);
      }
    }

    // Remove completed projectiles (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const p = this.active[idx];
      this.scene.remove(p.mesh);
      this.disposeMesh(p.mesh);
      this.active.splice(idx, 1);
    }

    // Update trails
    this.updateTrails(dt);

    // Update impact effects
    this.updateImpactEffects(dt);
  }

  // ── Projectile speed and arc configuration ──

  private getProjectileSpeed(type: ProjectileType): number {
    switch (type) {
      case 'arrow':
        return 20;
      case 'cannonball':
        return 12;
      case 'bolt':
        return 18;
      case 'bomb':
        return 8;
    }
  }

  private getArcHeight(type: ProjectileType, dist: number): number {
    switch (type) {
      case 'arrow':
        return dist * 0.1;
      case 'cannonball':
        return dist * 0.3;
      case 'bolt':
        return dist * 0.07;
      case 'bomb':
        return dist * 0.55;
    }
  }

  private getStartHeight(type: ProjectileType): number {
    switch (type) {
      case 'arrow':
        return 2.8;
      case 'cannonball':
        return 0.8;
      case 'bolt':
        return 2.2;
      case 'bomb':
        return 4.5;
    }
  }

  // ── Type-specific projectile behavior during flight ──

  private updateProjectileBehavior(p: ActiveProjectile, t: number, dt: number): void {
    const direction = new THREE.Vector3().subVectors(p.mesh.position, p.prevPosition);

    switch (p.type) {
      case 'arrow':
        this.updateArrow(p, direction, t, dt);
        break;
      case 'cannonball':
        this.updateCannonball(p, t, dt);
        break;
      case 'bolt':
        this.updateBolt(p, direction, t, dt);
        break;
      case 'bomb':
        this.updateBomb(p, t, dt);
        break;
    }
  }

  private updateArrow(
    p: ActiveProjectile,
    direction: THREE.Vector3,
    _t: number,
    dt: number,
  ): void {
    // Rotate arrow to face direction of travel
    if (direction.lengthSq() > 0.0001) {
      const lookTarget = p.mesh.position.clone().add(direction.normalize());
      p.mesh.lookAt(lookTarget);
    }
    // Slight tumble/spin along the flight axis
    p.mesh.rotateZ(dt * 12);
  }

  private updateCannonball(p: ActiveProjectile, t: number, dt: number): void {
    // Slow rotation
    p.mesh.rotation.x += dt * 3;
    p.mesh.rotation.z += dt * 2;

    // Animate fuse spark glow (the child spark mesh)
    const sparkChild = p.mesh.children[0] as THREE.Mesh | undefined;
    if (sparkChild && sparkChild.isMesh) {
      const mat = sparkChild.material as THREE.MeshStandardMaterial;
      const flicker = 1.5 + Math.sin(t * 40) * 0.8 + Math.sin(t * 67) * 0.4;
      mat.emissiveIntensity = flicker;
      // Scale spark randomly for a sizzling effect
      const sparkScale = 0.8 + Math.sin(t * 55) * 0.3;
      sparkChild.scale.setScalar(sparkScale);
    }
  }

  private updateBolt(
    p: ActiveProjectile,
    direction: THREE.Vector3,
    _t: number,
    dt: number,
  ): void {
    // Rotate bolt to face direction of travel
    if (direction.lengthSq() > 0.0001) {
      const lookTarget = p.mesh.position.clone().add(direction.normalize());
      p.mesh.lookAt(lookTarget);
    }
    // Slow roll along flight axis
    p.mesh.rotateZ(dt * 4);
  }

  private updateBomb(p: ActiveProjectile, t: number, dt: number): void {
    // Sway during flight
    const swayAmount = 0.15;
    const swaySpeed = 8;
    p.mesh.rotation.x = Math.sin(t * swaySpeed * Math.PI) * swayAmount;
    p.mesh.rotation.z = Math.cos(t * swaySpeed * Math.PI * 0.7) * swayAmount * 0.8;

    // Animate fuse spark (second child - the spark on the fuse)
    const bombMesh = p.mesh;
    // Spark is nested: bomb -> fuse -> spark
    const fuse = bombMesh.children[0] as THREE.Object3D | undefined;
    const spark = fuse?.children?.[0] as THREE.Mesh | undefined;
    if (spark && spark.isMesh) {
      const mat = spark.material as THREE.MeshStandardMaterial;
      const flicker = 2.0 + Math.sin(t * 50) * 1.0 + Math.sin(t * 73) * 0.5;
      mat.emissiveIntensity = flicker;
      const sparkScale = 0.7 + Math.sin(t * 60) * 0.4;
      spark.scale.setScalar(sparkScale);
    }

    // Slow tumble
    p.mesh.rotation.y += dt * 2;
  }

  // ── Trail system ──

  private getTrailInterval(type: ProjectileType): number {
    switch (type) {
      case 'arrow':
        return 0.04;
      case 'cannonball':
        return 0.035;
      case 'bolt':
        return 0.03;
      case 'bomb':
        return 0.05;
    }
  }

  private spawnTrail(p: ActiveProjectile): void {
    const geo = getSharedGeometries();

    switch (p.type) {
      case 'arrow':
        this.spawnArrowTrail(p, geo);
        break;
      case 'cannonball':
        this.spawnCannonballTrail(p, geo);
        break;
      case 'bolt':
        this.spawnBoltTrail(p, geo);
        break;
      case 'bomb':
        this.spawnBombTrail(p, geo);
        break;
    }
  }

  private spawnArrowTrail(
    p: ActiveProjectile,
    geo: NonNullable<typeof sharedGeometries>,
  ): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffaa,
      emissive: 0xffffaa,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geo.trail, mat);
    mesh.position.copy(p.mesh.position);
    mesh.scale.setScalar(0.6);
    this.scene.add(mesh);
    this.trails.push({
      mesh,
      lifetime: 0.2,
      maxLifetime: 0.2,
      initialScale: 0.6,
    });
  }

  private spawnCannonballTrail(
    p: ActiveProjectile,
    geo: NonNullable<typeof sharedGeometries>,
  ): void {
    // Smoke puff trail
    const grey = 0.3 + Math.random() * 0.15;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(grey, grey, grey),
      emissive: new THREE.Color(0xaaaaaa),
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo.smokeTrail, mat);
    mesh.position.copy(p.mesh.position);
    // Slight random offset
    mesh.position.x += (Math.random() - 0.5) * 0.05;
    mesh.position.y += (Math.random() - 0.5) * 0.05;
    mesh.position.z += (Math.random() - 0.5) * 0.05;
    const startScale = 0.4 + Math.random() * 0.3;
    mesh.scale.setScalar(startScale);
    this.scene.add(mesh);
    this.trails.push({
      mesh,
      lifetime: 0.5,
      maxLifetime: 0.5,
      initialScale: startScale,
    });
  }

  private spawnBoltTrail(
    p: ActiveProjectile,
    geo: NonNullable<typeof sharedGeometries>,
  ): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      emissive: 0xaaccff,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo.trail, mat);
    mesh.position.copy(p.mesh.position);
    mesh.scale.setScalar(0.7);
    this.scene.add(mesh);
    this.trails.push({
      mesh,
      lifetime: 0.25,
      maxLifetime: 0.25,
      initialScale: 0.7,
    });
  }

  private spawnBombTrail(
    p: ActiveProjectile,
    geo: NonNullable<typeof sharedGeometries>,
  ): void {
    // Smoke + spark trail
    const isSpark = Math.random() < 0.4;
    if (isSpark) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        emissive: 0xff6600,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.8,
      });
      const mesh = new THREE.Mesh(geo.trail, mat);
      mesh.position.copy(p.mesh.position);
      mesh.position.y += 0.18;
      mesh.position.x += (Math.random() - 0.5) * 0.08;
      mesh.position.z += (Math.random() - 0.5) * 0.08;
      mesh.scale.setScalar(0.5);
      this.scene.add(mesh);
      this.trails.push({
        mesh,
        lifetime: 0.15,
        maxLifetime: 0.15,
        initialScale: 0.5,
      });
    } else {
      const grey = 0.25 + Math.random() * 0.1;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(grey, grey, grey),
        emissive: new THREE.Color(0.1, 0.08, 0.04),
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(geo.smokeTrail, mat);
      mesh.position.copy(p.mesh.position);
      mesh.position.x += (Math.random() - 0.5) * 0.06;
      mesh.position.z += (Math.random() - 0.5) * 0.06;
      const startScale = 0.3 + Math.random() * 0.2;
      mesh.scale.setScalar(startScale);
      this.scene.add(mesh);
      this.trails.push({
        mesh,
        lifetime: 0.4,
        maxLifetime: 0.4,
        initialScale: startScale,
      });
    }
  }

  private updateTrails(dt: number): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.lifetime -= dt;

      if (trail.lifetime <= 0) {
        this.scene.remove(trail.mesh);
        // Only dispose material (geometry is shared)
        this.disposeMaterial(trail.mesh);
        this.trails.splice(i, 1);
        continue;
      }

      const fade = trail.lifetime / trail.maxLifetime;
      const mat = trail.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = fade * 0.6;

      // Smoke trails expand as they fade
      const expand = trail.initialScale * (1 + (1 - fade) * 1.5);
      trail.mesh.scale.setScalar(expand);

      // Slight upward drift for smoke
      trail.mesh.position.y += dt * 0.15;
    }
  }

  // ── Impact effects ──

  private handleImpact(p: ActiveProjectile): void {
    const pos = p.endPos;

    // Fire the external callback for particle system effects
    if (this.onImpactCallback) {
      this.onImpactCallback(pos.x, pos.y, pos.z, p.type);
    }

    // Spawn type-specific mesh impact effects
    switch (p.type) {
      case 'cannonball':
        this.spawnShockwaveRing(pos.x, pos.y, pos.z, 0xff8833, 1.0);
        break;
      case 'bomb':
        this.spawnExplosionFlash(pos.x, pos.y + 0.3, pos.z);
        this.spawnShockwaveRing(pos.x, pos.y, pos.z, 0xff4400, 1.8);
        break;
      case 'bolt':
        this.spawnEnergyFlash(pos.x, pos.y, pos.z);
        break;
      // Arrow: handled entirely by particle system callback (dust puff)
    }
  }

  private spawnShockwaveRing(
    x: number,
    y: number,
    z: number,
    color: number,
    sizeMult: number,
  ): void {
    const geo = getSharedGeometries();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffdd,
      emissive: 0xffffdd,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo.shockwaveRing, mat);
    ring.position.set(x, y + 0.05, z);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(0.3 * sizeMult);
    this.scene.add(ring);
    this.impactEffects.push({
      mesh: ring,
      lifetime: 0.4,
      maxLifetime: 0.4,
      initialScale: 0.3 * sizeMult,
    });
  }

  private spawnExplosionFlash(x: number, y: number, z: number): void {
    const geo = getSharedGeometries();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff8800,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.9,
    });
    const sphere = new THREE.Mesh(geo.explosionSphere, mat);
    sphere.position.set(x, y, z);
    sphere.scale.setScalar(0.2);
    this.scene.add(sphere);
    this.impactEffects.push({
      mesh: sphere,
      lifetime: 0.3,
      maxLifetime: 0.3,
      initialScale: 0.2,
    });
  }

  private spawnEnergyFlash(x: number, y: number, z: number): void {
    const geo = getSharedGeometries();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x66aaff,
      emissive: 0x4488ff,
      emissiveIntensity: 3.5,
      transparent: true,
      opacity: 0.9,
    });
    const sphere = new THREE.Mesh(geo.explosionSphere, mat);
    sphere.position.set(x, y, z);
    sphere.scale.setScalar(0.1);
    this.scene.add(sphere);
    this.impactEffects.push({
      mesh: sphere,
      lifetime: 0.2,
      maxLifetime: 0.2,
      initialScale: 0.1,
    });
  }

  private updateImpactEffects(dt: number): void {
    for (let i = this.impactEffects.length - 1; i >= 0; i--) {
      const effect = this.impactEffects[i];
      effect.lifetime -= dt;

      if (effect.lifetime <= 0) {
        this.scene.remove(effect.mesh);
        this.disposeMaterial(effect.mesh);
        this.impactEffects.splice(i, 1);
        continue;
      }

      const progress = 1 - effect.lifetime / effect.maxLifetime;
      const mat = effect.mesh.material as THREE.MeshStandardMaterial;

      // Expand and fade
      const expandScale = effect.initialScale + progress * effect.initialScale * 6;
      effect.mesh.scale.setScalar(expandScale);
      mat.opacity = (1 - progress) * 0.8;
      mat.emissiveIntensity = (1 - progress) * 3.0;
    }
  }

  // ── Projectile mesh creation ──

  private createProjectileMesh(type: ProjectileType): THREE.Object3D {
    switch (type) {
      case 'arrow':
        return this.createArrowMesh();
      case 'cannonball':
        return this.createCannonballMesh();
      case 'bolt':
        return this.createBoltMesh();
      case 'bomb':
        return this.createBombMesh();
    }
  }

  private createArrowMesh(): THREE.Object3D {
    const geo = getSharedGeometries();
    const group = new THREE.Group();

    // Wooden shaft
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
    });
    const shaft = new THREE.Mesh(geo.arrowShaft, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    group.add(shaft);

    // Metal tip
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0xffffff,
      emissiveIntensity: 3.0,
    });
    const tip = new THREE.Mesh(geo.arrowTip, tipMat);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = 0.3;
    group.add(tip);

    // Fletching (small tail feathers) - two crossed planes
    const fletchMat = new THREE.MeshStandardMaterial({
      color: 0xcc4444,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const fletchGeo = new THREE.PlaneGeometry(0.04, 0.08);
    const fletch1 = new THREE.Mesh(fletchGeo, fletchMat);
    fletch1.position.z = -0.22;
    fletch1.rotation.y = 0;
    group.add(fletch1);
    const fletch2 = new THREE.Mesh(fletchGeo, fletchMat);
    fletch2.position.z = -0.22;
    fletch2.rotation.y = Math.PI / 2;
    group.add(fletch2);

    return group;
  }

  private createCannonballMesh(): THREE.Object3D {
    const geo = getSharedGeometries();
    const group = new THREE.Group();

    // Dark iron ball
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
    });
    const ball = new THREE.Mesh(geo.cannonball, ballMat);
    group.add(ball);

    // Glowing fuse spark on top
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.0,
    });
    const spark = new THREE.Mesh(geo.fuseSpark, sparkMat);
    spark.position.y = 0.1;
    group.add(spark);

    return group;
  }

  private createBoltMesh(): THREE.Object3D {
    const geo = getSharedGeometries();
    const group = new THREE.Group();

    // Metal blue-grey shaft
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
    });
    const shaft = new THREE.Mesh(geo.boltShaft, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    group.add(shaft);

    // Heavy metal tip
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x889999,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x445566,
      emissiveIntensity: 0.2,
    });
    const tip = new THREE.Mesh(geo.boltTip, tipMat);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = 0.42;
    group.add(tip);

    // Metal stabilizer fins at the back
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x556677,
      metalness: 0.7,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const fin1 = new THREE.Mesh(geo.boltFin, finMat);
    fin1.position.z = -0.3;
    group.add(fin1);
    const fin2 = new THREE.Mesh(geo.boltFin, finMat);
    fin2.position.z = -0.3;
    fin2.rotation.z = Math.PI / 2;
    group.add(fin2);

    return group;
  }

  private createBombMesh(): THREE.Object3D {
    const geo = getSharedGeometries();
    const group = new THREE.Group();

    // Dark spherical bomb body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
    });
    const body = new THREE.Mesh(geo.bomb, bodyMat);
    group.add(body);

    // Fuse on top
    const fuseMat = new THREE.MeshStandardMaterial({
      color: 0x554422,
      roughness: 0.9,
    });
    const fuse = new THREE.Mesh(geo.bombFuse, fuseMat);
    fuse.position.y = 0.19;
    fuse.rotation.z = 0.3;
    group.add(fuse);

    // Sparking tip of the fuse
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.0,
    });
    const spark = new THREE.Mesh(geo.bombSpark, sparkMat);
    spark.position.y = 0.05;
    fuse.add(spark);

    return group;
  }

  // ── Cleanup ──

  private disposeMesh(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        // Do not dispose shared geometries - only dispose non-shared ones
        if (!this.isSharedGeometry(m.geometry)) {
          m.geometry.dispose();
        }
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  }

  private disposeMaterial(mesh: THREE.Mesh): void {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => mat.dispose());
    } else {
      mesh.material.dispose();
    }
  }

  private isSharedGeometry(geometry: THREE.BufferGeometry): boolean {
    if (!sharedGeometries) return false;
    const shared = sharedGeometries;
    return (
      geometry === shared.arrowShaft ||
      geometry === shared.arrowTip ||
      geometry === shared.cannonball ||
      geometry === shared.fuseSpark ||
      geometry === shared.boltShaft ||
      geometry === shared.boltTip ||
      geometry === shared.boltFin ||
      geometry === shared.bomb ||
      geometry === shared.bombFuse ||
      geometry === shared.bombSpark ||
      geometry === shared.trail ||
      geometry === shared.smokeTrail ||
      geometry === shared.shockwaveRing ||
      geometry === shared.explosionSphere
    );
  }
}
