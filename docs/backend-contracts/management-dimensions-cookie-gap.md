# Brecha backend — `/api/management/dimensions*` sigue api-key-only

> Handoff CC-WEB → CC-API. **2026-06-01.**

## Qué

El **editor de vistas de gestión (dimensiones + valores)** ya está construido y
mergeado en el frontend (PRs #272 D1 + #273 D2): crear/editar/activar
dimensiones y crear/editar/mover/activar sus valores jerárquicos. **Pero NO es
activable en prod** porque los endpoints que consume **no aceptan la cookie
`qavante_session`** del FE — siguen siendo api-key-only (ADR-0027 cubrió 5
grupos de tesorería C3, pero NO `management/dimensions`).

## Endpoints que faltan abrir a la cookie (espejo de lo que ADR-0027 hizo para `management/accounts`)

- `GET  /api/management/dimensions`
- `POST /api/management/dimensions`
- `PATCH /api/management/dimensions/{id}`
- `GET  /api/management/dimensions/{id}/values`
- `POST /api/management/dimensions/{id}/values`
- `PATCH /api/management/dimension-values/{id}`
- `POST /api/management/dimension-values/{id}/move`
- (cuando se cablee asignaciones) `POST/DELETE /api/management/dimension-assignments`

## Por qué importa

`management/accounts/tree` ya acepta la cookie (ADR-0027) → el editor de cuentas
está LIVE. Las dimensiones son la pieza par: misma UX, mismo patrón, pero el
gate de auth las deja fuera. Una vez que el backend extienda la cookie a estos
endpoints (mismo cambio que hizo para accounts), el FE solo necesita **activar
el flag** `managementDimensions` (o el que aplique) en `wrangler.toml` — el
código ya está listo y testeado.

## Verificación sugerida (igual que ADR-0027)

`curl` con cookie vs sin: con `qavante_session` válida debe responder 200 (no
`401 no_session` ni `Falta X-Api-Key`).
