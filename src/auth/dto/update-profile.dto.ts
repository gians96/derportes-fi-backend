import { IsInt } from 'class-validator';

export class UpdateProfileDto {
  @IsInt()
  facultyId!: number;

  @IsInt()
  schoolId!: number;
}
