// Simple ID generator (instead of uuid)
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

import {
  BuildingType,
  CastleUpgradeType,
  MAP_CONFIG,
  BUILDING_STATS,
  CASTLE_CONFIG,
  CASTLE_POSITIONS,
  EnemyType,
  EnemyStats,
  WAVE_CONFIG,
  ZOMBIE_WAVE_COMPOSITIONS,
  INVADER_WAVES,
} from '../config/gameConfig';
import { Grid } from '../pathfinding/Grid';
import { Vec2, distance } from '../utils/math';

// ── Local types (mirrored from server) ──
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

export interface DamageEvent {
  targetId: string;
  amount: number;
  remainingHp: number;
  targetType: 'enemy' | 'building' | 'castle';
  sourceId?: string;
  sourceType?: 'building' | 'castle_king';
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

// ── Local Enemy interface ──
interface LocalEnemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  goldReward: number;
  special?: string;
  lastSpecialTime: number;
  path: Vec2[];
  pathIndex: number;
}

// ── Local Building interface ──
interface LocalBuilding {
  id: string;
  type: BuildingType;
  gridX: number;
  gridY: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  stackCount: number;
  stats: typeof BUILDING_STATS[BuildingType];
  lastAttackTime: number;
}

// ── Local Castle interface ──
interface LocalCastle {
  playerId: string;
  hp: number;
  maxHp: number;
  centerX: number;
  centerY: number;
  upgrades: string[];
  lastKingAttackTime: number;
}

// ── Local Army Unit interface ──
interface LocalArmyUnit {
  id: string;
  type: string;
  ownerId: string;
  targetPlayerId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackSpeed: number;
  lastAttackTime: number;
}

// ── Local Game Engine (client-side) ──
export class LocalGameEngine {
  private grid: Grid;
  private players: PlayerInfo[] = [];
  private buildings: Map<string, LocalBuilding> = new Map();
  private enemies: Map<string, LocalEnemy> = new Map();
  private castles: LocalCastle[] = [];
  private armyUnits: Map<string, LocalArmyUnit> = new Map();
  
  // Economy (single player - shared gold)
  private gold: number = 500;
  private totalGoldEarned: number = 0;
  private totalKills: number = 0;
  private totalBuildingsPlaced: number = 0;

  // Game state
  private gameStartTime: number = 0;
  private gameOver: boolean = false;
  private gameResult: 'victory' | 'defeat' | null = null;
  
  // Wave management
  private currentZombieWave: number = 0;
  private currentInvaderWave: number = 0;
  private phase: 'preparation' | 'wave' | 'wave_break' | 'ended' = 'preparation';
  private timeRemaining: number = WAVE_CONFIG.preparationTime;
  private waveTimer: number = 0;
  private enemiesToSpawn: { type: EnemyType; edge: string; delay: number }[] = [];
  private spawnTimer: number = 0;

  // Callbacks
  onDamageDealt: ((data: DamageEvent) => void) | null = null;
  onEnemyDied: ((data: { id: string; goldReward: number }) => void) | null = null;
  onEnemySpawned: ((data: EnemySnapshot) => void) | null = null;
  onBuildingDestroyed: ((data: { id: string }) => void) | null = null;
  onGoldChanged: ((data: { gold: number }) => void) | null = null;
  onCastleUpdated: ((data: { playerId: string; hp: number; maxHp: number; upgrades: string[] }) => void) | null = null;
  onWaveWarning: ((data: { waveNumber: number; waveType: 'zombie' | 'invader'; countdown: number }) => void) | null = null;
  onWaveStart: ((data: { waveNumber: number; waveType: 'zombie' | 'invader'; enemyCount: number }) => void) | null = null;
  onGameOver: ((data: { result: 'victory' | 'defeat'; stats: GameStats }) => void) | null = null;
  onStateChanged: (() => void) | null = null;

  constructor() {
    this.grid = new Grid();
  }

  init(username: string = 'Player'): void {
    // Single player setup
    const playerId = 'local_player';
    this.players = [{ id: playerId, username }];
    
    // Initialize grid with single castle
    this.grid = new Grid();
    this.grid.initCastles([CASTLE_POSITIONS[0]]);
    
    // Initialize castle
    this.castles = [{
      playerId,
      hp: CASTLE_CONFIG.baseHp,
      maxHp: CASTLE_CONFIG.baseHp,
      centerX: CASTLE_POSITIONS[0].x,
      centerY: CASTLE_POSITIONS[0].y,
      upgrades: [],
      lastKingAttackTime: 0,
    }];

    // Starting gold
    this.gold = 500;
    this.totalGoldEarned = 500;

    // Game state
    this.gameStartTime = Date.now();
    this.gameOver = false;
    this.gameResult = null;
    this.currentZombieWave = 0;
    this.currentInvaderWave = 0;
    this.phase = 'preparation';
    this.timeRemaining = WAVE_CONFIG.preparationTime;
    this.waveTimer = 0;
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;

    // Clear existing entities
    this.buildings.clear();
    this.enemies.clear();
    this.armyUnits.clear();
    this.totalKills = 0;
    this.totalBuildingsPlaced = 0;

    this.notifyStateChanged();
  }

  /**
   * Main game tick. deltaTime is in seconds.
   */
  tick(deltaTime: number): void {
    if (this.gameOver) return;

    this.waveTimer += deltaTime;

    // Phase management
    if (this.phase === 'preparation') {
      this.timeRemaining -= deltaTime;
      if (this.timeRemaining <= 0) {
        this.startNextWave();
      }
    } else if (this.phase === 'wave' || this.phase === 'wave_break') {
      this.timeRemaining -= deltaTime;
      
      if (this.phase === 'wave_break' && this.timeRemaining <= 0) {
        // Break over, start next wave
        this.currentZombieWave++;
        this.startZombieWave();
      }
    }

    // Spawn enemies
    if (this.phase === 'wave' && this.enemiesToSpawn.length > 0) {
      this.spawnTimer -= deltaTime;
      while (this.spawnTimer <= 0 && this.enemiesToSpawn.length > 0) {
        const spawn = this.enemiesToSpawn.shift()!;
        this.spawnEnemy(spawn.type, spawn.edge as any);
        // Set next spawn delay (0.5s between spawns)
        this.spawnTimer = 0.5;
      }
    }

    // Enemy movement
    const reachedCastle: LocalEnemy[] = [];
    for (const enemy of this.enemies.values()) {
      this.updateEnemyMovement(enemy);
      
      // Check if reached castle
      const castle = this.castles[0];
      const distToCastle = distance({ x: enemy.x, y: enemy.y }, { x: castle.centerX, y: castle.centerY });
      if (distToCastle < 2) {
        reachedCastle.push(enemy);
      }
    }

    // Combat: buildings attack enemies
    this.updateCombat(deltaTime);

    // Castle king attacks
    this.updateCastleKingAttacks();

    // Enemy specials (boss slams, etc.)
    this.updateEnemySpecials(deltaTime);

    // Enemies reaching castle
    for (const enemy of reachedCastle) {
      const castle = this.castles[0];
      this.damageCastle(castle, enemy.damage);
      this.enemies.delete(enemy.id);
    }

    // Check defeat
    if (this.castles[0].hp <= 0) {
      this.endGame('defeat');
      return;
    }

    // Check victory (all waves complete, no enemies)
    if (this.currentZombieWave >= WAVE_CONFIG.totalZombieWaves && 
        this.enemies.size === 0 && 
        this.phase === 'wave') {
      this.endGame('victory');
      return;
    }

    this.notifyStateChanged();
  }

  private startNextWave(): void {
    // Determine what type of wave to start
    const nextZombieWave = this.currentZombieWave + 1;
    const nextInvaderWave = this.currentInvaderWave + 1;
    
    // Check if invader wave should happen
    const invaderWaveConfig: typeof INVADER_WAVES[0] | undefined = INVADER_WAVES.find((w) => w.appearsAfterZombieWave === nextZombieWave);
    
    if (invaderWaveConfig) {
      // Start invader wave
      this.currentInvaderWave = nextInvaderWave;
      this.startInvaderWave(invaderWaveConfig);
    } else {
      // Start zombie wave
      this.currentZombieWave = nextZombieWave;
      this.startZombieWave();
    }
  }

  private startZombieWave(): void {
    const waveNum = this.currentZombieWave;
    const compositionKey = waveNum >= 13 ? '13-14' : waveNum >= 10 ? '10-12' : waveNum >= 7 ? '7-9' : waveNum >= 4 ? '4-6' : '1-3';
    const composition = ZOMBIE_WAVE_COMPOSITIONS[compositionKey];
    
    // Calculate actual counts with scaling
    const baseCount = composition.baseCount + (waveNum - 1) * WAVE_CONFIG.spawnCountScale;
    
    // Generate spawn queue
    this.enemiesToSpawn = [];
    const normalCount = Math.floor(baseCount * composition.normalPercent);
    const fastCount = Math.floor(baseCount * composition.fastPercent);
    const heavyCount = baseCount - normalCount - fastCount;
    
    const edges: string[] = ['north', 'south', 'east', 'west'];
    
    // Add normal zombies
    for (let i = 0; i < normalCount; i++) {
      this.enemiesToSpawn.push({ type: EnemyType.NormalZombie, edge: edges[i % 4], delay: i * 0.5 });
    }
    // Add fast zombies
    for (let i = 0; i < fastCount; i++) {
      this.enemiesToSpawn.push({ type: EnemyType.FastZombie, edge: edges[i % 4], delay: (normalCount + i) * 0.5 });
    }
    // Add heavy zombies
    for (let i = 0; i < heavyCount; i++) {
      this.enemiesToSpawn.push({ type: EnemyType.HeavyZombie, edge: edges[i % 4], delay: (normalCount + fastCount + i) * 0.5 });
    }
    
    // Boss wave special
    if (waveNum === 15) {
      // Add 4 bosses, one from each edge
      edges.forEach((edge, i) => {
        this.enemiesToSpawn.push({ type: EnemyType.ZombieBoss, edge, delay: (baseCount + i) * 0.5 });
      });
    }

    // Set wave phase
    this.phase = 'wave';
    this.timeRemaining = 120; // 2 minutes per wave
    
    // Emit wave start
    if (this.onWaveStart) {
      this.onWaveStart({ waveNumber: waveNum, waveType: 'zombie', enemyCount: this.enemiesToSpawn.length });
    }
  }

  private startInvaderWave(config: typeof INVADER_WAVES[0]): void {
    this.enemiesToSpawn = [];
    const edges: string[] = ['north', 'south', 'east', 'west'];
    
    // Add soldiers
    for (let i = 0; i < config.soldiers; i++) {
      this.enemiesToSpawn.push({ type: EnemyType.Soldier, edge: edges[i % 4], delay: i * 0.5 });
    }
    // Add elites
    for (let i = 0; i < config.elites; i++) {
      this.enemiesToSpawn.push({ type: EnemyType.EliteSoldier, edge: edges[i % 4], delay: ((config.soldiers) + i) * 0.5 });
    }
    // Add General if applicable
    if (config.hasGeneral) {
      this.enemiesToSpawn.push({ type: EnemyType.General, edge: 'north', delay: ((config.soldiers + config.elites) * 0.5) });
    }

    this.phase = 'wave';
    this.timeRemaining = 120;
    
    if (this.onWaveStart) {
      this.onWaveStart({ waveNumber: this.currentInvaderWave, waveType: 'invader', enemyCount: this.enemiesToSpawn.length });
    }
  }

  private spawnEnemy(type: EnemyType, edge: string): void {
    const stats = this.getEnemyStats(type);
    
    // Spawn position based on edge
    let x = 0, y = 0;
    switch (edge) {
      case 'north': x = MAP_CONFIG.gridWidth / 2; y = MAP_CONFIG.gridHeight - 1; break;
      case 'south': x = MAP_CONFIG.gridWidth / 2; y = 1; break;
      case 'east': x = MAP_CONFIG.gridWidth - 1; y = MAP_CONFIG.gridHeight / 2; break;
      case 'west': x = 1; y = MAP_CONFIG.gridHeight / 2; break;
    }

    // Scale stats by wave
    const hpMultiplier = 1.0 + (this.currentZombieWave - 1) * WAVE_CONFIG.hpScalePerWave;
    const speedMultiplier = 1.0 + (this.currentZombieWave - 1) * WAVE_CONFIG.speedScalePerWave;

    const enemy: LocalEnemy = {
      id: generateId(),
      type,
      x,
      y,
      hp: Math.floor(stats.hp * hpMultiplier),
      maxHp: Math.floor(stats.hp * hpMultiplier),
      speed: stats.speed * speedMultiplier,
      damage: stats.damage,
      goldReward: stats.goldReward,
      special: stats.special,
      lastSpecialTime: 0,
      path: [],
      pathIndex: 0,
    };

    // Calculate path to castle
    const castle = this.castles[0];
    enemy.path = this.calculatePath(x, y, castle.centerX, castle.centerY);
    enemy.pathIndex = 0;

    this.enemies.set(enemy.id, enemy);

    if (this.onEnemySpawned) {
      this.onEnemySpawned({
        id: enemy.id,
        type: enemy.type,
        x: enemy.x,
        y: enemy.y,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        speed: enemy.speed,
      });
    }
  }

  private getEnemyStats(type: EnemyType): EnemyStats {
    const statsMap: Record<EnemyType, EnemyStats> = {
      [EnemyType.NormalZombie]: { hp: 50, speed: 1.0, damage: 5, goldReward: 5 },
      [EnemyType.FastZombie]: { hp: 30, speed: 2.0, damage: 4, goldReward: 8 },
      [EnemyType.HeavyZombie]: { hp: 150, speed: 0.6, damage: 10, goldReward: 12, special: 'wall_breaker' },
      [EnemyType.ZombieBoss]: { hp: 1000, speed: 0.8, damage: 25, goldReward: 50, special: 'aoe_slam' },
      [EnemyType.Soldier]: { hp: 80, speed: 1.2, damage: 8, goldReward: 10, special: 'shield' },
      [EnemyType.EliteSoldier]: { hp: 200, speed: 1.0, damage: 15, goldReward: 20, special: 'rally' },
      [EnemyType.General]: { hp: 3000, speed: 0.7, damage: 40, goldReward: 200, special: 'charge_warcry' },
    };
    return statsMap[type];
  }

  private calculatePath(startX: number, startY: number, endX: number, endY: number): Vec2[] {
    // Simple A* pathfinding
    return this.grid.findPath(startX, startY, endX, endY);
  }

  private updateEnemyMovement(enemy: LocalEnemy): void {
    if (enemy.path.length === 0) return;
    
    // Move towards next path point
    const target = enemy.path[enemy.pathIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.1) {
      enemy.pathIndex++;
      if (enemy.pathIndex >= enemy.path.length) {
        enemy.path = [];
      }
    } else {
      // Move towards target
      enemy.x += (dx / dist) * enemy.speed * 0.016; // Approximate for 60fps
      enemy.y += (dy / dist) * enemy.speed * 0.016;
    }
  }

  private updateCombat(deltaTime: number): void {
    const now = Date.now() / 1000;

    // Buildings attack enemies
    for (const building of this.buildings.values()) {
      const stats = building.stats;
      if (!stats.damage) continue;
      
      // Mines handled separately
      if (stats.isOneTime) continue;
      
      // Check cooldown
      if (stats.attackSpeed && now - building.lastAttackTime < stats.attackSpeed) continue;
      
      // Find enemies in range
      const bCenterX = building.gridX + stats.gridWidth / 2;
      const bCenterY = building.gridY + stats.gridHeight / 2;
      const range = stats.range || 0;
      
      const enemiesInRange = this.getEnemiesInRange(bCenterX, bCenterY, range);
      if (enemiesInRange.length === 0) continue;
      
      building.lastAttackTime = now;
      
      // Handle different building types
      switch (building.type) {
        case BuildingType.ArrowTower:
          this.handleArrowTowerAttack(building, enemiesInRange);
          break;
        case BuildingType.Cannon:
          this.handleCannonAttack(building, bCenterX, bCenterY, enemiesInRange);
          break;
        case BuildingType.Ballista:
          this.handleBallistaAttack(building, bCenterX, bCenterY, enemiesInRange);
          break;
        case BuildingType.HotAirBalloon:
          this.handleBalloonAttack(building, bCenterX, bCenterY, enemiesInRange);
          break;
      }
    }

    // Handle mines
    for (const building of this.buildings.values()) {
      if (building.type === BuildingType.ExplosiveMine) {
        this.handleMine(building);
      }
    }

    // Enemies attack buildings
    for (const enemy of this.enemies.values()) {
      const nearbyBuildings = this.getBuildingsInRange(enemy.x, enemy.y, 1.5);
      for (const building of nearbyBuildings) {
        if (!building.stats.isWall) continue;
        
        let damage = enemy.damage * deltaTime;
        if (enemy.special === 'wall_breaker') damage *= 2;
        
        this.damageBuilding(building.id, damage);
      }
    }
  }

  private handleArrowTowerAttack(building: LocalBuilding, enemies: LocalEnemy[]): void {
    const bCenterX = building.gridX + building.stats.gridWidth / 2;
    const bCenterY = building.gridY + building.stats.gridHeight / 2;
    
    // Find closest enemy
    let closest: LocalEnemy | null = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
      const d = distance({ x: bCenterX, y: bCenterY }, { x: enemy.x, y: enemy.y });
      if (d < closestDist) {
        closestDist = d;
        closest = enemy;
      }
    }
    
    if (!closest) return;
    
    this.damageEnemy(closest.id, building.stats.damage!, building.id);
  }

  private handleCannonAttack(building: LocalBuilding, bx: number, by: number, enemies: LocalEnemy[]): void {
    // Find closest as AoE target
    let closest: LocalEnemy | null = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
      const d = distance({ x: bx, y: by }, { x: enemy.x, y: enemy.y });
      if (d < closestDist) {
        closestDist = d;
        closest = enemy;
      }
    }
    
    if (!closest) return;
    
    const aoeRadius = building.stats.aoeRadius || 2;
    const aoeTargets = this.getEnemiesInRange(closest.x, closest.y, aoeRadius);
    
    for (const target of aoeTargets) {
      this.damageEnemy(target.id, building.stats.damage!, building.id);
    }
  }

  private handleBallistaAttack(building: LocalBuilding, bx: number, by: number, enemies: LocalEnemy[]): void {
    // Find closest
    let closest: LocalEnemy | null = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
      const d = distance({ x: bx, y: by }, { x: enemy.x, y: enemy.y });
      if (d < closestDist) {
        closestDist = d;
        closest = enemy;
      }
    }
    
    if (!closest) return;
    
    // Calculate direction
    const dx = closest.x - bx;
    const dy = closest.y - by;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    
    const ndx = dx / len;
    const ndy = dy / len;
    
    // Find enemies along the line
    const alongLine: { enemy: LocalEnemy; projDist: number }[] = [];
    for (const enemy of enemies) {
      const ex = enemy.x - bx;
      const ey = enemy.y - by;
      const projDist = ex * ndx + ey * ndy;
      if (projDist < 0) continue;
      
      const perpDist = Math.abs(ex * (-ndy) + ey * ndx);
      if (perpDist <= 1.0) {
        alongLine.push({ enemy, projDist });
      }
    }
    
    alongLine.sort((a, b) => a.projDist - b.projDist);
    
    // Pierce 2 enemies
    for (const { enemy } of alongLine.slice(0, 2)) {
      this.damageEnemy(enemy.id, building.stats.damage!, building.id);
    }
  }

  private handleBalloonAttack(building: LocalBuilding, bx: number, by: number, enemies: LocalEnemy[]): void {
    let closest: LocalEnemy | null = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
      const d = distance({ x: bx, y: by }, { x: enemy.x, y: enemy.y });
      if (d < closestDist) {
        closestDist = d;
        closest = enemy;
      }
    }
    
    if (!closest) return;
    
    const aoeRadius = building.stats.aoeRadius || 2;
    const targets = this.getEnemiesInRange(closest.x, closest.y, aoeRadius);
    
    for (const target of targets) {
      this.damageEnemy(target.id, building.stats.damage!, building.id);
    }
  }

  private handleMine(building: LocalBuilding): void {
    const bCenterX = building.gridX + building.stats.gridWidth / 2;
    const bCenterY = building.gridY + building.stats.gridHeight / 2;
    
    const nearby = this.getEnemiesInRange(bCenterX, bCenterY, 0.8);
    if (nearby.length === 0) return;
    
    const aoeRadius = building.stats.aoeRadius || 1.5;
    const targets = this.getEnemiesInRange(bCenterX, bCenterY, aoeRadius);
    
    for (const target of targets) {
      this.damageEnemy(target.id, building.stats.damage!, building.id);
    }
    
    // Destroy mine
    this.buildings.delete(building.id);
    if (this.onBuildingDestroyed) {
      this.onBuildingDestroyed({ id: building.id });
    }
  }

  private updateCastleKingAttacks(): void {
    const now = Date.now() / 1000;
    const CASTLE_KING_CONFIG = { damage: 50, range: 6, attackSpeed: 3.0 };
    
    for (const castle of this.castles) {
      if (castle.hp <= 0) continue;
      if (now - castle.lastKingAttackTime < CASTLE_KING_CONFIG.attackSpeed) continue;
      
      const enemiesInRange = this.getEnemiesInRange(castle.centerX, castle.centerY, CASTLE_KING_CONFIG.range);
      if (enemiesInRange.length === 0) continue;
      
      // Target closest
      let closest: LocalEnemy | null = null;
      let closestDist = Infinity;
      for (const enemy of enemiesInRange) {
        const d = distance({ x: castle.centerX, y: castle.centerY }, { x: enemy.x, y: enemy.y });
        if (d < closestDist) {
          closestDist = d;
          closest = enemy;
        }
      }
      
      if (!closest) continue;
      
      castle.lastKingAttackTime = now;
      this.damageEnemy(closest.id, CASTLE_KING_CONFIG.damage, `castle_${castle.playerId}`, 'castle_king');
    }
  }

  private updateEnemySpecials(deltaTime: number): void {
    const now = Date.now() / 1000;
    const BOSS_SLAM_CONFIG = { interval: 10, radius: 3, damage: 40 };
    
    for (const enemy of this.enemies.values()) {
      if (enemy.special === 'aoe_slam') {
        if (now - enemy.lastSpecialTime < BOSS_SLAM_CONFIG.interval) continue;
        
        enemy.lastSpecialTime = now;
        
        // Damage buildings in range
        const buildingsInRange = this.getBuildingsInRange(enemy.x, enemy.y, BOSS_SLAM_CONFIG.radius);
        for (const building of buildingsInRange) {
          this.damageBuilding(building.id, BOSS_SLAM_CONFIG.damage);
        }
      }
    }
  }

  private damageEnemy(id: string, damage: number, sourceId?: string, sourceType?: 'building' | 'castle_king'): void {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    
    enemy.hp -= damage;
    
    if (this.onDamageDealt) {
      this.onDamageDealt({
        targetId: id,
        amount: damage,
        remainingHp: enemy.hp,
        targetType: 'enemy',
        sourceId,
        sourceType,
      });
    }
    
    if (enemy.hp <= 0) {
      this.enemies.delete(id);
      this.totalKills++;
      this.gold += enemy.goldReward;
      this.totalGoldEarned += enemy.goldReward;
      
      if (this.onEnemyDied) {
        this.onEnemyDied({ id, goldReward: enemy.goldReward });
      }
      if (this.onGoldChanged) {
        this.onGoldChanged({ gold: this.gold });
      }
    }
  }

  private damageBuilding(id: string, damage: number): void {
    const building = this.buildings.get(id);
    if (!building) return;
    
    building.hp -= damage;
    
    if (this.onDamageDealt) {
      this.onDamageDealt({
        targetId: id,
        amount: damage,
        remainingHp: building.hp,
        targetType: 'building',
        sourceId: 'enemy',
      });
    }
    
    if (building.hp <= 0) {
      this.buildings.delete(id);
      if (this.onBuildingDestroyed) {
        this.onBuildingDestroyed({ id });
      }
    }
  }

  private damageCastle(castle: LocalCastle, damage: number): void {
    castle.hp -= damage;
    
    if (this.onDamageDealt) {
      this.onDamageDealt({
        targetId: `castle_${castle.playerId}`,
        amount: damage,
        remainingHp: castle.hp,
        targetType: 'castle',
      });
    }
    
    if (this.onCastleUpdated) {
      this.onCastleUpdated({
        playerId: castle.playerId,
        hp: castle.hp,
        maxHp: castle.maxHp,
        upgrades: castle.upgrades,
      });
    }
  }

  private getEnemiesInRange(x: number, y: number, range: number): LocalEnemy[] {
    const result: LocalEnemy[] = [];
    for (const enemy of this.enemies.values()) {
      if (distance({ x, y }, { x: enemy.x, y: enemy.y }) <= range) {
        result.push(enemy);
      }
    }
    return result;
  }

  private getBuildingsInRange(x: number, y: number, range: number): LocalBuilding[] {
    const result: LocalBuilding[] = [];
    for (const building of this.buildings.values()) {
      const bx = building.gridX + building.stats.gridWidth / 2;
      const by = building.gridY + building.stats.gridHeight / 2;
      if (distance({ x, y }, { x: bx, y: by }) <= range) {
        result.push(building);
      }
    }
    return result;
  }

  private endGame(result: 'victory' | 'defeat'): void {
    this.gameOver = true;
    this.gameResult = result;
    this.phase = 'ended';
    
    const stats: GameStats = {
      waveReached: this.currentZombieWave,
      totalKills: this.totalKills,
      totalGoldEarned: this.totalGoldEarned,
      totalBuildingsPlaced: this.totalBuildingsPlaced,
      duration: (Date.now() - this.gameStartTime) / 1000,
    };
    
    if (this.onGameOver) {
      this.onGameOver({ result, stats });
    }
    
    this.notifyStateChanged();
  }

  private notifyStateChanged(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  // ─── Public API ───

  getGold(): number {
    return this.gold;
  }

  setGold(gold: number): void {
    this.gold = gold;
  }

  handlePlaceBuilding(
    type: string,
    gridX: number,
    gridY: number,
    ownerId: string,
  ): { success: boolean; building?: BuildingSnapshot; error?: string } {
    const buildingType = type as BuildingType;
    const stats = BUILDING_STATS[buildingType];
    if (!stats) {
      return { success: false, error: 'Unknown building type' };
    }

    if (this.gold < stats.cost) {
      return { success: false, error: 'Not enough gold' };
    }

    // Check if placement is valid
    if (!this.grid.canPlace(gridX, gridY, stats.gridWidth, stats.gridHeight)) {
      return { success: false, error: 'Cannot place here' };
    }

    // Create building
    const id = generateId();
    const building: LocalBuilding = {
      id,
      type: buildingType,
      gridX,
      gridY,
      hp: stats.hp,
      maxHp: stats.hp,
      ownerId,
      stackCount: 1,
      stats,
      lastAttackTime: 0,
    };

    this.buildings.set(id, building);
    this.grid.placeBuilding(gridX, gridY, stats.gridWidth, stats.gridHeight);
    this.gold -= stats.cost;
    this.totalBuildingsPlaced++;

    if (this.onGoldChanged) {
      this.onGoldChanged({ gold: this.gold });
    }

    return {
      success: true,
      building: {
        id: building.id,
        type: building.type,
        gridX: building.gridX,
        gridY: building.gridY,
        hp: building.hp,
        maxHp: building.maxHp,
        ownerId: building.ownerId,
        stackCount: building.stackCount,
      },
    };
  }

  handleSellBuilding(buildingId: string, sellerId: string): { success: boolean; refund?: number; error?: string } {
    const building = this.buildings.get(buildingId);
    if (!building) {
      return { success: false, error: 'Building not found' };
    }

    if (building.ownerId !== sellerId) {
      return { success: false, error: 'You can only sell your own buildings' };
    }

    // Refund 50%
    const refund = Math.floor(building.stats.cost * 0.5);
    this.gold += refund;
    
    // Remove building
    this.buildings.delete(buildingId);
    this.grid.removeBuilding(buildingId);

    if (this.onGoldChanged) {
      this.onGoldChanged({ gold: this.gold });
    }

    return { success: true, refund };
  }

  handleUpgradeCastle(upgradeType: string, playerId: string): { success: boolean; error?: string } {
    const type = upgradeType as CastleUpgradeType;
    const config = CASTLE_CONFIG.upgrades[type];
    if (!config) {
      return { success: false, error: 'Unknown upgrade type' };
    }

    if (this.gold < config.cost) {
      return { success: false, error: 'Not enough gold' };
    }

    const castle = this.castles.find(c => c.playerId === playerId);
    if (!castle) {
      return { success: false, error: 'Castle not found' };
    }

    this.gold -= config.cost;

    switch (type) {
      case CastleUpgradeType.FortifyI:
        {
          const config = CASTLE_CONFIG.upgrades[CastleUpgradeType.FortifyI];
          castle.maxHp += config.hpBonus;
          castle.hp += config.hpBonus;
        }
        break;
      case CastleUpgradeType.FortifyII:
        {
          const config = CASTLE_CONFIG.upgrades[CastleUpgradeType.FortifyII];
          castle.maxHp += config.hpBonus;
          castle.hp += config.hpBonus;
        }
        break;
      case CastleUpgradeType.Treasury:
        // Gold bonus per kill handled elsewhere
        break;
      case CastleUpgradeType.Repair:
        {
          const config = CASTLE_CONFIG.upgrades[CastleUpgradeType.Repair];
          castle.hp = Math.min(castle.hp + config.hpRestore, castle.maxHp);
        }
        break;
    }

    castle.upgrades.push(type);

    if (this.onGoldChanged) {
      this.onGoldChanged({ gold: this.gold });
    }
    if (this.onCastleUpdated) {
      this.onCastleUpdated({
        playerId: castle.playerId,
        hp: castle.hp,
        maxHp: castle.maxHp,
        upgrades: castle.upgrades,
      });
    }

    return { success: true };
  }

  getFullState(): GameStateSnapshot {
    const castle = this.castles[0];
    
    return {
      gold: this.gold,
      castle: {
        hp: castle.hp,
        maxHp: castle.maxHp,
        upgrades: castle.upgrades,
      },
      playerGold: { [this.players[0].id]: this.gold },
      castles: this.castles.map(c => ({
        playerId: c.playerId,
        hp: c.hp,
        maxHp: c.maxHp,
        centerX: c.centerX,
        centerY: c.centerY,
        upgrades: c.upgrades,
      })),
      armyUnits: Array.from(this.armyUnits.values()).map(u => ({
        id: u.id,
        type: u.type,
        ownerId: u.ownerId,
        targetPlayerId: u.targetPlayerId,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
      })),
      buildings: Array.from(this.buildings.values()).map(b => ({
        id: b.id,
        type: b.type,
        gridX: b.gridX,
        gridY: b.gridY,
        hp: b.hp,
        maxHp: b.maxHp,
        ownerId: b.ownerId,
        stackCount: b.stackCount,
      })),
      enemies: Array.from(this.enemies.values()).map(e => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        speed: e.speed,
      })),
      currentZombieWave: this.currentZombieWave,
      currentInvaderWave: this.currentInvaderWave,
      phase: this.phase,
      timeRemaining: this.timeRemaining,
      players: this.players,
    };
  }

  getState(): {
    gold: number;
    castleHp: number;
    castleMaxHp: number;
    castleUpgrades: string[];
    buildings: BuildingSnapshot[];
    enemies: EnemySnapshot[];
    castles: CastleSnapshot[];
    armyUnits: ArmyUnitSnapshot[];
    currentZombieWave: number;
    currentInvaderWave: number;
    phase: 'lobby' | 'preparation' | 'wave' | 'wave_break' | 'ended';
    timeRemaining: number;
    players: PlayerInfo[];
    localPlayerId: string | null;
  } {
    const castle = this.castles[0];
    return {
      gold: this.gold,
      castleHp: castle?.hp ?? 0,
      castleMaxHp: castle?.maxHp ?? 0,
      castleUpgrades: castle?.upgrades ?? [],
      buildings: Array.from(this.buildings.values()).map(b => ({
        id: b.id,
        type: b.type,
        gridX: b.gridX,
        gridY: b.gridY,
        hp: b.hp,
        maxHp: b.maxHp,
        ownerId: b.ownerId,
        stackCount: b.stackCount,
      })),
      enemies: Array.from(this.enemies.values()).map(e => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        speed: e.speed,
      })),
      castles: this.castles.map(c => ({
        playerId: c.playerId,
        hp: c.hp,
        maxHp: c.maxHp,
        centerX: c.centerX,
        centerY: c.centerY,
        upgrades: c.upgrades,
      })),
      armyUnits: [],
      currentZombieWave: this.currentZombieWave,
      currentInvaderWave: this.currentInvaderWave,
      phase: this.phase as any,
      timeRemaining: this.timeRemaining,
      players: this.players,
      localPlayerId: this.players[0]?.id ?? null,
    };
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getGameResult(): 'victory' | 'defeat' | null {
    return this.gameResult;
  }
}
