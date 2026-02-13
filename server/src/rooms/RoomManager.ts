import { Room } from './Room';
import { PlayerInfo } from '../socket/events';
import { SERVER_CONFIG } from '../config/serverConfig';
import { saveRoomState, deleteRoom as deleteRoomCache } from '../cache/roomCache';

export class RoomManager {
  private rooms: Map<string, Room>;
  private socketToRoom: Map<string, string>;

  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  createRoom(): Room {
    const room = new Room();

    // Ensure unique room code
    while (this.rooms.has(room.roomCode)) {
      // Extremely unlikely collision, but handle it
      return this.createRoom();
    }

    this.rooms.set(room.roomCode, room);
    console.log(`[RoomManager] Room ${room.roomCode} created. Active rooms: ${this.rooms.size}`);
    return room;
  }

  joinRoom(
    roomCode: string,
    socketId: string,
    playerInfo: PlayerInfo
  ): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const result = room.addPlayer(socketId, playerInfo);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    this.socketToRoom.set(socketId, roomCode);

    // Persist room state to Redis
    saveRoomState(roomCode, {
      roomCode: room.roomCode,
      state: room.state,
      playerCount: room.getPlayerCount(),
      players: room.getPlayerList(),
      createdAt: room.createdAt,
    }).catch((err) => {
      console.error(`[RoomManager] Failed to save room state to Redis:`, err);
    });

    console.log(
      `[RoomManager] Player ${playerInfo.username} (${socketId}) joined room ${roomCode}. ` +
      `Players: ${room.getPlayerCount()}`
    );

    return { success: true, room };
  }

  leaveRoom(roomCode: string, socketId: string): { room?: Room; isEmpty: boolean } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { isEmpty: true };
    }

    room.removePlayer(socketId);
    this.socketToRoom.delete(socketId);

    const isEmpty = room.getPlayerCount() === 0;

    if (isEmpty) {
      // Start cleanup timer -- remove the room after the configured delay
      room.cleanupTimer = setTimeout(() => {
        this.removeRoom(roomCode);
      }, SERVER_CONFIG.roomCleanupDelay);

      console.log(
        `[RoomManager] Room ${roomCode} is empty. ` +
        `Scheduled cleanup in ${SERVER_CONFIG.roomCleanupDelay / 1000}s`
      );
    } else {
      // Update Redis state
      saveRoomState(roomCode, {
        roomCode: room.roomCode,
        state: room.state,
        playerCount: room.getPlayerCount(),
        players: room.getPlayerList(),
        createdAt: room.createdAt,
      }).catch((err) => {
        console.error(`[RoomManager] Failed to save room state to Redis:`, err);
      });
    }

    return { room, isEmpty };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomBySocketId(socketId: string): { roomCode: string; room: Room } | undefined {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) {
      return undefined;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      // Stale mapping, clean it up
      this.socketToRoom.delete(socketId);
      return undefined;
    }

    return { roomCode, room };
  }

  removeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    // Clear any pending timers
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }

    room.stopTick();

    // Remove all socket-to-room mappings for players still in this room
    for (const socketId of room.getPlayerIds()) {
      this.socketToRoom.delete(socketId);
    }

    this.rooms.delete(roomCode);

    // Clean up Redis
    deleteRoomCache(roomCode).catch((err) => {
      console.error(`[RoomManager] Failed to delete room state from Redis:`, err);
    });

    console.log(`[RoomManager] Room ${roomCode} removed. Active rooms: ${this.rooms.size}`);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
