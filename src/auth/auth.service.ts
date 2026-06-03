import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicService } from '../academic/academic.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly oauthClient: OAuth2Client;
  private readonly googleClientId: string;
  private readonly institutionalDomain: string;
  private readonly ownerEmails: string[];
  private readonly adminEmails: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly academic: AcademicService,
  ) {
    this.googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.institutionalDomain =
      this.config.get<string>('INSTITUTIONAL_DOMAIN') ?? 'undc.edu.pe';
    this.oauthClient = new OAuth2Client(this.googleClientId);
    this.ownerEmails = this.parseEmails(
      this.config.get<string>('OWNER_EMAILS'),
    );
    this.adminEmails = this.parseEmails(
      this.config.get<string>('ADMIN_EMAILS'),
    );
  }

  private parseEmails(value?: string): string[] {
    return (value ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async loginWithGoogle(idToken: string): Promise<{
    token: string;
    user: Pick<
      User,
      | 'id'
      | 'email'
      | 'fullName'
      | 'role'
      | 'studentCode'
      | 'facultyId'
      | 'schoolId'
      | 'avatarUrl'
    >;
  }> {
    const payload = await this.verifyGoogleToken(idToken);
    const email = (payload.email ?? '').toLowerCase();
    const domain = email.split('@')[1];

    if (domain !== this.institutionalDomain) {
      throw new UnauthorizedException(
        `Solo se permiten correos @${this.institutionalDomain}`,
      );
    }

    const code = email.split('@')[0];
    const user = await this.upsertUser(email, code, payload);
    const token = this.signToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        studentCode: user.studentCode,
        facultyId: user.facultyId,
        schoolId: user.schoolId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private async verifyGoogleToken(idToken: string) {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified) {
        throw new UnauthorizedException('Token de Google inválido');
      }
      return payload;
    } catch (error) {
      this.logger.warn(`Fallo verificación Google: ${String(error)}`);
      throw new UnauthorizedException('No se pudo verificar el token de Google');
    }
  }

  private resolveRole(email: string): Role {
    if (this.ownerEmails.includes(email)) return Role.OWNER_SYSTEM;
    if (this.adminEmails.includes(email)) return Role.ADMIN_SYSTEM;
    return Role.STUDENT;
  }

  private async upsertUser(
    email: string,
    code: string,
    payload: { name?: string; picture?: string; sub: string },
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const role =
      existing && existing.role !== Role.STUDENT
        ? existing.role
        : this.resolveRole(email);

    // Para estudiantes intentamos enriquecer con el padrón académico
    let fullName = payload.name ?? existing?.fullName ?? email;
    let studentCode = existing?.studentCode ?? null;

    if (role === Role.STUDENT) {
      const academic = await this.academic
        .findUniqueStudent(code)
        .catch(() => null);
      if (academic) {
        fullName = academic.estudiante.replace(/\s+/g, ' ').trim();
        studentCode = academic.codEstu;
      }
    }

    return this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        fullName,
        googleSub: payload.sub,
        avatarUrl: payload.picture ?? null,
        role,
        studentCode,
      },
      update: {
        fullName,
        googleSub: payload.sub,
        avatarUrl: payload.picture ?? null,
        ...(studentCode ? { studentCode } : {}),
      },
    });
  }

  private signToken(user: User): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        studentCode: true,
        facultyId: true,
        schoolId: true,
        avatarUrl: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }

  async updateProfile(userId: number, facultyId: number, schoolId: number) {
    const school = await this.prisma.professionalSchool.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('Escuela no encontrada');
    }
    if (school.facultyId !== facultyId) {
      throw new BadRequestException(
        'La escuela no pertenece a la facultad seleccionada',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { facultyId, schoolId },
    });
    return this.getProfile(userId);
  }
}
