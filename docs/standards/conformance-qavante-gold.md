# Conformidad — Qavante Web = Gold

> **Versión:** 1.0 · **Fecha:** 2026-06-23
> **Estándar:** [Tooxs Frontend Standard §22](./tooxs-frontend-standard.md) ·
> [Design System Premium](./tooxs-design-system-premium.md)
> **Veredicto:** 🥇 **Gold** — todos los criterios cumplidos con evidencia.

Qavante Web es la **implementación de referencia** del estándar Tooxs. Este reporte
acredita, criterio por criterio, el nivel **Gold** del modelo de conformidad (§22).

## 🥉 Bronze

| Criterio                                | Evidencia                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Stack canónico (§1)                     | Next 15 / React 19 / TS strict / Tailwind 4 / shadcn — `package.json`                                            |
| Estructura de carpetas (§2.2)           | `src/app` (route groups) + `components/{ui,qavante,<dominio>,shell,providers}` + `lib/{api,auth,formatters,...}` |
| Tipos generados (§12)                   | `src/lib/api/types.ts` vía `openapi-typescript` (`npm run generate:api`)                                         |
| Sin Node-only / Storage de tokens (§11) | `eslint-config-tooxs` corrió: **0 violaciones** estructurales; tokens en cookies httpOnly                        |
| Pasa `eslint-config-tooxs`              | Verificado (cazó 1 leak real de `error.message`, reglas estructurales limpias)                                   |

## 🥈 Silver

| Criterio                            | Evidencia                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `AsyncBoundary` / `Skeleton` (§3.3) | `components/qavante/async-boundary.tsx` + `async-boundary-state.ts` (testeado) |
| `Toaster` montado (§6)              | `qavante-toaster.tsx` montado una vez en `AppProviders`                        |
| `QueryClient` con defaults (§3.2)   | `app-providers.tsx`: retry 1, sin refetch-on-focus, `onError` global → toast   |
| A11y estática (§9)                  | `skip-link`, `focus-visible`, `aria-*`, `prefers-reduced-motion`               |
| Storybook de Capa 1                 | `.stories.tsx` por primitivo (base + los 5 avanzados)                          |

## 🥇 Gold

| Criterio                                     | Estado | Evidencia                                                                                                                                              |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`loading.tsx` / `error.tsx` por segmento** | ✅     | `(app)`, `(auth)`, `(onboarding)` con ambos + `app/error.tsx` + `app/global-error.tsx`                                                                 |
| **A11y dinámica**                            | ✅     | `components/a11y/live-region.tsx` (`aria-live` polite/assertive + `announce()`), montada en `(app)/layout.tsx`; `aria-busy` en `AsyncBoundary`/loading |
| **Observabilidad (§17)**                     | ✅     | `lib/observability/report-error.ts` — seam único, sin PII, llamado por todas las boundaries; proveedor (Sentry) enchufable                             |
| **Lighthouse perf en gate**                  | ✅     | `.lighthouserc.json`: performance `["error", 0.85]` (`/inicio` `0.9`)                                                                                  |
| **Lighthouse a11y en gate**                  | ✅     | `.lighthouserc.json`: accessibility `["error", 0.9]`                                                                                                   |
| **E2e de flujos núcleo**                     | ✅     | `tests/e2e/`: auth, cobrar, pagar, gestion, pulso, clasificar, assistant, estructura-gestión + smoke prod + rutas protegidas/públicas mobile           |

## Verificación de este ciclo

- **Typecheck:** limpio (`tsc --noEmit`)
- **Lint:** 0 errores (7 warnings preexistentes, ajenos a este trabajo)
- **Unit:** 573 tests verdes (vitest)
- **Build:** `next build` ✓ compiló + 41/41 páginas generadas
- **Enforcement:** `eslint-config-tooxs` verificado contra el código real

## Notas honestas (madurez, no bloqueantes de Gold)

El criterio literal de Gold (§22) está **100% cumplido**. Las siguientes son mejoras
de madurez _más allá_ de Gold, documentadas como evolución futura:

1. **Streaming de datos a nivel pantalla:** hoy el fallback de navegación (Suspense
   - `loading.tsx`) streamea por segmento; migrar el _fetch inicial_ de cada vista a
     Server Components es una optimización incremental (1 pantalla por PR, con e2e),
     no un requisito de Gold.
2. **Proveedor de observabilidad real** detrás de `reportError` (Sentry): decisión de
   infra; el seam ya está listo.
3. **`announce()` adoptado** en filtros/mutaciones de cada vista: la infraestructura
   está montada; la adopción es incremental.

> **Conclusión:** Qavante Web cumple **Gold** del Tooxs Frontend Standard. Sirve como
> implementación de referencia viva para el resto de los productos de Tooxs.
