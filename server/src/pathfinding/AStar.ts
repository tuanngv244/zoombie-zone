import { Vec2 } from '../utils/math';
import { Grid } from './Grid';

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function nodeKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * A* pathfinding on a Grid.
 * Returns an array of Vec2 waypoints from (startX,startY) to (endX,endY), or
 * an empty array if no path exists.
 */
export function findPath(
  grid: Grid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Vec2[] {
  // If start or end is out of bounds, return empty
  if (!grid.isInBounds(startX, startY) || !grid.isInBounds(endX, endY)) {
    return [];
  }

  // If the end is blocked we allow pathing TO an adjacent cell of the castle/blocked area.
  // But the standard A* should just check walkable for traversed cells (not the final cell).
  // For enemies pathing to the castle (which is blocked), we allow the end to be non-walkable
  // and instead path to the nearest walkable neighbor of the end.

  const targetIsBlocked = !grid.isWalkable(endX, endY);
  let actualEndX = endX;
  let actualEndY = endY;

  if (targetIsBlocked) {
    // Find the closest walkable neighbor to the blocked target
    const neighbors = [
      { x: endX - 1, y: endY },
      { x: endX + 1, y: endY },
      { x: endX, y: endY - 1 },
      { x: endX, y: endY + 1 },
      { x: endX - 1, y: endY - 1 },
      { x: endX + 1, y: endY - 1 },
      { x: endX - 1, y: endY + 1 },
      { x: endX + 1, y: endY + 1 },
    ];

    let bestDist = Infinity;
    let bestNeighbor: Vec2 | null = null;
    for (const n of neighbors) {
      if (grid.isWalkable(n.x, n.y)) {
        const d = manhattan(n.x, n.y, startX, startY);
        if (d < bestDist) {
          bestDist = d;
          bestNeighbor = n;
        }
      }
    }

    if (!bestNeighbor) {
      // Try a wider search ring around the target
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const nx = endX + dx;
          const ny = endY + dy;
          if (grid.isWalkable(nx, ny)) {
            const d = manhattan(nx, ny, endX, endY);
            if (d < bestDist) {
              bestDist = d;
              bestNeighbor = { x: nx, y: ny };
            }
          }
        }
      }
    }

    if (!bestNeighbor) return [];
    actualEndX = bestNeighbor.x;
    actualEndY = bestNeighbor.y;
  }

  // If start is not walkable, return empty
  if (!grid.isWalkable(startX, startY)) return [];

  // If start equals end, just return the single point
  if (startX === actualEndX && startY === actualEndY) {
    return [{ x: startX, y: startY }];
  }

  const openMap = new Map<string, AStarNode>();
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    h: manhattan(startX, startY, actualEndX, actualEndY),
    f: manhattan(startX, startY, actualEndX, actualEndY),
    parent: null,
  };
  openMap.set(nodeKey(startX, startY), startNode);

  while (openMap.size > 0) {
    // Find node with lowest f score
    let current: AStarNode | null = null;
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
      let node: AStarNode | null = current;
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
    const neighbors = grid.getNeighbors(current.x, current.y);
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
        const h = manhattan(neighbor.x, neighbor.y, actualEndX, actualEndY);
        const newNode: AStarNode = {
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

  // No path found
  return [];
}
