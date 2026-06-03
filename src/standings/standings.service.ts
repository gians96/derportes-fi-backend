import { Injectable } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByDiscipline(disciplineId: number) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
      select: { name: true },
    });

    const rows = await this.prisma.standing.findMany({
      where: { disciplineId },
      include: { team: { select: { name: true } } },
      orderBy: [{ points: 'desc' }, { won: 'desc' }],
    });

    return {
      disciplineName: discipline?.name ?? '',
      standings: rows.map((r, i) => ({
        position: i + 1,
        teamId: r.teamId,
        teamName: r.team.name,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        points: r.points,
      })),
    };
  }

  async getHistoryForUser(userId: number) {
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.PLAYED,
        OR: [
          { homeTeam: { delegateId: userId } },
          { awayTeam: { delegateId: userId } },
          { homeTeam: { participants: { some: { userId } } } },
          { awayTeam: { participants: { some: { userId } } } },
        ],
      },
      include: {
        discipline: { select: { name: true } },
        homeTeam: { select: { id: true, name: true, delegateId: true } },
        awayTeam: { select: { id: true, name: true, delegateId: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return matches.map((m) => {
      const isHome = m.homeTeam?.delegateId === userId;
      const team = isHome ? m.homeTeam : m.awayTeam;
      let result = 'empate';
      if (m.winnerTeamId) {
        result = m.winnerTeamId === team?.id ? 'ganado' : 'perdido';
      }
      return {
        discipline: m.discipline.name,
        team: team?.name ?? '',
        result,
        date: m.scheduledAt ?? m.updatedAt,
      };
    });
  }
}
