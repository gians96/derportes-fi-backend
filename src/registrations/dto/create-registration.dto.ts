import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class ParticipantDto {
  @IsString()
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @IsString()
  studentCode?: string | null;

  @IsOptional()
  @IsString()
  dni?: string | null;

  @IsOptional()
  @IsString()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  isDelegate?: boolean;

  @IsOptional()
  countsAsPlayer?: boolean;
}

export class CreateRegistrationDto {
  @Type(() => Number)
  disciplineId!: number;

  @IsString()
  @MaxLength(120)
  teamName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cycle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  section?: string | null;

  @IsOptional()
  @IsString()
  operationNumber?: string;

  @IsOptional()
  @Type(() => Number)
  delegateId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants!: ParticipantDto[];
}
