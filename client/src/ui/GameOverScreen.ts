import gsap from 'gsap';
import { ARMY_UNIT_DEFS } from '../config/clientConfig';
import { ArmyUnitRenderer } from '../entities/ArmyUnitRenderer';

export interface ArmyUnitSummary {
  type: string;
  count: number;
}

export interface GameOverStats {
  waveReached: number;
  totalKills: number;
  totalGoldEarned: number;
  totalBuildingsPlaced: number;
  duration: number;
}

/**
 * Full-screen game-over overlay with victory/defeat theming.
 */
export class GameOverScreen {
  private container: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private statsEl: HTMLDivElement;
  private armyEl: HTMLDivElement;
  private replayBtn: HTMLButtonElement;
  private replayCallback: (() => void) | null = null;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: none; align-items: center; justify-content: center;
      flex-direction: column; gap: 24px;
      background: rgba(10, 5, 2, 0.9);
      z-index: 100; pointer-events: auto;
    `;
    overlay.appendChild(this.container);

    // Title
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-family: 'Cinzel', serif; font-weight: 900;
      font-size: 72px; letter-spacing: 6px;
      text-shadow: 0 0 30px currentColor;
      opacity: 0;
    `;
    this.container.appendChild(this.titleEl);

    // Stats
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = `
      font-family: 'MedievalSharp', serif; font-size: 18px;
      color: #d4a857; text-align: center;
      line-height: 2; opacity: 0;
    `;
    this.container.appendChild(this.statsEl);

    // Army units summary
    this.armyEl = document.createElement('div');
    this.armyEl.style.cssText = `
      display: none; flex-direction: row; gap: 10px;
      flex-wrap: wrap; justify-content: center;
      max-width: 500px; opacity: 0;
    `;
    this.container.appendChild(this.armyEl);

    // Replay button
    this.replayBtn = document.createElement('button');
    this.replayBtn.textContent = 'Play Again';
    this.replayBtn.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 20px;
      padding: 12px 36px; border: 2px solid #6b4226;
      border-radius: 8px; cursor: pointer;
      background: rgba(40, 25, 15, 0.9); color: #d4a857;
      transition: background 0.2s, border-color 0.2s;
      opacity: 0;
    `;
    this.replayBtn.addEventListener('mouseenter', () => {
      this.replayBtn.style.borderColor = '#ffd700';
      this.replayBtn.style.background = 'rgba(60, 35, 20, 0.95)';
    });
    this.replayBtn.addEventListener('mouseleave', () => {
      this.replayBtn.style.borderColor = '#6b4226';
      this.replayBtn.style.background = 'rgba(40, 25, 15, 0.9)';
    });
    this.replayBtn.addEventListener('click', () => {
      this.replayCallback?.();
    });
    this.container.appendChild(this.replayBtn);
  }

  show(
    result: 'victory' | 'defeat',
    stats: GameOverStats,
    armyUnits?: ArmyUnitSummary[],
  ): void {
    this.container.style.display = 'flex';

    if (result === 'victory') {
      this.titleEl.textContent = 'VICTORY!';
      this.titleEl.style.color = '#ffd700';
      this.container.style.background = 'rgba(10, 15, 5, 0.92)';
    } else {
      this.titleEl.textContent = 'DEFEAT';
      this.titleEl.style.color = '#cc3333';
      this.container.style.background = 'rgba(15, 5, 5, 0.92)';
    }

    const mins = Math.floor(stats.duration / 60);
    const secs = Math.floor(stats.duration % 60);
    this.statsEl.innerHTML = `
      Wave Reached: <span style="color:#ffd700">${stats.waveReached}</span><br/>
      Total Kills: <span style="color:#ffd700">${stats.totalKills}</span><br/>
      Gold Earned: <span style="color:#ffd700">${stats.totalGoldEarned}</span><br/>
      Buildings Placed: <span style="color:#ffd700">${stats.totalBuildingsPlaced}</span><br/>
      Duration: <span style="color:#ffd700">${mins}m ${secs}s</span>
    `;

    // Army units summary
    this.armyEl.innerHTML = '';
    if (armyUnits && armyUnits.length > 0) {
      this.armyEl.style.display = 'flex';
      const label = document.createElement('div');
      label.style.cssText = `
        width: 100%; text-align: center;
        font-family: 'Cinzel', serif; font-size: 14px;
        color: #a88c5e; margin-bottom: 2px;
      `;
      label.textContent = 'Army Deployed';
      this.armyEl.appendChild(label);

      for (const unit of armyUnits) {
        const def = ARMY_UNIT_DEFS.find(d => d.type === unit.type);
        if (!def) continue;
        const colorHex = '#' + def.color.toString(16).padStart(6, '0');
        const card = document.createElement('div');
        card.style.cssText = `
          display: flex; flex-direction: column; align-items: center;
          background: rgba(40, 25, 15, 0.7);
          border: 1px solid #4a3020; border-radius: 6px;
          padding: 6px 10px; min-width: 60px;
        `;
        const swatch = document.createElement('div');
        swatch.style.cssText = `
          width: 32px; height: 32px; border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.2);
          margin-bottom: 4px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        `;
        const thumbUrl = ArmyUnitRenderer.generateThumbnail(def);
        if (thumbUrl) {
          swatch.style.backgroundImage = `url(${thumbUrl})`;
          swatch.style.backgroundColor = 'rgba(30, 18, 10, 0.6)';
        } else {
          swatch.style.backgroundColor = colorHex;
        }
        card.appendChild(swatch);
        const nameEl = document.createElement('div');
        nameEl.style.cssText = `
          font-family: 'MedievalSharp', serif; font-size: 10px;
          color: #d4a857; text-align: center;
        `;
        nameEl.textContent = def.name;
        card.appendChild(nameEl);
        const countEl = document.createElement('div');
        countEl.style.cssText = `
          font-family: 'Cinzel', serif; font-size: 12px;
          color: #ffd700;
        `;
        countEl.textContent = `x${unit.count}`;
        card.appendChild(countEl);
        this.armyEl.appendChild(card);
      }
    } else {
      this.armyEl.style.display = 'none';
    }

    // Animate in
    const tl = gsap.timeline();
    tl.fromTo(
      this.titleEl,
      { opacity: 0, scale: 0.3, y: -30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.4)' },
    )
      .fromTo(
        this.statsEl,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.3',
      )
      .fromTo(
        this.armyEl,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '-=0.2',
      )
      .fromTo(
        this.replayBtn,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        '-=0.2',
      );
  }

  hide(): void {
    this.container.style.display = 'none';
    gsap.killTweensOf(this.titleEl);
    gsap.killTweensOf(this.statsEl);
    gsap.killTweensOf(this.armyEl);
    gsap.killTweensOf(this.replayBtn);
    this.titleEl.style.opacity = '0';
    this.statsEl.style.opacity = '0';
    this.armyEl.style.opacity = '0';
    this.replayBtn.style.opacity = '0';
  }

  onReplay(callback: () => void): void {
    this.replayCallback = callback;
  }
}
