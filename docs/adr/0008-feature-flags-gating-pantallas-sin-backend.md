# ADR-0008: Feature flags para liberar pantallas del addendum sin mocks engañosos

- **Status:** Proposed
- **Fecha:** 2026-05-15
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** addendum frontend v2.0 §13 + Tabla 8, [`docs/addendum/reconciliation.md`](../addendum/reconciliation.md) P2

## Contexto

El addendum (§13 + Tabla 8) plantea que el backend puede entregar los endpoints de taxonomía/management/currencies **parcialmente** — algunos sí, otros no — y que el FE debe poder liberar pantallas de forma segura sin:

1. Mostrar UI mock que parezca real (anti-pattern explícito del addendum §5.2 y §6.1).
2. Romper rutas (`feature flag off` debe mostrar pantalla informativa, no 404 ni crash).

El addendum sugiere flags desde `GET /api/management/config` cuando exista, con fallback a "configuración local temporal claramente marcada como provisional". Tabla 8 lista 7 flags con default `false`:
`managementAccounts`, `managementDimensions`, `industryTemplates`, `multiCurrency`, `classificationRules`, `bankMovementClassification`, `phase2PlanningPreview`.

El repo **no tiene hoy** un patrón de feature flags. ADR-0005 (MSW) resuelve el "desarrollar sin backend" para dev/test, pero MSW **no** es un mecanismo de gating de producción — son cosas distintas (MSW intercepta en dev/test; feature flags gatean qué ve el usuario en prod según disponibilidad backend).

## Decisión

**Adoptamos feature flags con esta jerarquía de fuente, default seguro `false`:**

1. **Fuente primaria:** `GET /api/management/config` (o el endpoint que el backend exponga en el handoff). Si responde, manda.
2. **Fallback de detección:** si `/config` no existe aún, derivar disponibilidad de la **presencia del endpoint en el OpenAPI generado** (un dominio cuyo endpoint no está en `types.ts` → flag `false`). Esto evita una lista hardcodeada que se desincronice.
3. **Override local explícito:** sólo para dev/test, vía env var documentada (ej. `NEXT_PUBLIC_FF_*`), nunca como default de prod. Marcado como provisional en el código.

**Regla dura:** flag `false` ⇒ la ruta existe pero renderiza un estado "esta sección todavía no está disponible" (informativo, accionable, con copy de negocio del addendum §14.7) — **nunca** UI mock que simule datos reales, **nunca** ruta rota.

El módulo de flags vive en `src/lib/feature-flags.ts` (convención del repo: lógica transversal en `src/lib/`). Implementación concreta se hace en **PR #83** (cuando el handoff backend defina si `/config` existe). Este ADR fija el **patrón y los invariantes**, no el código.

## Alternativas consideradas

- **Opción A — sin flags, mostrar todo y que falle si el backend no está (descartada):** rompe rutas, mala UX, viola §6.1 del addendum.
- **Opción B — lista hardcodeada de flags en el FE (descartada):** se desincroniza del backend; cada cambio backend requiere PR FE. Frágil.
- **Opción C — `/config` + fallback por presencia en OpenAPI + override dev (elegida):** el backend manda cuando puede; mientras no, el propio OpenAPI generado es la señal de verdad (ya es nuestra fuente de tipos); el override dev no contamina prod.

## Consecuencias

### Positivas

- Pantallas del addendum se liberan incrementalmente sin coordinar deploy exacto FE/BE.
- Cero mocks engañosos en prod. Coherente con ADR-0005 (MSW es dev/test, esto es gating prod — separados y explícitos).
- El fallback por OpenAPI reusa la fuente de verdad que ya tenemos (`generate:api`), sin lista paralela.

### Negativas / tradeoffs aceptados

- El fallback "por presencia en OpenAPI" requiere una convención clara de qué endpoint mapea a qué flag — se documenta en el módulo al implementar.
- Un flag mal configurado en `/config` puede ocultar una pantalla lista. Mitigación: el override dev permite verificar; logs claros.

### Acciones que destraba o requiere

- [x] **Patrón materializado** (`src/lib/feature-flags.ts` + tests): 7 flags
      tipados, default `false`, override env `NEXT_PUBLIC_FF_*` (ignorado en
      prod), seam `config` inyectable para el futuro `/api/management/config`.
      Ver "Estado de implementación" abajo.
- [ ] Brief a CC-API: pedir explícitamente si habrá `GET /api/management/config` y su shape; si no, confirmar que el fallback por OpenAPI es aceptable.
- [x] Documentar en CONTRIBUTING.md el override `NEXT_PUBLIC_FF_*` para dev.

## Estado de implementación (2026-05-16)

El **patrón** está implementado; la **integración real** está diferida (no
depende solo de código):

- ✅ Registro tipado de 7 flags, default seguro `false`, override dev/test,
  seam `config` para inyectar `GET /api/management/config`.
- ⏸️ Fuente primaria `/api/management/config`: **el backend no la expone**
  (verificado 2026-05-16, [reconciliation P4-1](../addendum/reconciliation.md)).
  El seam existe; se cablea en el PR de integración real.
- ⏸️ Fallback "presencia en OpenAPI": **no se implementa como introspección
  runtime** — `types.ts` son tipos (se borran al compilar), no hay artefacto
  runtime. `FLAG_GATING_ENDPOINT` deja documentado el mapeo flag→endpoint para
  ese trabajo futuro (cuando exista `/config` o `generate:api` emita una lista
  de paths runtime). Default `false` es el comportamiento correcto entretanto.

Por eso el status sigue `Proposed`: la decisión completa se cierra cuando el
handoff backend confirme `/config` (o su ausencia definitiva).

## Referencias

- [Addendum frontend v2.0 §13 + Tabla 8](../addendum/frontend-v2.md)
- [Reconciliación P2](../addendum/reconciliation.md)
- [ADR-0005](./0005-mock-service-worker-for-fe-dev.md) — MSW es dev/test, distinto de gating prod
