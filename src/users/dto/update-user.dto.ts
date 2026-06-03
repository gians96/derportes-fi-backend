import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  facultyId?: number | null;

  @IsOptional()
  @IsInt()
  schoolId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  studentCode?: string | null;
}
