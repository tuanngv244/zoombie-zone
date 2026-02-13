import { SocketClient } from './SocketClient';

// ── Shared types (mirrored from server) ──
export interface PlayerInfo {
  id: string;
  username: string;
}

export interface EnemySnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
}

export interface BuildingSnapshot {
  id: string;
  type: string;
  gridX: number;
  gridY: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  stackCount: number;
}

export interface CastleSnapshot {
  playerId: string;
  hp: number;
  maxHp: number;
  centerX: number;
  centerY: number;
  upgrades: string[];
}

export interface ArmyUnitSnapshot {
  id: string;
  type: string;
  ownerId: string;
  targetPlayerId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface GameStateSnapshot {
  gold: number;
  castle: {
    hp: number;
    maxHp: number;
    upgrades: string[];
  };
  playerGold: Record<string, number>;
  castles: CastleSnapshot[];
  armyUnits: ArmyUnitSnapshot[];
  buildings: BuildingSnapshot[];
  enemies: EnemySnapshot[];
  currentZombieWave: number;
  currentInvaderWave: number;
  phase: 'preparation' | 'wave' | 'wave_break' | 'ended';
  timeRemaining: number;
  players: PlayerInfo[];
}

export interface GameStats {
  waveReached: number;
  totalKills: number;
  totalGoldEarned: number;
  totalBuildingsPlaced: number;
  duration: number;
}

export interface DamageEvent {
  targetId: string;
  amount: number;
  remainingHp: number;
  targetType: 'enemy' | 'building' | 'castle';
  sourceId?: string;
  sourceType?: 'building' | 'castle_king';
}

export interface LocalGameState {
  gold: number;
  castleHp: number;
  castleMaxHp: number;
  castleUpgrades: string[];
  buildings: BuildingSnapshot[];
  enemies: EnemySnapshot[];
  armyUnits: ArmyUnitSnapshot[];
  castles: CastleSnapshot[];
  currentZombieWave: number;
  currentInvaderWave: number;
  phase: 'lobby' | 'preparation' | 'wave' | 'wave_break' | 'ended';
  timeRemaining: number;
  players: PlayerInfo[];
  localPlayerId: string | null;
}

export type StateChangeCallback = (state: LocalGameState) => void;
export type DamageCallback = (event: DamageEvent) => void;
export type WaveWarningCallback = (data: {
  waveNumber: number;
  waveType: 'zombie' | 'invader';
  countdown: number;
}) => void;
export type GameOverCallback = (data: {
  result: 'victory' | 'defeat';
  stats: GameStats;
}) => void;
export type EnemyDiedCallback = (data: {
  id: string;
  goldReward: number;
}) => void;
export type BuildingDestroyedCallback = (data: { id: string }) => void;

/**
 * Listens to all server events and maintains a synchronised local state.
 */
export class StateSync {
  private socket: SocketClient;
  private state: LocalGameState;

  private stateCallbacks: StateChangeCallback[] = [];
  private damageCallbacks: DamageCallback[] = [];
  private waveWarningCallbacks: WaveWarningCallback[] = [];
  private gameOverCallbacks: GameOverCallback[] = [];
  private enemyDiedCallbacks: EnemyDiedCallback[] = [];
  private buildingDestroyedCallbacks: BuildingDestroyedCallback[] = [];

  constructor(socket: SocketClient) {
    this.socket = socket;
    this.state = {
      gold: 0,
      castleHp: 1000,
      castleMaxHp: 1000,
      castleUpgrades: [],
      buildings: [],
      enemies: [],
      armyUnits: [],
      castles: [],
      currentZombieWave: 0,
      currentInvaderWave: 0,
      phase: 'lobby',
      timeRemaining: 0,
      players: [],
      localPlayerId: null,
    };

    this.bindEvents();
  }

  // ── Public API ──

  getState(): Readonly<LocalGameState> {
    return this.state;
  }

  setLocalPlayerId(id: string): void {
    this.state.localPlayerId = id;
  }

  onStateChange(cb: StateChangeCallback): void {
    this.stateCallbacks.push(cb);
  }

  onDamage(cb: DamageCallback): void {
    this.damageCallbacks.push(cb);
  }

  onWaveWarning(cb: WaveWarningCallback): void {
    this.waveWarningCallbacks.push(cb);
  }

  onGameOver(cb: GameOverCallback): void {
    this.gameOverCallbacks.push(cb);
  }

  onEnemyDied(cb: EnemyDiedCallback): void {
    this.enemyDiedCallbacks.push(cb);
  }

  onBuildingDestroyed(cb: BuildingDestroyedCallback): void {
    this.buildingDestroyedCallbacks.push(cb);
  }

  // ── Event binding ──

  private bindEvents(): void {
    // Full state sync
    this.socket.on('game_state', (data: GameStateSnapshot) => {
      // Use per-player gold for the local player if available
      if (this.state.localPlayerId && data.playerGold && data.playerGold[this.state.localPlayerId] !== undefined) {
        this.state.gold = data.playerGold[this.state.localPlayerId];
      } else {
        this.state.gold = data.gold;
      }
      // Find local player's castle for backward-compat fields
      if (data.castles && data.castles.length > 0) {
        const myCastle = this.state.localPlayerId
          ? data.castles.find(c => c.playerId === this.state.localPlayerId)
          : data.castles[0];
        if (myCastle) {
          this.state.castleHp = myCastle.hp;
          this.state.castleMaxHp = myCastle.maxHp;
          this.state.castleUpgrades = myCastle.upgrades;
        }
        this.state.castles = data.castles;
      } else {
        this.state.castleHp = data.castle.hp;
        this.state.castleMaxHp = data.castle.maxHp;
        this.state.castleUpgrades = data.castle.upgrades;
      }
      this.state.buildings = data.buildings;
      this.state.enemies = data.enemies;
      this.state.armyUnits = data.armyUnits || [];
      this.state.currentZombieWave = data.currentZombieWave;
      this.state.currentInvaderWave = data.currentInvaderWave;
      this.state.phase = data.phase;
      this.state.timeRemaining = data.timeRemaining;
      this.state.players = data.players;
      this.notify();
    });

    // Room / lobby
    this.socket.on(
      'room_joined',
      (data: { roomCode: string; players: PlayerInfo[]; state: string }) => {
        this.state.players = data.players;
        this.notify();
      },
    );
    this.socket.on('player_joined', (data: PlayerInfo) => {
      if (!this.state.players.find((p) => p.id === data.id)) {
        this.state.players = [...this.state.players, data];
      }
      this.notify();
    });
    this.socket.on('player_left', (data: { playerId: string }) => {
      this.state.players = this.state.players.filter(
        (p) => p.id !== data.playerId,
      );
      this.notify();
    });

    // Preparation / wave phases
    this.socket.on('preparation_start', (data: { duration: number }) => {
      this.state.phase = 'preparation';
      this.state.timeRemaining = data.duration;
      this.notify();
    });
    this.socket.on(
      'wave_start',
      (data: {
        waveNumber: number;
        waveType: 'zombie' | 'invader';
        enemyCount: number;
      }) => {
        this.state.phase = 'wave';
        if (data.waveType === 'zombie') {
          this.state.currentZombieWave = data.waveNumber;
        } else {
          this.state.currentInvaderWave = data.waveNumber;
        }
        this.notify();
      },
    );

    // Timer
    this.socket.on(
      'timer_update',
      (data: { phase: string; timeRemaining: number }) => {
        this.state.phase = data.phase as LocalGameState['phase'];
        this.state.timeRemaining = data.timeRemaining;
        this.notify();
      },
    );

    // Enemies
    this.socket.on('enemy_spawned', (data: EnemySnapshot) => {
      this.state.enemies = [...this.state.enemies, data];
      this.notify();
    });
    this.socket.on('enemy_update', (data: EnemySnapshot[]) => {
      this.state.enemies = data;
      this.notify();
    });
    this.socket.on(
      'enemy_died',
      (data: { id: string; goldReward: number }) => {
        this.state.enemies = this.state.enemies.filter(
          (e) => e.id !== data.id,
        );
        this.enemyDiedCallbacks.forEach((cb) => cb(data));
        this.notify();
      },
    );

    // Buildings
    this.socket.on('building_placed', (data: BuildingSnapshot) => {
      this.state.buildings = [...this.state.buildings, data];
      this.notify();
    });
    this.socket.on('building_destroyed', (data: { id: string }) => {
      this.state.buildings = this.state.buildings.filter(
        (b) => b.id !== data.id,
      );
      this.buildingDestroyedCallbacks.forEach((cb) => cb(data));
      this.notify();
    });
    this.socket.on(
      'building_moved',
      (data: { id: string; gridX: number; gridY: number }) => {
        this.state.buildings = this.state.buildings.map((b) =>
          b.id === data.id ? { ...b, gridX: data.gridX, gridY: data.gridY } : b,
        );
        this.notify();
      },
    );
    this.socket.on(
      'building_sold',
      (data: { id: string; refund: number }) => {
        this.state.buildings = this.state.buildings.filter(
          (b) => b.id !== data.id,
        );
        this.notify();
      },
    );

    // Gold - now per-player: only update if it's our gold
    this.socket.on('gold_updated', (data: { playerId: string; gold: number }) => {
      if (!this.state.localPlayerId || data.playerId === this.state.localPlayerId) {
        this.state.gold = data.gold;
        this.notify();
      }
    });

    // Castle - now per-player
    this.socket.on(
      'castle_updated',
      (data: { playerId: string; hp: number; maxHp: number; upgrades: string[] }) => {
        // Update castles array
        this.state.castles = this.state.castles.map(c =>
          c.playerId === data.playerId
            ? { ...c, hp: data.hp, maxHp: data.maxHp, upgrades: data.upgrades }
            : c,
        );
        // Update local player's castle shorthand
        if (!this.state.localPlayerId || data.playerId === this.state.localPlayerId) {
          this.state.castleHp = data.hp;
          this.state.castleMaxHp = data.maxHp;
          this.state.castleUpgrades = data.upgrades;
        }
        this.notify();
      },
    );

    // Army units
    this.socket.on('army_unit_spawned', (data: ArmyUnitSnapshot) => {
      this.state.armyUnits = [...this.state.armyUnits, data];
      this.notify();
    });
    this.socket.on('army_unit_update', (data: ArmyUnitSnapshot[]) => {
      this.state.armyUnits = data;
      this.notify();
    });
    this.socket.on('army_unit_died', (data: { id: string }) => {
      this.state.armyUnits = this.state.armyUnits.filter(u => u.id !== data.id);
      this.notify();
    });

    // Damage
    this.socket.on('damage_dealt', (data: DamageEvent) => {
      this.damageCallbacks.forEach((cb) => cb(data));
    });

    // Wave warning
    this.socket.on(
      'wave_warning',
      (data: {
        waveNumber: number;
        waveType: 'zombie' | 'invader';
        countdown: number;
      }) => {
        this.waveWarningCallbacks.forEach((cb) => cb(data));
      },
    );

    // Game over
    this.socket.on(
      'game_over',
      (data: { result: 'victory' | 'defeat'; stats: GameStats }) => {
        this.state.phase = 'ended';
        this.gameOverCallbacks.forEach((cb) => cb(data));
        this.notify();
      },
    );

    // Error
    this.socket.on('error', (data: { message: string }) => {
      console.error('[StateSync] Server error:', data.message);
    });
  }

  private notify(): void {
    const snapshot = { ...this.state };
    this.stateCallbacks.forEach((cb) => cb(snapshot));
  }
}
