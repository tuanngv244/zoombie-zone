import prisma from './prismaClient';

export interface PlayerRecord {
  id: string;
  username: string;
  createdAt: Date;
}

export async function findOrCreate(username: string): Promise<PlayerRecord> {
  const existing = await prisma.player.findUnique({
    where: { username },
  });

  if (existing) {
    return existing;
  }

  const created = await prisma.player.create({
    data: { username },
  });

  return created;
}

export async function findById(id: string): Promise<PlayerRecord | null> {
  const player = await prisma.player.findUnique({
    where: { id },
  });

  return player;
}
