import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AcademicStudent {
  idEstu: string;
  nivel: string;
  codEstu: string;
  estudiante: string;
  egreso: string | null;
}

@Injectable()
export class AcademicService {
  private readonly logger = new Logger(AcademicService.name);
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint =
      this.config.get<string>('ACADEMIC_API_URL') ??
      'https://sivireno.undc.edu.pe/tiger/consulta/con_searchEstudiante.php';
  }

  /**
   * Consulta el padrón académico. Por privacidad, solo devuelve el estudiante
   * cuando la respuesta contiene exactamente un resultado.
   */
  async findUniqueStudent(buscador: string): Promise<AcademicStudent | null> {
    const results = await this.query(buscador);
    if (results.length !== 1) {
      return null;
    }
    return results[0];
  }

  async query(buscador: string): Promise<AcademicStudent[]> {
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
      return data as AcademicStudent[];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Error consultando padrón académico: ${String(error)}`,
      );
      throw new HttpException(
        'Servicio académico no disponible',
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
