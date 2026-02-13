import { v4 as uuidv4 } from 'uuid';
import { ArmyUnitType, ARMY_UNIT_STATS, ArmyUnitStats } from '../config/gameConfig';
import { Vec2, distance } from '../utils/math';
import { Grid } from '../pathfinding/Grid';
import { findPath } from '../pathfinding/AStar';
import { ArmyUnitSnapshot } from '../socket/events';

export interface ArmyUnit {
  id: string;
  type: ArmyUnitType;
  ownerId: string;       // player who purchased
  targetPlayerId: string; // player whose castle is being attacked
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  attackSpeed: number;
  path: Vec2[];
  pathIndex: number;
  lastAttackTime: number;
  special?: string;
}

export class ArmyManager {
  private units: Map<string, ArmyUnit> = new Map();

  init(): void {
    this.units = new Map();
  }

  getUnit(id: string): ArmyUnit | undefined {
    return this.units.get(id);
  }

  getAllUnits(): ArmyUnit[] {
    return Array.from(this.units.values());
  }

  getCount(): number {
    return this.units.size;
  }

  /**
   * Spawn an army unit owned by a player, targeting another player's castle.
   * The unit spawns near the owner's castle and paths toward the target castle.
   */
  spawnUnit(
    type: ArmyUnitType,
    ownerId: string,
    spawnX: number,
    spawnY: number,
    targetX: number,
    targetY: number,
    grid: Grid,
  ): ArmyUnit | null {
    const stats = ARMY_UNIT_STATS[type];
    if (!stats) return null;

    // Find a walkable spawn position near the owner's castle
    let actualSpawnX = spawnX;
    let actualSpawnY = spawnY;

    if (!grid.isWalkable(actualSpawnX, actualSpawnY)) {
      let found = false;
      // Search in expanding rings around the spawn point
      for (let ring = 1; ring < 10 && !found; ring++) {
        for (let dx = -ring; dx <= ring && !found; dx++) {
          for (let dy = -ring; dy <= ring && !found; dy++) {
            if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            const nx = spawnX + dx;
            const ny = spawnY + dy;
            if (grid.isWalkable(nx, ny)) {
              actualSpawnX = nx;
              actualSpawnY = ny;
              found = true;
            }
          }
        }
      }
      if (!found) return null;
    }

    // Compute path to target castle
    const path = findPath(grid, actualSpawnX, actualSpawnY, targetX, targetY);

    const unit: ArmyUnit = {
      id: uuidv4(),
      type,
      ownerId,
      targetPlayerId: '', // Will be set by the caller
      x: actualSpawnX,
      y: actualSpawnY,
      hp: stats.hp,
      maxHp: stats.hp,
      speed: stats.speed,
      damage: stats.damage,
      range: stats.range,
      attackSpeed: stats.attackSpeed,
      path,
      pathIndex: 0,
      lastAttackTime: 0,
      special: stats.special,
    };

    this.units.set(unit.id, unit);
    return unit;
  }

  /**
   * Update all army units: move along path toward target castle.
   * Returns units that have reached their target castle (within range).
   * deltaTime is in seconds.
   */
  updateUnits(deltaTime: number, grid: Grid): ArmyUnit[] {
    const reachedTarget: ArmyUnit[] = [];

    for (const unit of this.units.values()) {
      if (unit.path.length === 0) {
        // No path - check if already near target
        reachedTarget.push(unit);
        continue;
      }

      // Move along path
      const moveDistance = unit.speed * deltaTime;
      let remaining = moveDistance;

      while (remaining > 0 && unit.pathIndex < unit.path.length) {
        const target = unit.path[unit.pathIndex];
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget <= remaining) {
          unit.x = target.x;
          unit.y = target.y;
          remaining -= distToTarget;
          unit.pathIndex++;
        } else {
          const ratio = remaining / distToTarget;
          unit.x += dx * ratio;
          unit.y += dy * ratio;
          remaining = 0;
        }
      }

      // If path completed, unit has reached target area
      if (unit.pathIndex >= unit.path.length) {
        reachedTarget.push(unit);
      }
    }

    return reachedTarget;
  }

  /**
   * Deal damage to an army unit.
   * Returns whether the unit was killed.
   */
  takeDamage(id: string, amount: number): { killed: boolean } {
    const unit = this.units.get(id);
    if (!unit) return { killed: false };

    unit.hp = Math.max(0, unit.hp - amount);
    if (unit.hp <= 0) {
      this.units.delete(id);
      return { killed: true };
    }
    return { killed: false };
  }

  removeUnit(id: string): void {
    this.units.delete(id);
  }

  /** Get all army units within range of (x,y). */
  getInRange(x: number, y: number, range: number): ArmyUnit[] {
    const result: ArmyUnit[] = [];
    for (const unit of this.units.values()) {
      const dist = distance({ x, y }, { x: unit.x, y: unit.y });
      if (dist <= range) {
        result.push(unit);
      }
    }
    return result;
  }

  /** Get all army units owned by a specific player. */
  getByOwner(ownerId: string): ArmyUnit[] {
    const result: ArmyUnit[] = [];
    for (const unit of this.units.values()) {
      if (unit.ownerId === ownerId) {
        result.push(unit);
      }
    }
    return result;
  }

  /** Get all army units targeting a specific player's castle. */
  getByTarget(targetPlayerId: string): ArmyUnit[] {
    const result: ArmyUnit[] = [];
    for (const unit of this.units.values()) {
      if (unit.targetPlayerId === targetPlayerId) {
        result.push(unit);
      }
    }
    return result;
  }

  getSnapshot(): ArmyUnitSnapshot[] {
    const snapshots: ArmyUnitSnapshot[] = [];
    for (const u of this.units.values()) {
      snapshots.push({
        id: u.id,
        type: u.type,
        ownerId: u.ownerId,
        targetPlayerId: u.targetPlayerId,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
      });
    }
    return snapshots;
  }
}
