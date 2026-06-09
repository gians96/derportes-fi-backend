import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { StandingsService } from './standings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { GenerateFixtureDto } from './dto/generate-fixture.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchResultDto } from './dto/update-match-result.dto';

@Controller()
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('standings/:disciplineId')
  getStandings(@Param('disciplineId', ParseIntPipe) disciplineId: number) {
    return this.standings.getByDiscipline(disciplineId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM, Role.REFEREE)
  @Get('disciplines/:disciplineId/fixture')
  getFixture(@Param('disciplineId', ParseIntPipe) disciplineId: number) {
    return this.standings.getFixture(disciplineId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Post('disciplines/:disciplineId/fixture/generate')
  generateFixture(
    @Param('disciplineId', ParseIntPipe) disciplineId: number,
    @Body() dto: GenerateFixtureDto,
  ) {
    return this.standings.generateFixture(disciplineId, dto.resetPlayed);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM, Role.REFEREE)
  @Patch('matches/:id')
  updateMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.standings.updateMatch(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM, Role.REFEREE)
  @Patch('matches/:id/result')
  updateMatchResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatchResultDto,
  ) {
    return this.standings.updateMatchResult(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Post('disciplines/:disciplineId/standings/recalculate')
  recalculateStandings(
    @Param('disciplineId', ParseIntPipe) disciplineId: number,
  ) {
    return this.standings.recalculateStandings(disciplineId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('results/mine')
  getMyHistory(@CurrentUser() user: RequestUser) {
    return this.standings.getHistoryForUser(user.id);
  }
}
