import { v4 as uuidv4 } from 'uuid';
import {
  EnemyType,
  ENEMY_STATS,
  MAP_CONFIG,
  WAVE_CONFIG,
} from '../config/gameConfig';
import { EnemySnapshot } from '../socket/events';
import { Vec2, distance, randomInt } from '../utils/math';
import { Grid } from '../pathfinding/Grid';
import { findPath } from '../pathfinding/AStar';

export type SpawnEdge = 'north' | 'south' | 'east' | 'west';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  path: Vec2[];
  pathIndex: number;
  goldReward: number;
  special: string | undefined;
  lastSpecialTime: number;
  canClimbWalls: boolean;
}

export class EnemyManager {
  private enemies: Map<string, Enemy> = new Map();
  private totalKills: number = 0;

  init(): void {
    this.enemies = new Map();
    this.totalKills = 0;
  }

  getEnemy(id: string): Enemy | undefined {
    return this.enemies.get(id);
  }

  getAllEnemies(): Enemy[] {
    return Array.from(this.enemies.values());
  }

  getCount(): number {
    return this.enemies.size;
  }

  getTotalKills(): number {
    return this.totalKills;
  }

  /**
   * Spawn an enemy at a random position along the given edge, then compute
   * its path to the castle center.
   */
  spawnEnemy(
    type: EnemyType,
    spawnEdge: SpawnEdge,
    grid: Grid,
    waveNumber: number,
  ): Enemy | null {
    const baseStats = ENEMY_STATS[type];
    if (!baseStats) return null;

    // Determine spawn position on the map edge
    let spawnX: number;
    let spawnY: number;
    switch (spawnEdge) {
      case 'north':
        spawnX = randomInt(0, MAP_CONFIG.gridWidth - 1);
        spawnY = 0;
        break;
      case 'south':
        spawnX = randomInt(0, MAP_CONFIG.gridWidth - 1);
        spawnY = MAP_CONFIG.gridHeight - 1;
        break;
      case 'west':
        spawnX = 0;
        spawnY = randomInt(0, MAP_CONFIG.gridHeight - 1);
        break;
      case 'east':
        spawnX = MAP_CONFIG.gridWidth - 1;
        spawnY = randomInt(0, MAP_CONFIG.gridHeight - 1);
        break;
    }

    // Make sure spawn tile is walkable; if not, slide along the edge
    if (!grid.isWalkable(spawnX, spawnY)) {
      let found = false;
      for (let offset = 1; offset < 40; offset++) {
        if (spawnEdge === 'north' || spawnEdge === 'south') {
          if (grid.isWalkable(spawnX + offset, spawnY)) { spawnX += offset; found = true; break; }
          if (grid.isWalkable(spawnX - offset, spawnY)) { spawnX -= offset; found = true; break; }
        } else {
          if (grid.isWalkable(spawnX, spawnY + offset)) { spawnY += offset; found = true; break; }
          if (grid.isWalkable(spawnX, spawnY - offset)) { spawnY -= offset; found = true; break; }
        }
      }
      if (!found) return null;
    }

    // Compute A* path to castle center
    // After wave 5, enemies can climb walls - use a climbable grid for pathfinding
    const canClimb = waveNumber >= 5;
    const pathGrid = canClimb ? grid.getClimbableGrid() : grid;
    const path = findPath(pathGrid, spawnX, spawnY, MAP_CONFIG.castleCenterX, MAP_CONFIG.castleCenterY);

    // Apply wave scaling multipliers
    const hpMultiplier = 1.0 + (waveNumber - 1) * WAVE_CONFIG.hpScalePerWave;
    const speedMultiplier = 1.0 + (waveNumber - 1) * WAVE_CONFIG.speedScalePerWave;

    const scaledHp = Math.round(baseStats.hp * hpMultiplier);
    const scaledSpeed = baseStats.speed * speedMultiplier;

    const enemy: Enemy = {
      id: uuidv4(),
      type,
      x: spawnX,
      y: spawnY,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: scaledSpeed,
      damage: baseStats.damage,
      path,
      pathIndex: 0,
      goldReward: baseStats.goldReward,
      special: baseStats.special,
      lastSpecialTime: 0,
      canClimbWalls: canClimb,
    };

    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /**
   * Update all enemies: move along path, return enemies that have reached the castle.
   * deltaTime is in seconds.
   */
  updateEnemies(
    deltaTime: number,
    grid: Grid,
    castleX: number,
    castleY: number,
  ): Enemy[] {
    const reachedCastle: Enemy[] = [];

    for (const enemy of this.enemies.values()) {
      if (enemy.path.length === 0) {
        // No path — enemy is stuck or already at target
        // Check if close to castle
        const dist = distance({ x: enemy.x, y: enemy.y }, { x: castleX, y: castleY });
        if (dist <= 2) {
          reachedCastle.push(enemy);
        }
        continue;
      }

      // Calculate effective speed, applying wall climbing penalty if applicable
      let effectiveSpeed = enemy.speed;
      if (enemy.canClimbWalls) {
        const tileX = Math.floor(enemy.x);
        const tileY = Math.floor(enemy.y);
        const wallH = grid.getWallHeight(tileX, tileY);
        if (wallH > 0) {
          effectiveSpeed = enemy.speed / (1 + wallH);
        }
      }

      // Move along path
      const moveDistance = effectiveSpeed * deltaTime;
      let remaining = moveDistance;

      while (remaining > 0 && enemy.pathIndex < enemy.path.length) {
        const target = enemy.path[enemy.pathIndex];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget <= remaining) {
          // Reached this waypoint
          enemy.x = target.x;
          enemy.y = target.y;
          remaining -= distToTarget;
          enemy.pathIndex++;
        } else {
          // Move toward the waypoint
          const ratio = remaining / distToTarget;
          enemy.x += dx * ratio;
          enemy.y += dy * ratio;
          remaining = 0;
        }
      }

      // If path completed, check if at castle
      if (enemy.pathIndex >= enemy.path.length) {
        const dist = distance({ x: enemy.x, y: enemy.y }, { x: castleX, y: castleY });
        if (dist <= 3) {
          reachedCastle.push(enemy);
        }
      }
    }

    return reachedCastle;
  }

  /**
   * Deal damage to an enemy.
   * Returns whether the enemy was killed and its gold reward.
   */
  takeDamage(id: string, amount: number): { killed: boolean; goldReward: number } {
    const enemy = this.enemies.get(id);
    if (!enemy) return { killed: false, goldReward: 0 };

    enemy.hp = Math.max(0, enemy.hp - amount);
    if (enemy.hp <= 0) {
      this.totalKills++;
      const reward = enemy.goldReward;
      this.enemies.delete(id);
      return { killed: true, goldReward: reward };
    }
    return { killed: false, goldReward: 0 };
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id);
  }

  /** Get all enemies within range of (x,y). */
  getInRange(x: number, y: number, range: number): Enemy[] {
    const result: Enemy[] = [];
    for (const enemy of this.enemies.values()) {
      const dist = distance({ x, y }, { x: enemy.x, y: enemy.y });
      if (dist <= range) {
        result.push(enemy);
      }
    }
    return result;
  }

  getSnapshot(): EnemySnapshot[] {
    const snapshots: EnemySnapshot[] = [];
    for (const e of this.enemies.values()) {
      snapshots.push({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        speed: e.speed,
      });
    }
    return snapshots;
  }
}
