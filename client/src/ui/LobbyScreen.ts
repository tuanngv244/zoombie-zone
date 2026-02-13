/**
 * Full-screen lobby overlay for single-player game.
 */
export class LobbyScreen {
  private container: HTMLDivElement;
  private startSinglePlayerCallback: (() => void) | null = null;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 20px;
      background: radial-gradient(ellipse at center, rgba(30,15,8,0.95) 0%, rgba(10,5,2,0.98) 100%);
      z-index: 200; pointer-events: auto;
    `;
    overlay.appendChild(this.container);

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-family: 'Cinzel', serif; font-weight: 900;
      font-size: 64px; color: #d4a857;
      text-shadow: 0 0 30px rgba(212,168,87,0.5), 0 4px 8px rgba(0,0,0,0.8);
      letter-spacing: 8px; margin-bottom: 10px;
    `;
    title.textContent = 'ZOMBIE ZONE';
    this.container.appendChild(title);

    // Subtitle
    const sub = document.createElement('div');
    sub.style.cssText = `
      font-family: 'MedievalSharp', serif; font-size: 18px;
      color: #a88c5e; margin-bottom: 20px;
    `;
    sub.textContent = 'Defend the Castle. Survive the Horde.';
    this.container.appendChild(sub);

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(30, 18, 10, 0.9);
      border: 2px solid #6b4226; border-radius: 12px;
      padding: 30px 40px; min-width: 360px;
      display: flex; flex-direction: column; gap: 14px;
      align-items: center;
    `;
    this.container.appendChild(panel);

    // Play Solo button
    const soloBtn = document.createElement('button');
    soloBtn.textContent = 'PLAY SOLO';
    soloBtn.style.cssText = `
      width: 100%; padding: 15px 30px;
      font-family: 'Cinzel', serif; font-weight: 700;
      font-size: 20px;
      background: linear-gradient(180deg, #2a5a2a, #1a3a1a);
      border: 2px solid #6b4226; border-radius: 8px;
      color: #90EE90; cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      text-shadow: 0 1px 3px rgba(0,0,0,0.6);
    `;
    soloBtn.addEventListener('mouseenter', () => {
      soloBtn.style.background = 'linear-gradient(180deg, #3a7a3a, #2a5a2a)';
      soloBtn.style.transform = 'scale(1.02)';
    });
    soloBtn.addEventListener('mouseleave', () => {
      soloBtn.style.background = 'linear-gradient(180deg, #2a5a2a, #1a3a1a)';
      soloBtn.style.transform = 'scale(1)';
    });
    soloBtn.addEventListener('click', () => {
      this.startSinglePlayerCallback?.();
    });
    panel.appendChild(soloBtn);

    // Subtitle for mode
    const modeSub = document.createElement('div');
    modeSub.style.cssText = `
      font-family: 'MedievalSharp', serif; font-size: 14px;
      color: #6b4226; text-align: center;
      margin-top: 5px;
    `;
    modeSub.textContent = 'Single-player survival mode';
    panel.appendChild(modeSub);
  }

  // ── Public API ──

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  onStartSinglePlayer(callback: () => void): void {
    this.startSinglePlayerCallback = callback;
  }
}
