import {
  Controller,
  Get,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AcademicService } from './academic.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('student')
  async findStudent(@Query('buscador') buscador: string) {
    const student = await this.academic.findUniqueStudent(
      (buscador ?? '').trim(),
    );
    if (!student) {
      throw new NotFoundException(
        'No se encontró un estudiante único con ese criterio',
      );
    }
    return student;
  }
}
