import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFacultyDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  acronym?: string;
}

export class UpdateFacultyDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  acronym?: string;
}

export class CreateSchoolDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsInt()
  facultyId!: number;
}

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;
}
