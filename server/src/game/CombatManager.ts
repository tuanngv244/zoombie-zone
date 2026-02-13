import {
  BuildingType,
  BOSS_SLAM_CONFIG,
  GENERAL_CONFIG,
  CASTLE_KING_CONFIG,
} from '../config/gameConfig';
import { distance } from '../utils/math';
import { Building, BuildingManager } from './BuildingManager';
import { Enemy, EnemyManager } from './EnemyManager';
import { CastleManager } from './CastleManager';
import { ArmyManager, ArmyUnit } from './ArmyManager';
import { Grid } from '../pathfinding/Grid';

export interface DamageEvent {
  targetId: string;
  amount: number;
  remainingHp: number;
  targetType: 'enemy' | 'building' | 'castle';
  sourceId?: string;
  sourceType?: 'building' | 'castle_king';
}

export interface KillInfo {
  enemyId: string;
  goldReward: number;
  killedByBuildingOwnerId?: string; // player who owns the building that killed
}

export interface CombatResult {
  kills: KillInfo[];
  damageEvents: DamageEvent[];
  destroyedBuildings: string[];
  castleDamage: Map<string, number>; // playerId -> damage taken
}

export class CombatManager {
  private elapsedTime: number = 0;

  init(): void {
    this.elapsedTime = 0;
  }

  /**
   * Main combat update. deltaTime is in seconds.
   * Now supports multiple castles via CastleManager per-player system.
   */
  update(
    buildingManager: BuildingManager,
    enemyManager: EnemyManager,
    castleManager: CastleManager,
    grid: Grid,
    deltaTime: number,
    reachedCastle: Enemy[],
    armyManager?: ArmyManager,
  ): CombatResult {
    this.elapsedTime += deltaTime;
    const now = this.elapsedTime;

    const kills: KillInfo[] = [];
    const damageEvents: DamageEvent[] = [];
    const destroyedBuildings: string[] = [];
    const castleDamage: Map<string, number> = new Map();

    const buildings = buildingManager.getAllBuildings();
    const enemies = enemyManager.getAllEnemies();

    // ─── Buildings attack enemies ───
    for (const building of buildings) {
      const stats = building.stats;

      // Only offensive buildings (those with damage and range > 0, or mines)
      if (!stats.damage) continue;

      // Mines are triggered differently
      if (stats.isOneTime) {
        this.handleMine(building, buildingManager, enemyManager, kills, damageEvents, destroyedBuildings, grid, building.ownerId);
        continue;
      }

      // Check attack cooldown
      if (!stats.attackSpeed) continue;
      if (now - building.lastAttackTime < stats.attackSpeed) continue;

      const bCenterX = building.gridX + stats.gridWidth / 2;
      const bCenterY = building.gridY + stats.gridHeight / 2;
      const range = stats.range || 0;

      const enemiesInRange = enemyManager.getInRange(bCenterX, bCenterY, range);
      if (enemiesInRange.length === 0) continue;

      building.lastAttackTime = now;

      switch (building.type) {
        case BuildingType.ArrowTower:
          this.handleArrowTower(building, enemiesInRange, enemyManager, kills, damageEvents);
          break;
        case BuildingType.Cannon:
          this.handleCannon(building, bCenterX, bCenterY, enemiesInRange, enemyManager, kills, damageEvents);
          break;
        case BuildingType.Ballista:
          this.handleBallista(building, bCenterX, bCenterY, enemiesInRange, enemyManager, kills, damageEvents);
          break;
        case BuildingType.HotAirBalloon:
          this.handleHotAirBalloon(building, bCenterX, bCenterY, enemiesInRange, enemyManager, kills, damageEvents);
          break;
      }
    }

    // ─── Castle King lightning attack ───
    for (const castle of castleManager.getAllCastles()) {
      if (castle.hp <= 0) continue;
      if (now - castle.lastKingAttackTime < CASTLE_KING_CONFIG.attackSpeed) continue;

      const enemiesInRange = enemyManager.getInRange(
        castle.centerX,
        castle.centerY,
        CASTLE_KING_CONFIG.range,
      );
      if (enemiesInRange.length === 0) continue;

      // Target closest enemy
      let closest: Enemy | null = null;
      let closestDist = Infinity;
      for (const e of enemiesInRange) {
        const d = distance(
          { x: castle.centerX, y: castle.centerY },
          { x: e.x, y: e.y },
        );
        if (d < closestDist) {
          closestDist = d;
          closest = e;
        }
      }
      if (!closest) continue;

      castle.lastKingAttackTime = now;

      const dmg = CASTLE_KING_CONFIG.damage;
      const result = enemyManager.takeDamage(closest.id, dmg);
      const remaining = result.killed ? 0 : (enemyManager.getEnemy(closest.id)?.hp ?? 0);
      damageEvents.push({
        targetId: closest.id,
        amount: dmg,
        remainingHp: remaining,
        targetType: 'enemy',
        sourceId: castle.playerId,
        sourceType: 'castle_king',
      });
      if (result.killed) {
        kills.push({ enemyId: closest.id, goldReward: result.goldReward, killedByBuildingOwnerId: castle.playerId });
      }
    }

    // ─── Enemy specials ───
    for (const enemy of enemies) {
      if (!enemy.special) continue;

      switch (enemy.special) {
        case 'aoe_slam':
          this.handleBossSlam(enemy, buildingManager, castleManager, now, damageEvents, destroyedBuildings, grid, castleDamage);
          break;
        case 'charge_warcry':
          this.handleGeneralWarCry(enemy, enemyManager, now);
          break;
      }
    }

    // ─── Enemies that reached the castle deal damage ───
    for (const enemy of reachedCastle) {
      // Find nearest castle for this enemy to damage
      const nearestCastle = castleManager.getNearestCastle(enemy.x, enemy.y);
      if (nearestCastle) {
        castleManager.takeDamage(nearestCastle.playerId, enemy.damage);
        const prevDmg = castleDamage.get(nearestCastle.playerId) || 0;
        castleDamage.set(nearestCastle.playerId, prevDmg + enemy.damage);
        damageEvents.push({
          targetId: `castle_${nearestCastle.playerId}`,
          amount: enemy.damage,
          remainingHp: castleManager.getHp(nearestCastle.playerId),
          targetType: 'castle',
        });
      }
      // Remove enemy after hitting castle
      enemyManager.removeEnemy(enemy.id);
    }

    // ─── Enemies attack buildings blocking their path ───
    for (const enemy of enemyManager.getAllEnemies()) {
      const wallsInRange = buildingManager.getInRange(enemy.x, enemy.y, 1.5);
      for (const wall of wallsInRange) {
        if (!wall.stats.isWall) continue;

        // Heavy zombie does 2x damage to walls
        let dmg = enemy.damage;
        if (enemy.special === 'wall_breaker') {
          dmg *= 2;
        }

        const result = buildingManager.takeDamage(wall.id, dmg * deltaTime);
        if (result.building) {
          damageEvents.push({
            targetId: wall.id,
            amount: dmg * deltaTime,
            remainingHp: result.building.hp,
            targetType: 'building',
          });
          if (result.destroyed) {
            destroyedBuildings.push(wall.id);
            buildingManager.removeBuilding(wall.id, grid);
          }
        }
      }
    }

    // ─── Army units attack target castles ───
    if (armyManager) {
      const armyUnitsAtTarget = armyManager.updateUnits(deltaTime, grid);
      for (const unit of armyUnitsAtTarget) {
        if (unit.targetPlayerId) {
          const targetCastle = castleManager.getCastle(unit.targetPlayerId);
          if (targetCastle && targetCastle.hp > 0) {
            // Check attack cooldown
            if (now - unit.lastAttackTime >= unit.attackSpeed) {
              unit.lastAttackTime = now;
              castleManager.takeDamage(unit.targetPlayerId, unit.damage);
              const prevDmg = castleDamage.get(unit.targetPlayerId) || 0;
              castleDamage.set(unit.targetPlayerId, prevDmg + unit.damage);
              damageEvents.push({
                targetId: `castle_${unit.targetPlayerId}`,
                amount: unit.damage,
                remainingHp: castleManager.getHp(unit.targetPlayerId),
                targetType: 'castle',
              });
            }
          }
        }
      }
    }

    return { kills, damageEvents, destroyedBuildings, castleDamage };
  }

  // ─── Arrow Tower: single target, closest enemy ───
  private handleArrowTower(
    building: Building,
    enemiesInRange: Enemy[],
    enemyManager: EnemyManager,
    kills: KillInfo[],
    damageEvents: DamageEvent[],
  ): void {
    const bCenterX = building.gridX + building.stats.gridWidth / 2;
    const bCenterY = building.gridY + building.stats.gridHeight / 2;

    // Find closest
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of enemiesInRange) {
      const d = distance({ x: bCenterX, y: bCenterY }, { x: e.x, y: e.y });
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) return;

    const dmg = building.stats.damage!;
    const result = enemyManager.takeDamage(closest.id, dmg);
    const remaining = result.killed ? 0 : (enemyManager.getEnemy(closest.id)?.hp ?? 0);
    damageEvents.push({
      targetId: closest.id,
      amount: dmg,
      remainingHp: remaining,
      targetType: 'enemy',
      sourceId: building.id,
      sourceType: 'building',
    });
    if (result.killed) {
      kills.push({ enemyId: closest.id, goldReward: result.goldReward, killedByBuildingOwnerId: building.ownerId });
    }
  }

  // ─── Cannon: AoE, 25 dmg to all in 2-tile radius ───
  private handleCannon(
    building: Building,
    bCenterX: number,
    bCenterY: number,
    enemiesInRange: Enemy[],
    enemyManager: EnemyManager,
    kills: KillInfo[],
    damageEvents: DamageEvent[],
  ): void {
    // Find closest enemy as the AoE target center
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of enemiesInRange) {
      const d = distance({ x: bCenterX, y: bCenterY }, { x: e.x, y: e.y });
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) return;

    const aoeRadius = building.stats.aoeRadius || 2;
    const dmg = building.stats.damage!;

    // All enemies within AoE radius of the target
    const aoeTargets = enemyManager.getInRange(closest.x, closest.y, aoeRadius);
    for (const target of aoeTargets) {
      const result = enemyManager.takeDamage(target.id, dmg);
      const remaining = result.killed ? 0 : (enemyManager.getEnemy(target.id)?.hp ?? 0);
      damageEvents.push({
        targetId: target.id,
        amount: dmg,
        remainingHp: remaining,
        targetType: 'enemy',
        sourceId: building.id,
        sourceType: 'building',
      });
      if (result.killed) {
        kills.push({ enemyId: target.id, goldReward: result.goldReward, killedByBuildingOwnerId: building.ownerId });
      }
    }
  }

  // ─── Ballista: single target, pierce 2 enemies in a line ───
  private handleBallista(
    building: Building,
    bCenterX: number,
    bCenterY: number,
    enemiesInRange: Enemy[],
    enemyManager: EnemyManager,
    kills: KillInfo[],
    damageEvents: DamageEvent[],
  ): void {
    // Find closest enemy
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of enemiesInRange) {
      const d = distance({ x: bCenterX, y: bCenterY }, { x: e.x, y: e.y });
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) return;

    const dmg = building.stats.damage!;

    // Direction from tower to closest enemy
    const dirX = closest.x - bCenterX;
    const dirY = closest.y - bCenterY;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen === 0) return;
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;

    // Pierce: hit up to 2 enemies that are roughly along the line
    const enemiesAlongLine: { enemy: Enemy; projDist: number }[] = [];
    for (const e of enemiesInRange) {
      const ex = e.x - bCenterX;
      const ey = e.y - bCenterY;
      const projDist = ex * ndx + ey * ndy;
      if (projDist < 0) continue;

      const perpDist = Math.abs(ex * (-ndy) + ey * ndx);
      if (perpDist <= 1.0) {
        enemiesAlongLine.push({ enemy: e, projDist });
      }
    }

    enemiesAlongLine.sort((a, b) => a.projDist - b.projDist);

    const maxPierce = 2;
    const toPierce = enemiesAlongLine.slice(0, maxPierce);

    for (const { enemy } of toPierce) {
      const result = enemyManager.takeDamage(enemy.id, dmg);
      const remaining = result.killed ? 0 : (enemyManager.getEnemy(enemy.id)?.hp ?? 0);
      damageEvents.push({
        targetId: enemy.id,
        amount: dmg,
        remainingHp: remaining,
        targetType: 'enemy',
        sourceId: building.id,
        sourceType: 'building',
      });
      if (result.killed) {
        kills.push({ enemyId: enemy.id, goldReward: result.goldReward, killedByBuildingOwnerId: building.ownerId });
      }
    }
  }

  // ─── Hot Air Balloon: AoE bombs, 30 dmg in 2-tile radius ───
  private handleHotAirBalloon(
    building: Building,
    bCenterX: number,
    bCenterY: number,
    enemiesInRange: Enemy[],
    enemyManager: EnemyManager,
    kills: KillInfo[],
    damageEvents: DamageEvent[],
  ): void {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of enemiesInRange) {
      const d = distance({ x: bCenterX, y: bCenterY }, { x: e.x, y: e.y });
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) return;

    const aoeRadius = building.stats.aoeRadius || 2;
    const dmg = building.stats.damage!;

    const aoeTargets = enemyManager.getInRange(closest.x, closest.y, aoeRadius);
    for (const target of aoeTargets) {
      const result = enemyManager.takeDamage(target.id, dmg);
      const remaining = result.killed ? 0 : (enemyManager.getEnemy(target.id)?.hp ?? 0);
      damageEvents.push({
        targetId: target.id,
        amount: dmg,
        remainingHp: remaining,
        targetType: 'enemy',
        sourceId: building.id,
        sourceType: 'building',
      });
      if (result.killed) {
        kills.push({ enemyId: target.id, goldReward: result.goldReward, killedByBuildingOwnerId: building.ownerId });
      }
    }
  }

  // ─── Explosive Mine: triggers when enemy walks over, one-time ───
  private handleMine(
    building: Building,
    buildingManager: BuildingManager,
    enemyManager: EnemyManager,
    kills: KillInfo[],
    damageEvents: DamageEvent[],
    destroyedBuildings: string[],
    grid: Grid,
    buildingOwnerId: string,
  ): void {
    const bCenterX = building.gridX + building.stats.gridWidth / 2;
    const bCenterY = building.gridY + building.stats.gridHeight / 2;

    // Check if any enemy is on top of the mine (within 0.8 tile)
    const nearbyEnemies = enemyManager.getInRange(bCenterX, bCenterY, 0.8);
    if (nearbyEnemies.length === 0) return;

    // Mine triggered -- deal AoE damage
    const aoeRadius = building.stats.aoeRadius || 1.5;
    const dmg = building.stats.damage!;

    const aoeTargets = enemyManager.getInRange(bCenterX, bCenterY, aoeRadius);
    for (const target of aoeTargets) {
      const result = enemyManager.takeDamage(target.id, dmg);
      const remaining = result.killed ? 0 : (enemyManager.getEnemy(target.id)?.hp ?? 0);
      damageEvents.push({
        targetId: target.id,
        amount: dmg,
        remainingHp: remaining,
        targetType: 'enemy',
        sourceId: building.id,
        sourceType: 'building',
      });
      if (result.killed) {
        kills.push({ enemyId: target.id, goldReward: result.goldReward, killedByBuildingOwnerId: buildingOwnerId });
      }
    }

    // Destroy the mine
    destroyedBuildings.push(building.id);
    buildingManager.removeBuilding(building.id, grid);
  }

  // ─── Boss AoE Slam every 10s ───
  private handleBossSlam(
    enemy: Enemy,
    buildingManager: BuildingManager,
    castleManager: CastleManager,
    now: number,
    damageEvents: DamageEvent[],
    destroyedBuildings: string[],
    grid: Grid,
    castleDamage: Map<string, number>,
  ): void {
    const intervalSec = BOSS_SLAM_CONFIG.interval / 1000;
    if (now - enemy.lastSpecialTime < intervalSec) return;

    enemy.lastSpecialTime = now;

    const slamRadius = BOSS_SLAM_CONFIG.radius;
    const slamDamage = BOSS_SLAM_CONFIG.damage;

    // Damage buildings in range
    const buildingsHit = buildingManager.getInRange(enemy.x, enemy.y, slamRadius);
    for (const b of buildingsHit) {
      const result = buildingManager.takeDamage(b.id, slamDamage);
      if (result.building) {
        damageEvents.push({
          targetId: b.id,
          amount: slamDamage,
          remainingHp: result.building.hp,
          targetType: 'building',
        });
        if (result.destroyed) {
          destroyedBuildings.push(b.id);
          buildingManager.removeBuilding(b.id, grid);
        }
      }
    }

    // Damage all castles in range
    for (const castle of castleManager.getAllCastles()) {
      if (castle.hp <= 0) continue;
      const distToCastle = distance(
        { x: enemy.x, y: enemy.y },
        { x: castle.centerX, y: castle.centerY },
      );
      if (distToCastle <= slamRadius) {
        castleManager.takeDamage(castle.playerId, slamDamage);
        const prevDmg = castleDamage.get(castle.playerId) || 0;
        castleDamage.set(castle.playerId, prevDmg + slamDamage);
        damageEvents.push({
          targetId: `castle_${castle.playerId}`,
          amount: slamDamage,
          remainingHp: castleManager.getHp(castle.playerId),
          targetType: 'castle',
        });
      }
    }
  }

  // ─── General War Cry: heal nearby allies 10% every 15s ───
  private handleGeneralWarCry(
    enemy: Enemy,
    enemyManager: EnemyManager,
    now: number,
  ): void {
    const intervalSec = GENERAL_CONFIG.warCryInterval / 1000;
    if (now - enemy.lastSpecialTime < intervalSec) return;

    enemy.lastSpecialTime = now;

    const healPercent = GENERAL_CONFIG.warCryHealPercent;
    const allEnemies = enemyManager.getAllEnemies();

    // Heal all enemies within a generous radius
    const warCryRadius = 5;
    for (const ally of allEnemies) {
      if (ally.id === enemy.id) continue;
      const d = distance({ x: enemy.x, y: enemy.y }, { x: ally.x, y: ally.y });
      if (d <= warCryRadius) {
        const healAmount = Math.round(ally.maxHp * healPercent);
        ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
      }
    }
  }
}
