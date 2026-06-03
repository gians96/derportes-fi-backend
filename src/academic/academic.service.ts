import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Respuesta cruda del padrón académico de sivireno. */
interface RawAcademicStudent {
  idEstu?: string;
  nivel?: string;
  codEstu?: string;
  estudiante?: string;
  egreso?: string | null;
  [key: string]: unknown;
}

/** Respuesta cruda de Decolecta (RENIEC) para una consulta por DNI. */
interface RawReniecPerson {
  first_name?: string;
  first_last_name?: string;
  second_last_name?: string;
  full_name?: string;
  document_number?: string;
}

/** Persona normalizada que consume el frontend, sin importar la fuente. */
export interface AcademicPerson {
  fullName: string;
  studentCode: string | null;
  dni: string | null;
}

@Injectable()
export class AcademicService {
  private readonly logger = new Logger(AcademicService.name);
  private readonly endpoint: string;
  private readonly reniecEndpoint: string;
  private readonly decolectaToken: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint =
      this.config.get<string>('ACADEMIC_API_URL') ??
      'https://sivireno.undc.edu.pe/tiger/consulta/con_searchEstudiante.php';
    this.reniecEndpoint =
      this.config.get<string>('DECOLECTA_API_URL') ??
      'https://api.decolecta.com/v1/reniec/dni';
    this.decolectaToken = this.config.get<string>('DECOLECTA_TOKEN') ?? '';
  }

  /**
   * Consulta el padrón académico por código de estudiante. Por privacidad,
   * solo devuelve a la persona cuando la respuesta contiene un único resultado.
   */
  async findUniqueStudent(buscador: string): Promise<AcademicPerson | null> {
    const results = await this.query(buscador);
    if (results.length !== 1) {
      return null;
    }
    return this.normalizeStudent(results[0]);
  }

  /**
   * Consulta los datos de una persona por DNI a través de Decolecta (RENIEC).
   */
  async findByDni(numero: string): Promise<AcademicPerson | null> {
    if (!/^\d{8}$/.test(numero)) {
      return null;
    }
    if (!this.decolectaToken) {
      throw new HttpException(
        'El servicio de consulta por DNI no está configurado',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const url = `${this.reniecEndpoint}?numero=${encodeURIComponent(numero)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.decolectaToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new HttpException(
          'No se pudo consultar el DNI',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = (await response.json()) as RawReniecPerson;
      const fullName =
        data.full_name ??
        [data.first_last_name, data.second_last_name, data.first_name]
          .filter(Boolean)
          .join(' ')
          .trim();
      if (!fullName) {
        return null;
      }
      return {
        fullName: fullName.replace(/\s+/g, ' ').trim(),
        studentCode: null,
        dni: data.document_number ?? numero,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error consultando DNI: ${String(error)}`);
      throw new HttpException(
        'Servicio de consulta por DNI no disponible',
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Normaliza el registro del padrón a la forma que consume el frontend. */
  private normalizeStudent(raw: RawAcademicStudent): AcademicPerson {
    const code =
      raw.codEstu ??
      (raw['codigo'] as string | undefined) ??
      (raw['cod_estu'] as string | undefined) ??
      null;
    const name =
      raw.estudiante ??
      (raw['nombre'] as string | undefined) ??
      (raw['nombres'] as string | undefined) ??
      '';
    return {
      fullName: name.replace(/\s+/g, ' ').trim(),
      studentCode: code ? String(code).trim() : null,
      dni: (raw['dni'] as string | undefined) ?? null,
    };
  }

  async query(buscador: string): Promise<RawAcademicStudent[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcion: 7, buscador }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpException(
          'No se pudo consultar el padrón académico',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        return [];
      }
      return data as RawAcademicStudent[];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error consultando padrón académico: ${String(error)}`);
      throw new HttpException(
        'Servicio académico no disponible',
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
