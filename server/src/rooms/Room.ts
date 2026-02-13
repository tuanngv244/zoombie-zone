import { PlayerInfo } from '../socket/events';
import { SERVER_CONFIG } from '../config/serverConfig';

export type RoomState = 'waiting' | 'preparation' | 'in_progress' | 'ended';

const MAX_PLAYERS = 4;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

export class Room {
  public readonly roomCode: string;
  public readonly players: Map<string, PlayerInfo>;
  public state: RoomState;
  public gameEngine: any;
  public cleanupTimer: ReturnType<typeof setTimeout> | null;
  public tickInterval: ReturnType<typeof setInterval> | null;
  public readonly createdAt: number;

  constructor() {
    this.roomCode = generateRoomCode();
    this.players = new Map();
    this.state = 'waiting';
    this.gameEngine = null;
    this.cleanupTimer = null;
    this.tickInterval = null;
    this.createdAt = Date.now();
  }

  addPlayer(socketId: string, playerInfo: PlayerInfo): { success: boolean; error?: string } {
    if (this.players.size >= MAX_PLAYERS) {
      return { success: false, error: 'Room is full (max 4 players)' };
    }

    if (this.state !== 'waiting') {
      return { success: false, error: 'Game already in progress' };
    }

    if (this.players.has(socketId)) {
      return { success: false, error: 'Player already in room' };
    }

    // Cancel cleanup timer if a new player joins
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.players.set(socketId, playerInfo);
    return { success: true };
  }

  removePlayer(socketId: string): boolean {
    const removed = this.players.delete(socketId);
    return removed;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayerIds(): string[] {
    return Array.from(this.players.keys());
  }

  getPlayerList(): PlayerInfo[] {
    return Array.from(this.players.values());
  }

  setState(state: RoomState): void {
    this.state = state;
  }

  stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  toJSON(): object {
    return {
      roomCode: this.roomCode,
      state: this.state,
      playerCount: this.players.size,
      players: this.getPlayerList(),
      createdAt: this.createdAt,
    };
  }
}
