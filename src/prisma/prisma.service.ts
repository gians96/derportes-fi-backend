import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaService | undefined;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    if (globalForPrisma.prisma) {
      return globalForPrisma.prisma;
    }
    super();
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = this;
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = undefined;
    }
  }
}
