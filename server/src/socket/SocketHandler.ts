import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerInfo,
  GameStateSnapshot,
  ArmyUnitSnapshot,
} from './events';
import { RoomManager } from '../rooms/RoomManager';
import { Room } from '../rooms/Room';
import { SERVER_CONFIG } from '../config/serverConfig';
import { saveSession, deleteSession } from '../cache/sessionCache';
import { saveMatch, PlayerMatchStats } from '../db/matchRepository';
import { findOrCreate } from '../db/playerRepository';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketHandler {
  private io: TypedServer;
  private roomManager: RoomManager;

  constructor(io: TypedServer, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.setupConnectionHandler();
  }

  private setupConnectionHandler(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      this.handleCreateRoom(socket);
      this.handleJoinRoom(socket);
      this.handleStartGame(socket);
      this.handlePlaceBuilding(socket);
      this.handleMoveBuilding(socket);
      this.handleSellBuilding(socket);
      this.handleUpgradeCastle(socket);
      this.handleRepairCastle(socket);
      this.handleSpawnArmy(socket);
      this.handleDisconnect(socket);
    });
  }

  private handleCreateRoom(socket: TypedSocket): void {
    socket.on('create_room', async (data) => {
      try {
        const { username } = data;

        // Leave any existing room first
        const existing = this.roomManager.getRoomBySocketId(socket.id);
        if (existing) {
          const player = existing.room.players.get(socket.id);
          this.roomManager.leaveRoom(existing.roomCode, socket.id);
          socket.leave(existing.roomCode);
          if (player) {
            this.io.to(existing.roomCode).emit('player_left', { playerId: player.id });
          }
        }

        // Find or create the player in DB
        const player = await findOrCreate(username);

        const room = this.roomManager.createRoom();
        const playerInfo: PlayerInfo = {
          id: player.id,
          username: player.username,
        };

        const joinResult = this.roomManager.joinRoom(room.roomCode, socket.id, playerInfo);
        if (!joinResult.success) {
          socket.emit('error', { message: joinResult.error || 'Failed to create room' });
          return;
        }

        // Join the socket.io room
        socket.join(room.roomCode);

        // Save session to Redis
        await saveSession(socket.id, room.roomCode, player.id);

        socket.emit('room_created', { roomCode: room.roomCode });
        socket.emit('room_joined', {
          roomCode: room.roomCode,
          players: room.getPlayerList(),
          state: room.state,
        });

        console.log(
          `[Socket] ${username} created and joined room ${room.roomCode}`
        );
      } catch (err) {
        console.error('[Socket] Error creating room:', err);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });
  }

  private handleJoinRoom(socket: TypedSocket): void {
    socket.on('join_room', async (data) => {
      try {
        const { roomCode, username } = data;

        // Leave any existing room first
        const existing = this.roomManager.getRoomBySocketId(socket.id);
        if (existing) {
          const existingPlayer = existing.room.players.get(socket.id);
          this.roomManager.leaveRoom(existing.roomCode, socket.id);
          socket.leave(existing.roomCode);
          if (existingPlayer) {
            this.io.to(existing.roomCode).emit('player_left', { playerId: existingPlayer.id });
          }
        }

        // Find or create the player in DB
        const player = await findOrCreate(username);

        const playerInfo: PlayerInfo = {
          id: player.id,
          username: player.username,
        };

        const joinResult = this.roomManager.joinRoom(roomCode, socket.id, playerInfo);
        if (!joinResult.success) {
          socket.emit('error', { message: joinResult.error || 'Failed to join room' });
          return;
        }

        const room = joinResult.room!;

        // Join the socket.io room
        socket.join(roomCode);

        // Save session to Redis
        await saveSession(socket.id, roomCode, player.id);

        // Emit to the joining player
        socket.emit('room_joined', {
          roomCode,
          players: room.getPlayerList(),
          state: room.state,
        });

        // Emit to others in the room
        socket.to(roomCode).emit('player_joined', playerInfo);

        console.log(`[Socket] ${username} joined room ${roomCode}`);
      } catch (err) {
        console.error('[Socket] Error joining room:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
  }

  private handleStartGame(socket: TypedSocket): void {
    socket.on('start_game', async () => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;

        if (room.state !== 'waiting') {
          socket.emit('error', { message: 'Game has already started' });
          return;
        }

        // Dynamically import GameEngine (built by another agent)
        const { GameEngine } = await import('../game/GameEngine');

        const engine = new GameEngine();
        // Pass PlayerInfo[] so engine can set up per-player gold and castles
        engine.init(room.getPlayerList());
        room.gameEngine = engine;
        room.setState('preparation');

        // Send initial game state to all players
        const fullState: GameStateSnapshot = engine.getFullState();
        fullState.players = room.getPlayerList();
        this.io.to(roomCode).emit('game_state', fullState);
        this.io.to(roomCode).emit('preparation_start', {
          duration: fullState.timeRemaining,
        });

        // Setup engine event callbacks
        this.setupGameEngineCallbacks(room, roomCode);

        // Start the game tick loop
        room.tickInterval = setInterval(() => {
          this.gameTick(room, roomCode);
        }, SERVER_CONFIG.tickInterval);

        console.log(`[Socket] Game started in room ${roomCode}`);
      } catch (err) {
        console.error('[Socket] Error starting game:', err);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });
  }

  private setupGameEngineCallbacks(room: Room, roomCode: string): void {
    const engine = room.gameEngine;
    if (!engine) return;

    engine.onDamageDealt = (data: {
      targetId: string;
      amount: number;
      remainingHp: number;
      targetType: 'enemy' | 'building' | 'castle';
    }) => {
      this.io.to(roomCode).emit('damage_dealt', data);
    };

    engine.onEnemyDied = (data: { id: string; goldReward: number; rewardPlayerId?: string }) => {
      this.io.to(roomCode).emit('enemy_died', { id: data.id, goldReward: data.goldReward });
    };

    engine.onBuildingDestroyed = (data: { id: string }) => {
      this.io.to(roomCode).emit('building_destroyed', data);
    };

    engine.onGoldChanged = (data: { playerId: string; gold: number }) => {
      this.io.to(roomCode).emit('gold_updated', { playerId: data.playerId, gold: data.gold });
    };

    engine.onCastleUpdated = (data: { playerId: string; hp: number; maxHp: number; upgrades: string[] }) => {
      this.io.to(roomCode).emit('castle_updated', {
        playerId: data.playerId,
        hp: data.hp,
        maxHp: data.maxHp,
        upgrades: data.upgrades,
      });
    };

    engine.onWaveWarning = (data: {
      waveNumber: number;
      waveType: 'zombie' | 'invader';
      countdown: number;
    }) => {
      this.io.to(roomCode).emit('wave_warning', data);
    };

    engine.onWaveStart = (data: {
      waveNumber: number;
      waveType: 'zombie' | 'invader';
      enemyCount: number;
    }) => {
      this.io.to(roomCode).emit('wave_start', data);
    };

    engine.onArmyUnitSpawned = (data: ArmyUnitSnapshot) => {
      this.io.to(roomCode).emit('army_unit_spawned', data);
    };

    engine.onArmyUnitDied = (data: { id: string }) => {
      this.io.to(roomCode).emit('army_unit_died', data);
    };

    engine.onGameOver = async (data: {
      result: 'victory' | 'defeat';
      stats: {
        waveReached: number;
        totalKills: number;
        totalGoldEarned: number;
        totalBuildingsPlaced: number;
        duration: number;
      };
    }) => {
      room.setState('ended');
      room.stopTick();

      this.io.to(roomCode).emit('game_over', {
        result: data.result,
        stats: data.stats,
      });

      // Save match to database
      try {
        const playerStats: PlayerMatchStats[] = room.getPlayerList().map((p) => ({
          playerId: p.id,
          kills: Math.floor(data.stats.totalKills / room.getPlayerCount()),
          goldEarned: Math.floor(data.stats.totalGoldEarned / room.getPlayerCount()),
          buildingsPlaced: Math.floor(data.stats.totalBuildingsPlaced / room.getPlayerCount()),
        }));

        await saveMatch(
          roomCode,
          data.result,
          data.stats.waveReached,
          data.stats.duration,
          playerStats
        );

        console.log(
          `[Socket] Match saved for room ${roomCode}: ${data.result}, wave ${data.stats.waveReached}`
        );
      } catch (err) {
        console.error('[Socket] Failed to save match:', err);
      }
    };
  }

  private gameTick(room: Room, roomCode: string): void {
    if (!room.gameEngine || room.state === 'ended') {
      room.stopTick();
      return;
    }

    try {
      const deltaTime = SERVER_CONFIG.tickInterval / 1000; // Convert ms to seconds
      room.gameEngine.tick(deltaTime);

      const state: GameStateSnapshot = room.gameEngine.getFullState();

      // Emit enemy positions to all players in the room
      this.io.to(roomCode).emit('enemy_update', state.enemies);

      // Emit army unit positions if any
      if (state.armyUnits && state.armyUnits.length > 0) {
        this.io.to(roomCode).emit('army_unit_update', state.armyUnits);
      }

      // Emit timer/phase update
      this.io.to(roomCode).emit('timer_update', {
        phase: state.phase,
        timeRemaining: state.timeRemaining,
      });
    } catch (err) {
      console.error(`[Socket] Tick error in room ${roomCode}:`, err);
    }
  }

  private handlePlaceBuilding(socket: TypedSocket): void {
    socket.on('place_building', (data) => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const player = room.players.get(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }

        const result = room.gameEngine.handlePlaceBuilding(
          data.type,
          data.gridX,
          data.gridY,
          player.id
        );

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to place building' });
          return;
        }

        this.io.to(roomCode).emit('building_placed', result.building);

        // Gold update is now emitted per-player via engine callback
      } catch (err) {
        console.error('[Socket] Error placing building:', err);
        socket.emit('error', { message: 'Failed to place building' });
      }
    });
  }

  private handleMoveBuilding(socket: TypedSocket): void {
    socket.on('move_building', (data) => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const result = room.gameEngine.handleMoveBuilding(data.buildingId, data.gridX, data.gridY);

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to move building' });
          return;
        }

        this.io.to(roomCode).emit('building_moved', {
          id: data.buildingId,
          gridX: data.gridX,
          gridY: data.gridY,
        });
      } catch (err) {
        console.error('[Socket] Error moving building:', err);
        socket.emit('error', { message: 'Failed to move building' });
      }
    });
  }

  private handleSellBuilding(socket: TypedSocket): void {
    socket.on('sell_building', (data) => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const player = room.players.get(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }

        // Pass the seller's player ID so refund goes to the correct player
        const result = room.gameEngine.handleSellBuilding(data.buildingId, player.id);

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to sell building' });
          return;
        }

        this.io.to(roomCode).emit('building_sold', {
          id: data.buildingId,
          refund: result.refund ?? 0,
        });

        // Gold update is now emitted per-player via engine callback
      } catch (err) {
        console.error('[Socket] Error selling building:', err);
        socket.emit('error', { message: 'Failed to sell building' });
      }
    });
  }

  private handleUpgradeCastle(socket: TypedSocket): void {
    socket.on('upgrade_castle', (data) => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const player = room.players.get(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }

        // Pass the player ID so upgrade costs come from their gold
        const result = room.gameEngine.handleUpgradeCastle(data.upgradeType, player.id);

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to upgrade castle' });
          return;
        }

        this.io.to(roomCode).emit('castle_upgrade_applied', {
          upgradeType: data.upgradeType,
        });

        // Gold and castle updates are now emitted per-player via engine callbacks
      } catch (err) {
        console.error('[Socket] Error upgrading castle:', err);
        socket.emit('error', { message: 'Failed to upgrade castle' });
      }
    });
  }

  private handleRepairCastle(socket: TypedSocket): void {
    socket.on('repair_castle', () => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const player = room.players.get(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }

        // Pass the player ID so repair costs come from their gold
        const result = room.gameEngine.handleRepairCastle(player.id);

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to repair castle' });
          return;
        }

        // Castle and gold updates are emitted per-player via engine callbacks
      } catch (err) {
        console.error('[Socket] Error repairing castle:', err);
        socket.emit('error', { message: 'Failed to repair castle' });
      }
    });
  }

  private handleSpawnArmy(socket: TypedSocket): void {
    socket.on('spawn_army', (data) => {
      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (!found) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { roomCode, room } = found;
        if (!room.gameEngine) {
          socket.emit('error', { message: 'Game not started' });
          return;
        }

        const player = room.players.get(socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }

        const result = room.gameEngine.handleSpawnArmy(
          data.unitType,
          player.id,
          data.targetPlayerId,
        );

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Failed to spawn army unit' });
          return;
        }

        // Army unit spawned and gold update events are emitted via engine callbacks
      } catch (err) {
        console.error('[Socket] Error spawning army:', err);
        socket.emit('error', { message: 'Failed to spawn army unit' });
      }
    });
  }

  private handleDisconnect(socket: TypedSocket): void {
    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      try {
        const found = this.roomManager.getRoomBySocketId(socket.id);
        if (found) {
          const { roomCode, room } = found;
          const player = room.players.get(socket.id);
          const playerId = player?.id || socket.id;

          this.roomManager.leaveRoom(roomCode, socket.id);

          // Notify remaining players
          this.io.to(roomCode).emit('player_left', { playerId });
        }

        // Clean up session from Redis
        await deleteSession(socket.id);
      } catch (err) {
        console.error('[Socket] Error handling disconnect:', err);
      }
    });
  }
}
