import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  lifetime: number;
  maxLifetime: number;
  size: number;
  noGravity: boolean;
}

type ParticleType = 'smoke' | 'fire' | 'debris' | 'blood' | 'explosion' | 'shockwave' | 'spark' | 'dust';

/**
 * Particle system using Three.js Points geometry.
 * Supports smoke, fire, debris, blood, explosion, shockwave, spark, and dust particle types.
 */
export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private maxParticles = 1000;
  private isMobile: boolean;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (this.isMobile) {
      this.maxParticles = 300;
    }

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(type: ParticleType, x: number, y: number, z: number, count: number): void {
    const actualCount = this.isMobile ? Math.ceil(count / 3) : count;

    for (let i = 0; i < actualCount; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const p = this.createParticle(type, x, y, z);
      this.particles.push(p);
    }
  }

  private createParticle(
    type: ParticleType,
    x: number,
    y: number,
    z: number,
  ): Particle {
    let spread: number;
    let pos: THREE.Vector3;
    let vel: THREE.Vector3;
    let color: THREE.Color;
    let lifetime: number;
    let size: number;
    let noGravity = false;

    switch (type) {
      case 'smoke': {
        spread = 0.3;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.2,
          z + (Math.random() - 0.5) * spread,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.5 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.3,
        );
        color = new THREE.Color(
          0.3 + Math.random() * 0.1,
          0.3 + Math.random() * 0.1,
          0.3 + Math.random() * 0.1,
        );
        lifetime = 1.0 + Math.random() * 0.5;
        size = 0.15 + Math.random() * 0.1;
        break;
      }

      case 'fire': {
        spread = 0.3;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.2,
          z + (Math.random() - 0.5) * spread,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          1.0 + Math.random() * 1.0,
          (Math.random() - 0.5) * 0.5,
        );
        color = new THREE.Color(
          0.9 + Math.random() * 0.1,
          0.3 + Math.random() * 0.4,
          0.0,
        );
        lifetime = 0.5 + Math.random() * 0.3;
        size = 0.12 + Math.random() * 0.08;
        break;
      }

      case 'debris': {
        spread = 0.3;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.2,
          z + (Math.random() - 0.5) * spread,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1.5 + Math.random() * 2,
          (Math.random() - 0.5) * 2,
        );
        color = new THREE.Color(
          0.4 + Math.random() * 0.2,
          0.25 + Math.random() * 0.1,
          0.1,
        );
        lifetime = 0.8 + Math.random() * 0.4;
        size = 0.08 + Math.random() * 0.06;
        break;
      }

      case 'blood': {
        spread = 0.3;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.2,
          z + (Math.random() - 0.5) * spread,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          0.5 + Math.random() * 1.0,
          (Math.random() - 0.5) * 1.5,
        );
        color = new THREE.Color(
          0.6 + Math.random() * 0.3,
          0.0,
          0.0,
        );
        lifetime = 0.6 + Math.random() * 0.3;
        size = 0.06 + Math.random() * 0.04;
        break;
      }

      case 'explosion': {
        // Large bright orange/red/yellow particles bursting outward
        spread = 0.2;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.15,
          z + (Math.random() - 0.5) * spread,
        );
        // High velocity outward burst
        const angle = Math.random() * Math.PI * 2;
        const upAngle = Math.random() * Math.PI * 0.5;
        const speed = 3.0 + Math.random() * 4.0;
        vel = new THREE.Vector3(
          Math.cos(angle) * Math.cos(upAngle) * speed,
          Math.sin(upAngle) * speed * 0.8 + 1.0,
          Math.sin(angle) * Math.cos(upAngle) * speed,
        );
        // Random orange/red/yellow
        const explosionHue = Math.random();
        if (explosionHue < 0.33) {
          // Bright orange
          color = new THREE.Color(
            0.95 + Math.random() * 0.05,
            0.45 + Math.random() * 0.25,
            0.0,
          );
        } else if (explosionHue < 0.66) {
          // Red-orange
          color = new THREE.Color(
            0.9 + Math.random() * 0.1,
            0.15 + Math.random() * 0.2,
            0.0,
          );
        } else {
          // Bright yellow
          color = new THREE.Color(
            0.95 + Math.random() * 0.05,
            0.8 + Math.random() * 0.2,
            0.1 + Math.random() * 0.2,
          );
        }
        lifetime = 0.3 + Math.random() * 0.4;
        size = 0.18 + Math.random() * 0.14;
        break;
      }

      case 'shockwave': {
        // Ring of white/yellow particles expanding outward horizontally
        const ringAngle = Math.random() * Math.PI * 2;
        const ringSpeed = 4.0 + Math.random() * 3.0;
        pos = new THREE.Vector3(
          x + Math.cos(ringAngle) * 0.1,
          y + (Math.random() - 0.5) * 0.05,
          z + Math.sin(ringAngle) * 0.1,
        );
        vel = new THREE.Vector3(
          Math.cos(ringAngle) * ringSpeed,
          0, // No vertical movement
          Math.sin(ringAngle) * ringSpeed,
        );
        // White to yellow
        const waveHue = Math.random();
        if (waveHue < 0.5) {
          color = new THREE.Color(
            0.95 + Math.random() * 0.05,
            0.9 + Math.random() * 0.1,
            0.7 + Math.random() * 0.3,
          );
        } else {
          color = new THREE.Color(
            0.9 + Math.random() * 0.1,
            0.85 + Math.random() * 0.15,
            0.5 + Math.random() * 0.2,
          );
        }
        lifetime = 0.15 + Math.random() * 0.15;
        size = 0.1 + Math.random() * 0.08;
        noGravity = true;
        break;
      }

      case 'spark': {
        // Tiny bright yellow/white particles, very short life, very fast
        spread = 0.08;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + (Math.random() - 0.5) * spread,
          z + (Math.random() - 0.5) * spread,
        );
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkPitch = (Math.random() - 0.3) * Math.PI;
        const sparkSpeed = 5.0 + Math.random() * 6.0;
        vel = new THREE.Vector3(
          Math.cos(sparkAngle) * Math.cos(sparkPitch) * sparkSpeed,
          Math.sin(sparkPitch) * sparkSpeed + 1.0,
          Math.sin(sparkAngle) * Math.cos(sparkPitch) * sparkSpeed,
        );
        // Bright yellow to white
        const sparkBright = Math.random();
        if (sparkBright < 0.5) {
          // Bright yellow
          color = new THREE.Color(
            0.95 + Math.random() * 0.05,
            0.85 + Math.random() * 0.15,
            0.3 + Math.random() * 0.3,
          );
        } else {
          // Near-white
          color = new THREE.Color(
            0.9 + Math.random() * 0.1,
            0.9 + Math.random() * 0.1,
            0.8 + Math.random() * 0.2,
          );
        }
        lifetime = 0.1 + Math.random() * 0.15;
        size = 0.04 + Math.random() * 0.03;
        break;
      }

      case 'dust': {
        // Brownish/grey particles, slow upward drift, low velocity
        spread = 0.5;
        pos = new THREE.Vector3(
          x + (Math.random() - 0.5) * spread,
          y + Math.random() * 0.1,
          z + (Math.random() - 0.5) * spread,
        );
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          0.2 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.4,
        );
        // Brown to grey
        const dustShade = Math.random();
        if (dustShade < 0.5) {
          // Brown
          color = new THREE.Color(
            0.4 + Math.random() * 0.15,
            0.3 + Math.random() * 0.1,
            0.15 + Math.random() * 0.1,
          );
        } else {
          // Grey
          const g = 0.35 + Math.random() * 0.15;
          color = new THREE.Color(g, g, g - 0.02);
        }
        lifetime = 0.8 + Math.random() * 0.6;
        size = 0.1 + Math.random() * 0.1;
        noGravity = true;
        break;
      }
    }

    return { position: pos, velocity: vel, color, lifetime, maxLifetime: lifetime, size, noGravity };
  }

  update(dt: number): void {
    const gravity = -3.0;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics - apply gravity only to particles that use it
      if (!p.noGravity) {
        p.velocity.y += gravity * dt;
      }
      p.position.add(p.velocity.clone().multiplyScalar(dt));

      // Floor collision
      if (p.position.y < 0.05) {
        p.position.y = 0.05;
        p.velocity.y *= -0.3;
        p.velocity.x *= 0.8;
        p.velocity.z *= 0.8;
      }
    }

    // Update geometry buffers
    const count = this.particles.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const fade = p.lifetime / p.maxLifetime;

      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;

      colors[i * 3] = p.color.r * fade;
      colors[i * 3 + 1] = p.color.g * fade;
      colors[i * 3 + 2] = p.color.b * fade;
    }

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3),
    );
    this.geometry.attributes['position'].needsUpdate = true;
    this.geometry.attributes['color'].needsUpdate = true;
  }
}
