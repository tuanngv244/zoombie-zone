/**
 * Background music manager with crossfade support.
 * Placeholder implementation that works when audio files are placed
 * in public/assets/audio/music/.
 */
export class MusicManager {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private masterVolume = 0.3;
  private buffers: Map<string, AudioBuffer> = new Map();
  private currentTrack: string | null = null;
  private initialized = false;

  private trackPaths: Record<string, string> = {
    ambient_prep: '/assets/audio/music/ambient_prep.mp3',
    combat_normal: '/assets/audio/music/combat_normal.mp3',
    combat_boss: '/assets/audio/music/combat_boss.mp3',
  };

  async init(): Promise<void> {
    if (this.initialized) return;

    const resume = async () => {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.initialized = true;
      this.preloadAll();
    };

    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
  }

  private async preloadAll(): Promise<void> {
    for (const [name, path] of Object.entries(this.trackPaths)) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        if (this.ctx) {
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(name, audioBuffer);
        }
      } catch {
        // Silently ignore missing music files
      }
    }
  }

  playTrack(name: string): void {
    if (!this.ctx || this.currentTrack === name) return;

    this.stop();

    const buffer = this.buffers.get(name);
    if (!buffer) {
      this.currentTrack = name; // track intent even without file
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = this.masterVolume;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);

    this.currentSource = source;
    this.currentGain = gain;
    this.currentTrack = name;
  }

  crossfadeTo(name: string, duration: number = 2.0): void {
    if (!this.ctx || this.currentTrack === name) return;

    const buffer = this.buffers.get(name);
    if (!buffer) {
      this.stop();
      this.currentTrack = name;
      return;
    }

    // Fade out current
    if (this.currentGain && this.currentSource) {
      const oldGain = this.currentGain;
      const oldSource = this.currentSource;
      const now = this.ctx.currentTime;
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + duration);
      setTimeout(() => {
        try {
          oldSource.stop();
        } catch {
          // already stopped
        }
      }, duration * 1000 + 100);
    }

    // Fade in new
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.masterVolume, now + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);

    this.currentSource = source;
    this.currentGain = gain;
    this.currentTrack = name;
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.currentGain) {
      this.currentGain.gain.value = this.masterVolume;
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    this.currentGain = null;
    this.currentTrack = null;
  }
}
