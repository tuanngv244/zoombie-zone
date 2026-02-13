import Redis from 'ioredis';
import { SERVER_CONFIG } from '../config/serverConfig';

const redis = new Redis(SERVER_CONFIG.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      console.error('[Redis] Max reconnection attempts reached. Giving up.');
      return null;
    }
    const delay = Math.min(times * 200, 5000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('close', () => {
  console.log('[Redis] Connection closed');
});

export async function get(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function set(key: string, value: string): Promise<void> {
  await redis.set(key, value);
}

export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export async function setex(key: string, ttl: number, value: string): Promise<void> {
  await redis.setex(key, ttl, value);
}

export { redis as default };
