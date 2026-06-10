import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleRoundOneDto } from './dto/schedule-round-one.dto';

interface PlayerLike {
  studentCode: string | null;
  dni: string | null;
  userId: number | null;
  fullName: string;
  countsAsPlayer: boolean;
}

interface MatchNode {
  matchId: number;
  disciplineId: number;
  disciplineName: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  playerKeys: Set<string>;
}

export interface ScheduledMatch {
  matchId: number;
  disciplineId: number;
  disciplineName: string;
  round: number;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  slot: number;
  court: number;
  scheduledAt: string;
}

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async scheduleRoundOne(dto: ScheduleRoundOneDto) {
    const disciplineIds = [...new Set(dto.disciplineIds)];
    if (!disciplineIds.length) {
      throw new BadRequestException('Selecciona al menos una disciplina.');
    }

    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('La fecha de inicio no es válida.');
    }

    const disciplines = await this.prisma.discipline.findMany({
      where: { id: { in: disciplineIds } },
      select: {
        id: true,
        name: true,
        matchDurationMinutes: true,
        courtsCount: true,
      },
    });
    if (disciplines.length !== disciplineIds.length) {
      throw new BadRequestException('Una o más disciplinas no existen.');
    }
    const disciplineMap = new Map(disciplines.map((d) => [d.id, d]));

    const slotMinutes = dto.slotMinutes ?? this.inferSlotMinutes(disciplines);

    const matches = await this.prisma.match.findMany({
      where: {
        disciplineId: { in: disciplineIds },
        round: 1,
        homeTeamId: { not: null },
        awayTeamId: { not: null },
      },
      orderBy: { id: 'asc' },
      include: {
        homeTeam: { include: { participants: true } },
        awayTeam: { include: { participants: true } },
      },
    });

    const nodes: MatchNode[] = matches.map((match) => {
      const playerKeys = new Set<string>();
      const participants: PlayerLike[] = [
        ...(match.homeTeam?.participants ?? []),
        ...(match.awayTeam?.participants ?? []),
      ];
      for (const participant of participants) {
        if (!participant.countsAsPlayer) continue;
        const key = this.playerKey(participant);
        if (key) playerKeys.add(key);
      }
      return {
        matchId: match.id,
        disciplineId: match.disciplineId,
        disciplineName: disciplineMap.get(match.disciplineId)?.name ?? '',
        homeTeamId: match.homeTeamId as number,
        awayTeamId: match.awayTeamId as number,
        homeTeamName: match.homeTeam?.name ?? '',
        awayTeamName: match.awayTeam?.name ?? '',
        playerKeys,
      };
    });

    const adjacency = new Map<number, Set<number>>();
    for (const node of nodes) adjacency.set(node.matchId, new Set<number>());
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (this.sharesPlayer(nodes[i], nodes[j])) {
          adjacency.get(nodes[i].matchId)!.add(nodes[j].matchId);
          adjacency.get(nodes[j].matchId)!.add(nodes[i].matchId);
        }
      }
    }

    // Welsh-Powell style: assign the most constrained matches first.
    const ordered = [...nodes].sort((a, b) => {
      const degreeA = adjacency.get(a.matchId)!.size;
      const degreeB = adjacency.get(b.matchId)!.size;
      if (degreeB !== degreeA) return degreeB - degreeA;
      return a.matchId - b.matchId;
    });

    const slotMatches = new Map<number, Set<number>>();
    const slotDisciplineCount = new Map<string, number>();
    const result: ScheduledMatch[] = [];

    for (const node of ordered) {
      const courts = disciplineMap.get(node.disciplineId)?.courtsCount ?? 1;
      const neighbors = adjacency.get(node.matchId)!;

      let slot = 0;
      for (;;) {
        const inSlot = slotMatches.get(slot);
        const hasConflict =
          !!inSlot && [...neighbors].some((id) => inSlot.has(id));
        const discKey = `${slot}:${node.disciplineId}`;
        const used = slotDisciplineCount.get(discKey) ?? 0;
        if (!hasConflict && used < courts) break;
        slot += 1;
      }

      const discKey = `${slot}:${node.disciplineId}`;
      const court = (slotDisciplineCount.get(discKey) ?? 0) + 1;
      slotDisciplineCount.set(discKey, court);

      const set = slotMatches.get(slot) ?? new Set<number>();
      set.add(node.matchId);
      slotMatches.set(slot, set);

      const scheduledAt = new Date(
        startAt.getTime() + slot * slotMinutes * 60_000,
      );

      result.push({
        matchId: node.matchId,
        disciplineId: node.disciplineId,
        disciplineName: node.disciplineName,
        round: 1,
        homeTeamId: node.homeTeamId,
        homeTeamName: node.homeTeamName,
        awayTeamId: node.awayTeamId,
        awayTeamName: node.awayTeamName,
        slot,
        court,
        scheduledAt: scheduledAt.toISOString(),
      });
    }

    result.sort(
      (a, b) =>
        a.slot - b.slot ||
        a.disciplineId - b.disciplineId ||
        a.court - b.court,
    );

    const applied = dto.dryRun === false;
    if (applied && result.length) {
      await this.prisma.$transaction(
        result.map((item) =>
          this.prisma.match.update({
            where: { id: item.matchId },
            data: { scheduledAt: new Date(item.scheduledAt) },
          }),
        ),
      );
    }

    const slotsUsed = result.length
      ? Math.max(...result.map((item) => item.slot)) + 1
      : 0;

    return {
      applied,
      startAt: startAt.toISOString(),
      slotMinutes,
      slotsUsed,
      totalMatches: result.length,
      disciplines: disciplines.map((d) => ({
        id: d.id,
        name: d.name,
        courtsCount: d.courtsCount,
        matchDurationMinutes: d.matchDurationMinutes,
      })),
      matches: result,
    };
  }

  private inferSlotMinutes(
    disciplines: { matchDurationMinutes: number }[],
  ): number {
    const durations = disciplines
      .map((d) => d.matchDurationMinutes)
      .filter((value) => value > 0);
    if (!durations.length) return 30;
    return Math.max(...durations);
  }

  private playerKey(player: PlayerLike): string | null {
    if (player.studentCode && player.studentCode.trim()) {
      return `code:${player.studentCode.trim().toLowerCase()}`;
    }
    if (player.dni && player.dni.trim()) {
      return `dni:${player.dni.trim().toLowerCase()}`;
    }
    if (player.userId) {
      return `user:${player.userId}`;
    }
    if (player.fullName && player.fullName.trim()) {
      return `name:${player.fullName.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    }
    return null;
  }

  private sharesPlayer(a: MatchNode, b: MatchNode): boolean {
    const [small, large] =
      a.playerKeys.size <= b.playerKeys.size
        ? [a.playerKeys, b.playerKeys]
        : [b.playerKeys, a.playerKeys];
    for (const key of small) {
      if (large.has(key)) return true;
    }
    return false;
  }
}
