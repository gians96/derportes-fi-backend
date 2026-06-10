import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionFormat,
  Match,
  MatchStatus,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchResultDto } from './dto/update-match-result.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByDiscipline(disciplineId: number) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
      select: {
        id: true,
        name: true,
        format: true,
        winPoints: true,
        drawPoints: true,
        lossPoints: true,
        allowDraw: true,
      },
    });
    if (!discipline) throw new NotFoundException('Disciplina no encontrada');

    const [rows, matches] = await Promise.all([
      this.prisma.standing.findMany({
        where: { disciplineId },
        include: { team: { select: { name: true } } },
        orderBy: [
          { points: 'desc' },
          { won: 'desc' },
          { goalsFor: 'desc' },
          { goalsAgainst: 'asc' },
        ],
      }),
      this.prisma.match.findMany({
        where: { disciplineId },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          winnerTeam: { select: { id: true, name: true } },
        },
        orderBy: [{ round: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      disciplineName: discipline.name,
      format: discipline.format,
      scoring: {
        winPoints: discipline.winPoints,
        drawPoints: discipline.drawPoints,
        lossPoints: discipline.lossPoints,
        allowDraw: discipline.allowDraw,
      },
      standings: rows.map((r, i) => ({
        position: i + 1,
        teamId: r.teamId,
        teamName: r.team.name,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        points: r.points,
      })),
      matches: this.mapMatches(matches),
    };
  }

  async getFixture(disciplineId: number) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
      include: {
        teams: {
          where: { status: RegistrationStatus.APPROVED },
          select: { id: true, name: true, cycle: true, section: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        },
        matches: {
          include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            winnerTeam: { select: { id: true, name: true } },
          },
          orderBy: [{ round: 'asc' }, { id: 'asc' }],
        },
        standings: {
          include: { team: { select: { name: true } } },
          orderBy: [
            { points: 'desc' },
            { won: 'desc' },
            { goalsFor: 'desc' },
            { goalsAgainst: 'asc' },
          ],
        },
      },
    });
    if (!discipline) throw new NotFoundException('Disciplina no encontrada');

    return {
      discipline: {
        id: discipline.id,
        name: discipline.name,
        format: discipline.format,
        winPoints: discipline.winPoints,
        drawPoints: discipline.drawPoints,
        lossPoints: discipline.lossPoints,
        allowDraw: discipline.allowDraw,
      },
      approvedTeams: discipline.teams,
      standings: discipline.standings.map((r, i) => ({
        position: i + 1,
        teamId: r.teamId,
        teamName: r.team.name,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        points: r.points,
      })),
      matches: this.mapMatches(discipline.matches),
    };
  }

  async generateFixture(disciplineId: number, resetPlayed = false) {
    await this.prisma.$transaction(async (tx) => {
      const discipline = await tx.discipline.findUnique({
        where: { id: disciplineId },
        include: {
          teams: {
            where: { status: RegistrationStatus.APPROVED },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          },
          matches: { select: { id: true, status: true } },
        },
      });
      if (!discipline) throw new NotFoundException('Disciplina no encontrada');
      if (discipline.teams.length < 2) {
        throw new BadRequestException(
          'Se necesitan al menos dos equipos aprobados para generar fixture',
        );
      }

      const playedCount = discipline.matches.filter(
        (m) => m.status === MatchStatus.PLAYED,
      ).length;
      if (playedCount && !resetPlayed) {
        throw new BadRequestException(
          'Ya existen partidos jugados. Confirma regenerar incluyendo jugados.',
        );
      }

      await tx.match.deleteMany({
        where: {
          disciplineId,
          ...(resetPlayed ? {} : { status: { not: MatchStatus.PLAYED } }),
        },
      });
      if (resetPlayed) {
        await tx.standing.deleteMany({ where: { disciplineId } });
      }

      const ordered = this.shuffle(discipline.teams);
      if (discipline.format === CompetitionFormat.POINTS) {
        await this.createRoundRobin(tx, discipline.id, ordered);
      } else {
        await this.createElimination(tx, discipline.id, ordered);
      }

      if (discipline.format === CompetitionFormat.POINTS) {
        await this.recalculateStandingsTx(tx, discipline.id);
      }
    });
    return this.getFixture(disciplineId);
  }

  async arrangeFixture(disciplineId: number, teamOrder: number[]) {
    await this.prisma.$transaction(async (tx) => {
      const discipline = await tx.discipline.findUnique({
        where: { id: disciplineId },
        include: {
          teams: {
            where: { status: RegistrationStatus.APPROVED },
            select: { id: true },
          },
          matches: { select: { id: true, status: true } },
        },
      });
      if (!discipline) throw new NotFoundException('Disciplina no encontrada');

      const approvedIds = discipline.teams.map((t) => t.id);
      const uniqueOrder = new Set(teamOrder);
      const sameLength =
        teamOrder.length === approvedIds.length &&
        uniqueOrder.size === teamOrder.length;
      const sameSet =
        sameLength && approvedIds.every((id) => uniqueOrder.has(id));
      if (!sameSet) {
        throw new BadRequestException(
          'El orden debe incluir exactamente a los equipos aprobados, sin repetidos ni faltantes',
        );
      }
      if (approvedIds.length < 2) {
        throw new BadRequestException(
          'Se necesitan al menos dos equipos aprobados para generar fixture',
        );
      }

      const hasPlayed = discipline.matches.some(
        (m) => m.status === MatchStatus.PLAYED,
      );
      if (hasPlayed) {
        throw new BadRequestException(
          'No puedes reordenar el sorteo con partidos ya jugados',
        );
      }

      await tx.match.deleteMany({ where: { disciplineId } });
      await tx.standing.deleteMany({ where: { disciplineId } });

      const orderedTeams = teamOrder.map((id) => ({ id }));
      if (discipline.format === CompetitionFormat.POINTS) {
        await this.createRoundRobin(tx, discipline.id, orderedTeams);
        await this.recalculateStandingsTx(tx, discipline.id);
      } else {
        await this.createElimination(tx, discipline.id, orderedTeams);
      }
    });
    return this.getFixture(disciplineId);
  }

  async updateMatch(id: number, dto: UpdateMatchDto) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');

    return this.prisma.match.update({
      where: { id },
      data: {
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async updateMatchResult(id: number, dto: UpdateMatchResultDto) {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id },
        include: { discipline: true },
      });
      if (!match) throw new NotFoundException('Partido no encontrado');
      if (!match.homeTeamId || !match.awayTeamId) {
        throw new BadRequestException(
          'El partido debe tener dos equipos antes de registrar resultado',
        );
      }

      const isDraw = dto.homeScore === dto.awayScore;
      if (isDraw && !match.discipline.allowDraw) {
        throw new BadRequestException('Esta disciplina no permite empates');
      }
      if (isDraw && match.discipline.format === CompetitionFormat.ELIMINATION) {
        throw new BadRequestException(
          'En eliminacion debe existir un ganador',
        );
      }

      const winnerTeamId = isDraw
        ? null
        : dto.homeScore > dto.awayScore
          ? match.homeTeamId
          : match.awayTeamId;

      const updated = await tx.match.update({
        where: { id },
        data: {
          homeScore: dto.homeScore,
          awayScore: dto.awayScore,
          winnerTeamId,
          status: MatchStatus.PLAYED,
        },
      });

      if (match.discipline.format === CompetitionFormat.POINTS) {
        await this.recalculateStandingsTx(tx, match.disciplineId);
      } else if (winnerTeamId) {
        await this.advanceWinner(tx, updated, winnerTeamId);
      }

      return updated;
    });
  }

  async recalculateStandings(disciplineId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.recalculateStandingsTx(tx, disciplineId);
    });
    return this.getFixture(disciplineId);
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

  private async createRoundRobin(
    tx: Tx,
    disciplineId: number,
    teams: { id: number }[],
  ) {
    const matches: Prisma.MatchCreateManyInput[] = [];
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        matches.push({
          disciplineId,
          round: i + 1,
          homeTeamId: teams[i].id,
          awayTeamId: teams[j].id,
          status: MatchStatus.PENDING,
        });
      }
    }
    if (matches.length) await tx.match.createMany({ data: matches });
  }

  private async createElimination(
    tx: Tx,
    disciplineId: number,
    teams: { id: number }[],
  ) {
    // Llave que minimiza los byes: en cada ronda se empareja la mayor cantidad
    // posible de equipos y, si la cantidad es impar, solo el ultimo pasa libre.
    const byes: { match: Match; winnerTeamId: number }[] = [];

    // Ronda 1: empareja consecutivamente el orden recibido.
    const round1Units = Math.ceil(teams.length / 2);
    for (let i = 0; i < round1Units; i += 1) {
      const home = teams[i * 2] ?? null;
      const away = teams[i * 2 + 1] ?? null;
      const winnerTeamId = home && !away ? home.id : null;
      const match = await tx.match.create({
        data: {
          disciplineId,
          round: 1,
          homeTeamId: home?.id ?? null,
          awayTeamId: away?.id ?? null,
          winnerTeamId,
          status: winnerTeamId ? MatchStatus.PLAYED : MatchStatus.PENDING,
        },
      });
      if (winnerTeamId) byes.push({ match, winnerTeamId });
    }

    // Rondas siguientes: vacias; cada ronda tiene la mitad (hacia arriba) de
    // unidades de la anterior, hasta llegar a la final.
    let round = 1;
    let prevUnits = round1Units;
    while (prevUnits > 1) {
      round += 1;
      const units = Math.ceil(prevUnits / 2);
      for (let i = 0; i < units; i += 1) {
        await tx.match.create({
          data: { disciplineId, round, status: MatchStatus.PENDING },
        });
      }
      prevUnits = units;
    }

    // Avanza los byes de la primera ronda (puede encadenar byes consecutivos).
    for (const bye of byes) {
      await this.advanceWinner(tx, bye.match, bye.winnerTeamId);
    }
  }

  private shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private async advanceWinner(tx: Tx, match: Match, winnerTeamId: number) {
    const nextRoundMatches = await tx.match.findMany({
      where: { disciplineId: match.disciplineId, round: match.round + 1 },
      orderBy: { id: 'asc' },
    });
    if (!nextRoundMatches.length) return;

    const currentRoundMatches = await tx.match.findMany({
      where: { disciplineId: match.disciplineId, round: match.round },
      orderBy: { id: 'asc' },
    });
    const matchIndex = currentRoundMatches.findIndex((m) => m.id === match.id);
    if (matchIndex < 0) return;

    const nextIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRoundMatches[nextIndex];
    if (!nextMatch) return;
    const isHome = matchIndex % 2 === 0;
    const updates = isHome
      ? { homeTeamId: winnerTeamId }
      : { awayTeamId: winnerTeamId };
    const currentSlot = isHome ? nextMatch.homeTeamId : nextMatch.awayTeamId;

    if (
      nextMatch.status === MatchStatus.PLAYED &&
      currentSlot &&
      currentSlot !== winnerTeamId
    ) {
      throw new BadRequestException(
        'No se puede cambiar este resultado porque la siguiente ronda ya fue jugada',
      );
    }

    // Si al siguiente partido nunca le llegara un rival (numero impar de
    // unidades en esta ronda), es un bye: el equipo avanza directo otra ronda.
    const awayFeedIndex = nextIndex * 2 + 1;
    const nextIsBye = awayFeedIndex >= currentRoundMatches.length;

    const updated = await tx.match.update({
      where: { id: nextMatch.id },
      data: {
        ...updates,
        ...(nextIsBye
          ? { winnerTeamId, status: MatchStatus.PLAYED }
          : {}),
      },
    });

    if (nextIsBye) {
      await this.advanceWinner(tx, updated, winnerTeamId);
    }
  }

  private async recalculateStandingsTx(tx: Tx, disciplineId: number) {
    const discipline = await tx.discipline.findUnique({
      where: { id: disciplineId },
      include: {
        teams: {
          where: { status: RegistrationStatus.APPROVED },
          select: { id: true },
        },
        matches: {
          where: { status: MatchStatus.PLAYED },
        },
      },
    });
    if (!discipline) throw new NotFoundException('Disciplina no encontrada');

    const rows = new Map<
      number,
      {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
      }
    >();
    for (const team of discipline.teams) {
      rows.set(team.id, {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }

    for (const match of discipline.matches) {
      if (
        !match.homeTeamId ||
        !match.awayTeamId ||
        match.homeScore === null ||
        match.awayScore === null
      ) {
        continue;
      }
      const home = rows.get(match.homeTeamId);
      const away = rows.get(match.awayTeamId);
      if (!home || !away) continue;

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore === match.awayScore) {
        home.drawn += 1;
        away.drawn += 1;
        home.points += discipline.drawPoints;
        away.points += discipline.drawPoints;
      } else if (match.homeScore > match.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += discipline.winPoints;
        away.points += discipline.lossPoints;
      } else {
        away.won += 1;
        home.lost += 1;
        away.points += discipline.winPoints;
        home.points += discipline.lossPoints;
      }
    }

    await tx.standing.deleteMany({ where: { disciplineId } });
    for (const [teamId, row] of rows) {
      await tx.standing.create({
        data: {
          disciplineId,
          teamId,
          ...row,
        },
      });
    }
  }

  private mapMatches(
    matches: (Match & {
      homeTeam?: { id: number; name: string } | null;
      awayTeam?: { id: number; name: string } | null;
      winnerTeam?: { id: number; name: string } | null;
    })[],
  ) {
    return matches.map((m) => ({
      id: m.id,
      disciplineId: m.disciplineId,
      round: m.round,
      homeTeamId: m.homeTeamId,
      homeTeamName: m.homeTeam?.name ?? null,
      awayTeamId: m.awayTeamId,
      awayTeamName: m.awayTeam?.name ?? null,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winnerTeamId: m.winnerTeamId,
      winnerTeamName: m.winnerTeam?.name ?? null,
      status: m.status,
      scheduledAt: m.scheduledAt,
    }));
  }
}
