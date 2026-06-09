# API Contract — Backend

- **Base URL**: `http://localhost:3001/api/v1` (local) · `https://<host>/api/v1` (prod)
- **Formato**: JSON salvo `POST /registrations` que es `multipart/form-data`.
- **Auth**: header `Authorization: Bearer <jwt>`. El token se obtiene en
  `POST /auth/google`.
- **Roles**: `OWNER_SYSTEM`, `ADMIN_SYSTEM`, `REFEREE`, `STUDENT`, `OTHER`.

Notación de la columna *Auth*:
- `público` — sin token.
- `auth` — cualquier usuario autenticado.
- `admin` — solo `OWNER_SYSTEM` o `ADMIN_SYSTEM`.
- `fixture` — `OWNER_SYSTEM`, `ADMIN_SYSTEM` o `REFEREE`.

---

## Auth

### `POST /auth/google` — `público`
Inicia sesión con el `idToken` de Google Identity. Cualquier correo verificado
por Google puede autenticarse. Los correos configurados como owner/admin
conservan su rol; los correos numéricos `@undc.edu.pe` son `STUDENT`; los demás
correos son `OTHER`. En el login se **vinculan** los
`Participant` previos que coincidan por `studentCode` o `dni`.
```json
// request
{ "idToken": "<google-id-token>" }
// response 200
{
  "token": "<jwt>",
  "user": {
    "id": 1, "email": "ej@undc.edu.pe", "fullName": "...",
    "role": "STUDENT", "studentCode": "2020...", "dni": null,
    "facultyId": null, "schoolId": null, "avatarUrl": null
  }
}
```
Errores: `401` token inválido o correo Google no verificado.

### Rate limit global

Toda la API está protegida por un límite global por IP configurable con
`APP_RATE_LIMIT_WINDOW_MS` y `APP_RATE_LIMIT_MAX_REQUESTS`. Si se excede,
responde `429 Too Many Requests` y cabeceras `X-RateLimit-*`.

### `GET /auth/me` — `auth`
Devuelve el perfil del usuario del token (incluye `studentCode` y `dni`).

### `PATCH /auth/me/profile` — `auth`
Completa el perfil según el rol.

Para `STUDENT`, exige facultad y escuela profesional:
```json
{ "facultyId": 1, "schoolId": 3 }
```

Para `OTHER`, exige solo DNI. No guarda facultad ni escuela; valida el DNI con
Decolecta, actualiza `fullName` y vincula participantes por `dni`:
```json
{ "dni": "12345678" }
```

---

## Academic

Los dos endpoints normalizan su salida al mismo objeto **`AcademicPerson`**:
```json
{ "fullName": "PEREZ JUAN", "studentCode": "2020..." | null, "dni": "12345678" | null }
```

### `GET /academic/student?buscador=<dni|codigo>` — `auth`
Consulta el padrón **SIVIRENO** (disciplinas de tipo `STUDENT`). **Solo responde
cuando hay exactamente un resultado** (privacidad). `404` si no hay coincidencia
única.

### `GET /academic/dni?numero=<8 dígitos>` — `auth`
Consulta **RENIEC vía Decolecta** (disciplinas de tipo `OTHER`). Valida que
`numero` tenga 8 dígitos. `404` si el DNI no existe; `503` si falta el token de
Decolecta. Devuelve `AcademicPerson` con `studentCode: null`.

> Detalle de los servicios externos en
> [Integraciones externas](#integraciones-externas).

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
| GET    | `/disciplines`      | público | Filtros opcionales `?eventId=&facultyId=&schoolId=`; cada disciplina incluye `teamsCount` |
| GET    | `/disciplines/:id`  | público | Incluye `event`, equipos aprobados y `teamsCount` |
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
  "participantType": "STUDENT",  // STUDENT (padrón SIVIRENO) | OTHER (DNI/RENIEC)
  "minPlayers": 7,
  "maxPlayers": 12,
  "maxTeams": 16,                // 0 = sin límite
  "isPaid": true,
  "cost": 50.0,
  "rulesText": "…",
  "extraInfo": "…",
  "registrationDeadline": "2026-06-20T23:59:00.000Z",
  "winPoints": 3,
  "drawPoints": 1,
  "lossPoints": 0,
  "allowDraw": true
}
```
`participantType` define cómo se buscan los integrantes en el frontend:
`STUDENT` → `GET /academic/student`; `OTHER` → `GET /academic/dni`.
`teamsCount` devuelve la cantidad total de equipos inscritos en la disciplina
(sin filtrar por estado) para mostrar el avance de cupos en el panel admin.

---

## Registrations (equipos)

| Método | Ruta                         | Auth  | Notas |
| ------ | ---------------------------- | ----- | ----- |
| GET    | `/registrations?status=`     | admin | `status` ∈ `PENDING\|APPROVED\|REJECTED\|CANCELLED`; filtros `?eventId=&facultyId=&schoolId=&disciplineId=&isPaid=&participantType=` |
| GET    | `/registrations/mine`        | auth  | Equipos donde el usuario es **delegado o integrante** (match por `userId`) |
| POST   | `/registrations`             | auth  | **multipart/form-data** ver ↓ |
| PATCH  | `/registrations/:id/approve` | admin | |
| PATCH  | `/registrations/:id/reject`  | admin | `{ "reason": "…" }` |

> El panel principal de administración es `/admin/inscripciones`. Allí se
> gestionan equipos gratuitos y de pago en un solo flujo. Para pagos, el modal
> muestra el voucher incrustado y usa `/vouchers/:id/validate` para validar y
> aprobar; el rechazo principal se realiza con `/registrations/:id/reject` para
> permitir una nueva inscripción. `/admin/vouchers` queda como vista secundaria
> de compatibilidad.

### `POST /registrations` (multipart/form-data)
| Campo            | Tipo   | Obligatorio | Notas |
| ---------------- | ------ | ----------- | ----- |
| `disciplineId`   | number | sí          | |
| `teamName`       | string | sí          | |
| `phone`          | string | no          | Teléfono de contacto del equipo/delegado; visible en admin |
| `operationNumber`| string | si pagada   | nº de operación del voucher |
| `delegateId`     | number | no          | **solo lo respeta si el actor es admin/owner** (equipo manual); en flujo público el delegado es el usuario autenticado |
| `participants`   | string | sí          | **JSON** del arreglo de jugadores (ver ↓); el delegado no va aquí salvo que también juegue y se agregue como integrante |
| `voucher`        | file   | si pagada   | imagen del comprobante |

```jsonc
// participants (JSON.stringify)
[
  { "fullName": "PEREZ JUAN", "studentCode": "2020...", "dni": "12345678",
    "gender": "M" },
  { "fullName": "...", "studentCode": "...", "dni": null, "gender": "F",
    "countsAsPlayer": true }
]
```
Reglas del servidor: plazo de inscripción vigente, mín/máx de jugadores,
política de género, **sin integrantes duplicados** (código/DNI), límite de
equipos y voucher obligatorio si `isPaid`. El equipo nace en estado `PENDING`.
Cada integrante se **vincula automáticamente** a su `User` (si existe) por
`studentCode` o `dni`, de modo que el estudiante vea ese equipo en
`/registrations/mine`.

---

## Vouchers

| Método | Ruta                      | Auth  | Body |
| ------ | ------------------------- | ----- | ---- |
| GET    | `/vouchers?status=`       | admin | `status` ∈ `PENDING\|VALIDATED\|REJECTED`; filtros `?eventId=&facultyId=&schoolId=&disciplineId=` |
| PATCH  | `/vouchers/:id/validate`  | admin | — |
| PATCH  | `/vouchers/:id/reject`    | admin | `{ "reason": "…" }` |

Cada elemento de la lista incluye datos del equipo y de la disciplina para la
validación: `teamName`, `phone`, `operationNumber`, `amount`, `imageUrl`,
`status`, `disciplineName`, **`participantType`**, `genderPolicy`,
`minPlayers`/`maxPlayers`, `eventName`, `facultyName`, `schoolName`,
`participantsCount` y `participants[]` (cada uno con su `userId` si está
vinculado).

---

## Users

| Método | Ruta                  | Auth  | Notas |
| ------ | --------------------- | ----- | ----- |
| GET    | `/users`              | admin | Incluye `isActive`, `dni`, facultad/escuela |
| POST   | `/users`              | admin | Pre-registro por correo (ver ↓) |
| PATCH  | `/users/:id`          | admin | `{ fullName?, email?, dni?, facultyId?, schoolId? }` |
| PATCH  | `/users/:id/active`   | admin | `{ "isActive": false }` |
| PATCH  | `/users/:id/role`     | admin | `{ "role": "STUDENT" }`, `{ "role": "OTHER" }` o `{ "role": "REFEREE" }` |

```json
// POST /users  (pre-registro: se vincula al primer login con Google)
{ "email": "x@undc.edu.pe", "fullName": "…", "role": "OTHER",
  "dni": "12345678" }
```
Reglas: un `ADMIN_SYSTEM` puede gestionar/crear roles no administrativos
(`STUDENT`, `OTHER` y `REFEREE`); no se puede inhabilitar a un `OWNER_SYSTEM` ni a uno
mismo. Un usuario `OTHER` o `REFEREE` no requiere `facultyId` ni `schoolId`. Un usuario con
`isActive=false` no puede autenticarse (rechazado en `JwtStrategy`).

---

## Standings & Results

| Método | Ruta                          | Auth   | Notas |
| ------ | ----------------------------- | ------ | ----- |
| GET    | `/standings/:disciplineId`    | público| Tabla, fixture y partidos publicados |
| GET    | `/disciplines/:disciplineId/fixture` | fixture | Fixture admin con equipos aprobados, partidos y tabla |
| POST   | `/disciplines/:disciplineId/fixture/generate` | admin | `{ "resetPlayed": false }`; genera round-robin o eliminación simple |
| PATCH  | `/matches/:id`                | fixture | `{ "scheduledAt"?, "status"? }` |
| PATCH  | `/matches/:id/result`         | fixture | `{ "homeScore": 2, "awayScore": 1 }`; recalcula tabla o avanza llave |
| POST   | `/disciplines/:disciplineId/standings/recalculate` | admin | Recalcula tabla desde partidos jugados |
| GET    | `/results/mine`               | auth   | Historial del usuario |

---

## Admin

| Método | Ruta                | Auth  | Notas |
| ------ | ------------------- | ----- | ----- |
| GET    | `/admin/dashboard`  | admin | Métricas agregadas del panel |

---

## Integraciones externas

El backend consume dos servicios externos para validar la identidad de los
integrantes. Las URLs y credenciales se configuran por variables de entorno
(ver `.env.example`); **nunca** se exponen al frontend.

### SIVIRENO — Padrón académico UNDC
- **Var. entorno**: `ACADEMIC_API_URL`
  (`https://sivireno.undc.edu.pe/tiger/consulta/con_searchEstudiante.php`).
- **Consumido por**: `GET /academic/student` y el enriquecimiento de perfil en
  `POST /auth/google`.
- **Uso**: validar integrantes de disciplinas `participantType = STUDENT` y
  precargar datos del estudiante al loguear.
- **Normalización**: la respuesta cruda (`estudiante`/`codEstu` y variantes) se
  mapea a `AcademicPerson { fullName, studentCode, dni }`. Solo se devuelve si
  hay **un único** resultado (privacidad).

### Decolecta — RENIEC (consulta de DNI)
- **Var. entorno**: `DECOLECTA_API_URL`
  (`https://api.decolecta.com/v1/reniec/dni`) y `DECOLECTA_TOKEN`.
- **Método**: `GET ?numero=<8 dígitos>` con header
  `Authorization: Bearer <DECOLECTA_TOKEN>`.
- **Consumido por**: `GET /academic/dni` y `PATCH /auth/me/profile` para
  usuarios `OTHER`.
- **Uso**: validar integrantes de disciplinas `participantType = OTHER` y
  completar el perfil de usuarios no estudiantiles.
- **Respuesta cruda**: `{ first_name, first_last_name, second_last_name,
  full_name, document_number }` → se mapea a `AcademicPerson { fullName:
  full_name, dni: document_number, studentCode: null }`.
- **Errores**: `503` si `DECOLECTA_TOKEN` no está configurado; `404` si el DNI
  no existe.

---

## Errores comunes

| Código | Significado |
| ------ | ----------- |
| 400    | Validación de DTO o regla de negocio (mensaje en `message`) |
| 401    | Token ausente/ inválido o usuario inhabilitado |
| 403    | Rol insuficiente para la operación |
| 429    | Rate limit global excedido |
| 404    | Recurso no encontrado |
| 503    | Servicio externo no disponible (p. ej. `DECOLECTA_TOKEN` ausente) |
