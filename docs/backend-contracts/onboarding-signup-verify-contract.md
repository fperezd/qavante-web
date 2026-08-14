# Contrato esperado — Onboarding: signup + verificar email

> **CC-WEB → CC-API. Actualizado 2026-06-22.** signup + verify-email **YA están
> en prod** ✅ → el FE usa los **tipos generados** (`SignupRequest`,
> `SignupResponse`, `VerifyEmailRequest`, `LoginResponse`) en
> `src/lib/api/onboarding.ts`. Modelo [ADR-0017](../adr/0017-modelo-identidad-multi-empresa.md)
> (la 1ra persona crea su empresa y queda owner). Gated por `onboarding`, que está
> **ON en prod** desde 2026-06-22 (`wrangler.toml`): el registro self-serve **está
> vivo**. (Este encabezado decía "OFF en prod"; corregido tras el review del PR
> #935.) Este doc queda como referencia del flujo; el contrato vivo es el OpenAPI.

## 1. `POST /api/auth/signup` ✅ (en prod)

Crea **persona** (owner) + **empresa** y dispara el correo de verificación. **NO
inicia sesión** (primero se verifica el email). **Captcha Turnstile obligatorio**
(fail-closed sin él).

- **Auth:** público. **Request** (`SignupRequest`):
  ```jsonc
  {
    "owner_full_name": "Fernando Pérez",
    "owner_rut": "11.111.111-1", // RUT de la persona (con DV)
    "email": "fernando@tooxs.com",
    "password": "claveSegura1",
    "company_name": "Tooxs SpA",
    "company_rut": "76.123.456-0", // opcional (null permitido)
    "captcha_token": "<token de Turnstile>", // anti-bot; el FE lo manda del widget
  }
  ```
- **200 →** `SignupResponse` `{ "status": "pending_verification", "message": "…" }`.
- **409** email/RUT duplicado · **422** validación (DV del RUT, unicidad, clave).
- **Turnstile:** site key pública `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en el FE; la
  **secret** la valida el backend (`TURNSTILE_SECRET`).

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
