import {
  CASTLE_CONFIG,
  CASTLE_POSITIONS,
  CastleUpgradeType,
} from '../config/gameConfig';

export interface PlayerCastle {
  playerId: string;
  hp: number;
  maxHp: number;
  centerX: number;
  centerY: number;
  purchasedUpgrades: Set<CastleUpgradeType>;
  goldBonusPerKill: number;
  lastKingAttackTime: number;
}

export interface CastleSnapshot {
  playerId: string;
  hp: number;
  maxHp: number;
  centerX: number;
  centerY: number;
  upgrades: string[];
}

export class CastleManager {
  private castles: Map<string, PlayerCastle> = new Map(); // playerId -> PlayerCastle

  init(): void {
    this.castles = new Map();
  }

  /** Initialize castles for multiple players. Each gets their own castle at a different position. */
  initMultiple(playerIds: string[]): void {
    this.castles = new Map();
    for (let i = 0; i < playerIds.length; i++) {
      const pos = CASTLE_POSITIONS[i] || CASTLE_POSITIONS[0];
      const castle: PlayerCastle = {
        playerId: playerIds[i],
        hp: CASTLE_CONFIG.baseHp,
        maxHp: CASTLE_CONFIG.baseHp,
        centerX: pos.x,
        centerY: pos.y,
        purchasedUpgrades: new Set(),
        goldBonusPerKill: 0,
        lastKingAttackTime: 0,
      };
      this.castles.set(playerIds[i], castle);
    }
  }

  getCastle(playerId: string): PlayerCastle | undefined {
    return this.castles.get(playerId);
  }

  getAllCastles(): PlayerCastle[] {
    return Array.from(this.castles.values());
  }

  /** Get the first castle (for backward compat or single-player scenarios). */
  getFirstCastle(): PlayerCastle | undefined {
    for (const c of this.castles.values()) return c;
    return undefined;
  }

  getHp(playerId?: string): number {
    if (playerId) {
      return this.castles.get(playerId)?.hp ?? 0;
    }
    // Backward compat: return first castle HP
    const first = this.getFirstCastle();
    return first?.hp ?? 0;
  }

  getMaxHp(playerId?: string): number {
    if (playerId) {
      return this.castles.get(playerId)?.maxHp ?? 0;
    }
    const first = this.getFirstCastle();
    return first?.maxHp ?? 0;
  }

  getGoldBonusPerKill(playerId?: string): number {
    if (playerId) {
      return this.castles.get(playerId)?.goldBonusPerKill ?? 0;
    }
    // Return max bonus across all castles for backward compat
    let maxBonus = 0;
    for (const c of this.castles.values()) {
      if (c.goldBonusPerKill > maxBonus) maxBonus = c.goldBonusPerKill;
    }
    return maxBonus;
  }

  takeDamage(playerId: string, amount: number): void {
    const castle = this.castles.get(playerId);
    if (castle) {
      castle.hp = Math.max(0, castle.hp - amount);
    }
  }

  isDestroyed(playerId: string): boolean {
    const castle = this.castles.get(playerId);
    if (!castle) return true;
    return castle.hp <= 0;
  }

  /** Returns true if ALL player castles are destroyed (zombie game over). */
  isAllDestroyed(): boolean {
    for (const castle of this.castles.values()) {
      if (castle.hp > 0) return false;
    }
    return true;
  }

  /**
   * Find the nearest non-destroyed castle to a position.
   * Used by enemies to determine which castle to target.
   */
  getNearestCastle(x: number, y: number): PlayerCastle | null {
    let nearest: PlayerCastle | null = null;
    let nearestDist = Infinity;
    for (const castle of this.castles.values()) {
      if (castle.hp <= 0) continue;
      const dx = castle.centerX - x;
      const dy = castle.centerY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = castle;
      }
    }
    return nearest;
  }

  /**
   * Attempt to repair a player's castle. Returns the cost if successful.
   * Repair can be repeated.
   */
  repair(playerId: string): { success: boolean; cost: number } {
    const castle = this.castles.get(playerId);
    if (!castle) return { success: false, cost: 0 };

    const cfg = CASTLE_CONFIG.upgrades[CastleUpgradeType.Repair];
    castle.hp = Math.min(castle.maxHp, castle.hp + cfg.hpRestore);
    return { success: true, cost: cfg.cost };
  }

  /**
   * Attempt an upgrade on a specific player's castle.
   * Returns the cost if successful, or null if the upgrade has already been purchased
   * or prerequisites are not met.
   */
  upgrade(playerId: string, type: CastleUpgradeType): { success: boolean; cost: number; reason?: string } {
    const castle = this.castles.get(playerId);
    if (!castle) return { success: false, cost: 0, reason: 'Castle not found' };

    // Repair is handled separately and can be repeated
    if (type === CastleUpgradeType.Repair) {
      return this.repair(playerId);
    }

    // One-time upgrades
    if (castle.purchasedUpgrades.has(type)) {
      return { success: false, cost: 0, reason: 'Already purchased' };
    }

    // FortifyII requires FortifyI
    if (type === CastleUpgradeType.FortifyII && !castle.purchasedUpgrades.has(CastleUpgradeType.FortifyI)) {
      return { success: false, cost: 0, reason: 'FortifyI required first' };
    }

    castle.purchasedUpgrades.add(type);

    switch (type) {
      case CastleUpgradeType.FortifyI: {
        const cfg = CASTLE_CONFIG.upgrades[CastleUpgradeType.FortifyI];
        castle.maxHp += cfg.hpBonus;
        castle.hp += cfg.hpBonus;
        return { success: true, cost: cfg.cost };
      }
      case CastleUpgradeType.FortifyII: {
        const cfg = CASTLE_CONFIG.upgrades[CastleUpgradeType.FortifyII];
        castle.maxHp += cfg.hpBonus;
        castle.hp += cfg.hpBonus;
        return { success: true, cost: cfg.cost };
      }
      case CastleUpgradeType.Treasury: {
        const cfg = CASTLE_CONFIG.upgrades[CastleUpgradeType.Treasury];
        castle.goldBonusPerKill = cfg.goldBonusPerKill;
        return { success: true, cost: cfg.cost };
      }
      default:
        return { success: false, cost: 0, reason: 'Unknown upgrade type' };
    }
  }

  /** Return an array of castle snapshots for all players. */
  getSnapshot(): CastleSnapshot[] {
    const snapshots: CastleSnapshot[] = [];
    for (const castle of this.castles.values()) {
      snapshots.push({
        playerId: castle.playerId,
        hp: castle.hp,
        maxHp: castle.maxHp,
        centerX: castle.centerX,
        centerY: castle.centerY,
        upgrades: Array.from(castle.purchasedUpgrades),
      });
    }
    return snapshots;
  }

  /** Get snapshot for a specific player's castle. */
  getPlayerSnapshot(playerId: string): CastleSnapshot | null {
    const castle = this.castles.get(playerId);
    if (!castle) return null;
    return {
      playerId: castle.playerId,
      hp: castle.hp,
      maxHp: castle.maxHp,
      centerX: castle.centerX,
      centerY: castle.centerY,
      upgrades: Array.from(castle.purchasedUpgrades),
    };
  }

  getPurchasedUpgrades(playerId: string): CastleUpgradeType[] {
    const castle = this.castles.get(playerId);
    if (!castle) return [];
    return Array.from(castle.purchasedUpgrades);
  }
}
