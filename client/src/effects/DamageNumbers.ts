import * as THREE from 'three';
import gsap from 'gsap';

interface ActiveNumber {
  element: HTMLDivElement;
  worldPos: THREE.Vector3;
}

/**
 * Floating damage / gold numbers rendered as HTML divs positioned over 3D world.
 */
export class DamageNumbers {
  private overlay: HTMLElement;
  private active: ActiveNumber[] = [];

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  showDamage(amount: number, worldX: number, worldY: number, worldZ: number): void {
    this.spawn(
      `-${Math.floor(amount)}`,
      '#ff4444',
      new THREE.Vector3(worldX, worldY + 0.5, worldZ),
    );
  }

  showGold(amount: number, worldX: number, worldY: number, worldZ: number): void {
    this.spawn(
      `+${Math.floor(amount)}`,
      '#ffd700',
      new THREE.Vector3(worldX, worldY + 0.8, worldZ),
    );
  }

  private spawn(text: string, color: string, worldPos: THREE.Vector3): void {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: absolute; pointer-events: none;
      font-family: 'Cinzel', serif; font-weight: 700;
      font-size: 18px; color: ${color};
      text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6);
      white-space: nowrap; z-index: 30;
      opacity: 1; transform: translate(-50%, -50%);
    `;
    this.overlay.appendChild(el);

    const entry: ActiveNumber = { element: el, worldPos: worldPos.clone() };
    this.active.push(entry);

    // Animate upward and fade
    gsap.to(entry.worldPos, {
      y: worldPos.y + 2,
      duration: 1.0,
      ease: 'power2.out',
    });
    gsap.to(el, {
      opacity: 0,
      duration: 1.0,
      ease: 'power1.in',
      onComplete: () => {
        el.remove();
        const idx = this.active.indexOf(entry);
        if (idx >= 0) this.active.splice(idx, 1);
      },
    });
  }

  update(camera: THREE.PerspectiveCamera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const vec = new THREE.Vector3();

    for (const entry of this.active) {
      vec.copy(entry.worldPos);
      vec.project(camera);

      // Check if behind camera
      if (vec.z > 1) {
        entry.element.style.display = 'none';
        continue;
      }

      const x = (vec.x * 0.5 + 0.5) * w;
      const y = (-vec.y * 0.5 + 0.5) * h;

      entry.element.style.display = 'block';
      entry.element.style.left = `${x}px`;
      entry.element.style.top = `${y}px`;
    }
  }
}
