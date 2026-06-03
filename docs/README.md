# Documentación — Backend (deportes-fi)

API REST del **Sistema de Deportes de la Facultad de Ingeniería (UNDC)**, construida con NestJS 11 + Prisma sobre MariaDB.

## Índice

- [overview.md](./overview.md) — Qué hace, qué se quiere lograr y lo planteado (roadmap).
- [api-contract.md](./api-contract.md) — Contrato de la API: endpoints, auth, request/response.
- [data-model.md](./data-model.md) — Modelo de datos (Prisma) y enums.
- [deployment.md](./deployment.md) — Despliegue (Docker / Dokploy), variables de entorno.

## Stack

| Capa            | Tecnología                                  |
| --------------- | ------------------------------------------- |
| Framework       | NestJS 11                                   |
| Lenguaje        | TypeScript                                  |
| Runtime / PM    | Bun                                         |
| ORM             | Prisma 6 (`mysql` provider)                 |
| Base de datos   | MariaDB externa (`DATABASE_URL`)            |
| Auth            | Google Identity + JWT (`@nestjs/jwt`)       |
| Validación      | class-validator / class-transformer         |
| Subida archivos | Multer (`uploads/` local)                   |
| Seguridad       | helmet, compression, cookie-parser          |

## Arranque local

```powershell
bun install
bunx prisma generate
bunx prisma db push          # o: bun run prisma:migrate
bun run prisma:seed          # datos iniciales (roles, facultad, owner)
bun run start:dev            # http://localhost:3001/api/v1
```

> Prefijo global de la API: **`/api/v1`**. Puerto por defecto: **3001**.
