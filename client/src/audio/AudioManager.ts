/**
 * Web Audio API wrapper for sound effects.
 * Placeholder implementation that will work when audio files are placed
 * in public/assets/audio/sfx/.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private muted = false;
  private initialized = false;

  private soundPaths: Record<string, string> = {
    ui_click: '/assets/audio/sfx/ui_click.mp3',
    ui_error: '/assets/audio/sfx/ui_error.mp3',
    gold_chime: '/assets/audio/sfx/gold_chime.mp3',
    arrow_hit: '/assets/audio/sfx/arrow_hit.mp3',
    cannon_boom: '/assets/audio/sfx/cannon_boom.mp3',
    explosion: '/assets/audio/sfx/explosion.mp3',
    zombie_groan: '/assets/audio/sfx/zombie_groan.mp3',
    warning_horn: '/assets/audio/sfx/warning_horn.mp3',
    war_drums: '/assets/audio/sfx/war_drums.mp3',
  };

  async init(): Promise<void> {
    if (this.initialized) return;

    // Resume AudioContext on first user interaction (Safari requirement)
    const resume = async () => {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.initialized = true;
      // Pre-load sounds (silently fail if files missing)
      this.preloadAll();
    };

    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
  }

  private async preloadAll(): Promise<void> {
    for (const [name, path] of Object.entries(this.soundPaths)) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        if (this.ctx) {
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(name, audioBuffer);
        }
      } catch {
        // Silently ignore missing audio files
      }
    }
  }

  playSound(name: string): void {
    if (this.muted || !this.ctx || !this.gainNode) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start(0);
  }

  setVolume(vol: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  mute(): void {
    this.muted = true;
    if (this.gainNode) this.gainNode.gain.value = 0;
  }

  unmute(): void {
    this.muted = false;
    if (this.gainNode) this.gainNode.gain.value = 1;
  }
}
