# Auditoría UX/UI — Backlog de mejoras

> **Fecha:** 2026-06-23
> **Autor:** Revisión externa, rol Líder UX/UI
> **Alcance:** `qavante-web` (frontend completo, no solo design system)
> **Método:** lectura del código real — tokens, design system, shell, vistas de
> datos, providers, convenciones de Next App Router. No es una revisión de la
> vidriera (primitivos), es del **producto como sistema**.

## Veredicto

**6.5 / 10.** Esto es **un dashboard de 9 rodeado de un producto de 6**. El
equipo sabe ejecutar: cuando deciden pulir una pantalla (ej. `InicioEjecutivoView`)
la dejan impecable — skeleton, error con `role="alert"`, empty, bloques nullables,
capa de confianza, `tabular-nums`, deltas daltonismo-safe, `focus-visible` en todo.
El problema es que **la calidad no está sistematizada**: faltan primitivos para los
estados async, no hay feedback global de mutaciones, no hay streaming RSC, y
demasiada superficie es promesa (placeholder) y no producto.

Las notas por capa están en la tabla final. Lo que sigue es el backlog accionable.

---

## P0 — Bloqueantes de calidad percibida (hacer ya)

### P0-1 · El `<Toaster>` de Sonner no está montado

- **Evidencia:** `sonner` está en `dependencies`, pero `grep "sonner|Toaster|toast("`
  en todo `src/` → **cero resultados** (fuera de tests). No se monta en
  `app-providers.tsx` ni en `layout.tsx`.
- **Impacto:** no hay feedback global de mutaciones. En un SaaS financiero donde
  el usuario guarda, borra, clasifica y concilia, **no confirmar "se guardó / falló"**
  es un hueco de UX de primer orden. Además es una dependencia muerta en el bundle.
- **Fix:** crear `qavante-toaster.tsx` (Sonner `<Toaster>` tematizado con tokens
  de marca: `position="top-right"`, `richColors` mapeado a `success/danger/warning`),
  montarlo una sola vez en `AppProviders`, re-exportar `toast` desde el barrel.
- **Acceptance:** toda mutación (`useMutation`) dispara `toast.success`/`toast.error`
  con copy del Anexo F. Lector de pantalla anuncia el toast (Sonner ya usa
  `aria-live`, validar que quede `polite`/`assertive` según severidad).
- **Esfuerzo:** S · **Riesgo:** bajo (aditivo).

### P0-2 · No hay primitivo de estado async → boilerplate copy-paste en 26 vistas

- **Evidencia:** el bloque de error de ~12 líneas (`role="alert"` + `AlertCircle` +
  chequeo `ApiError` + `apiErrorToUserMessage`) está duplicado en `InicioEjecutivoView`,
  `PagarView` y ~24 más. Cada vista hace su propio `LoadingSkeleton` a mano.
  `QavanteInlineError` **ya existe** (creado para deduplicar esto) pero solo lo
  adoptaron 4 vistas; el resto sigue a mano. **No existe** un skeleton compartido
  ni un componente que componga loading/error/empty alrededor de una query.
- **Impacto:** consistencia-por-disciplina, no por arquitectura. Hoy se ven
  parecidas; en 3 sprints habrán divergido (copys, spacing, iconos). Deuda
  garantizada.
- **Fix:**
  1. Crear `QavanteSkeleton` (bloque `animate-pulse` tokenizado) — hoy cada vista
     reinventa `h-28 animate-pulse rounded-xl bg-neutral-light/30`.
  2. Crear `<AsyncBoundary>` que reciba el resultado de TanStack Query y resuelva
     `isLoading → skeleton`, `isError → QavanteInlineError`, `empty → QavanteEmpty`,
     `data → children`. Slots configurables.
  3. Migrar las 26 vistas **de forma incremental** (1 PR por dominio, respetando
     la regla de no-regresión y los contratos e2e), empezando por las que ya
     adoptaron `QavanteInlineError`.
- **Acceptance:** una vista nueva no escribe ni un `isLoading` a mano. `QavanteInlineError`
  adoptado en 100% de las vistas con query.
- **Esfuerzo:** M (primitivo S + migración incremental) · **Riesgo:** bajo el
  primitivo / medio la migración (mitigar con e2e por dominio).

### P0-3 · Demasiada superficie es placeholder visible en el nav

- **Evidencia:** 19 archivos renderizan `FeatureUnavailableState`; 8 pantallas son
  literalmente *"construcción en Sprint Cx"* / *"Disponible al cerrar…"*. De 39
  rutas, una fracción grande le dice al usuario "no disponible".
- **Impacto:** la **completitud percibida** es baja. El usuario real choca con
  callejones sin salida y pierde confianza en que el producto "está listo".
- **Fix:** decisión de producto — **ocultar del sidebar** lo que está gated/placeholder
  (el gate de nav ya existe en `sidebar.tsx`, hoy solo filtra por rol; extenderlo a
  feature flags) en vez de mostrar la pantalla "no disponible". Mantener las rutas
  accesibles por URL para QA/demos, pero no ofrecerlas en la navegación principal.
- **Acceptance:** el sidebar solo muestra módulos con feature flag ON. Cero
  pantallas "construcción Sprint Cx" alcanzables desde el nav.
- **Esfuerzo:** S · **Riesgo:** bajo.

---

## P1 — Arquitectura y performance percibida

### P1-1 · Todo es fetch client-side, sin streaming RSC ni `loading.tsx`

- **Evidencia:** `find src/app -name loading.tsx` → **ninguno**. Cada vista es
  `"use client"` + react-query `isLoading`. Patrón real: navego → blanco → carga
  JS → fetch → skeleton → data.
- **Impacto:** estás en Next 15 con RSC y **no aprovechás SSR streaming en ninguna
  pantalla de datos**. Se siente como SPA vieja. Para un dashboard financiero el
  waterfall percibido es caro y afecta Lighthouse/LCP.
- **Fix:** mover el fetch inicial de las pantallas clave (`inicio`, `caja`,
  `gestion`) a Server Components con `Suspense` + `loading.tsx` por segmento, e
  hidratar mutaciones/refetch con react-query (prefetch + `HydrationBoundary`).
  Al menos `loading.tsx` por segmento para skeletons en la navegación.
- **Acceptance:** `loading.tsx` en cada segmento de `(app)`. LCP del dashboard
  con dato server-rendered (no spinner). Lighthouse `/app/inicio` ≥ 90 sostenido.
- **Esfuerzo:** L · **Riesgo:** medio (cambia el data-flow; hacerlo pantalla por
  pantalla, no big-bang).

### P1-2 · `QueryClient` sin defaults

- **Evidencia:** `app-providers.tsx` → `new QueryClient()` pelado.
- **Impacto:** defaults de react-query (retry 3×, refetch-on-window-focus) → en una
  app de plata son refetches sorpresivos, parpadeos, y sin estrategia unificada de
  `staleTime`/errores.
- **Fix:** configurar `defaultOptions` (`staleTime` razonable, `retry` acotado,
  `refetchOnWindowFocus` según criticidad del dato, `throwOnError`/`onError` global
  que dispare `toast.error` para errores no manejados).
- **Acceptance:** un solo lugar define la política de cache/retry. Error no
  capturado → toast, no pantalla rota.
- **Esfuerzo:** S · **Riesgo:** bajo.

### P1-3 · Sin error boundary por ruta

- **Evidencia:** existen `src/app/error.tsx` y `not-found.tsx` (root), pero no hay
  `error.tsx` por segmento ni `global-error.tsx`.
- **Impacto:** un throw en una vista de un módulo tumba toda el área en vez de
  degradar local.
- **Fix:** `error.tsx` por segmento de dominio con copy de recuperación (Anexo F) +
  `global-error.tsx` para el catch-all de layout.
- **Esfuerzo:** S · **Riesgo:** bajo.

---

## P2 — Accesibilidad, contenido y consistencia

### P2-1 · A11y dinámica casi inexistente

- **Evidencia:** solo **2 `aria-live`** en toda la app. La a11y estática (labels,
  `focus-visible`, `skip-link`, `prefers-reduced-motion`) es buena; la dinámica no.
- **Impacto:** resultados de filtros, mutaciones y errores async **no se anuncian**
  a lectores de pantalla. En una app transaccional eso es la mitad de la a11y que
  importa.
- **Fix:** región `aria-live="polite"` global para cambios de estado de datos;
  `aria-busy` en contenedores durante fetch; el `<AsyncBoundary>` (P0-2) puede
  centralizar esto. Toasts con severidad → `assertive` para errores.
- **Acceptance:** filtrar una tabla anuncia "N resultados"; guardar anuncia el
  resultado; Lighthouse a11y como **gate duro** (hoy solo hay gates de performance).
- **Esfuerzo:** M · **Riesgo:** bajo.

### P2-2 · Lighthouse a11y no es gate

- **Evidencia:** `.lighthouserc.json` exige performance (login ≥85, inicio ≥90),
  no accesibilidad.
- **Fix:** agregar assertion de categoría `accessibility ≥ 0.95` al `lhci`.
- **Esfuerzo:** S · **Riesgo:** bajo (puede romper CI hasta cerrar P2-1; activar
  como warning primero).

### P2-3 · "Refresh v1.2/v1.3 adoptado progresivamente" = inconsistencia visible

- **Evidencia:** comentarios en `globals.css`/`tokens.css` describen utilidades
  (`glass`, gradientes, `animate-qv-fade-up`) "que los componentes adoptan
  progresivamente". Conviven pantallas en distinto nivel de pulido.
- **Fix:** cerrar el refresh — terminar de adoptar en todas las pantallas o revertir
  lo que no se usa. Definir un checklist de "pantalla terminada" (gradiente de
  título, card premium, animación de entrada, estados async).
- **Esfuerzo:** M · **Riesgo:** bajo.

### P2-4 · Escala neutral y tipográfica pobres para densidad de datos

- **Evidencia:** `tokens.css` tiene 3 grises (`light/mid/dark`); `foreground` es
  alias de `neutral-dark`. Tamaños tipográficos (`text-xs/sm/base`) van sueltos en
  cada componente, sin tokens.
- **Impacto:** las tablas financieras de C4+ van a necesitar 5–6 grises (bordes
  sutiles, texto secundario/terciario, headers) y una escala tipográfica
  consistente. Hoy se resuelve con `/30`, `/60` ad-hoc.
- **Fix:** expandir la escala neutral (50→900) y tokenizar la jerarquía
  tipográfica (display/title/body/caption/data).
- **Esfuerzo:** M · **Riesgo:** bajo.

### P2-5 · Tablas y densidad de datos en mobile sin verificar

- **Evidencia:** 7 vistas con `<table>`, 6 envueltas en `overflow-x-auto` (1 sin
  envolver). Las tablas financieras en mobile (scroll horizontal de columnas de
  plata) son un patrón notoriamente malo y no hay un componente de tabla
  responsiva del design system.
- **Fix:** primitivo `QavanteDataTable` (sobre `@tanstack/react-table`, ya está en
  deps) con patrón responsivo definido (columnas colapsables / vista card en
  mobile), sticky header, `tabular-nums`, alineación de montos a la derecha.
- **Acceptance:** ninguna tabla con scroll horizontal accidental; vista mobile
  usable sin zoom.
- **Esfuerzo:** L · **Riesgo:** medio (toca vistas existentes; incremental).

---

## P3 — Sistema, escala y proceso

### P3-1 · Navegación plana de 2 niveles no escala a 39 rutas

- **Evidencia:** `sidebar.tsx` agrupa por dominio pero los módulos con subrutas
  (`caja → proyeccion/clasificados/por-clasificar`) no muestran sub-items. La
  ubicación dentro de un módulo la resuelve solo el breadcrumb.
- **Fix:** sub-navegación (sidebar con sub-items colapsables o tabs secundarias
  intra-módulo). Indicar sección activa en el nav, no solo en el breadcrumb.
- **Esfuerzo:** M · **Riesgo:** bajo.

### P3-2 · Dark mode

- **Evidencia:** modo claro único (decisión consciente de Fase 1, documentada). La
  estructura de tokens ya está preparada.
- **Fix:** completar el set de tokens dark cuando entre en roadmap. No urgente,
  pero la deuda crece con cada pantalla nueva que hardcodea contra el set claro.
- **Esfuerzo:** L · **Riesgo:** bajo (diferible).

### P3-3 · Variantes de botón redundantes

- **Evidencia:** `QavanteButton` tiene 5 variantes; `link` y `ghost` se solapan
  conceptualmente.
- **Fix:** revisar si `link` se justifica o se absorbe en `ghost` + un componente
  `QavanteLink`.
- **Esfuerzo:** S · **Riesgo:** bajo.

### P3-4 · Validación con usuarios reales

- **Evidencia:** todo lo anterior es calidad de **implementación**. No hay rastro
  de tests de usabilidad con las PYMEs chilenas objetivo.
- **Fix:** 3–5 sesiones de usabilidad moderadas sobre los flujos núcleo
  (onboarding, clasificar movimientos, leer el Pulso, conciliar pagos). Validar las
  **decisiones de producto**, no solo la prolijidad del código.
- **Esfuerzo:** M (operativo) · **Riesgo:** —. **Mayor ROI de la lista.**

---

## Notas por capa

| Capa | Nota | Comentario |
| --- | --- | --- |
| Tokens / design system | 8.5 | Lo mejor del repo: rationale escrito, separación tokens→theme, semánticos aparte. |
| Primitivos (botón, card, empty, inline-error…) | 8 | Excelentes, pero sin primitivo de estado async ni skeleton compartido. |
| Dashboard `InicioEjecutivoView` | 9 | Sobresaliente. El estándar al que deberían llegar las demás pantallas. |
| Arquitectura de estados (loading/error/empty) | 5 | Copy-paste en 26 vistas, sin abstracción, sin streaming. |
| Feedback / notificaciones | 3 | `Toaster` instalado y **no montado**. |
| A11y estática | 8.5 | skip-link, focus-visible, reduced-motion, aria-label correctos. |
| A11y dinámica | 5 | Solo 2 `aria-live`; mutaciones/filtros no se anuncian. |
| Completitud percibida | 5 | 19 pantallas gated + 8 placeholders "Sprint Cx". |
| Consistencia visual / theming | 6 | Sin dark; refresh adoptado a medias. |
| Navegación / shell | 7.5 | Buena agrupación; nav plana no escala. |
| **Global** | **6.5** | Dashboard de 9 envuelto en producto de 6. |

---

## Orden recomendado de ataque

1. **P0-1** (Toaster) + **P1-2** (QueryClient defaults) — 1 PR, bajo riesgo, mueve
   feedback global de golpe.
2. **P0-2** (AsyncBoundary + Skeleton) — 1 PR el primitivo, luego migración
   incremental por dominio.
3. **P0-3** (ocultar placeholders del nav) — 1 PR, sube completitud percibida.
4. **P1-1** (streaming + `loading.tsx`) — por pantalla, empezando por `inicio`.
5. **P2-1/P2-2** (a11y dinámica + gate Lighthouse).
6. Resto (P2-3 a P3) según roadmap de producto.

> **Disciplina:** todo esto respeta la regla de no-regresión del `CLAUDE.md`. Lo
> aditivo (primitivos, Toaster, defaults) primero; las migraciones de vistas
> existentes, **incrementales y con e2e por dominio** — nunca un big-bang.
</content>
</invoke>
