// ── Enemy Types ──
export enum EnemyType {
  NormalZombie = 'normal_zombie',
  FastZombie = 'fast_zombie',
  HeavyZombie = 'heavy_zombie',
  ZombieBoss = 'zombie_boss',
  Soldier = 'soldier',
  EliteSoldier = 'elite_soldier',
  General = 'general',
}

// ── Building Types ──
export enum BuildingType {
  WoodenWall = 'wooden_wall',
  StoneWall = 'stone_wall',
  BrickWall = 'brick_wall',
  RiverBarrier = 'river_barrier',
  ArrowTower = 'arrow_tower',
  Cannon = 'cannon',
  Ballista = 'ballista',
  ExplosiveMine = 'explosive_mine',
  HotAirBalloon = 'hot_air_balloon',
}

export enum CastleUpgradeType {
  FortifyI = 'fortify_1',
  FortifyII = 'fortify_2',
  Treasury = 'treasury',
  Repair = 'repair',
}

// ── Enemy Stats ──
export interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  goldReward: number;
  special?: string;
}

export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  [EnemyType.NormalZombie]:  { hp: 50, speed: 1.0, damage: 5, goldReward: 5 },
  [EnemyType.FastZombie]:    { hp: 30, speed: 2.0, damage: 4, goldReward: 8 },
  [EnemyType.HeavyZombie]:   { hp: 150, speed: 0.6, damage: 10, goldReward: 12, special: 'wall_breaker' },
  [EnemyType.ZombieBoss]:    { hp: 1000, speed: 0.8, damage: 25, goldReward: 50, special: 'aoe_slam' },
  [EnemyType.Soldier]:       { hp: 80, speed: 1.2, damage: 8, goldReward: 10, special: 'shield' },
  [EnemyType.EliteSoldier]:  { hp: 200, speed: 1.0, damage: 15, goldReward: 20, special: 'rally' },
  [EnemyType.General]:       { hp: 3000, speed: 0.7, damage: 40, goldReward: 200, special: 'charge_warcry' },
};

// ── Building Stats ──
export interface BuildingStats {
  gridWidth: number;
  gridHeight: number;
  hp: number;
  cost: number;
  damage?: number;
  range?: number;
  attackSpeed?: number;
  isWall: boolean;
  isOneTime?: boolean;
  aoeRadius?: number;
  special?: string;
}

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  [BuildingType.WoodenWall]:    { gridWidth: 1, gridHeight: 1, hp: 100, cost: 5, isWall: true },
  [BuildingType.StoneWall]:     { gridWidth: 1, gridHeight: 1, hp: 250, cost: 12, isWall: true },
  [BuildingType.BrickWall]:     { gridWidth: 1, gridHeight: 1, hp: 500, cost: 25, isWall: true },
  [BuildingType.RiverBarrier]:  { gridWidth: 2, gridHeight: 1, hp: 150, cost: 20, isWall: true, special: 'slow_50' },
  [BuildingType.ArrowTower]:    { gridWidth: 2, gridHeight: 1, hp: 200, cost: 25, damage: 8, range: 5, attackSpeed: 1.0, isWall: false },
  [BuildingType.Cannon]:        { gridWidth: 2, gridHeight: 2, hp: 250, cost: 50, damage: 25, range: 6, attackSpeed: 3.0, isWall: false, aoeRadius: 2 },
  [BuildingType.Ballista]:      { gridWidth: 2, gridHeight: 1, hp: 180, cost: 35, damage: 40, range: 8, attackSpeed: 2.5, isWall: false, special: 'pierce_2' },
  [BuildingType.ExplosiveMine]: { gridWidth: 1, gridHeight: 1, hp: 50, cost: 10, damage: 80, range: 0, isWall: false, isOneTime: true, aoeRadius: 1.5 },
  [BuildingType.HotAirBalloon]: { gridWidth: 2, gridHeight: 2, hp: 150, cost: 80, damage: 30, range: 4, attackSpeed: 4.0, isWall: false, aoeRadius: 2, special: 'aerial' },
};

// ── Castle Stats ──
export const CASTLE_CONFIG = {
  baseHp: 1000,
  gridSize: 4,
  upgrades: {
    [CastleUpgradeType.FortifyI]:  { cost: 100, hpBonus: 300 },
    [CastleUpgradeType.FortifyII]: { cost: 200, hpBonus: 500 },
    [CastleUpgradeType.Treasury]:  { cost: 150, goldBonusPerKill: 2 },
    [CastleUpgradeType.Repair]:    { cost: 50, hpRestore: 200 },
  },
};

// ── Economy ──
export const ECONOMY_CONFIG = {
  startingGoldPerPlayer: 500,
  sellRefundPercent: 0.5,
};

// ── Castle Positions ──
export const CASTLE_POSITIONS = [
  { x: 20, y: 20 },  // Player 1 - center
];

// ── Map ──
export const MAP_CONFIG = {
  gridWidth: 40,
  gridHeight: 40,
  castleCenterX: 20,
  castleCenterY: 20,
};

// ── Wave System ──
export const WAVE_CONFIG = {
  preparationTime: 150, // seconds (2:30)
  waveBreakTime: 30,    // seconds
  totalZombieWaves: 15,
  totalInvaderWaves: 5,
  hpScalePerWave: 0.15,
  speedScalePerWave: 0.05,
  spawnCountScale: 2,
};

// ── Wave composition ──
export interface WaveComposition {
  baseCount: number;
  normalPercent: number;
  fastPercent: number;
  heavyPercent: number;
}

export const ZOMBIE_WAVE_COMPOSITIONS: Record<string, WaveComposition> = {
  '1-3':   { baseCount: 8,  normalPercent: 1.0, fastPercent: 0,    heavyPercent: 0 },
  '4-6':   { baseCount: 12, normalPercent: 0.7, fastPercent: 0.3,  heavyPercent: 0 },
  '7-9':   { baseCount: 16, normalPercent: 0.5, fastPercent: 0.3,  heavyPercent: 0.2 },
  '10-12': { baseCount: 20, normalPercent: 0.4, fastPercent: 0.3,  heavyPercent: 0.3 },
  '13-14': { baseCount: 25, normalPercent: 0.3, fastPercent: 0.35, heavyPercent: 0.35 },
  '15':    { baseCount: 30, normalPercent: 0.3, fastPercent: 0.35, heavyPercent: 0.35 },
};

export interface InvaderWaveConfig {
  appearsAfterZombieWave: number;
  soldiers: number;
  elites: number;
  hasGeneral: boolean;
}

export const INVADER_WAVES: InvaderWaveConfig[] = [
  { appearsAfterZombieWave: 3,  soldiers: 6,  elites: 0, hasGeneral: false },
  { appearsAfterZombieWave: 6,  soldiers: 8,  elites: 2, hasGeneral: false },
  { appearsAfterZombieWave: 9,  soldiers: 10, elites: 4, hasGeneral: false },
  { appearsAfterZombieWave: 12, soldiers: 12, elites: 6, hasGeneral: false },
  { appearsAfterZombieWave: 15, soldiers: 15, elites: 8, hasGeneral: true },
];

// ── Boss slam special ──
export const BOSS_SLAM_CONFIG = {
  interval: 10, // seconds
  radius: 3,
  damage: 40,
};

// ── Castle King lightning attack ──
export const CASTLE_KING_CONFIG = {
  damage: 50,
  range: 6,
  attackSpeed: 3.0,
};
