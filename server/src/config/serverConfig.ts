export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  tickRate: 20,
  tickInterval: 50, // ms (1000 / 20)
  maxRoomsPerServer: 50,
  roomCleanupDelay: 60_000, // 60 seconds after all disconnect
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};
