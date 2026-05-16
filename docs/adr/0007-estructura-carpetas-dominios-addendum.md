# ADR-0007: Mantener `src/components/` + `src/lib/api/` para los dominios del addendum (no introducir `src/features/`)

- **Status:** Proposed
- **Fecha:** 2026-05-15
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** addendum frontend v2.0 §24, [`docs/addendum/reconciliation.md`](../addendum/reconciliation.md) P1-3, PR de formalización del addendum

## Contexto

El [addendum frontend v2.0](../addendum/frontend-v2.md) §24 propone una estructura objetivo basada en `src/features/<dominio>/{api.ts,hooks.ts,components/}` para los dominios nuevos (management-accounts, management-dimensions, industry-templates, currencies, classification).

El repo real **no usa esa convención**. La estructura vigente es:

- Componentes de dominio: `src/components/<dominio>/` — ya existen `src/components/credenciales/`, `src/components/administracion/`, `src/components/qavante/` (design system).
- Cliente de datos + tipos + hooks TanStack por dominio: `src/lib/api/<dominio>.ts` — ya existen `src/lib/api/credentials.ts`, `src/lib/api/users.ts`, `src/lib/api/client.ts`, `src/lib/api/error-messages.ts`.
- Hooks UI transversales: `src/hooks/`.
- El **Anexo E del Documento Maestro v2.6.4** define la estructura canónica de carpetas (39 rutas + layout de `src/`).

El addendum mismo (§24) admite: _"Claude Code debe adaptar nombres exactos al repo real"_. Y su §4 prioridad 1 + §30 ordenan resolver a favor del repo cuando hay conflicto.

Introducir `src/features/` ahora significaría: dos convenciones coexistiendo (los dominios viejos en `components/`+`lib/api/`, los nuevos en `features/`), o una migración masiva de lo existente (viola la regla de no-regresión de CLAUDE.md).

## Decisión

**Mantenemos la convención actual del repo. No se introduce `src/features/`.**

Mapeo autoritativo del addendum §24 → estructura real, a aplicar en los PRs #84+ derivados del addendum:

| Addendum §24                                      | Ubicación real en `qavante-web`                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/<dominio>/api.ts` + `hooks.ts`      | `src/lib/api/<dominio>.ts` (tipos + cliente + hooks TanStack en un módulo por dominio, patrón de `credentials.ts`)                                           |
| `src/features/<dominio>/components/*`             | `src/components/<dominio>/*`                                                                                                                                 |
| `src/lib/api/query-keys.ts`                       | aceptable como archivo nuevo central, o `query-keys` co-locados por dominio si el repo ya lo hace así — seguir el patrón existente al momento de implementar |
| Rutas `src/app/(app)/administracion/<x>/page.tsx` | igual (ya es la convención real, respetar el route group `(app)`)                                                                                            |

Si al momento de implementar PR #84 la cantidad de dominios nuevos hace que `src/components/` quede inmanejable, **se evalúa `src/features/` en un ADR-superseder específico** — no se decide preventivamente acá.

## Alternativas consideradas

- **Opción A — adoptar `src/features/` como el addendum pide (descartada):** crea doble convención o fuerza migración masiva de `credenciales/`, `administracion/`, `users.ts`, etc. Viola no-regresión. El beneficio (co-location estricta por feature) no supera el costo de inconsistencia en un repo que ya tiene 3+ dominios en la convención actual.
- **Opción B — migrar TODO a `src/features/` (descartada):** refactor masivo de código que ya pasa tests y está deployado, sin necesidad funcional. Anti-pattern explícito de CLAUDE.md.
- **Opción C — mantener convención actual + tabla de mapeo (elegida):** cero refactor, consistencia total, el addendum se cumple en intención (separación por dominio) sin imponer su layout literal.

## Consecuencias

### Positivas

- Cero regresión. Lo deployado no se toca.
- Un solo patrón mental para todo el repo: dominio → `components/<dominio>/` + `lib/api/<dominio>.ts`.
- Los PRs #84+ del addendum tienen una regla de ubicación inequívoca (la tabla de mapeo).

### Negativas / tradeoffs aceptados

- Menos co-location estricta que `src/features/` (los componentes y el cliente de datos de un dominio viven en árboles distintos). Aceptable: ya es así para `credenciales` y funciona.
- Si el número de dominios crece mucho, `src/components/` podría necesitar revisión futura — explícitamente diferido a un ADR posterior, no resuelto acá.

### Acciones que destraba o requiere

- [ ] Los PRs #84–#89 del addendum aplican la tabla de mapeo de este ADR.
- [ ] Si se evalúa `src/features/` a futuro: ADR-superseder, no cambio silencioso.

## Referencias

- [Addendum frontend v2.0 §24](../addendum/frontend-v2.md)
- [Reconciliación P1-3](../addendum/reconciliation.md)
- Documento Maestro v2.6.4 Anexo E (estructura de carpetas)
- CLAUDE.md regla de no-regresión
