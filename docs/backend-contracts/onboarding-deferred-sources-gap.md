# Brecha de contrato — "conectar después" (fuentes diferidas del onboarding)

> **CC-WEB → CC-API. 2026-08-14.** Pedido de UN campo para cerrar el patrón
> ratificado por Fernando el 2026-08-12: **"siempre wizard, con conexiones
> diferibles"**. El FE ya está construido y funcionando **sin** este campo; lo que
> falta es que el diferimiento **sobreviva a la sesión**.

## Estado verificado del contrato (snapshot OpenAPI de `qavante-api`, 2026-08-14)

| Pieza                                                                                             | Estado                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /api/onboarding/status` → `{completed, completed_at, steps:{sii_connected, bank_connected}}` | ✅ en el snapshot                                  |
| `POST /api/onboarding/sync` (per-source `ok`/`failed`/`skipped`)                                  | ✅                                                 |
| `POST /api/onboarding/complete`                                                                   | ✅                                                 |
| `onboarding_completed` en `/api/me`                                                               | ✅                                                 |
| `POST /api/treasury/opening-balance`                                                              | ✅                                                 |
| `GET /api/bank-movements/bice/accounts` + `POST …/{external_id}/link`                             | ✅ (usados por la pantalla "cuentas por vincular") |
| **Fuente DIFERIDA por el usuario**                                                                | ❌ **no existe**                                   |

`OnboardingSteps` solo dice si una fuente está **conectada**. No hay forma de
distinguir _"todavía no la conectó"_ de _"eligió conectarla después"_.

## Por qué importa

Con "conectar después" el usuario declara una decisión. Si el backend no la
recuerda:

- al volver a entrar, el guard lo trata como pendiente y lo empuja de nuevo al
  paso que acaba de saltar (justo lo que el patrón busca evitar);
- no se puede saber, del lado producto, cuántos usuarios **difieren** una fuente
  vs cuántos **abandonan** el paso.

## Lo que el FE necesita (mínimo)

Cualquiera de las dos formas sirve; la segunda es la que preferimos:

```jsonc
// A) por paso, junto a los *_connected
"steps": { "sii_connected": false, "sii_deferred": true, "bank_connected": false, "bank_deferred": false }

// B) lista explícita (extensible al ERP sin tocar el shape)
"deferred_sources": ["sii"]
```

Y un endpoint para escribirlo, p.ej.:

```
POST /api/onboarding/sources/{source}/defer     → marca "la conecto después"
DELETE /api/onboarding/sources/{source}/defer   → la retoma (o basta con conectarla)
```

`source` ∈ `sii` | `bank` (y `erp` cuando exista). Idempotente, owner/admin.

## Qué hace el FE mientras tanto (sin mentir)

- El diferimiento vive **en memoria, por sesión de navegación**
  (`src/lib/onboarding/deferred-sources.ts`). Nada se persiste (sin
  `localStorage`: prohibido en este repo por el runtime de Workers).
- Al recargar, una fuente diferida vuelve a leerse como **pendiente** — que es la
  verdad conocida. **Nunca** se muestra como conectada.
- Todo el consumo pasa por el adaptador `src/lib/api/onboarding-sources.ts`.
  Conectar el campo real es **una línea** en `deferredSourcesFromStatus()`; el
  resto del FE (guard, hub de conexiones, pasos, banner) no cambia.

## Nota adicional (menor)

`GET /api/onboarding/status` **no** trae `current_step` (el contrato FE-first de
2026-06-22 lo proponía). El FE no lo necesita: deriva dónde retomar desde
`steps` + los diferimientos (`onboardingResumeRoute`). Queda anotado para que
`onboarding-status-contract.md` no se lea como si existiera.
