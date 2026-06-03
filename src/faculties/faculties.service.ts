import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFacultyDto,
  CreateSchoolDto,
  UpdateFacultyDto,
  UpdateSchoolDto,
} from './dto/faculty.dto';

@Injectable()
export class FacultiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.faculty.findMany({
      orderBy: { name: 'asc' },
      include: {
        schools: { orderBy: { name: 'asc' } },
      },
    });
  }

  createFaculty(dto: CreateFacultyDto) {
    return this.prisma.faculty.create({
      data: { name: dto.name, acronym: dto.acronym ?? null },
    });
  }

  async updateFaculty(id: number, dto: UpdateFacultyDto) {
    await this.ensureFaculty(id);
    return this.prisma.faculty.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.acronym !== undefined ? { acronym: dto.acronym } : {}),
      },
    });
  }

  async deleteFaculty(id: number) {
    await this.ensureFaculty(id);
    const schools = await this.prisma.professionalSchool.count({
      where: { facultyId: id },
    });
    if (schools > 0) {
      throw new BadRequestException(
        'No se puede eliminar una facultad con escuelas asociadas',
      );
    }
    await this.prisma.faculty.delete({ where: { id } });
    return { deleted: true };
  }

  async createSchool(dto: CreateSchoolDto) {
    await this.ensureFaculty(dto.facultyId);
    return this.prisma.professionalSchool.create({
      data: { name: dto.name, facultyId: dto.facultyId },
    });
  }

  async updateSchool(id: number, dto: UpdateSchoolDto) {
    await this.ensureSchool(id);
    return this.prisma.professionalSchool.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
    });
  }

  async deleteSchool(id: number) {
    await this.ensureSchool(id);
    await this.prisma.professionalSchool.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureFaculty(id: number) {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Facultad no encontrada');
    return faculty;
  }

  private async ensureSchool(id: number) {
    const school = await this.prisma.professionalSchool.findUnique({
      where: { id },
    });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    return school;
  }
}
