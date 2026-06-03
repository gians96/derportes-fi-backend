# Modelo de datos — Backend (Prisma)

Provider: `mysql` (MariaDB externa). Fuente de verdad:
[`prisma/schema.prisma`](../prisma/schema.prisma).

## Enums

| Enum                 | Valores |
| -------------------- | ------- |
| `Role`               | `OWNER_SYSTEM`, `ADMIN_SYSTEM`, `STUDENT` |
| `Gender`             | `M`, `F`, `O` |
| `DisciplineModality` | `TEAM`, `INDIVIDUAL` |
| `GenderPolicy`       | `MALE`, `FEMALE`, `MIXED`, `FREE` |
| `CompetitionFormat`  | `ELIMINATION`, `POINTS` |
| `RegistrationStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `VoucherStatus`      | `PENDING`, `VALIDATED`, `REJECTED` |
| `MatchStatus`        | `PENDING`, `IN_PROGRESS`, `PLAYED`, `CANCELLED`, `POSTPONED` |

## Entidades y relaciones

```
Faculty 1───* ProfessionalSchool
Faculty 1───* SportEvent           ProfessionalSchool 1───* SportEvent (opcional)
Faculty 1───* User                 ProfessionalSchool 1───* User (opcional)

SportEvent 1───* Discipline
Discipline 1───* Team
Discipline 1───* Match
Discipline 1───* Standing

User (delegate) 1───* Team
Team 1───* Participant
Team 1───1 Voucher
Team 1───1 Standing
Team *──* Match (home / away / winner)
User 0/1 ──* Participant (vínculo opcional al usuario real)
```

## Notas de diseño

- **User**: `email` único; `googleSub` único y opcional (pre-registro sin Google
  hasta el primer login). `isActive` controla el acceso (soft-delete). `dni`,
  `studentCode` opcionales; `facultyId`/`schoolId` opcionales.
- **Discipline**: `cost` es `Decimal(10,2)`; `maxTeams = 0` significa sin límite;
  `registrationDeadline` cierra inscripciones.
- **Team**: nace `PENDING`; `rejectionReason` cuando se rechaza.
- **Participant**: guarda `fullName`/`studentCode`/`dni` (snapshot del padrón) y
  puede vincularse a un `User` real vía `userId`.
- **Voucher**: 1:1 con `Team`; `imageUrl` apunta a `uploads/vouchers/...`.
- **Match** / **Standing**: soporte para brackets (eliminación) y tabla de
  posiciones (puntos). Endpoints de avance/resultados pendientes (ver roadmap).
- Borrados en cascada: `Discipline → Team → Participant/Voucher`, etc., vía
  `onDelete: Cascade`.

## Migraciones

```powershell
bunx prisma migrate dev --name <cambio>   # entorno de desarrollo
bunx prisma migrate deploy                # producción (CI/Dokploy)
bunx prisma db push                       # sincronizar sin migración (rápido)
bunx prisma generate                      # regenerar cliente
bun run prisma:seed                       # datos iniciales
```
