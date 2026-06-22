# Contrato esperado — Onboarding: traer datos / completar / status + guard

> **CC-WEB → CC-API. 2026-06-22.** Contrato **FE-first** (paso 7 final + guard del
> wizard, gated `onboarding` OFF). Tipos hand-rolled en
> `src/lib/api/onboarding-status.ts`. Endpoints **aún no existen**.

## 1. `POST /api/onboarding/sync`

Dispara la traída inicial de datos (SII + banco) tras conectar las fuentes.
Puede ser asíncrona.

- **Auth:** cookie. **200 →** `{ "started": true }`.

## 2. `POST /api/onboarding/complete`

Marca el onboarding del tenant como completado.

- **Auth:** cookie. **200 →** `{ "completed": true }`.

## 3. `GET /api/onboarding/status` (para el guard)

- **Auth:** cookie.
- **200 →**
  ```jsonc
  {
    "completed": false,
    "current_step": "connect-sii", // id del paso sugerido si está incompleto; null si completed
  }
  ```
- `current_step` ∈ ids de `OnboardingStep` (`signup` | `verify-email` | `connect-sii` |
  `connect-bank` | `industry` | `opening-balance` | `import`).

## Guard (enforcement) — pendiente de wiring

El FE provee `useOnboardingStatus`. La **enforcement** (mandar al wizard si el
tenant no completó onboarding) **NO está cableada todavía** porque toca el entry
vivo (`/inicio`) y depende de este `status` (o de `active_company`/`companies`
del [contrato de identidad](./auth-identity-multi-empresa-contract.md)). Cuando
exista `GET /api/onboarding/status` (o el login/me devuelva `onboarding_completed`),
se agrega el guard en un PR dedicado: post-login → si `!completed` → redirect a
`/onboarding/{current_step}`.

**Recomendación:** lo más simple para el FE es que **`/api/me` incluya
`onboarding_completed: bool`** (un campo), evitando un endpoint extra. Avisar cuál
prefieren.
