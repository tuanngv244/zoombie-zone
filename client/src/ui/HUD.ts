/**
 * HTML overlay HUD displaying gold, wave, timer, castle HP, and player list.
 */
export class HUD {
  private container: HTMLDivElement;
  private goldEl: HTMLDivElement;
  private waveEl: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private hpBarContainer: HTMLDivElement;
  private hpBarFill: HTMLDivElement;
  private hpBarText: HTMLDivElement;
  private playerListEl: HTMLDivElement;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 20;
    `;
    overlay.appendChild(this.container);

    // Top-left: Gold
    this.goldEl = this.createPanel();
    this.goldEl.style.cssText += `
      position: absolute; top: 12px; left: 12px;
      padding: 8px 18px; font-size: 22px;
      display: flex; align-items: center; gap: 8px;
    `;
    this.goldEl.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26" style="flex-shrink:0;"><circle cx="13" cy="13" r="12" fill="#ffd700" stroke="#b8860b" stroke-width="1.5"/><circle cx="13" cy="13" r="9" fill="none" stroke="#b8860b" stroke-width="0.8"/><text x="13" y="17.5" text-anchor="middle" font-size="12" font-weight="bold" fill="#8b6914" font-family="Cinzel,serif">$</text></svg><span style="font-size:13px;color:#a88c5e;margin-right:2px;">Your Gold:</span><span id="gold-value">0</span>`;
    this.container.appendChild(this.goldEl);

    // Top-center group
    const topCenter = document.createElement('div');
    topCenter.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    `;
    this.container.appendChild(topCenter);

    // Wave indicator
    this.waveEl = this.createPanel();
    this.waveEl.style.cssText += `
      padding: 6px 20px; font-size: 18px; text-align: center; white-space: nowrap;
    `;
    this.waveEl.textContent = 'Preparing...';
    topCenter.appendChild(this.waveEl);

    // Timer
    this.timerEl = this.createPanel();
    this.timerEl.style.cssText += `
      padding: 4px 16px; font-size: 24px; text-align: center;
      font-family: 'Cinzel', serif; letter-spacing: 2px;
    `;
    this.timerEl.textContent = '--:--';
    topCenter.appendChild(this.timerEl);

    // Castle HP bar
    this.hpBarContainer = document.createElement('div');
    this.hpBarContainer.style.cssText = `
      width: 260px; height: 22px; background: #1a0e0a;
      border: 2px solid #6b4226; border-radius: 4px;
      position: relative; overflow: hidden;
    `;
    topCenter.appendChild(this.hpBarContainer);

    this.hpBarFill = document.createElement('div');
    this.hpBarFill.style.cssText = `
      height: 100%; width: 100%;
      background: linear-gradient(90deg, #cc3333, #3daa3d);
      transition: width 0.3s ease;
    `;
    this.hpBarContainer.appendChild(this.hpBarFill);

    this.hpBarText = document.createElement('div');
    this.hpBarText.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: #fff; text-shadow: 1px 1px 2px #000;
      font-family: 'Cinzel', serif;
    `;
    this.hpBarText.textContent = '1000 / 1000';
    this.hpBarContainer.appendChild(this.hpBarText);

    // Top-right: Player list
    this.playerListEl = this.createPanel();
    this.playerListEl.style.cssText += `
      position: absolute; top: 12px; right: 12px;
      padding: 8px 14px; font-size: 14px; min-width: 140px;
    `;
    this.playerListEl.innerHTML = '<div style="font-size:12px;color:#a88c5e;margin-bottom:4px;">Players</div>';
    this.container.appendChild(this.playerListEl);
  }

  private createPanel(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      background: rgba(20, 10, 5, 0.85);
      border: 1px solid #6b4226;
      border-radius: 6px;
      color: #d4a857;
      font-family: 'MedievalSharp', serif;
      pointer-events: auto;
    `;
    return el;
  }

  updateGold(amount: number): void {
    const span = this.goldEl.querySelector('#gold-value');
    if (span) span.textContent = String(amount);
  }

  updateWave(zombieWave: number, invaderWave: number): void {
    let text = '';
    if (zombieWave > 0) {
      text = `Zombie Wave ${zombieWave}/15`;
    }
    if (invaderWave > 0) {
      text += (text ? ' | ' : '') + `Invader Wave ${invaderWave}/5`;
    }
    if (!text) text = 'Preparing...';
    this.waveEl.textContent = text;
  }

  updateTimer(phase: string, seconds: number): void {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    let label = '';
    switch (phase) {
      case 'preparation':
        label = 'PREP ';
        break;
      case 'wave':
        label = 'WAVE ';
        break;
      case 'wave_break':
        label = 'BREAK ';
        break;
      default:
        label = '';
    }
    this.timerEl.textContent = label + timeStr;
  }

  updateCastleHp(hp: number, maxHp: number): void {
    const pct = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    this.hpBarFill.style.width = `${pct}%`;

    // Color gradient based on HP
    if (pct > 60) {
      this.hpBarFill.style.background = 'linear-gradient(90deg, #3daa3d, #5dcc5d)';
    } else if (pct > 30) {
      this.hpBarFill.style.background = 'linear-gradient(90deg, #ccaa33, #ddcc44)';
    } else {
      this.hpBarFill.style.background = 'linear-gradient(90deg, #cc3333, #dd5555)';
    }

    this.hpBarText.textContent = `${Math.floor(hp)} / ${Math.floor(maxHp)}`;
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    this.playerListEl.innerHTML =
      '<div style="font-size:12px;color:#a88c5e;margin-bottom:4px;">Players</div>';
    for (const p of players) {
      const el = document.createElement('div');
      el.style.cssText = 'padding: 2px 0; font-size: 14px;';
      el.textContent = p.username;
      this.playerListEl.appendChild(el);
    }
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
