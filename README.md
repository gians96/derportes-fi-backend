# Deportes FI — Backend

API REST de gestión deportiva para la **Facultad de Ingeniería (UNDC)**.
Construida con **NestJS 11**, **TypeScript**, **Prisma 6** (MariaDB/MySQL),
**JWT** + **Google Auth Library** y **Multer** para archivos.
Gestor de paquetes: **Bun**.

## Requisitos

- Bun >= 1.2
- MariaDB/MySQL accesible vía `DATABASE_URL`

## Configuración

```bash
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | URL completa de MariaDB (`mysql://user:pass@host:3306/db`) |
| `PORT` | Puerto del servidor (default `3001`) |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Configuración de JWT |
| `GOOGLE_CLIENT_ID` | Client ID de Google (igual que el frontend) |
| `INSTITUTIONAL_DOMAIN` | Dominio permitido (`undc.edu.pe`) |
| `ACADEMIC_API_URL` | Endpoint del padrón SIVIRENO (estudiantes) |
| `DECOLECTA_API_URL` / `DECOLECTA_TOKEN` | Endpoint y token RENIEC vía Decolecta (externos por DNI) |
| `UPLOADS_DIR` | Directorio de archivos subidos (default `uploads`) |
| `OWNER_EMAILS` / `ADMIN_EMAILS` | Correos con rol elevado (separados por coma) |

## Base de datos

```bash
bun install
bunx prisma generate
bunx prisma migrate dev --name init   # crea las tablas
bun run prisma:seed                    # facultad, escuelas y owners/admins
```

## Desarrollo

```bash
bun run start:dev
```

API disponible en `http://localhost:3001/api/v1`.

## Build de producción

```bash
bun run build
node dist/main.js
```

## Endpoints principales (prefijo `/api/v1`)

- `POST /auth/google` — login con ID token de Google
- `GET /auth/me` — perfil autenticado
- `GET /academic/student?buscador=` — consulta padrón SIVIRENO (único resultado)
- `GET /academic/dni?numero=` — consulta RENIEC vía Decolecta (8 dígitos)
- `GET /events`, `GET /events/:id`, `GET /events/:id/disciplines`
- `GET /disciplines`, `GET /disciplines/:id`
- `POST /registrations` (multipart con voucher), `GET /registrations/mine`
- `PATCH /registrations/:id/approve|reject`
- `GET /vouchers`, `PATCH /vouchers/:id/validate|reject`
- `GET /users`, `PATCH /users/:id/role`
- `GET /standings/:disciplineId`, `GET /results/mine`
- `GET /admin/dashboard`

## Autenticación

1. El frontend obtiene un **ID token** de Google y lo envía a `POST /auth/google`.
2. El backend verifica el token, exige dominio `@undc.edu.pe` y extrae el código
   (parte antes de `@`).
3. Para estudiantes consulta el padrón académico; si hay **un único** resultado,
   completa nombre y código.
4. El rol se resuelve desde BD (`OWNER_SYSTEM` / `ADMIN_SYSTEM` por env, resto `STUDENT`).
5. Devuelve un **JWT** usado en `Authorization: Bearer`.

## Docker / Dokploy

Se despliega por separado, **solo con su Dockerfile** (sin docker-compose).
La base de datos es un servicio externo consumido por `DATABASE_URL`.

```bash
docker build -t deportes-fi-backend .
docker run -p 3001:3001 \
  -e DATABASE_URL="mysql://user:pass@host:3306/deportes_fi" \
  -e JWT_SECRET=xxxx \
  -e GOOGLE_CLIENT_ID=xxxx \
  -e CORS_ORIGIN=https://tu-frontend \
  -v deportes_uploads:/app/uploads \
  deportes-fi-backend
```

> En Dokploy monta un **volumen persistente** en `/app/uploads` para conservar
> los comprobantes subidos. Ejecuta `prisma migrate deploy` en el arranque o como
> job previo al despliegue.
