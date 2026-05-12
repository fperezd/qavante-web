# Contrato backend — Auth + User CRUD (C0-11 + C0-14)

> Documento que enumera los endpoints HTTP que el frontend `qavante-web` ya
> consume (o consumirá inmediatamente al implementar C0-15) y que aún no
> están deployados en `tooxs-gestion-api.fly.dev`. Este archivo es la fuente
> de verdad para abrir un issue en el repo backend `qavante-api`.
>
> **Estado verificado el 2026-05-12:** `GET /openapi.json` de producción
> devuelve 43 paths, ninguno bajo `/api/auth/*`, `/api/me` ni `/api/users/*`.
> El código de login + middleware + interceptor 401 ya está en `main` del
> frontend (mergeado en PRs #12, #13, #14) consumiendo estos endpoints.

---

## 1. Contexto y restricciones del frontend

### 1.1 Cookie de sesión (compartida con backend)

| Atributo   | Valor                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Nombre     | `qavante_session` (constante en [src/lib/auth/cookies.ts:6](../../src/lib/auth/cookies.ts#L6))                          |
| `HttpOnly` | **obligatorio** (CLAUDE.md regla 6 prohibe storage APIs para tokens)                                                    |
| `Secure`   | obligatorio en prod (Cloudflare Workers sobre HTTPS)                                                                    |
| `SameSite` | `Lax` (recomendado; permite navegación cross-site al landing)                                                           |
| `Path`     | `/`                                                                                                                     |
| `Domain`   | `qavante.cl` en prod, sin domain en dev (`.fly.dev` vs `localhost`)                                                     |
| Contenido  | Session token opaco firmado por el backend. El frontend NO lo lee, sólo lo pasa de regreso vía `credentials: "include"` |
| Vida       | Idealmente ≤ 1h para access, refresh token aparte (cookie distinta opcional, o mismo cookie con rotación en `/refresh`) |

El interceptor 401 en [src/lib/api/client.ts:64](../../src/lib/api/client.ts#L64) llama a `/api/auth/refresh` automáticamente cuando recibe un 401; si responde 2xx reintenta el request original. Si refresh falla, redirige a `/login?redirect=<path>`.

### 1.2 Formato canónico de error

El frontend espera respuestas de error con la siguiente shape (ver [error-messages.ts](../../src/lib/api/error-messages.ts)):

```json
{
  "code": "string_machine_readable",
  "detail": "Mensaje en español que puede mostrarse al usuario"
}
```

El status HTTP define el comportamiento; el `code` da especificidad. Códigos ya mapeados a UI:

| HTTP          | `code`                             | Copy mostrado                                                |
| ------------- | ---------------------------------- | ------------------------------------------------------------ |
| 401 (login)   | `invalid_credentials` o cualquiera | "RUT o clave incorrectos. Verificá tus datos."               |
| 401 (general) | —                                  | "Tu sesión expiró. Volvé a iniciar sesión."                  |
| 403           | —                                  | "No tenés permisos para realizar esta acción."               |
| 404           | —                                  | "No encontramos la información que buscás."                  |
| 422           | —                                  | "Algunos datos no son válidos. Revisá el formulario."        |
| 429           | —                                  | "Hiciste muchas operaciones seguidas. Esperá unos segundos." |
| 503           | —                                  | "Qavante está en mantenimiento. Volvemos pronto."            |
| 5xx           | —                                  | "No pudimos cargar la información. Intentá nuevamente."      |

### 1.3 Roles canónicos (ver Anexo C.4 del Documento Maestro v2.6.4)

Lista exacta en [src/lib/auth/types.ts:1-8](../../src/lib/auth/types.ts#L1-L8):

```ts
type UserRole =
  | "owner"
  | "admin"
  | "finance_manager"
  | "accountant"
  | "viewer"
  | "external_advisor"
  | "technical_admin";
```

---

## 2. Endpoints — C0-11 (auth)

### 2.1 `POST /api/auth/login`

**Permiso:** público (sin cookie).
**Consumido por:** [login-form.tsx:45](../../src/components/forms/login-form.tsx#L45).

**Request body**

```json
{
  "rut": "12345678-9",
  "password": "<plaintext, mínimo 6 caracteres>"
}
```

- `rut`: string con formato chileno (con puntos opcionales, guión obligatorio). El frontend valida con `isValidRut` antes de enviar, pero el backend debe re-validar.
- `password`: string. El frontend no impone más que `>= 6`; el backend define la política real.

**Response 200 (success)**

- Body: `{ user: SessionUser }` (opcional pero útil para evitar un `GET /api/me` inmediato).
- **Side effect crítico:** setea cookie `qavante_session` HttpOnly con session token. Si hay refresh token separado, también setearlo (sugerido: `qavante_refresh`, HttpOnly, path=`/api/auth/refresh`, expiración mayor).

```json
{
  "user": {
    "id": "uuid-string",
    "email": "fperez@tooxs.com",
    "role": "owner"
  }
}
```

**Response 401**

```json
{ "code": "invalid_credentials", "detail": "Credenciales inválidas." }
```

El frontend mapea cualquier 401 en contexto login al mismo copy genérico (no diferencia "usuario no existe" vs "clave mala" por seguridad).

**Response 422** — validación de RUT/email mal formateado (no debería ocurrir si el frontend valida).

**Response 429** — rate-limit. Recomendado: 5 intentos por RUT en 5 min; bloquear con 429 + `Retry-After` header.

---

### 2.2 `POST /api/auth/refresh`

**Permiso:** requiere cookie de refresh válida (o session vencida pero refresh vigente).
**Consumido por:** interceptor 401 en [client.ts:15](../../src/lib/api/client.ts#L15).

**Request body:** vacío (la cookie es todo lo que se necesita).

**Response 200**

- Body opcional: `{ user: SessionUser }`.
- **Side effect:** rotar cookie `qavante_session` con nuevo token. Idealmente rotar también refresh token (defensa contra replay).

**Response 401**

- Refresh inválido o expirado → forzar re-login.
- Cualquier 4xx hace que el interceptor pase al `window.location.href = /login?redirect=...`.

---

### 2.3 `POST /api/auth/logout`

**Permiso:** requiere sesión.
**Consumido por:** _aún no consumido_, pero será obligatorio cuando se agregue botón "Cerrar sesión" en el sidebar (Anexo B, header del shell).

**Request body:** vacío.

**Response 204** — sin body. **Side effect:** invalidar refresh token en server y enviar `Set-Cookie` con expiración pasada para `qavante_session` (y refresh).

---

### 2.4 `GET /api/me`

**Permiso:** requiere sesión.
**Consumido por:** [session.ts:11](../../src/lib/auth/session.ts#L11) (actualmente placeholder; cuando esté el endpoint, esta función llama y reemplaza el placeholder).

**Request:** sólo cookie.

**Response 200**

```json
{
  "user": {
    "id": "uuid-string",
    "email": "fperez@tooxs.com",
    "role": "owner",
    "tenant_id": "uuid-string",
    "permissions": ["users.read", "users.write", "..."],
    "name": "Fernando Pérez",
    "last_login_at": "2026-05-11T23:00:00Z"
  }
}
```

Campos mínimos (`id`, `email`, `role`) ya están en el tipo `SessionUser` del frontend. Los adicionales (`tenant_id`, `permissions`, `name`, `last_login_at`) son necesarios para C0-15 (tabla de usuarios) y para el shell (mostrar nombre y rol en el header).

**Response 401** — sin cookie o cookie inválida (después de intento de refresh).

---

## 3. Endpoints — C0-14 (User CRUD + invitaciones)

> Permiso de toda esta familia: `admin` u `owner`, salvo `/api/users/me/permissions` que es del usuario actual.

### 3.1 `GET /api/users`

**Permiso:** `admin` u `owner`.
**Consumido por:** tabla TanStack en `/app/administracion/usuarios` (C0-15).

**Query params** (todos opcionales, paginación shape estándar):

| Param       | Tipo                                   | Default | Notas                     |
| ----------- | -------------------------------------- | ------- | ------------------------- |
| `page`      | int                                    | 1       | 1-indexed                 |
| `page_size` | int                                    | 25      | máx 100                   |
| `search`    | string                                 | —       | filtra por nombre o email |
| `role`      | UserRole                               | —       | filtro por rol            |
| `status`    | `"active" \| "suspended" \| "invited"` | —       | filtro por estado         |

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@empresa.cl",
      "name": "Nombre Apellido",
      "role": "finance_manager",
      "status": "active",
      "last_login_at": "2026-05-11T20:00:00Z",
      "invited_at": null,
      "created_at": "2026-04-01T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 25
}
```

- `status = "invited"` → usuario aún no aceptó la invitación. `last_login_at` es `null`.
- El frontend renderiza columnas: nombre, email, rol, estado, último login, acciones.

**Response 403** — viewer/accountant/etc intentando listar (rol insuficiente).

---

### 3.2 `POST /api/users` (invitar)

**Permiso:** `admin` u `owner`.

**Request body**

```json
{
  "email": "nuevo@empresa.cl",
  "role": "finance_manager",
  "name": "Nombre Apellido (opcional)"
}
```

**Comportamiento esperado:**

1. Crear registro en tabla `user_invitations` con `token` único (UUID o random 32 bytes hex) y `expires_at = now() + 7 days` (DoD del Kit).
2. Enviar email vía Resend al `email` con link `https://qavante.cl/aceptar-invitacion?token=<token>`.
3. El user queda en estado `"invited"` hasta aceptar.

**Response 201**

```json
{
  "id": "uuid-del-pending-user-o-invitacion",
  "email": "nuevo@empresa.cl",
  "role": "finance_manager",
  "status": "invited",
  "invited_at": "2026-05-12T10:00:00Z",
  "expires_at": "2026-05-19T10:00:00Z"
}
```

**Errores:**

- `409 { "code": "email_already_exists", "detail": "..." }` — email ya está activo en el tenant.
- `409 { "code": "invitation_already_pending", "detail": "..." }` — ya hay invitación pendiente para ese email (idempotency: opción de reenviar).
- `422` — email inválido o rol inválido (no en lista de `UserRole`).

---

### 3.3 `PATCH /api/users/{id}`

**Permiso:** `admin` u `owner`.

**Request body** (todos opcionales, al menos uno):

```json
{
  "role": "admin",
  "status": "suspended"
}
```

**Validaciones del backend:**

- Si el target user es el **único `owner` activo del tenant** y se intenta cambiar `role ≠ owner` o `status = suspended`: devolver **409 `last_owner_protection`**.
- No se permite auto-suspender (`{id} == current_user.id` con `status = "suspended"`).
- `role` debe estar en el enum `UserRole`.
- `status` debe estar en `"active" | "suspended"` (no se puede pasar a `"invited"` por PATCH).

**Response 200** — user actualizado con el shape del item de §3.1.

**Errores:**

- `403` — no admin/owner.
- `404` — user no existe o no está en el tenant.
- `409` con `code: "last_owner_protection"`.
- `422` — body inválido.

---

### 3.4 `POST /api/auth/accept-invitation`

**Permiso:** público (sin cookie, sólo token).
**Consumido por:** página `/aceptar-invitacion?token=xxx` (C0-15 deliverable).

**Request body**

```json
{
  "token": "uuid-o-hex-del-link",
  "password": "<plaintext, política del backend>",
  "password_confirmation": "<igual al anterior>"
}
```

**Comportamiento:**

1. Validar token (existe, no expirado, no usado).
2. Crear `user` real desde la invitación.
3. Marcar invitación como `accepted_at = now()`.
4. **Setear cookies de sesión** (igual que login) → el flujo deja al usuario logueado de una vez sin redirect a /login.

**Response 200**

```json
{
  "user": {
    /* mismo shape que login */
  }
}
```

**Errores:**

- `404 { "code": "invitation_not_found" }` — token inválido o ya usado.
- `410 { "code": "invitation_expired" }` — token vencido. El frontend muestra "El enlace ya no es válido. Pedile a un admin que te invite de nuevo."
- `422` — passwords no coinciden o no cumple política.

---

### 3.5 `GET /api/users/me/permissions`

**Permiso:** requiere sesión (cualquier rol).

**Response 200**

```json
{
  "permissions": ["users.read", "users.write", "sources.bice.read", "..."],
  "role": "owner"
}
```

El frontend usará esto para gating fino en componentes (más allá del rol crudo). Lista exacta de permisos = Anexo C.4 del Documento Maestro.

**Alternativa:** si los permisos ya vienen en `GET /api/me`, este endpoint puede omitirse y dejar el campo `permissions` allá.

---

## 4. Modelos compartidos (sugerencia para OpenAPI)

```yaml
User:
  type: object
  required: [id, email, role, status]
  properties:
    id: { type: string, format: uuid }
    email: { type: string, format: email }
    name: { type: string, nullable: true }
    role:
      type: string
      enum: [owner, admin, finance_manager, accountant, viewer, external_advisor, technical_admin]
    status:
      type: string
      enum: [active, suspended, invited]
    last_login_at: { type: string, format: date-time, nullable: true }
    invited_at: { type: string, format: date-time, nullable: true }
    created_at: { type: string, format: date-time }

ErrorResponse:
  type: object
  required: [code, detail]
  properties:
    code: { type: string }
    detail: { type: string }
```

---

## 5. Notas de seguridad (no negociables)

1. **HttpOnly + Secure obligatorios** en todas las cookies de sesión y refresh. El frontend no tiene fallback a localStorage (CLAUDE.md regla 6).
2. **CSRF:** con `SameSite=Lax` el riesgo de CSRF clásico está mitigado, pero para POST/PATCH/DELETE recomendamos doble token (header `X-Csrf-Token` que el backend devuelva en `GET /api/me`). El frontend puede agregar esto fácilmente si el backend lo requiere.
3. **Rate limit en `/api/auth/login`:** mínimo recomendado 5 intentos/RUT en 5 min, con 429 + `Retry-After`.
4. **Mensaje 403 genérico:** no filtrar qué rol falta (Kit C0-16 DoD); responder `403 { code: "permission_denied", detail: "No tenés permisos para esta acción." }`.

---

## 6. Acción esperada del backend

Crear issue en `qavante-api` titulado **"C0-11 + C0-14: auth endpoints + User CRUD"** con este documento como descripción (o link a este archivo). DoD del issue backend:

- [ ] 9 endpoints documentados acá implementados en FastAPI.
- [ ] Tests pytest cubriendo casos felices + edge (último owner, token expirado, email duplicado, rate limit).
- [ ] `/openapi.json` deployado refleja los nuevos paths.
- [ ] Frontend regenera tipos con `npm run generate:api` y compila sin tocar handlers.
- [ ] Smoke test manual: login con un usuario seed funciona contra `tooxs-gestion-api.fly.dev`.

---

Generated by CC-WEB — 2026-05-12.
