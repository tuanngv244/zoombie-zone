import { SocketClient } from '../socket/SocketClient';
import { BuildingSnapshot, CastleSnapshot } from '../socket/StateSync';
import { getBuildingDef, GRID, CASTLE_ORIGIN } from '../config/clientConfig';
import { InputManager } from './InputManager';
import { GridRenderer } from '../scene/GridRenderer';
import { BuildingRenderer } from '../entities/BuildingRenderer';
import { BuildPanel } from '../ui/BuildPanel';

/**
 * Handles the building placement drag-drop flow.
 * Supports continuous placement: after placing a building the same type
 * stays selected so the player can place another one immediately.
 * Placement ends when the player toggles the item off, presses Escape,
 * right-clicks, or runs out of gold.
 */
export class DragDropHandler {
  private socket: SocketClient | null;
  private inputManager: InputManager;
  private gridRenderer: GridRenderer;
  private buildingRenderer: BuildingRenderer;
  private buildPanel: BuildPanel;

  private placingType: string | null = null;
  private occupiedMap: Map<string, { id: string; type: string; stackCount: number }> = new Map();
  private currentGold = 0;
  private interactionMode: 'none' | 'placing' | 'moving' = 'none';
  private movingBuildingId: string | null = null;
  private movingBuildingType: string | null = null;
  private armyType: string | null = null;
  private targetPlayerId: string | null = null;
  private otherPlayerIds: string[] = [];
  private localPlayerId: string | null = null;

  // Callbacks for local game mode
  private onPlaceBuilding: ((type: string, gridX: number, gridY: number) => void) | null = null;
  private onSellBuilding: ((buildingId: string) => void) | null = null;
  private onMoveBuilding: ((buildingId: string, gridX: number, gridY: number) => void) | null = null;

  constructor(
    socket: SocketClient | null,
    inputManager: InputManager,
    gridRenderer: GridRenderer,
    buildingRenderer: BuildingRenderer,
    buildPanel: BuildPanel,
  ) {
    this.socket = socket;
    this.inputManager = inputManager;
    this.gridRenderer = gridRenderer;
    this.buildingRenderer = buildingRenderer;
    this.buildPanel = buildPanel;

    // ESC to cancel
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelPlacement();
      }
    });

    // Grid click to place — keep placing the same type (continuous mode)
    this.inputManager.onGridClick((gx, gy) => {
      // Moving a building
      if (this.interactionMode === 'moving' && this.movingBuildingId && this.movingBuildingType) {
        if (this.socket) {
          this.socket.emit('move_building', {
            buildingId: this.movingBuildingId,
            gridX: gx,
            gridY: gy,
          });
        } else if (this.onMoveBuilding) {
          this.onMoveBuilding(this.movingBuildingId, gx, gy);
        }
        this.cancelPlacement();
        return;
      }

      // Spawning army units - send to the first other player
      if (this.armyType) {
        const target = this.targetPlayerId || this.otherPlayerIds[0];
        if (target && this.socket) {
          this.socket.emit('spawn_army', { unitType: this.armyType, targetPlayerId: target });
        }
        return;
      }

      if (this.placingType) {
        const valid = this.isPositionValid(this.placingType, gx, gy);
        if (valid) {
          if (this.socket) {
            this.socket.emit('place_building', {
              type: this.placingType,
              gridX: gx,
              gridY: gy,
            });
          } else if (this.onPlaceBuilding) {
            this.onPlaceBuilding(this.placingType, gx, gy);
          }
        }
      }
    });

    // Right click to cancel or sell
    this.inputManager.onGridRightClick((gx, gy) => {
      if (this.placingType || this.armyType || this.interactionMode === 'moving') {
        this.cancelPlacement();
        return;
      }
      // Check if there's a building at this position - sell it
      const buildingId = this.findBuildingAt(gx, gy);
      if (buildingId) {
        if (this.socket) {
          this.socket.emit('sell_building', { buildingId });
        } else if (this.onSellBuilding) {
          this.onSellBuilding(buildingId);
        }
      }
    });
  }

  // Set callbacks for local game mode
  setLocalCallbacks(
    onPlace: (type: string, gridX: number, gridY: number) => void,
    onSell: (buildingId: string) => void,
    onMove: (buildingId: string, gridX: number, gridY: number) => void,
  ): void {
    this.onPlaceBuilding = onPlace;
    this.onSellBuilding = onSell;
    this.onMoveBuilding = onMove;
  }

  startPlacement(buildingType: string): void {
    this.cancelPlacement();
    this.placingType = buildingType;
    this.interactionMode = 'placing';
    this.buildPanel.setSelected(buildingType);
  }

  cancelPlacement(): void {
    this.placingType = null;
    this.armyType = null;
    this.interactionMode = 'none';
    this.movingBuildingId = null;
    this.movingBuildingType = null;
    this.buildPanel.setSelected(null);
    this.gridRenderer.hidePlacementPreview();
    this.buildingRenderer.hideGhost();
  }

  startMoveBuilding(buildingId: string, type: string): void {
    this.cancelPlacement();
    this.interactionMode = 'moving';
    this.movingBuildingId = buildingId;
    this.movingBuildingType = type;
  }

  sellBuilding(buildingId: string): void {
    if (this.socket) {
      this.socket.emit('sell_building', { buildingId });
    } else if (this.onSellBuilding) {
      this.onSellBuilding(buildingId);
    }
  }

  startArmyPlacement(type: string): void {
    if (this.otherPlayerIds.length === 0) {
      // No other players to target — show message and cancel
      this.showMessage('Army units require multiplayer — no enemy castles to attack!');
      this.buildPanel.setSelectedArmy(null);
      return;
    }
    this.cancelPlacement();
    this.armyType = type;
    // Auto-target first other player
    this.targetPlayerId = this.otherPlayerIds[0];
  }

  private showMessage(text: string): void {
    // Create a temporary toast message
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
      font-family: 'MedievalSharp', serif; font-size: 16px;
      color: #ffd700; background: rgba(30, 15, 8, 0.95);
      border: 1px solid #6b4226; border-radius: 8px;
      padding: 10px 20px; z-index: 300; pointer-events: none;
      transition: opacity 0.5s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    setTimeout(() => { document.body.removeChild(toast); }, 2500);
  }

  setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    this.otherPlayerIds = players
      .filter(p => p.id !== this.localPlayerId)
      .map(p => p.id);
  }

  findBuildingAt(gx: number, gy: number): string | null {
    const key = `${gx},${gy}`;
    const entry = this.occupiedMap.get(key);
    if (entry && entry.id && entry.type !== '__castle__') {
      return entry.id;
    }
    return null;
  }

  isPlacing(): boolean {
    return this.placingType !== null;
  }

  /**
   * Keep the handler informed of the player's current gold balance
   * so it can auto-cancel placement when the player can no longer afford
   * the selected building type.
   */
  updateGold(gold: number): void {
    this.currentGold = gold;
  }

  syncOccupied(buildings: BuildingSnapshot[], castles?: CastleSnapshot[]): void {
    this.occupiedMap.clear();
    for (const b of buildings) {
      const def = getBuildingDef(b.type);
      if (!def) continue;
      for (let dx = 0; dx < def.gridWidth; dx++) {
        for (let dy = 0; dy < def.gridHeight; dy++) {
          this.occupiedMap.set(`${b.gridX + dx},${b.gridY + dy}`, {
            id: b.id,
            type: b.type,
            stackCount: b.stackCount || 1,
          });
        }
      }
    }
    // Block castle zones
    const cs = GRID.castleSize;
    if (castles && castles.length > 0) {
      for (const castle of castles) {
        const ox = castle.centerX - cs / 2;
        const oy = castle.centerY - cs / 2;
        for (let dx = 0; dx < cs; dx++) {
          for (let dy = 0; dy < cs; dy++) {
            this.occupiedMap.set(`${ox + dx},${oy + dy}`, {
              id: '__castle__',
              type: '__castle__',
              stackCount: 1,
            });
          }
        }
      }
    } else {
      // Default single castle
      for (let dx = 0; dx < cs; dx++) {
        for (let dy = 0; dy < cs; dy++) {
          this.occupiedMap.set(`${CASTLE_ORIGIN.x + dx},${CASTLE_ORIGIN.y + dy}`, {
            id: '__castle__',
            type: '__castle__',
            stackCount: 1,
          });
        }
      }
    }
  }

  update(): void {
    // Handle moving mode preview
    if (this.interactionMode === 'moving' && this.movingBuildingType) {
      const pos = this.inputManager.getMouseGridPosition();
      if (!pos) {
        this.gridRenderer.hidePlacementPreview();
        this.buildingRenderer.hideGhost();
        return;
      }
      const valid = this.isPositionValid(this.movingBuildingType, pos.x, pos.y);
      this.gridRenderer.showPlacementPreview(this.movingBuildingType, pos.x, pos.y, valid);
      this.buildingRenderer.showGhost(this.movingBuildingType, pos.x, pos.y, valid);
      return;
    }

    if (!this.placingType) return;

    // Auto-cancel if the player can no longer afford the selected building
    const def = getBuildingDef(this.placingType);
    if (def && this.currentGold < def.cost) {
      this.cancelPlacement();
      return;
    }

    const pos = this.inputManager.getMouseGridPosition();
    if (!pos) {
      this.gridRenderer.hidePlacementPreview();
      this.buildingRenderer.hideGhost();
      return;
    }

    const valid = this.isPositionValid(this.placingType, pos.x, pos.y);
    this.gridRenderer.showPlacementPreview(this.placingType, pos.x, pos.y, valid);
    this.buildingRenderer.showGhost(this.placingType, pos.x, pos.y, valid);
  }

  private isPositionValid(type: string, gx: number, gy: number): boolean {
    const def = getBuildingDef(type);
    if (!def) return false;

    // Check bounds
    if (gx < 0 || gy < 0) return false;
    if (gx + def.gridWidth > GRID.width) return false;
    if (gy + def.gridHeight > GRID.height) return false;

    // Check occupied tiles
    for (let dx = 0; dx < def.gridWidth; dx++) {
      for (let dy = 0; dy < def.gridHeight; dy++) {
        const key = `${gx + dx},${gy + dy}`;
        const existing = this.occupiedMap.get(key);
        if (existing) {
          // Allow stacking walls of the same type, max 3
          if (def.isWall && existing.type === type && existing.stackCount < 3) {
            continue;
          }
          return false;
        }
      }
    }

    return true;
  }
}
