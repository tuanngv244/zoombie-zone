// Socket.io event type definitions

// ── Client → Server Events ──
export interface ClientToServerEvents {
  join_room: (data: { roomCode: string; username: string }) => void;
  create_room: (data: { username: string }) => void;
  start_game: () => void;
  place_building: (data: { type: string; gridX: number; gridY: number }) => void;
  move_building: (data: { buildingId: string; gridX: number; gridY: number }) => void;
  sell_building: (data: { buildingId: string }) => void;
  upgrade_castle: (data: { upgradeType: string }) => void;
  repair_castle: () => void;
  spawn_army: (data: { unitType: string; targetPlayerId: string }) => void;
}

// ── Server → Client Events ──
export interface ServerToClientEvents {
  room_joined: (data: { roomCode: string; players: PlayerInfo[]; state: string }) => void;
  room_created: (data: { roomCode: string }) => void;
  player_joined: (data: PlayerInfo) => void;
  player_left: (data: { playerId: string }) => void;
  game_state: (data: GameStateSnapshot) => void;
  preparation_start: (data: { duration: number }) => void;
  wave_warning: (data: { waveNumber: number; waveType: 'zombie' | 'invader'; countdown: number }) => void;
  wave_start: (data: { waveNumber: number; waveType: 'zombie' | 'invader'; enemyCount: number }) => void;
  enemy_spawned: (data: EnemySnapshot) => void;
  enemy_update: (data: EnemySnapshot[]) => void;
  enemy_died: (data: { id: string; goldReward: number }) => void;
  building_placed: (data: BuildingSnapshot) => void;
  building_destroyed: (data: { id: string }) => void;
  building_moved: (data: { id: string; gridX: number; gridY: number }) => void;
  building_sold: (data: { id: string; refund: number }) => void;
  damage_dealt: (data: { targetId: string; amount: number; remainingHp: number; targetType: 'enemy' | 'building' | 'castle' }) => void;
  gold_updated: (data: { playerId: string; gold: number }) => void;
  castle_updated: (data: { playerId: string; hp: number; maxHp: number; upgrades: string[] }) => void;
  castle_upgrade_applied: (data: { upgradeType: string }) => void;
  game_over: (data: { result: 'victory' | 'defeat'; stats: GameStats }) => void;
  error: (data: { message: string }) => void;
  timer_update: (data: { phase: string; timeRemaining: number }) => void;
  army_unit_spawned: (data: ArmyUnitSnapshot) => void;
  army_unit_update: (data: ArmyUnitSnapshot[]) => void;
  army_unit_died: (data: { id: string }) => void;
}

// ── Shared Types ──
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
  // Backward compat fields (set to requesting player's values or first player)
  gold: number;
  castle: {
    hp: number;
    maxHp: number;
    upgrades: string[];
  };
  // Per-player data
  playerGold: Record<string, number>;
  castles: Array<{
    playerId: string;
    hp: number;
    maxHp: number;
    centerX: number;
    centerY: number;
    upgrades: string[];
  }>;
  armyUnits: ArmyUnitSnapshot[];
  // Shared data
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
