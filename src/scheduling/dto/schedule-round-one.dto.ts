import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class ScheduleRoundOneDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  disciplineIds!: number[];

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  slotMinutes?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
