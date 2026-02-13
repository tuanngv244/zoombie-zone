import { setex, get, del } from './redisClient';

const SESSION_TTL = 300; // seconds

function sessionKey(socketId: string): string {
  return `session:${socketId}`;
}

export interface SessionData {
  socketId: string;
  roomId: string;
  playerId: string;
}

export async function saveSession(
  socketId: string,
  roomId: string,
  playerId: string
): Promise<void> {
  const data: SessionData = { socketId, roomId, playerId };
  const serialized = JSON.stringify(data);
  await setex(sessionKey(socketId), SESSION_TTL, serialized);
}

export async function getSession(socketId: string): Promise<SessionData | null> {
  const raw = await get(sessionKey(socketId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as SessionData;
}

export async function deleteSession(socketId: string): Promise<void> {
  await del(sessionKey(socketId));
}
