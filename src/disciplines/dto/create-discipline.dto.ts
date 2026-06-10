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
  ParticipantType,
} from '@prisma/client';

export class CreateDisciplineDto {
  @IsInt()
  eventId!: number;

  @IsString()
  @MaxLength(150)
  name!: string;

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
  @IsEnum(ParticipantType)
  participantType?: ParticipantType;

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

  @IsDateString()
  registrationDeadline!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  winPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  drawPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lossPoints?: number;

  @IsOptional()
  @IsBoolean()
  allowDraw?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  matchDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  courtsCount?: number;
}
