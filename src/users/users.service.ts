import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface RoleActor {
  id: number;
  role: Role;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  studentCode: true,
  dni: true,
  facultyId: true,
  schoolId: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { fullName: 'asc' },
    });
  }

  async create(actor: RoleActor, dto: CreateUserDto) {
    if (
      actor.role === Role.ADMIN_SYSTEM &&
      dto.role !== Role.STUDENT &&
      dto.role !== Role.OTHER
    ) {
      throw new ForbiddenException(
        'Un administrador solo puede crear estudiantes u otros usuarios',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un usuario con ese correo');
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        facultyId: dto.role === Role.OTHER ? null : (dto.facultyId ?? null),
        schoolId: dto.role === Role.OTHER ? null : (dto.schoolId ?? null),
        dni: dto.dni ?? null,
        studentCode: dto.role === Role.OTHER ? null : (dto.studentCode ?? null),
      },
      select: userSelect,
    });
  }

  async update(actor: RoleActor, id: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    this.assertCanManage(actor, user.role);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un usuario con ese correo');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(user.role === Role.OTHER
          ? { facultyId: null, schoolId: null }
          : {
              ...(dto.facultyId !== undefined && { facultyId: dto.facultyId }),
              ...(dto.schoolId !== undefined && { schoolId: dto.schoolId }),
            }),
        ...(dto.dni !== undefined && { dni: dto.dni }),
        ...(user.role === Role.OTHER
          ? { studentCode: null }
          : dto.studentCode !== undefined
            ? { studentCode: dto.studentCode }
            : {}),
      },
      select: userSelect,
    });
  }

  async setActive(actor: RoleActor, id: number, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.id === actor.id) {
      throw new BadRequestException('No puedes inhabilitarte a ti mismo');
    }
    if (user.role === Role.OWNER_SYSTEM) {
      throw new BadRequestException('No se puede inhabilitar al owner');
    }
    this.assertCanManage(actor, user.role);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });
  }

  private assertCanManage(actor: RoleActor, targetRole: Role) {
    if (
      actor.role === Role.ADMIN_SYSTEM &&
      targetRole !== Role.STUDENT &&
      targetRole !== Role.OTHER
    ) {
      throw new ForbiddenException(
        'Un administrador solo puede gestionar estudiantes u otros usuarios',
      );
    }
  }

  async updateRole(actor: RoleActor, id: number, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role === Role.OWNER_SYSTEM) {
      throw new BadRequestException('No se puede modificar el rol del owner');
    }

    // Un administrador no puede asignar roles elevados ni tocar a otros
    // administradores; solo el owner tiene ese poder.
    if (actor.role === Role.ADMIN_SYSTEM) {
      if (role !== Role.STUDENT && role !== Role.OTHER) {
        throw new ForbiddenException(
          'Un administrador solo puede asignar roles de estudiante u otro',
        );
      }
      if (user.role === Role.ADMIN_SYSTEM) {
        throw new ForbiddenException(
          'Un administrador no puede modificar a otro administrador',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role,
        ...(role === Role.OTHER
          ? { facultyId: null, schoolId: null, studentCode: null }
          : {}),
      },
      select: userSelect,
    });
  }
}
