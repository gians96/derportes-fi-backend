import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, VoucherStatus } from '@prisma/client';
import { VouchersService } from './vouchers.service';
import { RejectDto } from '../registrations/dto/reject.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  findAll(
    @Query('status') status?: VoucherStatus,
    @Query('eventId') eventId?: string,
    @Query('facultyId') facultyId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('disciplineId') disciplineId?: string,
  ) {
    return this.vouchers.findAll({
      status,
      eventId: eventId ? Number(eventId) : undefined,
      facultyId: facultyId ? Number(facultyId) : undefined,
      schoolId: schoolId ? Number(schoolId) : undefined,
      disciplineId: disciplineId ? Number(disciplineId) : undefined,
    });
  }

  @Patch(':id/validate')
  validate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.vouchers.validate(id, user.id);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.vouchers.reject(id, dto.reason, user.id);
  }
}
