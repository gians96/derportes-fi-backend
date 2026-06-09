import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateFixtureDto {
  @IsOptional()
  @IsBoolean()
  resetPlayed?: boolean;
}
