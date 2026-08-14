# Contrato esperado — Onboarding: traer datos / completar / status + guard

> **CC-WEB → CC-API. 2026-06-22.** Contrato **FE-first** (paso 7 final + guard del
> wizard, gated `onboarding` OFF). Tipos hand-rolled en
> `src/lib/api/onboarding-status.ts`. Endpoints **aún no existen**.
>
> **⚠️ Actualización 2026-08-14 — este doc quedó desactualizado en 3 puntos.** (1)
> El flag `onboarding` **NO está OFF: está ON en prod** desde 2026-06-22
> (`wrangler.toml`), o sea el guard corre y hace requests para todos los usuarios
> — leer este doc como "inerte en prod" hace subestimar el blast radius de
> cualquier cambio colgado del flag (hallazgo del review del PR #935). (2) Los
> 3 endpoints **YA están en prod** y el FE usa **tipos generados**. (3) Además el
> `status` real **NO trae `current_step`** (§3 de abajo es el contrato propuesto,
> no el implementado): trae `steps: {sii_connected, bank_connected}`, y el FE
> deriva de ahí dónde retomar. La brecha viva del wizard es otra: **no existe el
> estado "diferida" por fuente** →
> [`onboarding-deferred-sources-gap.md`](./onboarding-deferred-sources-gap.md).

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

## Guard (enforcement) — CABLEADO FE-first (gated)

El guard YA está cableado: `(app)/layout.tsx` (server) resuelve el flag y monta
`<OnboardingGuard enabled={onboarding} />` (client, `onboarding-guard.tsx`), que
consulta `useOnboardingStatus` y, si `completed === false`, redirige a
`/onboarding/{current_step}` (`stepRouteOrFirst`).

- **FAIL-SAFE:** solo redirige con dato **presente, FRESCO** y `completed === false`
  (`shouldResumeOnboarding`). Loading, error, dato **stale** o flag OFF → **no
  redirige** (nunca atrapa al usuario).
- **Gated `onboarding`, que está ON en prod** desde 2026-06-22 → el guard **SÍ
  corre y SÍ hace requests**. (Este punto decía "OFF → hoy inerte en prod"; era
  falso. Corregido tras el review del PR #935.)
- **Cache compartida — el candado de frescura no es opcional:**
  `["onboarding","status"]` vive en el `QueryClient` **único** del layout raíz
  (`app-providers.tsx`), así que la misma entrada la comparten el guard, el hub,
  el banner y los pasos del wizard. `POST /api/onboarding/complete` **debe**
  escribir el status devuelto en esa clave (`applyOnboardingStatus`); sin eso, el
  `completed:false` que dejaron los pasos del wizard sigue en cache cuando el
  usuario aterriza en el panel y el guard lo devuelve al wizard que ACABA de
  terminar. Regresión cubierta por `src/lib/api/onboarding-complete-cache.test.ts`.
- **Limitación:** redirección client-side (un flash). **Mejora recomendada:** que
  **`/api/me` incluya `onboarding_completed: bool`** → el guard pasa a server-side
  en el layout (sin flash, sin endpoint extra). Avisar si lo agregan a `/api/me`.
