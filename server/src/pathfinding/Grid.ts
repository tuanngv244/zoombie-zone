import { MAP_CONFIG } from '../config/gameConfig';
import { Vec2 } from '../utils/math';

export class Grid {
  private readonly width: number;
  private readonly height: number;
  private readonly walkable: boolean[][];
  private readonly wallHeight: number[][]; // 0 = no wall, 1-3 = wall stack count
  private castlePositions: Vec2[] = [];

  constructor() {
    this.width = MAP_CONFIG.gridWidth;
    this.height = MAP_CONFIG.gridHeight;
    this.walkable = [];
    this.wallHeight = [];
    for (let x = 0; x < this.width; x++) {
      this.walkable[x] = [];
      this.wallHeight[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.walkable[x][y] = true;
        this.wallHeight[x][y] = 0;
      }
    }
  }

  /** Initialize the grid with the castle occupying 4x4 center tiles (18-21, 18-21). */
  initCastle(): void {
    const castleStart = MAP_CONFIG.castleCenterX - 2; // 18
    this.setBlocked(castleStart, castleStart, 4, 4);
    this.castlePositions = [{ x: MAP_CONFIG.castleCenterX, y: MAP_CONFIG.castleCenterY }];
  }

  /** Initialize the grid with multiple castles, each occupying 4x4 tiles centered at given positions. */
  initCastles(positions: Vec2[]): void {
    this.castlePositions = [...positions];
    for (const pos of positions) {
      const startX = pos.x - 2;
      const startY = pos.y - 2;
      this.setBlocked(startX, startY, 4, 4);
    }
  }

  getCastlePositions(): Vec2[] {
    return this.castlePositions;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    return this.walkable[x][y];
  }

  setBlocked(x: number, y: number, w: number, h: number): void {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (this.isInBounds(px, py)) {
          this.walkable[px][py] = false;
        }
      }
    }
  }

  setWalkable(x: number, y: number, w: number, h: number): void {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (this.isInBounds(px, py)) {
          this.walkable[px][py] = true;
        }
      }
    }
  }

  setWallHeight(x: number, y: number, w: number, h: number, height: number): void {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (this.isInBounds(px, py)) {
          this.wallHeight[px][py] = height;
        }
      }
    }
  }

  getWallHeight(x: number, y: number): number {
    if (!this.isInBounds(x, y)) return 0;
    return this.wallHeight[x][y];
  }

  /**
   * Return a grid where everything is walkable except the castle tiles.
   * Used for enemies that can climb over walls (post wave 5).
   */
  getClimbableGrid(): Grid {
    const climbable = new Grid();
    // Block all castle positions
    if (this.castlePositions.length > 0) {
      climbable.initCastles(this.castlePositions);
    } else {
      climbable.initCastle();
    }
    // Copy wall heights so speed penalty still applies
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        climbable.wallHeight[x][y] = this.wallHeight[x][y];
      }
    }
    return climbable;
  }

  /** Get walkable cardinal neighbors of a cell (no diagonals). */
  getNeighbors(x: number, y: number): Vec2[] {
    const neighbors: Vec2[] = [];
    const dirs: Vec2[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const d of dirs) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (this.isWalkable(nx, ny)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    return neighbors;
  }

  /** Clone the grid so we can test hypothetical placements without mutating the real grid. */
  clone(): Grid {
    const copy = new Grid();
    copy.castlePositions = [...this.castlePositions];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        copy.walkable[x][y] = this.walkable[x][y];
        copy.wallHeight[x][y] = this.wallHeight[x][y];
      }
    }
    return copy;
  }
}
