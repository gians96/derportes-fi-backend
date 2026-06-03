import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsInt()
  facultyId!: number;

  @IsInt()
  schoolId!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;
}
