import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SchedulingService } from './scheduling.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ScheduleRoundOneDto } from './dto/schedule-round-one.dto';

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Post('round-one')
  scheduleRoundOne(@Body() dto: ScheduleRoundOneDto) {
    return this.scheduling.scheduleRoundOne(dto);
  }
}
