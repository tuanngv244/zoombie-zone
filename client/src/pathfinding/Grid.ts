import { Vec2 } from '../utils/math';

interface GridCell {
  walkable: boolean;
  buildingId?: string;
}

export class Grid {
  private width: number;
  private height: number;
  private cells: Map<string, GridCell> = new Map();
  private occupiedCells: Set<string> = new Set();

  constructor(width: number = 40, height: number = 40) {
    this.width = width;
    this.height = height;
    this.init();
  }

  private init(): void {
    // Initialize all cells as walkable
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.cells.set(this.key(x, y), { walkable: true });
      }
    }
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  initCastles(positions: { x: number; y: number }[]): void {
    // Mark castle areas as non-walkable
    for (const pos of positions) {
      const startX = pos.x - 2;
      const startY = pos.y - 2;
      for (let x = startX; x < startX + 4; x++) {
        for (let y = startY; y < startY + 4; y++) {
          if (this.isInBounds(x, y)) {
            const cell = this.cells.get(this.key(x, y));
            if (cell) {
              cell.walkable = false;
            }
          }
        }
      }
    }
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const cell = this.cells.get(this.key(x, y));
    return cell?.walkable ?? false;
  }

  canPlace(gridX: number, gridY: number, width: number, height: number): boolean {
    for (let x = gridX; x < gridX + width; x++) {
      for (let y = gridY; y < gridY + height; y++) {
        if (!this.isInBounds(x, y)) return false;
        const cellKey = this.key(x, y);
        if (this.occupiedCells.has(cellKey)) return false;
      }
    }
    return true;
  }

  placeBuilding(gridX: number, gridY: number, width: number, height: number, buildingId?: string): void {
    for (let x = gridX; x < gridX + width; x++) {
      for (let y = gridY; y < gridY + height; y++) {
        if (this.isInBounds(x, y)) {
          const cellKey = this.key(x, y);
          this.occupiedCells.add(cellKey);
          const cell = this.cells.get(cellKey);
          if (cell) {
            cell.walkable = false;
            if (buildingId) {
              cell.buildingId = buildingId;
            }
          }
        }
      }
    }
  }

  removeBuilding(buildingId: string): void {
    // Find and free all cells that had this building
    for (const [key, cell] of this.cells) {
      if (cell.buildingId === buildingId) {
        cell.walkable = true;
        cell.buildingId = undefined;
        this.occupiedCells.delete(key);
      }
    }
  }

  getNeighbors(x: number, y: number): Vec2[] {
    const neighbors: Vec2[] = [];
    // 8-directional movement
    const dirs = [
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    
    for (const dir of dirs) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (this.isWalkable(nx, ny)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    
    return neighbors;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): Vec2[] {
    // A* pathfinding
    interface Node {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent: Node | null;
    }

    function heuristic(ax: number, ay: number, bx: number, by: number): number {
      return Math.abs(ax - bx) + Math.abs(ay - by);
    }

    function nodeKey(x: number, y: number): string {
      return `${x},${y}`;
    }

    // If start is blocked, return empty
    if (!this.isWalkable(startX, startY)) {
      return [];
    }

    // Find closest walkable neighbor if target is blocked
    let actualEndX = endX;
    let actualEndY = endY;

    if (!this.isWalkable(endX, endY)) {
      const neighbors = this.getNeighbors(endX, endY);
      if (neighbors.length === 0) {
        // Try wider search
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            if (this.isWalkable(endX + dx, endY + dy)) {
              actualEndX = endX + dx;
              actualEndY = endY + dy;
              break;
            }
          }
          if (this.isWalkable(actualEndX, actualEndY)) break;
        }
      } else {
        actualEndX = neighbors[0].x;
        actualEndY = neighbors[0].y;
      }
    }

    if (startX === actualEndX && startY === actualEndY) {
      return [{ x: startX, y: startY }];
    }

    const openMap = new Map<string, Node>();
    const closedSet = new Set<string>();

    const startNode: Node = {
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY, actualEndX, actualEndY),
      f: heuristic(startX, startY, actualEndX, actualEndY),
      parent: null,
    };

    openMap.set(nodeKey(startX, startY), startNode);

    while (openMap.size > 0) {
      // Find node with lowest f score
      let current: Node | null = null;
      for (const node of openMap.values()) {
        if (!current || node.f < current.f || (node.f === current.f && node.h < current.h)) {
          current = node;
        }
      }

      if (!current) break;

      // Check if we reached the goal
      if (current.x === actualEndX && current.y === actualEndY) {
        // Reconstruct path
        const path: Vec2[] = [];
        let node: Node | null = current;
        while (node) {
          path.push({ x: node.x, y: node.y });
          node = node.parent;
        }
        path.reverse();
        return path;
      }

      const currentKey = nodeKey(current.x, current.y);
      openMap.delete(currentKey);
      closedSet.add(currentKey);

      // Expand neighbors
      const neighbors = this.getNeighbors(current.x, current.y);
      for (const neighbor of neighbors) {
        const nKey = nodeKey(neighbor.x, neighbor.y);
        if (closedSet.has(nKey)) continue;

        const tentativeG = current.g + 1;

        const existing = openMap.get(nKey);
        if (existing) {
          if (tentativeG < existing.g) {
            existing.g = tentativeG;
            existing.f = tentativeG + existing.h;
            existing.parent = current;
          }
        } else {
          const h = heuristic(neighbor.x, neighbor.y, actualEndX, actualEndY);
          const newNode: Node = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          };
          openMap.set(nKey, newNode);
        }
      }
    }

    return [];
  }
}
