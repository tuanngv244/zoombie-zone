import { get, set, del } from './redisClient';

function roomKey(roomId: string): string {
  return `room:${roomId}:state`;
}

export interface RoomState {
  roomCode: string;
  state: string;
  playerCount: number;
  players: Array<{ id: string; username: string }>;
  createdAt: number;
}

export async function saveRoomState(roomId: string, state: RoomState): Promise<void> {
  const serialized = JSON.stringify(state);
  await set(roomKey(roomId), serialized);
}

export async function getRoomState(roomId: string): Promise<RoomState | null> {
  const raw = await get(roomKey(roomId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as RoomState;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await del(roomKey(roomId));
}
