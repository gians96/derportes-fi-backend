import { Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationStatus, VoucherStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: VoucherStatus) {
    const vouchers = await this.prisma.voucher.findMany({
      where: status ? { status } : undefined,
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    return vouchers.map((v) => ({
      id: v.id,
      teamId: v.teamId,
      teamName: v.team.name,
      operationNumber: v.operationNumber ?? '',
      amount: Number(v.amount),
      imageUrl: v.imageUrl,
      status: v.status,
      rejectionReason: v.rejectionReason,
      uploadedAt: v.uploadedAt,
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
