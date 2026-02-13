// ── Server connection ──
export const SERVER_URL: string =
  (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:3000';

// ── Color palette ──
export const COLORS = {
  // Backgrounds / ground
  ground: 0x1a1a1a,
  groundAlt: 0x222222,
  fogColor: 0x0a0a0a,
  ambientLight: 0x5a4220,
  moonLight: 0xccddff,
  // UI
  gold: 0xd4a857,
  goldBright: 0xffd700,
  panelBg: 'rgba(20, 10, 5, 0.85)',
  panelBorder: '#6b4226',
  hpGreen: '#3daa3d',
  hpRed: '#cc3333',
  textPrimary: '#d4a857',
  textSecondary: '#a88c5e',
  // Grid
  gridLine: 0xcc8844,
  gridHoverValid: 0x33aa33,
  gridHoverInvalid: 0xcc3333,
  castleZone: 0x4a3728,
  // Castle
  castleStone: 0x4a3728,
  castleTrim: 0x6b5540,
  castleRoof: 0x2a1810,
} as const;

// ── Grid ──
export const GRID = {
  width: 40,
  height: 40,
  castleSize: 4,
  castleCenterX: 20,
  castleCenterY: 20,
} as const;

// Castle origin (bottom-left corner of 4x4 block)
export const CASTLE_ORIGIN = {
  x: GRID.castleCenterX - GRID.castleSize / 2,
  y: GRID.castleCenterY - GRID.castleSize / 2,
} as const;

// ── Building definitions ──
export interface BuildingDef {
  type: string;
  name: string;
  cost: number;
  gridWidth: number;
  gridHeight: number;
  description: string;
  color: number;
  isWall: boolean;
}

export const BUILDING_DEFS: BuildingDef[] = [
  {
    type: 'wooden_wall',
    name: 'Wooden Wall',
    cost: 5,
    gridWidth: 1,
    gridHeight: 1,
    description: 'Cheap wooden barricade. HP: 100',
    color: 0x8b6914,
    isWall: true,
  },
  {
    type: 'stone_wall',
    name: 'Stone Wall',
    cost: 12,
    gridWidth: 1,
    gridHeight: 1,
    description: 'Sturdy stone wall. HP: 250',
    color: 0x808080,
    isWall: true,
  },
  {
    type: 'brick_wall',
    name: 'Brick Wall',
    cost: 25,
    gridWidth: 1,
    gridHeight: 1,
    description: 'Fortified brick wall. HP: 500',
    color: 0x8b4513,
    isWall: true,
  },
  {
    type: 'river_barrier',
    name: 'River Barrier',
    cost: 20,
    gridWidth: 2,
    gridHeight: 1,
    description: 'Water barrier, slows enemies 50%. HP: 150',
    color: 0x4488aa,
    isWall: true,
  },
  {
    type: 'arrow_tower',
    name: 'Arrow Tower',
    cost: 25,
    gridWidth: 2,
    gridHeight: 1,
    description: 'Fires arrows. DMG: 8, Range: 5',
    color: 0x6b4226,
    isWall: false,
  },
  {
    type: 'cannon',
    name: 'Cannon',
    cost: 50,
    gridWidth: 2,
    gridHeight: 2,
    description: 'AOE cannonfire. DMG: 25, Range: 6',
    color: 0x3a3a3a,
    isWall: false,
  },
  {
    type: 'ballista',
    name: 'Ballista',
    cost: 35,
    gridWidth: 2,
    gridHeight: 1,
    description: 'Piercing bolt. DMG: 40, Range: 8',
    color: 0x5a4020,
    isWall: false,
  },
  {
    type: 'explosive_mine',
    name: 'Explosive Mine',
    cost: 10,
    gridWidth: 1,
    gridHeight: 1,
    description: 'One-time explosion. DMG: 80, AOE: 1.5',
    color: 0x444444,
    isWall: false,
  },
  {
    type: 'hot_air_balloon',
    name: 'Hot Air Balloon',
    cost: 80,
    gridWidth: 2,
    gridHeight: 2,
    description: 'Aerial bomber. DMG: 30, Range: 4',
    color: 0xcc6633,
    isWall: false,
  },
];

export function getBuildingDef(type: string): BuildingDef | undefined {
  return BUILDING_DEFS.find((b) => b.type === type);
}

// ── Army unit definitions ──
export interface ArmyUnitDef {
  type: string;
  name: string;
  cost: number;
  description: string;
  color: number;
}

export const ARMY_UNIT_DEFS: ArmyUnitDef[] = [
  { type: 'swordsman', name: 'Swordsman', cost: 30, description: 'Melee infantry. DMG: 8', color: 0x4488cc },
  { type: 'army_archer', name: 'Archer', cost: 40, description: 'Ranged unit. DMG: 12, Range: 6', color: 0x44aa44 },
  { type: 'mage', name: 'Mage', cost: 60, description: 'AoE magic. DMG: 20, Range: 5', color: 0x8844cc },
  { type: 'knight', name: 'Knight', cost: 80, description: 'Heavy cavalry. DMG: 15', color: 0xccaa44 },
  { type: 'commander', name: 'Commander', cost: 120, description: 'Buffs allies. DMG: 25', color: 0xcc4444 },
];

// ── Enemy colors ──
export const ENEMY_COLORS: Record<string, number> = {
  normal_zombie: 0x556b2f,
  fast_zombie: 0x6b8e23,
  heavy_zombie: 0x3b3b2f,
  zombie_boss: 0x2f4f2f,
  soldier: 0x808080,
  elite_soldier: 0xb8860b,
  general: 0x8b0000,
};

// ── Wave totals ──
export const TOTAL_ZOMBIE_WAVES = 15;
export const TOTAL_INVADER_WAVES = 5;
