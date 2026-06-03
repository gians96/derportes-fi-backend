import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RegistrationStatus, VoucherStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    status?: VoucherStatus;
    eventId?: number;
    facultyId?: number;
    schoolId?: number;
    disciplineId?: number;
  }) {
    const disciplineWhere: Prisma.DisciplineWhereInput = {};
    if (filters?.eventId) disciplineWhere.eventId = filters.eventId;

    const eventWhere: Prisma.SportEventWhereInput = {};
    if (filters?.facultyId) eventWhere.facultyId = filters.facultyId;
    if (filters?.schoolId) eventWhere.schoolId = filters.schoolId;
    if (Object.keys(eventWhere).length) disciplineWhere.event = eventWhere;

    const teamWhere: Prisma.TeamWhereInput = {};
    if (filters?.disciplineId) teamWhere.disciplineId = filters.disciplineId;
    if (Object.keys(disciplineWhere).length)
      teamWhere.discipline = disciplineWhere;

    const where: Prisma.VoucherWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (Object.keys(teamWhere).length) where.team = teamWhere;

    const vouchers = await this.prisma.voucher.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            phone: true,
            participants: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
                dni: true,
                gender: true,
                isDelegate: true,
                userId: true,
              },
            },
            discipline: {
              select: {
                id: true,
                name: true,
                participantType: true,
                minPlayers: true,
                maxPlayers: true,
                genderPolicy: true,
                event: {
                  select: {
                    id: true,
                    name: true,
                    faculty: { select: { id: true, name: true } },
                    school: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    return vouchers.map((v) => ({
      id: v.id,
      teamId: v.teamId,
      teamName: v.team.name,
      phone: v.team.phone,
      operationNumber: v.operationNumber ?? '',
      amount: Number(v.amount),
      imageUrl: v.imageUrl,
      status: v.status,
      rejectionReason: v.rejectionReason,
      uploadedAt: v.uploadedAt,
      disciplineName: v.team.discipline.name,
      participantType: v.team.discipline.participantType,
      minPlayers: v.team.discipline.minPlayers,
      maxPlayers: v.team.discipline.maxPlayers,
      genderPolicy: v.team.discipline.genderPolicy,
      eventName: v.team.discipline.event.name,
      facultyName: v.team.discipline.event.faculty?.name ?? '',
      schoolName: v.team.discipline.event.school?.name ?? '',
      participantsCount: v.team.participants.length,
      participants: v.team.participants,
    }));
  }

  async validate(id: number, validatedById: number) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Comprobante no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.voucher.update({
        where: { id },
        data: { status: VoucherStatus.VALIDATED, validatedById },
      });
      await tx.team.update({
        where: { id: voucher.teamId },
        data: { status: RegistrationStatus.APPROVED },
      });
      return updated;
    });
  }

  async reject(id: number, reason: string, validatedById: number) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Comprobante no encontrado');

    return this.prisma.voucher.update({
      where: { id },
      data: {
        status: VoucherStatus.REJECTED,
        rejectionReason: reason,
        validatedById,
      },
    });
  }
}
