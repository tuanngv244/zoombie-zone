import prisma from './prismaClient';

export interface PlayerMatchStats {
  playerId: string;
  kills: number;
  goldEarned: number;
  buildingsPlaced: number;
}

export interface MatchRecord {
  id: string;
  roomId: string;
  result: string;
  waveReached: number;
  duration: number;
  playedAt: Date;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  totalKills: number;
  gamesWon: number;
  gamesPlayed: number;
}

export async function saveMatch(
  roomId: string,
  result: 'victory' | 'defeat',
  waveReached: number,
  duration: number,
  playerStats: PlayerMatchStats[]
): Promise<MatchRecord> {
  const match = await prisma.$transaction(async (tx) => {
    // Create the match history record
    const matchRecord = await tx.matchHistory.create({
      data: {
        roomId,
        result,
        waveReached,
        duration,
        matchPlayers: {
          create: playerStats.map((ps) => ({
            playerId: ps.playerId,
            kills: ps.kills,
            goldEarned: ps.goldEarned,
            buildingsPlaced: ps.buildingsPlaced,
          })),
        },
      },
    });

    // Update leaderboard for each player
    for (const ps of playerStats) {
      await tx.leaderboard.upsert({
        where: { playerId: ps.playerId },
        create: {
          playerId: ps.playerId,
          totalKills: ps.kills,
          gamesWon: result === 'victory' ? 1 : 0,
          gamesPlayed: 1,
        },
        update: {
          totalKills: { increment: ps.kills },
          gamesWon: result === 'victory' ? { increment: 1 } : undefined,
          gamesPlayed: { increment: 1 },
        },
      });
    }

    return matchRecord;
  });

  return match;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const entries = await prisma.leaderboard.findMany({
    orderBy: { gamesWon: 'desc' },
    take: limit,
    include: {
      player: {
        select: { username: true },
      },
    },
  });

  return entries.map((entry) => ({
    playerId: entry.playerId,
    username: entry.player.username,
    totalKills: entry.totalKills,
    gamesWon: entry.gamesWon,
    gamesPlayed: entry.gamesPlayed,
  }));
}
