import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { SERVER_CONFIG } from './config/serverConfig';
import { ClientToServerEvents, ServerToClientEvents } from './socket/events';
import { RoomManager } from './rooms/RoomManager';
import { SocketHandler } from './socket/SocketHandler';
import prisma from './db/prismaClient';
import redisClient from './cache/redisClient';

// ── Express App ──
const app = express();
app.use(cors());
app.use(express.json());

// ── HTTP Server ──
const server = http.createServer(app);

// ── Socket.io Server ──
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ── Initialize Services ──
const roomManager = new RoomManager();
const socketHandler = new SocketHandler(io, roomManager);

// ── Health Check Endpoint ──
app.get('/api/health', async (_req, res) => {
  let redisStatus = 'disconnected';
  let dbStatus = 'disconnected';

  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch {
    redisStatus = 'error';
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  const status = redisStatus === 'connected' && dbStatus === 'connected' ? 'healthy' : 'degraded';

  res.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeRooms: roomManager.getRoomCount(),
    connectedSockets: io.engine.clientsCount,
    redis: redisStatus,
    database: dbStatus,
    environment: SERVER_CONFIG.nodeEnv,
  });
});

// ── Start Server ──
server.listen(SERVER_CONFIG.port, () => {
  console.log(`[Server] Zombie Zone server running on port ${SERVER_CONFIG.port}`);
  console.log(`[Server] Environment: ${SERVER_CONFIG.nodeEnv}`);
  console.log(`[Server] Tick rate: ${SERVER_CONFIG.tickRate}Hz (${SERVER_CONFIG.tickInterval}ms)`);
});

// ── Graceful Shutdown ──
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });

  // Close all socket connections
  io.close(() => {
    console.log('[Server] Socket.io server closed');
  });

  // Disconnect Redis
  try {
    await redisClient.quit();
    console.log('[Server] Redis connection closed');
  } catch (err) {
    console.error('[Server] Error closing Redis:', err);
  }

  // Disconnect Prisma
  try {
    await prisma.$disconnect();
    console.log('[Server] Prisma connection closed');
  } catch (err) {
    console.error('[Server] Error closing Prisma:', err);
  }

  console.log('[Server] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  shutdown('uncaughtException');
});

export { app, server, io };
