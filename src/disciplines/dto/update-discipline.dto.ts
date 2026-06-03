import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CompetitionFormat,
  DisciplineModality,
  GenderPolicy,
} from '@prisma/client';

export class UpdateDisciplineDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(DisciplineModality)
  modality?: DisciplineModality;

  @IsOptional()
  @IsEnum(GenderPolicy)
  genderPolicy?: GenderPolicy;

  @IsOptional()
  @IsEnum(CompetitionFormat)
  format?: CompetitionFormat;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxTeams?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  rulesText?: string;

  @IsOptional()
  @IsString()
  extraInfo?: string;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;
}
