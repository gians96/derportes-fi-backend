import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class UpdateMatchDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;
}
