import {
  BuildingType,
  CastleUpgradeType,
  MAP_CONFIG,
  BUILDING_STATS,
  CASTLE_CONFIG,
  CASTLE_POSITIONS,
  EnemyType,
  ArmyUnitType,
  ARMY_UNIT_STATS,
} from '../config/gameConfig';
import {
  GameStateSnapshot,
  GameStats,
  PlayerInfo,
  EnemySnapshot,
  BuildingSnapshot,
  ArmyUnitSnapshot,
} from '../socket/events';
import { Grid } from '../pathfinding/Grid';
import { EconomyManager } from './EconomyManager';
import { CastleManager } from './CastleManager';
import { BuildingManager } from './BuildingManager';
import { EnemyManager, SpawnEdge } from './EnemyManager';
import { WaveManager } from './WaveManager';
import { CombatManager, DamageEvent } from './CombatManager';
import { ArmyManager } from './ArmyManager';

export class GameEngine {
  private grid: Grid;
  private economyManager: EconomyManager;
  private castleManager: CastleManager;
  private buildingManager: BuildingManager;
  private enemyManager: EnemyManager;
  private waveManager: WaveManager;
  private combatManager: CombatManager;
  private armyManager: ArmyManager;

  private players: PlayerInfo[] = [];
  private gameStartTime: number = 0;
  private gameOver: boolean = false;
  private gameResult: 'victory' | 'defeat' | null = null;

  // ─── Event Callbacks ───
  onDamageDealt: ((data: {
    targetId: string;
    amount: number;
    remainingHp: number;
    targetType: 'enemy' | 'building' | 'castle';
  }) => void) | null = null;

  onEnemyDied: ((data: { id: string; goldReward: number; rewardPlayerId?: string }) => void) | null = null;
  onEnemySpawned: ((data: EnemySnapshot) => void) | null = null;
  onBuildingDestroyed: ((data: { id: string }) => void) | null = null;
  onGoldChanged: ((data: { playerId: string; gold: number }) => void) | null = null;
  onCastleUpdated: ((data: { playerId: string; hp: number; maxHp: number; upgrades: string[] }) => void) | null = null;

  onWaveWarning: ((data: {
    waveNumber: number;
    waveType: 'zombie' | 'invader';
    countdown: number;
  }) => void) | null = null;

  onWaveStart: ((data: {
    waveNumber: number;
    waveType: 'zombie' | 'invader';
    enemyCount: number;
  }) => void) | null = null;

  onGameOver: ((data: {
    result: 'victory' | 'defeat';
    stats: GameStats;
  }) => void) | null = null;

  onArmyUnitSpawned: ((data: ArmyUnitSnapshot) => void) | null = null;
  onArmyUnitDied: ((data: { id: string }) => void) | null = null;

  constructor() {
    this.grid = new Grid();
    this.economyManager = new EconomyManager();
    this.castleManager = new CastleManager();
    this.buildingManager = new BuildingManager();
    this.enemyManager = new EnemyManager();
    this.waveManager = new WaveManager();
    this.combatManager = new CombatManager();
    this.armyManager = new ArmyManager();
  }

  /**
   * Initialize the game engine.
   * Accepts either a player count (number) or a PlayerInfo array.
   */
  init(playersOrCount: number | PlayerInfo[]): void {
    let playerCount: number;
    if (typeof playersOrCount === 'number') {
      playerCount = playersOrCount;
      this.players = [];
      // Create dummy player IDs for backward compat
      const playerIds: string[] = [];
      for (let i = 0; i < playerCount; i++) {
        playerIds.push(`player_${i}`);
      }
      this.initWithPlayerIds(playerIds);
    } else {
      playerCount = playersOrCount.length;
      this.players = playersOrCount;
      const playerIds = playersOrCount.map(p => p.id);
      this.initWithPlayerIds(playerIds);
    }
  }

  private initWithPlayerIds(playerIds: string[]): void {
    // Determine castle positions for this game
    const castlePositions = playerIds.map((_, i) => CASTLE_POSITIONS[i] || CASTLE_POSITIONS[0]);

    // Initialize grid with multiple castles
    this.grid = new Grid();
    this.grid.initCastles(castlePositions);

    // Initialize managers
    this.economyManager.init(playerIds);
    this.castleManager.initMultiple(playerIds);
    this.buildingManager.init();
    this.enemyManager.init();
    this.waveManager.init();
    this.combatManager.init();
    this.armyManager.init();

    this.gameStartTime = Date.now();
    this.gameOver = false;
    this.gameResult = null;

    // Wire up WaveManager callbacks
    this.waveManager.onWaveWarning = (waveNumber, waveType, countdown) => {
      if (this.onWaveWarning) {
        this.onWaveWarning({ waveNumber, waveType, countdown });
      }
    };

    this.waveManager.onWaveStart = (waveNumber, waveType, enemyCount) => {
      if (this.onWaveStart) {
        this.onWaveStart({ waveNumber, waveType, enemyCount });
      }
    };

    this.waveManager.onEnemySpawn = (type: EnemyType, edge: SpawnEdge, waveNumber: number) => {
      const enemy = this.enemyManager.spawnEnemy(type, edge, this.grid, waveNumber);
      if (enemy && this.onEnemySpawned) {
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
    };
  }

  /**
   * Main game tick. deltaTime is in seconds.
   */
  tick(deltaTime: number): void {
    if (this.gameOver) return;

    // 1. Wave manager -- spawns enemies via callbacks
    this.waveManager.update(deltaTime, this.enemyManager.getCount());

    // 2. Enemy movement -- enemies path to nearest castle
    // Find nearest alive castle center for each enemy to target
    const allCastles = this.castleManager.getAllCastles().filter(c => c.hp > 0);
    // Use first alive castle center as default target for movement
    const defaultCastle = allCastles.length > 0 ? allCastles[0] : null;
    const castleX = defaultCastle ? defaultCastle.centerX : MAP_CONFIG.castleCenterX;
    const castleY = defaultCastle ? defaultCastle.centerY : MAP_CONFIG.castleCenterY;

    const reachedCastle = this.enemyManager.updateEnemies(deltaTime, this.grid, castleX, castleY);

    // 3. Combat -- buildings attack enemies, enemies attack buildings, castle damage
    const combatResult = this.combatManager.update(
      this.buildingManager,
      this.enemyManager,
      this.castleManager,
      this.grid,
      deltaTime,
      reachedCastle,
      this.armyManager,
    );

    // Process kills -- add gold to the building OWNER
    for (const kill of combatResult.kills) {
      const ownerId = kill.killedByBuildingOwnerId;
      if (ownerId) {
        // Gold goes to the building owner
        const goldBonus = this.castleManager.getGoldBonusPerKill(ownerId);
        const totalGold = kill.goldReward + goldBonus;
        this.economyManager.addGold(ownerId, totalGold);

        if (this.onEnemyDied) {
          this.onEnemyDied({ id: kill.enemyId, goldReward: totalGold, rewardPlayerId: ownerId });
        }
        if (this.onGoldChanged) {
          this.onGoldChanged({ playerId: ownerId, gold: this.economyManager.getGold(ownerId) });
        }
      } else {
        // No owner found -- distribute to all players
        const goldBonus = this.castleManager.getGoldBonusPerKill();
        const totalGold = kill.goldReward + goldBonus;
        this.economyManager.addGoldAll(totalGold);

        if (this.onEnemyDied) {
          this.onEnemyDied({ id: kill.enemyId, goldReward: totalGold });
        }
        // Notify all players of gold change
        for (const player of this.players) {
          if (this.onGoldChanged) {
            this.onGoldChanged({ playerId: player.id, gold: this.economyManager.getGold(player.id) });
          }
        }
      }
    }

    // Emit damage events
    for (const event of combatResult.damageEvents) {
      if (this.onDamageDealt) {
        this.onDamageDealt(event);
      }
    }

    // Emit building destroyed events
    for (const buildingId of combatResult.destroyedBuildings) {
      if (this.onBuildingDestroyed) {
        this.onBuildingDestroyed({ id: buildingId });
      }
    }

    // Emit castle updated if damage was taken
    for (const [playerId, dmg] of combatResult.castleDamage) {
      if (dmg > 0 && this.onCastleUpdated) {
        const cs = this.castleManager.getPlayerSnapshot(playerId);
        if (cs) {
          this.onCastleUpdated({ playerId: cs.playerId, hp: cs.hp, maxHp: cs.maxHp, upgrades: cs.upgrades });
        }
      }
    }

    // 4. Check ALL castles destroyed -- game over defeat
    if (this.castleManager.isAllDestroyed()) {
      this.endGame('defeat');
      return;
    }

    // 5. Check victory: all waves complete + no enemies alive
    if (
      this.waveManager.isAllWavesComplete() &&
      this.waveManager.getPhase() === 'ended' &&
      this.enemyManager.getCount() === 0
    ) {
      this.endGame('victory');
      return;
    }
  }

  private endGame(result: 'victory' | 'defeat'): void {
    this.gameOver = true;
    this.gameResult = result;

    const stats = this.getGameStats();
    if (this.onGameOver) {
      this.onGameOver({ result, stats });
    }
  }

  getGameStats(): GameStats {
    return {
      waveReached: this.waveManager.getCurrentZombieWave(),
      totalKills: this.enemyManager.getTotalKills(),
      totalGoldEarned: this.economyManager.getTotalGoldEarned(),
      totalBuildingsPlaced: this.buildingManager.getTotalBuildingsPlaced(),
      duration: (Date.now() - this.gameStartTime) / 1000,
    };
  }

  getFullState(): GameStateSnapshot {
    const waveState = this.waveManager.getCurrentState();
    const castleSnapshots = this.castleManager.getSnapshot();

    // Backward compat: use first castle for the old single-castle fields
    const firstCastle = castleSnapshots.length > 0 ? castleSnapshots[0] : null;

    let phase: 'preparation' | 'wave' | 'wave_break' | 'ended';
    switch (waveState.phase) {
      case 'preparation':
        phase = 'preparation';
        break;
      case 'wave_active':
        phase = 'wave';
        break;
      case 'wave_break':
        phase = 'wave_break';
        break;
      case 'ended':
        phase = 'ended';
        break;
    }

    // Build per-player gold record
    const playerGold: Record<string, number> = {};
    for (const [id, g] of this.economyManager.getAllPlayerGold()) {
      playerGold[id] = g;
    }

    return {
      // Backward compat fields
      gold: this.economyManager.getTotalGold(),
      castle: {
        hp: firstCastle?.hp ?? 0,
        maxHp: firstCastle?.maxHp ?? 0,
        upgrades: firstCastle?.upgrades ?? [],
      },
      // Per-player data
      playerGold,
      castles: castleSnapshots.map(cs => ({
        playerId: cs.playerId,
        hp: cs.hp,
        maxHp: cs.maxHp,
        centerX: cs.centerX,
        centerY: cs.centerY,
        upgrades: cs.upgrades,
      })),
      armyUnits: this.armyManager.getSnapshot(),
      // Shared data
      buildings: this.buildingManager.getSnapshot(),
      enemies: this.enemyManager.getSnapshot(),
      currentZombieWave: waveState.currentZombieWave,
      currentInvaderWave: waveState.currentInvaderWave,
      phase,
      timeRemaining: waveState.timeRemaining,
      players: this.players,
    };
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getGameResult(): 'victory' | 'defeat' | null {
    return this.gameResult;
  }

  // ─── Player Action Handlers ───

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

    // Check PLAYER's gold (not shared pool)
    if (this.economyManager.getGold(ownerId) < stats.cost) {
      return { success: false, error: 'Not enough gold' };
    }

    const result = this.buildingManager.placeBuilding(
      buildingType,
      gridX,
      gridY,
      ownerId,
      this.grid,
      this.economyManager.getGold(ownerId),
    );

    if (!result.building) {
      return { success: false, error: result.reason };
    }

    // Deduct from PLAYER's gold
    this.economyManager.spendGold(ownerId, stats.cost);

    if (this.onGoldChanged) {
      this.onGoldChanged({ playerId: ownerId, gold: this.economyManager.getGold(ownerId) });
    }

    const snapshot: BuildingSnapshot = {
      id: result.building.id,
      type: result.building.type,
      gridX: result.building.gridX,
      gridY: result.building.gridY,
      hp: result.building.hp,
      maxHp: result.building.maxHp,
      ownerId: result.building.ownerId,
      stackCount: result.building.stackCount,
    };

    return { success: true, building: snapshot };
  }

  handleSellBuilding(buildingId: string, sellerId: string): { success: boolean; refund?: number; error?: string } {
    const building = this.buildingManager.getBuilding(buildingId);
    if (!building) {
      return { success: false, error: 'Building not found' };
    }

    // Only the owner can sell their building
    if (building.ownerId !== sellerId) {
      return { success: false, error: 'You can only sell your own buildings' };
    }

    const result = this.buildingManager.sellBuilding(buildingId, this.grid);
    if (!result.building) {
      return { success: false, error: 'Building not found' };
    }

    // Refund goes to the SELLER (owner)
    this.economyManager.addGold(sellerId, result.refund);

    if (this.onGoldChanged) {
      this.onGoldChanged({ playerId: sellerId, gold: this.economyManager.getGold(sellerId) });
    }

    return { success: true, refund: result.refund };
  }

  handleMoveBuilding(
    buildingId: string,
    newGridX: number,
    newGridY: number,
  ): { success: boolean; error?: string } {
    const result = this.buildingManager.moveBuilding(buildingId, newGridX, newGridY, this.grid);
    return { success: result.success, error: result.reason };
  }

  handleUpgradeCastle(upgradeType: string, playerId: string): { success: boolean; error?: string } {
    const type = upgradeType as CastleUpgradeType;
    const cfg = CASTLE_CONFIG.upgrades[type];
    if (!cfg) {
      return { success: false, error: 'Unknown upgrade type' };
    }

    // Check PLAYER's gold
    if (!this.economyManager.spendGold(playerId, cfg.cost)) {
      return { success: false, error: 'Not enough gold' };
    }

    const result = this.castleManager.upgrade(playerId, type);
    if (!result.success) {
      // Refund gold since upgrade failed
      this.economyManager.addGold(playerId, cfg.cost);
      return { success: false, error: result.reason };
    }

    // Update economy manager if treasury was purchased
    if (type === CastleUpgradeType.Treasury) {
      this.economyManager.setGoldBonusPerKill(this.castleManager.getGoldBonusPerKill(playerId));
    }

    if (this.onGoldChanged) {
      this.onGoldChanged({ playerId, gold: this.economyManager.getGold(playerId) });
    }

    if (this.onCastleUpdated) {
      const cs = this.castleManager.getPlayerSnapshot(playerId);
      if (cs) {
        this.onCastleUpdated({ playerId: cs.playerId, hp: cs.hp, maxHp: cs.maxHp, upgrades: cs.upgrades });
      }
    }

    return { success: true };
  }

  handleRepairCastle(playerId: string): { success: boolean; error?: string } {
    return this.handleUpgradeCastle(CastleUpgradeType.Repair, playerId);
  }

  /**
   * Handle spawning an army unit to attack another player's castle.
   */
  handleSpawnArmy(
    unitType: string,
    ownerId: string,
    targetPlayerId: string,
  ): { success: boolean; unit?: ArmyUnitSnapshot; error?: string } {
    const type = unitType as ArmyUnitType;
    const stats = ARMY_UNIT_STATS[type];
    if (!stats) {
      return { success: false, error: 'Unknown army unit type' };
    }

    // Cannot target yourself
    if (ownerId === targetPlayerId) {
      return { success: false, error: 'Cannot attack your own castle' };
    }

    // Target castle must exist and not be destroyed
    const targetCastle = this.castleManager.getCastle(targetPlayerId);
    if (!targetCastle || targetCastle.hp <= 0) {
      return { success: false, error: 'Target castle not found or already destroyed' };
    }

    // Check and spend gold
    if (!this.economyManager.spendGold(ownerId, stats.cost)) {
      return { success: false, error: 'Not enough gold' };
    }

    // Spawn near owner's castle
    const ownerCastle = this.castleManager.getCastle(ownerId);
    if (!ownerCastle) {
      // Refund
      this.economyManager.addGold(ownerId, stats.cost);
      return { success: false, error: 'Your castle not found' };
    }

    const unit = this.armyManager.spawnUnit(
      type,
      ownerId,
      ownerCastle.centerX,
      ownerCastle.centerY,
      targetCastle.centerX,
      targetCastle.centerY,
      this.grid,
    );

    if (!unit) {
      // Refund
      this.economyManager.addGold(ownerId, stats.cost);
      return { success: false, error: 'Failed to spawn unit (no valid position)' };
    }

    // Set the target player ID on the unit
    unit.targetPlayerId = targetPlayerId;

    if (this.onGoldChanged) {
      this.onGoldChanged({ playerId: ownerId, gold: this.economyManager.getGold(ownerId) });
    }

    const snapshot: ArmyUnitSnapshot = {
      id: unit.id,
      type: unit.type,
      ownerId: unit.ownerId,
      targetPlayerId: unit.targetPlayerId,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
    };

    if (this.onArmyUnitSpawned) {
      this.onArmyUnitSpawned(snapshot);
    }

    return { success: true, unit: snapshot };
  }

  // ─── Accessors for socket handler ───

  getGrid(): Grid {
    return this.grid;
  }

  getEconomyManager(): EconomyManager {
    return this.economyManager;
  }

  getCastleManager(): CastleManager {
    return this.castleManager;
  }

  getBuildingManager(): BuildingManager {
    return this.buildingManager;
  }

  getEnemyManager(): EnemyManager {
    return this.enemyManager;
  }

  getWaveManager(): WaveManager {
    return this.waveManager;
  }

  getArmyManager(): ArmyManager {
    return this.armyManager;
  }
}
