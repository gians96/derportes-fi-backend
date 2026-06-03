# API Contract — Backend

- **Base URL**: `http://localhost:3001/api/v1` (local) · `https://<host>/api/v1` (prod)
- **Formato**: JSON salvo `POST /registrations` que es `multipart/form-data`.
- **Auth**: header `Authorization: Bearer <jwt>`. El token se obtiene en
  `POST /auth/google`.
- **Roles**: `OWNER_SYSTEM`, `ADMIN_SYSTEM`, `STUDENT`.

Notación de la columna *Auth*:
- `público` — sin token.
- `auth` — cualquier usuario autenticado.
- `admin` — solo `OWNER_SYSTEM` o `ADMIN_SYSTEM`.

---

## Auth

### `POST /auth/google` — `público`
Inicia sesión con el `idToken` de Google Identity.
```json
// request
{ "idToken": "<google-id-token>" }
// response 200
{
  "token": "<jwt>",
  "user": {
    "id": 1, "email": "ej@undc.edu.pe", "fullName": "...",
    "role": "STUDENT", "facultyId": null, "schoolId": null, "avatarUrl": null
  }
}
```
Errores: `401` correo no institucional / token inválido.

### `GET /auth/me` — `auth`
Devuelve el perfil del usuario del token.

### `PATCH /auth/me/profile` — `auth`
Completa facultad/escuela (primer login del estudiante).
```json
{ "facultyId": 1, "schoolId": 3 }
```
Valida que la escuela pertenezca a la facultad.

---

## Academic

### `GET /academic/student?buscador=<dni|codigo>` — `auth`
Consulta el padrón SIVIRENO. **Solo responde cuando hay exactamente un
resultado** (privacidad). Respuesta: `{ estudiante, codEstu, ... }`.

---

## Faculties & Schools

| Método | Ruta                 | Auth  | Body |
| ------ | -------------------- | ----- | ---- |
| GET    | `/faculties`         | auth  | — (lista con `schools`) |
| POST   | `/faculties`         | admin | `{ name, acronym? }` |
| PATCH  | `/faculties/:id`     | admin | `{ name?, acronym? }` |
| DELETE | `/faculties/:id`     | admin | — |
| POST   | `/schools`           | admin | `{ name, facultyId }` |
| PATCH  | `/schools/:id`       | admin | `{ name? }` |
| DELETE | `/schools/:id`       | admin | — |

---

## Events

| Método | Ruta                        | Auth  | Notas |
| ------ | --------------------------- | ----- | ----- |
| GET    | `/events`                   | público | Incluye `facultyId`, `schoolId`, `_count.disciplines` |
| GET    | `/events/:id`               | público | |
| GET    | `/events/:id/disciplines`   | público | Disciplinas del evento |
| POST   | `/events`                   | admin | ver body ↓ |
| PATCH  | `/events/:id`               | admin | campos parciales |
| DELETE | `/events/:id`               | admin | |

```json
// POST /events
{
  "name": "Juegos FI 2026",
  "description": "…",
  "facultyId": 1,
  "schoolId": null,
  "startDate": "2026-07-01",
  "endDate": "2026-07-15",
  "isOpen": true
}
```

---

## Disciplines

| Método | Ruta                | Auth  | Notas |
| ------ | ------------------- | ----- | ----- |
| GET    | `/disciplines`      | público | Filtros opcionales `?eventId=&facultyId=&schoolId=` |
| GET    | `/disciplines/:id`  | público | Incluye `event` y `_count.teams` |
| POST   | `/disciplines`      | admin | ver body ↓ |
| PATCH  | `/disciplines/:id`  | admin | campos parciales |
| DELETE | `/disciplines/:id`  | admin | |

```json
// POST /disciplines
{
  "eventId": 1,
  "name": "Fútbol 7 Varones",
  "modality": "TEAM",            // TEAM | INDIVIDUAL
  "genderPolicy": "MALE",        // MALE | FEMALE | MIXED | FREE
  "format": "ELIMINATION",       // ELIMINATION | POINTS
  "minPlayers": 7,
  "maxPlayers": 12,
  "maxTeams": 16,                // 0 = sin límite
  "isPaid": true,
  "cost": 50.0,
  "rulesText": "…",
  "extraInfo": "…",
  "registrationDeadline": "2026-06-20"
}
```

---

## Registrations (equipos)

| Método | Ruta                         | Auth  | Notas |
| ------ | ---------------------------- | ----- | ----- |
| GET    | `/registrations?status=`     | admin | `status` ∈ `PENDING\|APPROVED\|REJECTED\|CANCELLED` |
| GET    | `/registrations/mine`        | auth  | Equipos donde el usuario es delegado |
| POST   | `/registrations`             | auth  | **multipart/form-data** ver ↓ |
| PATCH  | `/registrations/:id/approve` | admin | |
| PATCH  | `/registrations/:id/reject`  | admin | `{ "reason": "…" }` |

### `POST /registrations` (multipart/form-data)
| Campo            | Tipo   | Obligatorio | Notas |
| ---------------- | ------ | ----------- | ----- |
| `disciplineId`   | number | sí          | |
| `teamName`       | string | sí          | |
| `phone`          | string | no          | |
| `operationNumber`| string | si pagada   | nº de operación del voucher |
| `delegateId`     | number | no          | **solo lo respeta si el actor es admin/owner** (equipo manual) |
| `participants`   | string | sí          | **JSON** del arreglo (ver ↓) |
| `voucher`        | file   | si pagada   | imagen del comprobante |

```jsonc
// participants (JSON.stringify)
[
  { "fullName": "PEREZ JUAN", "studentCode": "2020...", "dni": "12345678",
    "gender": "M", "isDelegate": true },
  { "fullName": "...", "studentCode": "...", "dni": null, "gender": "F",
    "isDelegate": false }
]
```
Reglas del servidor: plazo de inscripción vigente, mín/máx de jugadores,
política de género, **sin integrantes duplicados** (código/DNI), límite de
equipos y voucher obligatorio si `isPaid`. El equipo nace en estado `PENDING`.

---

## Vouchers

| Método | Ruta                      | Auth  | Body |
| ------ | ------------------------- | ----- | ---- |
| GET    | `/vouchers?status=`       | admin | `status` ∈ `PENDING\|VALIDATED\|REJECTED` |
| PATCH  | `/vouchers/:id/validate`  | admin | — |
| PATCH  | `/vouchers/:id/reject`    | admin | `{ "reason": "…" }` |

---

## Users

| Método | Ruta                  | Auth  | Notas |
| ------ | --------------------- | ----- | ----- |
| GET    | `/users`              | admin | Incluye `isActive`, `dni`, facultad/escuela |
| POST   | `/users`              | admin | Pre-registro por correo (ver ↓) |
| PATCH  | `/users/:id`          | admin | `{ fullName?, email?, dni?, facultyId?, schoolId? }` |
| PATCH  | `/users/:id/active`   | admin | `{ "isActive": false }` |
| PATCH  | `/users/:id/role`     | admin | `{ "role": "STUDENT" }` |

```json
// POST /users  (pre-registro: se vincula al primer login con Google)
{ "email": "x@undc.edu.pe", "fullName": "…", "role": "STUDENT",
  "facultyId": 1, "schoolId": 3, "dni": "12345678" }
```
Reglas: un `ADMIN_SYSTEM` solo puede gestionar/crear `STUDENT`; no se puede
inhabilitar a un `OWNER_SYSTEM` ni a uno mismo. Un usuario con `isActive=false`
no puede autenticarse (rechazado en `JwtStrategy`).

---

## Standings & Results

| Método | Ruta                          | Auth   | Notas |
| ------ | ----------------------------- | ------ | ----- |
| GET    | `/standings/:disciplineId`    | público| Tabla de posiciones |
| GET    | `/results/mine`               | auth   | Historial del usuario |

---

## Admin

| Método | Ruta                | Auth  | Notas |
| ------ | ------------------- | ----- | ----- |
| GET    | `/admin/dashboard`  | admin | Métricas agregadas del panel |

---

## Errores comunes

| Código | Significado |
| ------ | ----------- |
| 400    | Validación de DTO o regla de negocio (mensaje en `message`) |
| 401    | Token ausente/ inválido o usuario inhabilitado |
| 403    | Rol insuficiente para la operación |
| 404    | Recurso no encontrado |
