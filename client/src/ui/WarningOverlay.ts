import gsap from 'gsap';

/**
 * Full-screen wave warning overlay with GSAP animations.
 */
export class WarningOverlay {
  private container: HTMLDivElement;
  private textEl: HTMLDivElement;
  private borderEl: HTMLDivElement;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50;
      display: none; align-items: center; justify-content: center;
    `;
    overlay.appendChild(this.container);

    // Red flashing border
    this.borderEl = document.createElement('div');
    this.borderEl.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      box-shadow: inset 0 0 80px rgba(200, 0, 0, 0);
      pointer-events: none;
    `;
    this.container.appendChild(this.borderEl);

    // Center text
    this.textEl = document.createElement('div');
    this.textEl.style.cssText = `
      font-family: 'Cinzel', serif;
      font-weight: 900;
      font-size: 48px;
      color: #ff3333;
      text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.4);
      text-align: center;
      opacity: 0;
      transform: scale(0.5);
      letter-spacing: 4px;
    `;
    this.container.appendChild(this.textEl);
  }

  showWarning(text: string, severity: 'normal' | 'boss' | 'general'): void {
    this.container.style.display = 'flex';
    this.textEl.textContent = text;

    // Kill existing animations
    gsap.killTweensOf(this.textEl);
    gsap.killTweensOf(this.borderEl);

    let fontSize = '42px';
    let borderColor = 'rgba(200, 0, 0, 0.5)';
    let textColor = '#ff4444';
    let duration = 3;

    if (severity === 'boss') {
      fontSize = '56px';
      borderColor = 'rgba(180, 0, 0, 0.7)';
      textColor = '#ff2222';
      duration = 4;
    } else if (severity === 'general') {
      fontSize = '64px';
      borderColor = 'rgba(150, 0, 0, 0.9)';
      textColor = '#ff0000';
      duration = 5;
    }

    this.textEl.style.fontSize = fontSize;
    this.textEl.style.color = textColor;

    // Border flash
    gsap.fromTo(
      this.borderEl,
      { boxShadow: `inset 0 0 80px ${borderColor}` },
      {
        boxShadow: `inset 0 0 40px rgba(200, 0, 0, 0)`,
        duration: 0.5,
        repeat: Math.floor(duration / 0.5),
        yoyo: true,
        ease: 'power1.inOut',
      },
    );

    // Text animation
    const tl = gsap.timeline({
      onComplete: () => {
        this.container.style.display = 'none';
      },
    });

    tl.fromTo(
      this.textEl,
      { opacity: 0, scale: 0.5 },
      { opacity: 1, scale: 1.1, duration: 0.4, ease: 'back.out(1.7)' },
    )
      .to(this.textEl, {
        scale: 1.0,
        duration: 0.2,
        ease: 'power2.out',
      })
      .to(this.textEl, {
        opacity: 1,
        scale: 1.05,
        duration: 0.3,
        repeat: 3,
        yoyo: true,
        ease: 'sine.inOut',
      })
      .to(this.textEl, {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        ease: 'power2.in',
      });

    // Screen shake for general
    if (severity === 'general') {
      const gameContainer = document.getElementById('canvas-container');
      if (gameContainer) {
        gsap.to(gameContainer, {
          x: '+=3',
          duration: 0.05,
          repeat: 20,
          yoyo: true,
          ease: 'none',
          onComplete: () => {
            gsap.set(gameContainer, { x: 0 });
          },
        });
      }
    }
  }
}
