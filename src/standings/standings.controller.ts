import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { StandingsService } from './standings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@Controller()
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('standings/:disciplineId')
  getStandings(@Param('disciplineId', ParseIntPipe) disciplineId: number) {
    return this.standings.getByDiscipline(disciplineId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('results/mine')
  getMyHistory(@CurrentUser() user: RequestUser) {
    return this.standings.getHistoryForUser(user.id);
  }
}
