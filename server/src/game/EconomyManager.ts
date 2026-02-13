import { ECONOMY_CONFIG } from '../config/gameConfig';

export class EconomyManager {
  private playerGold: Map<string, number> = new Map();  // playerId -> gold
  private totalGoldEarned: number = 0;
  private goldBonusPerKill: number = 0;

  init(playerIds: string[]): void {
    this.playerGold = new Map();
    for (const id of playerIds) {
      this.playerGold.set(id, ECONOMY_CONFIG.startingGoldPerPlayer);
    }
    this.totalGoldEarned = ECONOMY_CONFIG.startingGoldPerPlayer * playerIds.length;
    this.goldBonusPerKill = 0;
  }

  getGold(playerId: string): number {
    return this.playerGold.get(playerId) ?? 0;
  }

  /** For backward compat - returns total gold across all players. */
  getTotalGold(): number {
    let sum = 0;
    for (const g of this.playerGold.values()) sum += g;
    return sum;
  }

  addGold(playerId: string, amount: number): void {
    const current = this.playerGold.get(playerId) ?? 0;
    this.playerGold.set(playerId, current + amount);
    this.totalGoldEarned += amount;
  }

  /** Add gold to ALL players (e.g., wave rewards). */
  addGoldAll(amount: number): void {
    for (const [id, g] of this.playerGold) {
      this.playerGold.set(id, g + amount);
    }
    this.totalGoldEarned += amount * this.playerGold.size;
  }

  /** Attempt to spend gold for a specific player. Returns true if successful. */
  spendGold(playerId: string, amount: number): boolean {
    const current = this.playerGold.get(playerId) ?? 0;
    if (current < amount) return false;
    this.playerGold.set(playerId, current - amount);
    return true;
  }

  /** Set the treasury bonus gold per kill (from castle upgrade). */
  setGoldBonusPerKill(bonus: number): void {
    this.goldBonusPerKill = bonus;
  }

  getGoldBonusPerKill(): number {
    return this.goldBonusPerKill;
  }

  getTotalGoldEarned(): number {
    return this.totalGoldEarned;
  }

  getAllPlayerGold(): Map<string, number> {
    return this.playerGold;
  }
}
