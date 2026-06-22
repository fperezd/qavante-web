# Contrato esperado — Onboarding: signup + verificar email

> **CC-WEB → CC-API. 2026-06-21.** Contrato **FE-first**: el FE construyó los
> pasos 1-2 del wizard de onboarding contra este contrato + MSW, **gated por
> `onboarding` (OFF en prod)**. Modelo [ADR-0017](../adr/0017-modelo-identidad-multi-empresa.md)
> (la 1ra persona crea su empresa y queda owner). Los endpoints **aún no existen
> en prod** (`/api/auth/*` solo tiene login/refresh/accept-invitation/logout).
> Tipos hand-rolled en `src/lib/api/onboarding.ts`.

## 1. `POST /api/auth/signup`

Crea **persona** (email = llave) + **empresa** (RUT, tenant) y deja a la persona
como **owner**. Dispara el correo de verificación. **NO inicia sesión** (Fase 1:
primero se verifica el email).

- **Auth:** público (sin sesión).
- **Request:**
  ```jsonc
  {
    "name": "Fernando Pérez",
    "email": "fernando@tooxs.com",
    "password": "claveSegura1",
    "company_name": "Tooxs SpA",
    "company_rut": "76.123.456-7",
  }
  ```
- **201/200 →**
  ```jsonc
  { "email": "fernando@tooxs.com", "verification_sent": true }
  ```
- **409** si email o RUT ya existen (el FE muestra el detalle).
- **422** validación (el FE ya valida formato; el backend valida canónicamente:
  dígito verificador del RUT, unicidad, fuerza de clave).

## 2. `POST /api/auth/verify-email`

Valida el token del link del correo (`/verificar?token=…`). Si es válido,
**setea la cookie de sesión** (`qavante_session`) → la persona queda logueada y
el FE continúa al primer paso post-auth (`/onboarding/conectar-sii`).

- **Auth:** público (el token ES la credencial).
- **Request:** `{ "token": "…" }`
- **200 →** `{ "verified": true }` **+ Set-Cookie** `qavante_session` (Domain=.qavante.com, HttpOnly, Secure, SameSite=Lax).
- **400/410** token inválido / expirado (el FE ofrece reenviar).

## 3. `POST /api/auth/resend-verification`

Reenvía el correo de verificación.

- **Request:** `{ "email": "…" }` · **200** (idempotente; no revelar si el email existe).

## Notas

- El FE pasa `?email=` a `/verificar` tras el signup para el estado "te enviamos
  un correo" (sin token todavía).
- Tras verificar, la empresa creada queda como **active_company** de la sesión
  (ver [auth-identity-multi-empresa-contract.md](./auth-identity-multi-empresa-contract.md)).
- Endpoints para el flag (`onboarding`): el entry es `/api/auth/signup`.
