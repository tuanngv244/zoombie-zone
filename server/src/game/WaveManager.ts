import {
  EnemyType,
  WAVE_CONFIG,
  ZOMBIE_WAVE_COMPOSITIONS,
  INVADER_WAVES,
  WaveComposition,
} from '../config/gameConfig';
import { SpawnEdge } from './EnemyManager';

export type WavePhase = 'preparation' | 'wave_active' | 'wave_break' | 'ended';

interface SpawnRequest {
  type: EnemyType;
  edge: SpawnEdge;
}

const EDGES: SpawnEdge[] = ['north', 'south', 'east', 'west'];

function pickRandomEdge(): SpawnEdge {
  return EDGES[Math.floor(Math.random() * EDGES.length)];
}

function getCompositionForWave(wave: number): WaveComposition {
  if (wave >= 1 && wave <= 3) return ZOMBIE_WAVE_COMPOSITIONS['1-3'];
  if (wave >= 4 && wave <= 6) return ZOMBIE_WAVE_COMPOSITIONS['4-6'];
  if (wave >= 7 && wave <= 9) return ZOMBIE_WAVE_COMPOSITIONS['7-9'];
  if (wave >= 10 && wave <= 12) return ZOMBIE_WAVE_COMPOSITIONS['10-12'];
  if (wave >= 13 && wave <= 14) return ZOMBIE_WAVE_COMPOSITIONS['13-14'];
  return ZOMBIE_WAVE_COMPOSITIONS['15'];
}

export class WaveManager {
  private phase: WavePhase = 'preparation';
  private preparationTimer: number = WAVE_CONFIG.preparationTime;
  private waveBreakTimer: number = 0;

  private currentZombieWave: number = 0;
  private currentInvaderWave: number = 0;

  private waveSpawnQueue: SpawnRequest[] = [];
  private spawnInterval: number = 0.5; // seconds between each spawn
  private spawnTimer: number = 0;

  private waveWarningEmitted: boolean = false;
  private waveWarningTime: number = 10; // emit warning 10 seconds before wave

  // Callbacks
  onWaveWarning: ((waveNumber: number, waveType: 'zombie' | 'invader', countdown: number) => void) | null = null;
  onWaveStart: ((waveNumber: number, waveType: 'zombie' | 'invader', enemyCount: number) => void) | null = null;
  onEnemySpawn: ((type: EnemyType, edge: SpawnEdge, waveNumber: number) => void) | null = null;

  init(): void {
    this.phase = 'preparation';
    this.preparationTimer = WAVE_CONFIG.preparationTime;
    this.waveBreakTimer = 0;
    this.currentZombieWave = 0;
    this.currentInvaderWave = 0;
    this.waveSpawnQueue = [];
    this.spawnTimer = 0;
    this.waveWarningEmitted = false;
  }

  getPhase(): WavePhase {
    return this.phase;
  }

  getCurrentZombieWave(): number {
    return this.currentZombieWave;
  }

  getCurrentInvaderWave(): number {
    return this.currentInvaderWave;
  }

  getTimeRemaining(): number {
    switch (this.phase) {
      case 'preparation':
        return this.preparationTimer;
      case 'wave_break':
        return this.waveBreakTimer;
      default:
        return 0;
    }
  }

  getCurrentState(): {
    phase: WavePhase;
    currentZombieWave: number;
    currentInvaderWave: number;
    timeRemaining: number;
  } {
    return {
      phase: this.phase,
      currentZombieWave: this.currentZombieWave,
      currentInvaderWave: this.currentInvaderWave,
      timeRemaining: this.getTimeRemaining(),
    };
  }

  isAllWavesComplete(): boolean {
    return (
      this.currentZombieWave >= WAVE_CONFIG.totalZombieWaves &&
      this.currentInvaderWave >= WAVE_CONFIG.totalInvaderWaves
    );
  }

  /**
   * Signal that all enemies from the current wave are dead so we can
   * transition to wave_break or ended.
   */
  notifyAllEnemiesDead(): void {
    if (this.phase === 'wave_active' && this.waveSpawnQueue.length === 0) {
      if (this.isAllWavesComplete()) {
        this.phase = 'ended';
      } else {
        this.phase = 'wave_break';
        this.waveBreakTimer = WAVE_CONFIG.waveBreakTime;
        this.waveWarningEmitted = false;
      }
    }
  }

  /**
   * Main update. deltaTime is in seconds.
   */
  update(deltaTime: number, activeEnemyCount: number): void {
    switch (this.phase) {
      case 'preparation':
        this.updatePreparation(deltaTime);
        break;
      case 'wave_active':
        this.updateWaveActive(deltaTime, activeEnemyCount);
        break;
      case 'wave_break':
        this.updateWaveBreak(deltaTime);
        break;
      case 'ended':
        break;
    }
  }

  private updatePreparation(deltaTime: number): void {
    this.preparationTimer -= deltaTime;

    // Emit wave warning
    if (!this.waveWarningEmitted && this.preparationTimer <= this.waveWarningTime) {
      this.waveWarningEmitted = true;
      if (this.onWaveWarning) {
        this.onWaveWarning(1, 'zombie', Math.ceil(this.preparationTimer));
      }
    }

    if (this.preparationTimer <= 0) {
      this.preparationTimer = 0;
      this.startNextZombieWave();
    }
  }

  private updateWaveActive(deltaTime: number, activeEnemyCount: number): void {
    // Spawn enemies from queue
    if (this.waveSpawnQueue.length > 0) {
      this.spawnTimer -= deltaTime;
      while (this.spawnTimer <= 0 && this.waveSpawnQueue.length > 0) {
        const req = this.waveSpawnQueue.shift()!;
        if (this.onEnemySpawn) {
          this.onEnemySpawn(req.type, req.edge, this.currentZombieWave);
        }
        this.spawnTimer += this.spawnInterval;
      }
    }

    // If all spawns are done and no enemies remain, transition
    if (this.waveSpawnQueue.length === 0 && activeEnemyCount === 0) {
      if (this.isAllWavesComplete()) {
        this.phase = 'ended';
      } else {
        this.phase = 'wave_break';
        this.waveBreakTimer = WAVE_CONFIG.waveBreakTime;
        this.waveWarningEmitted = false;
      }
    }
  }

  private updateWaveBreak(deltaTime: number): void {
    this.waveBreakTimer -= deltaTime;

    // Emit wave warning
    if (!this.waveWarningEmitted && this.waveBreakTimer <= this.waveWarningTime) {
      this.waveWarningEmitted = true;
      const nextWave = this.currentZombieWave + 1;
      if (this.onWaveWarning && nextWave <= WAVE_CONFIG.totalZombieWaves) {
        this.onWaveWarning(nextWave, 'zombie', Math.ceil(this.waveBreakTimer));
      }
    }

    if (this.waveBreakTimer <= 0) {
      this.waveBreakTimer = 0;
      this.startNextZombieWave();
    }
  }

  private startNextZombieWave(): void {
    this.currentZombieWave++;
    if (this.currentZombieWave > WAVE_CONFIG.totalZombieWaves) {
      this.phase = 'ended';
      return;
    }

    this.phase = 'wave_active';
    this.waveSpawnQueue = [];
    this.spawnTimer = 0;

    const wave = this.currentZombieWave;
    const composition = getCompositionForWave(wave);

    // Compute total enemy count: baseCount + (wave - 1) * spawnCountScale
    const totalCount = composition.baseCount + (wave - 1) * WAVE_CONFIG.spawnCountScale;

    const normalCount = Math.round(totalCount * composition.normalPercent);
    const fastCount = Math.round(totalCount * composition.fastPercent);
    const heavyCount = Math.max(0, totalCount - normalCount - fastCount);

    // Build spawn requests
    const spawnRequests: SpawnRequest[] = [];

    for (let i = 0; i < normalCount; i++) {
      spawnRequests.push({ type: EnemyType.NormalZombie, edge: pickRandomEdge() });
    }
    for (let i = 0; i < fastCount; i++) {
      spawnRequests.push({ type: EnemyType.FastZombie, edge: pickRandomEdge() });
    }
    for (let i = 0; i < heavyCount; i++) {
      spawnRequests.push({ type: EnemyType.HeavyZombie, edge: pickRandomEdge() });
    }

    // Wave 15: add 4 Zombie Bosses (one from each edge)
    if (wave === 15) {
      for (const edge of EDGES) {
        spawnRequests.push({ type: EnemyType.ZombieBoss, edge });
      }
    }

    // Shuffle spawn requests for variety
    this.shuffleArray(spawnRequests);

    this.waveSpawnQueue = spawnRequests;

    const totalEnemyCount = spawnRequests.length;

    if (this.onWaveStart) {
      this.onWaveStart(wave, 'zombie', totalEnemyCount);
    }

    // Check if this zombie wave triggers an invader wave
    // Invader waves appear after zombie waves 3, 6, 9, 12, 15
    const invaderWave = INVADER_WAVES.find(iw => iw.appearsAfterZombieWave === wave);
    if (invaderWave) {
      this.queueInvaderWave(invaderWave);
    }
  }

  private queueInvaderWave(invaderWave: typeof INVADER_WAVES[number]): void {
    this.currentInvaderWave++;
    const invaderRequests: SpawnRequest[] = [];

    for (let i = 0; i < invaderWave.soldiers; i++) {
      invaderRequests.push({ type: EnemyType.Soldier, edge: pickRandomEdge() });
    }
    for (let i = 0; i < invaderWave.elites; i++) {
      invaderRequests.push({ type: EnemyType.EliteSoldier, edge: pickRandomEdge() });
    }
    if (invaderWave.hasGeneral) {
      invaderRequests.push({ type: EnemyType.General, edge: pickRandomEdge() });
    }

    this.shuffleArray(invaderRequests);

    // Append invader spawns to the existing queue
    this.waveSpawnQueue.push(...invaderRequests);

    if (this.onWaveStart) {
      this.onWaveStart(this.currentInvaderWave, 'invader', invaderRequests.length);
    }
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
