import { v4 as uuidv4 } from 'uuid';
import {
  BuildingType,
  BuildingStats,
  BUILDING_STATS,
  ECONOMY_CONFIG,
  MAP_CONFIG,
} from '../config/gameConfig';
import { BuildingSnapshot } from '../socket/events';
import { Vec2, distance } from '../utils/math';
import { Grid } from '../pathfinding/Grid';
import { findPath } from '../pathfinding/AStar';

export interface Building {
  id: string;
  type: BuildingType;
  gridX: number;
  gridY: number;
  hp: number;
  maxHp: number;
  ownerId: string;
  lastAttackTime: number;
  stats: BuildingStats;
  stackCount: number; // how many walls stacked (1 = single wall)
}

export class BuildingManager {
  private buildings: Map<string, Building> = new Map();
  private totalBuildingsPlaced: number = 0;

  init(): void {
    this.buildings = new Map();
    this.totalBuildingsPlaced = 0;
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getTotalBuildingsPlaced(): number {
    return this.totalBuildingsPlaced;
  }

  /** Find an existing wall building at the given grid position with matching type. */
  findWallAt(gridX: number, gridY: number, type: BuildingType): Building | null {
    for (const b of this.buildings.values()) {
      if (b.gridX === gridX && b.gridY === gridY && b.type === type && b.stats.isWall) {
        return b;
      }
    }
    return null;
  }

  /**
   * Place a building on the grid.
   * Returns the building if successfully placed, or null with a reason string.
   */
  placeBuilding(
    type: BuildingType,
    gridX: number,
    gridY: number,
    ownerId: string,
    grid: Grid,
    currentGold: number,
  ): { building: Building | null; reason?: string } {
    const stats = BUILDING_STATS[type];
    if (!stats) {
      return { building: null, reason: 'Unknown building type' };
    }

    // Check cost
    if (currentGold < stats.cost) {
      return { building: null, reason: 'Not enough gold' };
    }

    // Check bounds
    if (
      gridX < 0 || gridY < 0 ||
      gridX + stats.gridWidth > MAP_CONFIG.gridWidth ||
      gridY + stats.gridHeight > MAP_CONFIG.gridHeight
    ) {
      return { building: null, reason: 'Out of bounds' };
    }

    // Check overlap: all tiles occupied by this building must be walkable
    // Special case: allow stacking walls of the same type (max 3)
    let allBlocked = true;
    for (let dx = 0; dx < stats.gridWidth; dx++) {
      for (let dy = 0; dy < stats.gridHeight; dy++) {
        if (grid.isWalkable(gridX + dx, gridY + dy)) {
          allBlocked = false;
        }
      }
    }

    if (allBlocked && stats.isWall) {
      // Check for wall stacking
      const existingWall = this.findWallAt(gridX, gridY, type);
      if (existingWall && existingWall.stackCount < 3) {
        // Stack on top of existing wall
        existingWall.stackCount++;
        existingWall.hp += stats.hp;
        existingWall.maxHp += stats.hp;
        // Update wall height on grid
        grid.setWallHeight(gridX, gridY, stats.gridWidth, stats.gridHeight, existingWall.stackCount);
        this.totalBuildingsPlaced++;
        return { building: existingWall };
      }
      // Max stack reached or no matching wall
      return { building: null, reason: existingWall ? 'Maximum stack count (3) reached' : 'Tiles are already occupied' };
    }

    if (allBlocked) {
      return { building: null, reason: 'Tiles are already occupied' };
    }

    // For non-stacking placement, all tiles must be walkable
    for (let dx = 0; dx < stats.gridWidth; dx++) {
      for (let dy = 0; dy < stats.gridHeight; dy++) {
        if (!grid.isWalkable(gridX + dx, gridY + dy)) {
          return { building: null, reason: 'Tiles are already occupied' };
        }
      }
    }

    // Check path not fully blocked: temporarily block the tiles, then verify
    // that at least one path from each map edge to the castle center still exists.
    const testGrid = grid.clone();
    testGrid.setBlocked(gridX, gridY, stats.gridWidth, stats.gridHeight);

    const castleCenterX = MAP_CONFIG.castleCenterX;
    const castleCenterY = MAP_CONFIG.castleCenterY;

    // Test from each edge midpoint
    const edgeTests: Vec2[] = [
      { x: castleCenterX, y: 0 },                          // north
      { x: castleCenterX, y: MAP_CONFIG.gridHeight - 1 },  // south
      { x: 0, y: castleCenterY },                          // west
      { x: MAP_CONFIG.gridWidth - 1, y: castleCenterY },   // east
    ];

    for (const start of edgeTests) {
      // Make sure the start itself is walkable (it should be on edge)
      if (!testGrid.isWalkable(start.x, start.y)) continue;
      const path = findPath(testGrid, start.x, start.y, castleCenterX, castleCenterY);
      if (path.length === 0) {
        return { building: null, reason: 'Placement would block all paths to castle' };
      }
    }

    // All checks passed, create the building
    const building: Building = {
      id: uuidv4(),
      type,
      gridX,
      gridY,
      hp: stats.hp,
      maxHp: stats.hp,
      ownerId,
      lastAttackTime: 0,
      stats,
      stackCount: 1,
    };

    this.buildings.set(building.id, building);
    grid.setBlocked(gridX, gridY, stats.gridWidth, stats.gridHeight);

    // Update wall height on grid for wall buildings
    if (stats.isWall) {
      grid.setWallHeight(gridX, gridY, stats.gridWidth, stats.gridHeight, 1);
    }

    this.totalBuildingsPlaced++;

    return { building };
  }

  /** Remove a building from the grid entirely. */
  removeBuilding(id: string, grid: Grid): Building | null {
    const building = this.buildings.get(id);
    if (!building) return null;

    grid.setWalkable(building.gridX, building.gridY, building.stats.gridWidth, building.stats.gridHeight);
    // Reset wall height when removing a wall building
    if (building.stats.isWall) {
      grid.setWallHeight(building.gridX, building.gridY, building.stats.gridWidth, building.stats.gridHeight, 0);
    }
    this.buildings.delete(id);
    return building;
  }

  /** Sell a building: remove and return 50% gold refund. */
  sellBuilding(id: string, grid: Grid): { building: Building | null; refund: number } {
    const building = this.buildings.get(id);
    if (!building) return { building: null, refund: 0 };

    const refund = Math.floor(building.stats.cost * ECONOMY_CONFIG.sellRefundPercent);
    this.removeBuilding(id, grid);
    return { building, refund };
  }

  /** Move a building to new grid coordinates. */
  moveBuilding(
    id: string,
    newX: number,
    newY: number,
    grid: Grid,
  ): { success: boolean; reason?: string } {
    const building = this.buildings.get(id);
    if (!building) return { success: false, reason: 'Building not found' };

    const stats = building.stats;

    // Check bounds
    if (
      newX < 0 || newY < 0 ||
      newX + stats.gridWidth > MAP_CONFIG.gridWidth ||
      newY + stats.gridHeight > MAP_CONFIG.gridHeight
    ) {
      return { success: false, reason: 'Out of bounds' };
    }

    // Unblock old position
    grid.setWalkable(building.gridX, building.gridY, stats.gridWidth, stats.gridHeight);

    // Check new tiles are all walkable
    for (let dx = 0; dx < stats.gridWidth; dx++) {
      for (let dy = 0; dy < stats.gridHeight; dy++) {
        if (!grid.isWalkable(newX + dx, newY + dy)) {
          // Revert unblock
          grid.setBlocked(building.gridX, building.gridY, stats.gridWidth, stats.gridHeight);
          return { success: false, reason: 'New position is occupied' };
        }
      }
    }

    // Check path not blocked
    const testGrid = grid.clone();
    testGrid.setBlocked(newX, newY, stats.gridWidth, stats.gridHeight);

    const castleCenterX = MAP_CONFIG.castleCenterX;
    const castleCenterY = MAP_CONFIG.castleCenterY;

    const edgeTests: Vec2[] = [
      { x: castleCenterX, y: 0 },
      { x: castleCenterX, y: MAP_CONFIG.gridHeight - 1 },
      { x: 0, y: castleCenterY },
      { x: MAP_CONFIG.gridWidth - 1, y: castleCenterY },
    ];

    for (const start of edgeTests) {
      if (!testGrid.isWalkable(start.x, start.y)) continue;
      const path = findPath(testGrid, start.x, start.y, castleCenterX, castleCenterY);
      if (path.length === 0) {
        // Revert unblock
        grid.setBlocked(building.gridX, building.gridY, stats.gridWidth, stats.gridHeight);
        return { success: false, reason: 'Move would block all paths to castle' };
      }
    }

    // Apply move
    grid.setBlocked(newX, newY, stats.gridWidth, stats.gridHeight);
    building.gridX = newX;
    building.gridY = newY;

    return { success: true };
  }

  /** Deal damage to a building. Returns true if the building was destroyed. */
  takeDamage(id: string, amount: number): { destroyed: boolean; building: Building | null } {
    const building = this.buildings.get(id);
    if (!building) return { destroyed: false, building: null };

    building.hp = Math.max(0, building.hp - amount);
    if (building.hp <= 0) {
      return { destroyed: true, building };
    }
    return { destroyed: false, building };
  }

  /** Get all buildings whose center is within range of (x,y). */
  getInRange(x: number, y: number, range: number): Building[] {
    const result: Building[] = [];
    for (const building of this.buildings.values()) {
      const centerX = building.gridX + building.stats.gridWidth / 2;
      const centerY = building.gridY + building.stats.gridHeight / 2;
      const dist = distance({ x, y }, { x: centerX, y: centerY });
      if (dist <= range) {
        result.push(building);
      }
    }
    return result;
  }

  getSnapshot(): BuildingSnapshot[] {
    const snapshots: BuildingSnapshot[] = [];
    for (const b of this.buildings.values()) {
      snapshots.push({
        id: b.id,
        type: b.type,
        gridX: b.gridX,
        gridY: b.gridY,
        hp: b.hp,
        maxHp: b.maxHp,
        ownerId: b.ownerId,
        stackCount: b.stackCount,
      });
    }
    return snapshots;
  }
}
