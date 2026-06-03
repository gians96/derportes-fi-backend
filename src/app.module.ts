import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AcademicModule } from './academic/academic.module';
import { AuthModule } from './auth/auth.module';
import { FacultiesModule } from './faculties/faculties.module';
import { EventsModule } from './events/events.module';
import { DisciplinesModule } from './disciplines/disciplines.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { UsersModule } from './users/users.module';
import { StandingsModule } from './standings/standings.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOADS_DIR ?? 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AcademicModule,
    AuthModule,
    FacultiesModule,
    EventsModule,
    DisciplinesModule,
    RegistrationsModule,
    VouchersModule,
    UsersModule,
    StandingsModule,
    AdminModule,
  ],
})
export class AppModule {}
