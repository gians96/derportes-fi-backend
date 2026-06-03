import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GenderPolicy,
  Prisma,
  RegistrationStatus,
  VoucherStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRegistrationDto,
  ParticipantDto,
} from './dto/create-registration.dto';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: RegistrationStatus) {
    return this.prisma.team.findMany({
      where: status ? { status } : undefined,
      include: {
        participants: true,
        discipline: { select: { name: true } },
        voucher: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMine(userId: number) {
    return this.prisma.team.findMany({
      where: { delegateId: userId },
      include: {
        participants: true,
        discipline: { select: { name: true } },
        voucher: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private validateAgainstDiscipline(
    discipline: {
      minPlayers: number;
      maxPlayers: number;
      genderPolicy: GenderPolicy;
      registrationDeadline: Date;
      maxTeams: number;
    },
    participants: ParticipantDto[],
    currentTeamCount: number,
  ) {
    if (new Date() > discipline.registrationDeadline) {
      throw new BadRequestException(
        'El plazo de inscripción para esta disciplina ya cerró',
      );
    }

    if (discipline.maxTeams > 0 && currentTeamCount >= discipline.maxTeams) {
      throw new BadRequestException(
        'Se alcanzó el número máximo de equipos para esta disciplina',
      );
    }

    if (
      participants.length < discipline.minPlayers ||
      participants.length > discipline.maxPlayers
    ) {
      throw new BadRequestException(
        `El equipo debe tener entre ${discipline.minPlayers} y ${discipline.maxPlayers} integrantes`,
      );
    }

    // Validación de duplicados por DNI/código dentro del mismo equipo
    const identifiers = new Set<string>();
    for (const p of participants) {
      const id = (p.studentCode || p.dni || '').toLowerCase();
      if (id && identifiers.has(id)) {
        throw new BadRequestException(
          `Integrante duplicado: ${p.fullName}`,
        );
      }
      if (id) identifiers.add(id);
    }

    // Validación de política de género
    if (discipline.genderPolicy === GenderPolicy.MALE) {
      if (participants.some((p) => p.gender === 'F')) {
        throw new BadRequestException('Esta disciplina es solo masculina');
      }
    } else if (discipline.genderPolicy === GenderPolicy.FEMALE) {
      if (participants.some((p) => p.gender === 'M')) {
        throw new BadRequestException('Esta disciplina es solo femenina');
      }
    }
  }

  async create(
    userId: number,
    dto: CreateRegistrationDto,
    voucherPath?: string,
    delegateId?: number,
  ) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: Number(dto.disciplineId) },
      include: { _count: { select: { teams: true } } },
    });
    if (!discipline) {
      throw new NotFoundException('Disciplina no encontrada');
    }

    const finalDelegateId = delegateId ?? userId;
    if (delegateId) {
      const delegate = await this.prisma.user.findUnique({
        where: { id: delegateId },
      });
      if (!delegate) {
        throw new NotFoundException('Delegado no encontrado');
      }
    }

    this.validateAgainstDiscipline(
      discipline,
      dto.participants,
      discipline._count.teams,
    );

    if (discipline.isPaid && !voucherPath) {
      throw new BadRequestException(
        'Esta disciplina requiere adjuntar el comprobante de pago',
      );
    }

    const delegateIndex = dto.participants.findIndex((p) => p.isDelegate);

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.teamName,
          disciplineId: discipline.id,
          delegateId: finalDelegateId,
          phone: dto.phone,
          status: RegistrationStatus.PENDING,
          participants: {
            create: dto.participants.map((p, i) => ({
              fullName: p.fullName,
              studentCode: p.studentCode ?? null,
              dni: p.dni ?? null,
              gender: p.gender ?? 'O',
              isDelegate: i === delegateIndex,
            })),
          },
        },
      });

      if (discipline.isPaid && voucherPath) {
        await tx.voucher.create({
          data: {
            teamId: team.id,
            operationNumber: dto.operationNumber ?? null,
            amount: new Prisma.Decimal(discipline.cost),
            imageUrl: voucherPath,
            status: VoucherStatus.PENDING,
          },
        });
      }

      return tx.team.findUnique({
        where: { id: team.id },
        include: { participants: true, voucher: true },
      });
    });
  }

  async approve(id: number) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    return this.prisma.team.update({
      where: { id },
      data: { status: RegistrationStatus.APPROVED, rejectionReason: null },
    });
  }

  async reject(id: number, reason: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    return this.prisma.team.update({
      where: { id },
      data: { status: RegistrationStatus.REJECTED, rejectionReason: reason },
    });
  }
}
