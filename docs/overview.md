# Overview — Backend

## 1. Qué hace

Expone la API que da soporte al sistema de gestión deportiva de la Facultad de
Ingeniería de la UNDC. Sus responsabilidades principales son:

- **Autenticación institucional** con Google (solo correos `@undc.edu.pe`) y
  emisión de JWT. Al primer login de un estudiante consulta el padrón académico
  (SIVIRENO) usando el código extraído del correo y precarga sus datos.
- **Catálogo académico**: facultades y escuelas profesionales (CRUD).
- **Eventos deportivos** y **disciplinas** configurables (modalidad por equipos o
  individual, política de género, formato de competencia, mín/máx de jugadores,
  límite de equipos, costo/gratuidad, fecha límite de inscripción, bases).
- **Inscripciones de equipos**: un delegado (o un admin/owner manualmente) crea un
  equipo, agrega integrantes validados contra el padrón académico y, si la
  disciplina es pagada, adjunta el comprobante (voucher).
- **Validación de vouchers** por administradores (aprobar / rechazar con motivo).
- **Gestión de usuarios y roles** (`OWNER_SYSTEM`, `ADMIN_SYSTEM`, `STUDENT`),
  incluyendo pre-registro por correo e inhabilitación lógica (`isActive`).
- **Resultados, posiciones y partidos** (modelo listo en BD; ver roadmap).
- **Dashboard** con métricas agregadas para el panel admin.

## 2. Qué se quiere lograr

Un backend desplegable de forma **independiente** (servicio propio en Dokploy,
sin docker-compose) que consuma una **MariaDB externa** por `DATABASE_URL` y sirva
tanto al frontend Nuxt como a integraciones futuras, manteniendo reglas de negocio
y seguridad en el servidor (no confiar en el cliente).

## 3. Lo planteado (roadmap)

### Implementado
- Auth Google + JWT, guard de roles y `@CurrentUser`.
- Módulos: `auth`, `users`, `faculties`, `events`, `disciplines`,
  `registrations`, `vouchers`, `standings`, `admin`, `academic`.
- Reglas de inscripción: fecha límite, mín/máx jugadores, política de género,
  **duplicados de integrantes** por código/DNI, límite de equipos, voucher
  obligatorio si la disciplina es pagada.
- Creación **manual** de equipos por owner/admin (`delegateId` opcional).
- Gestión de usuarios: crear (pre-registro), editar, cambiar rol, habilitar /
  inhabilitar (`isActive`, validado en `JwtStrategy`).
- Filtros de disciplinas por `eventId` / `facultyId` / `schoolId`.

### Pendiente / futuro
- Módulo de **partidos** (`Match`) y avance de brackets para formato
  `ELIMINATION` (modelo en BD, faltan endpoints de generación/avance).
- Registro de **resultados** que alimente `Standing` en formato `POINTS`.
- Reportes/exportaciones (PDF/Excel).
- Migrar el JWT a **cookie httpOnly** emitida por el backend (hoy el token viaja
  como Bearer y el frontend lo guarda en cookie de Nuxt).
- Almacenamiento de vouchers en S3 compatible (hoy disco local `uploads/`).

## 4. Convenciones

- Prefijo global `/api/v1`.
- DTOs validados con `class-validator`; `ValidationPipe` global con whitelist.
- Errores de negocio → `BadRequestException` / `ForbiddenException` /
  `NotFoundException` con mensaje en español.
- Reglas de autorización finas dentro del *service* recibiendo el `actor`
  (`@CurrentUser()`), no solo en el guard.
