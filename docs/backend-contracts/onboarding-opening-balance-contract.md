# Contrato esperado — Saldo de apertura (onboarding)

> **CC-WEB → CC-API. 2026-06-22.** Contrato **FE-first** (paso 6 del wizard,
> gated `onboarding` OFF). Tipos hand-rolled en `src/lib/api/opening-balance.ts`.

## Contexto

Existe `POST /api/treasury/bank-accounts/{account_id}/opening-balance` (per-cuenta),
pero **requiere una cuenta bancaria conectada**. Durante el onboarding el banco
puede no estar conectado todavía → el wizard ofrece un **saldo de apertura
MANUAL a nivel tenant** como punto de partida de la caja.

## `POST /api/treasury/opening-balance` (nuevo, FE-first)

- **Auth:** cookie `qavante_session`.
- **Request:**
  ```jsonc
  {
    "balance": "1500000", // string-decimal CLP
    "as_of_date": "2026-06-22", // YYYY-MM-DD (opcional; default = hoy del tenant)
  }
  ```
- **200 →**
  ```jsonc
  { "balance": "1500000", "as_of_date": "2026-06-22" }
  ```

## Notas

- Es el saldo inicial total del tenant (manual). Cuando haya cuentas conectadas,
  el saldo per-cuenta (`/bank-accounts/{id}/opening-balance`) lo refina.
- El FE manda solo dígitos en `balance` (CLP entero). Sin decimales en Fase 1.
- Paso **opcional**: el usuario puede omitirlo y cargarlo después.
