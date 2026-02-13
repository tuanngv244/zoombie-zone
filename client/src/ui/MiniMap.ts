import { GRID } from '../config/clientConfig';
import { BuildingSnapshot, EnemySnapshot, CastleSnapshot } from '../socket/StateSync';

const MAP_SIZE = 160;
const TILE = MAP_SIZE / GRID.width;

/**
 * Canvas-based mini-map shown in the bottom-left corner.
 * Displays buildings, enemies, castles, and army units.
 */
export class MiniMap {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; bottom: 12px; left: 12px;
      width: ${MAP_SIZE + 4}px; height: ${MAP_SIZE + 4}px;
      background: rgba(15, 8, 4, 0.9);
      border: 2px solid #6b4226;
      border-radius: 6px;
      pointer-events: auto;
      z-index: 25;
    `;
    overlay.appendChild(this.container);

    // Title label
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute; top: -18px; left: 0; width: 100%;
      text-align: center; font-family: 'Cinzel', serif;
      font-size: 10px; color: #a88c5e; letter-spacing: 1px;
    `;
    label.textContent = 'MAP';
    this.container.appendChild(label);

    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_SIZE;
    this.canvas.height = MAP_SIZE;
    this.canvas.style.cssText = `
      display: block; margin: 2px;
      image-rendering: pixelated;
    `;
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
  }

  update(
    buildings: BuildingSnapshot[],
    enemies: EnemySnapshot[],
    castles: CastleSnapshot[],
    armyUnits?: { x: number; y: number; ownerId: string }[],
  ): void {
    const ctx = this.ctx;
    const t = TILE;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(100, 70, 40, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID.width; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i * t, 0);
      ctx.lineTo(i * t, MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * t);
      ctx.lineTo(MAP_SIZE, i * t);
      ctx.stroke();
    }

    // Castles
    if (castles.length > 0) {
      for (const castle of castles) {
        const hpPct = castle.maxHp > 0 ? castle.hp / castle.maxHp : 0;
        if (hpPct > 0.6) ctx.fillStyle = '#4488cc';
        else if (hpPct > 0.3) ctx.fillStyle = '#ccaa33';
        else ctx.fillStyle = '#cc3333';

        const cx = (castle.centerX - 2) * t;
        const cy = (castle.centerY - 2) * t;
        ctx.fillRect(cx, cy, 4 * t, 4 * t);

        // Castle outline
        ctx.strokeStyle = '#d4a857';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, 4 * t, 4 * t);
      }
    } else {
      // Default single castle
      const cx = (GRID.castleCenterX - 2) * t;
      const cy = (GRID.castleCenterY - 2) * t;
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(cx, cy, 4 * t, 4 * t);
      ctx.strokeStyle = '#d4a857';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, 4 * t, 4 * t);
    }

    // Buildings
    for (const b of buildings) {
      const isWall = b.type.includes('wall') || b.type === 'river_barrier';
      ctx.fillStyle = isWall ? '#8b6914' : '#cc6633';
      ctx.fillRect(b.gridX * t, b.gridY * t, t, t);
    }

    // Enemies (red dots)
    ctx.fillStyle = '#ff4444';
    for (const e of enemies) {
      ctx.beginPath();
      ctx.arc(e.x * t, e.y * t, Math.max(1.5, t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Army units (cyan dots)
    if (armyUnits) {
      ctx.fillStyle = '#44ffff';
      for (const u of armyUnits) {
        ctx.beginPath();
        ctx.arc(u.x * t, u.y * t, Math.max(1.5, t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Border
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
