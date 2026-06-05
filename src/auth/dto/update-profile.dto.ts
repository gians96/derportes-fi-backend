import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsInt()
  facultyId?: number;

  @IsOptional()
  @IsInt()
  schoolId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;
}
