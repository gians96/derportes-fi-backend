import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters?: {
    eventId?: number;
    facultyId?: number;
    schoolId?: number;
  }) {
    const eventWhere: Prisma.SportEventWhereInput = {};
    if (filters?.facultyId) eventWhere.facultyId = filters.facultyId;
    if (filters?.schoolId) eventWhere.schoolId = filters.schoolId;

    const where: Prisma.DisciplineWhereInput = {};
    if (filters?.eventId) where.eventId = filters.eventId;
    if (Object.keys(eventWhere).length) where.event = eventWhere;

    return this.prisma.discipline.findMany({
      where,
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { teams: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, name: true } },
        _count: { select: { teams: true } },
      },
    });
    if (!discipline) {
      throw new NotFoundException('Disciplina no encontrada');
    }
    return discipline;
  }

  create(dto: CreateDisciplineDto) {
    return this.prisma.discipline.create({
      data: {
        eventId: dto.eventId,
        name: dto.name,
        modality: dto.modality,
        genderPolicy: dto.genderPolicy,
        format: dto.format,
        participantType: dto.participantType,
        minPlayers: dto.minPlayers,
        maxPlayers: dto.maxPlayers,
        maxTeams: dto.maxTeams,
        isPaid: dto.isPaid,
        cost: dto.cost !== undefined ? new Prisma.Decimal(dto.cost) : undefined,
        rulesText: dto.rulesText,
        extraInfo: dto.extraInfo,
        registrationDeadline: new Date(dto.registrationDeadline),
      },
    });
  }

  async update(id: number, dto: UpdateDisciplineDto) {
    await this.findOne(id);
    return this.prisma.discipline.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.modality !== undefined && { modality: dto.modality }),
        ...(dto.genderPolicy !== undefined && {
          genderPolicy: dto.genderPolicy,
        }),
        ...(dto.format !== undefined && { format: dto.format }),
        ...(dto.participantType !== undefined && {
          participantType: dto.participantType,
        }),
        ...(dto.minPlayers !== undefined && { minPlayers: dto.minPlayers }),
        ...(dto.maxPlayers !== undefined && { maxPlayers: dto.maxPlayers }),
        ...(dto.maxTeams !== undefined && { maxTeams: dto.maxTeams }),
        ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
        ...(dto.cost !== undefined && { cost: new Prisma.Decimal(dto.cost) }),
        ...(dto.rulesText !== undefined && { rulesText: dto.rulesText }),
        ...(dto.extraInfo !== undefined && { extraInfo: dto.extraInfo }),
        ...(dto.registrationDeadline !== undefined && {
          registrationDeadline: new Date(dto.registrationDeadline),
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.discipline.delete({ where: { id } });
    return { success: true };
  }
}
