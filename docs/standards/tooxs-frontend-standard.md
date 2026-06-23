# Tooxs Frontend Standard

> **Versión:** 1.1 · **Estado:** Activo · **Fecha:** 2026-06-23
> **Dueño:** CTO / Líder UX/UI · **Aplica a:** todo SaaS web nuevo de Tooxs
> **Repo de referencia:** `qavante-web` (implementación canónica)
> **Enforcement:** [`eslint-config-tooxs.mjs`](./eslint-config-tooxs.mjs) (§23)
>
> **Changelog:** v1.1 — implementaciones de referencia con código real (§21),
> enforcement por ESLint (§23), observabilidad (§17), i18n (§18), theming/
> white-label (§19), auth+SSR (§20), modelo de conformidad (§22) y política de
> versionado (§24). · v1.0 — estándar inicial.

Este documento es **agnóstico del dominio**: no asume finanzas, salud, logística
ni ningún vertical. Define el stack, la arquitectura, el design system y las
convenciones que **todo producto web de Tooxs** debe seguir. Lo específico de cada
SaaS (lógica de negocio, entidades, copys de dominio) vive en el repo del producto,
no acá.

**Cómo leerlo:** cada sección tiene una tabla de decisión —
**Qué usar / Cuándo / Dónde / Evitar**. Si una decisión de producto contradice este
estándar, se documenta con un ADR en el repo del producto; el ADR gana localmente,
pero el cambio se propone de vuelta a este estándar si es generalizable.

---

## 0. Principios

1. **Server-first.** Renderiza en el servidor por defecto. `"use client"` es una
   excepción justificada, no el default.
2. **El estándar es un primitivo, no una convención.** Si un patrón se repite 3+
   veces (estado de carga, error, feedback), se extrae a un componente. La
   consistencia se garantiza con código compartido, no con disciplina.
3. **Cada dato declara su origen y frescura.** Un número sin contexto no se muestra.
4. **Accesible por defecto.** AA es piso, no aspiración. Si no es accesible, no está
   terminado.
5. **Edge-compatible siempre.** El target es un runtime de borde (Workers). Nada de
   APIs Node-only ni Storage del navegador para datos sensibles.
6. **Tipado estricto, sin `any`.** Los tipos del backend se generan, no se escriben.
7. **Mobile es el caso base, no el adaptado.**

---

## 1. Stack canónico

| Capa | Estándar | Versión piso | Por qué / cuándo desviarse |
| --- | --- | --- | --- |
| Framework | **Next.js (App Router)** | 15+ | RSC + streaming. No usar Pages Router en proyectos nuevos. |
| UI runtime | **React** | 19+ | Server Components, Actions, `use()`. |
| Lenguaje | **TypeScript strict** | 5+ | `strict` + `noUncheckedIndexedAccess` obligatorios. |
| Estilos | **Tailwind CSS** | 4+ | Vía `@tailwindcss/postcss`. CSS variables para tokens. |
| Primitivos UI | **shadcn/ui sobre Base UI** | — | Copiados al repo (no dependencia), tematizados con tokens propios. |
| Iconos | **lucide-react** | — | Un solo set. No mezclar librerías de iconos. |
| Server state | **TanStack Query** | 5+ | Todo fetch remoto. Nunca `useEffect` + `fetch` a mano. |
| Client state | **Zustand** | 5+ | Solo estado de UI no derivable del server. Mínimo. |
| Forms | **react-hook-form + Zod** | RHF 7+, Zod 4+ | Validación con `@hookform/resolvers`. |
| Tablas | **TanStack Table** | 8+ | Sobre un primitivo `DataTable` propio. |
| Gráficos | **Recharts** | 3+ | Tematizado con tokens. |
| Fechas | **date-fns** | 4+ | No moment. No `Intl` crudo disperso. |
| Toasts | **Sonner** | 2+ | Montado **una vez** en providers (ver §6). |
| i18n | **next-intl** | 4+ | Aunque sea un solo locale, centraliza copys. |
| Deploy | **Cloudflare Workers** vía `@opennextjs/cloudflare` | — | `nodejs_compat`. **Nunca** `runtime = 'edge'` (rompe el adapter). |
| Tests unit | **Vitest** | — | Lógica pura + componentes. |
| Tests e2e | **Playwright** | — | Flujos núcleo + smoke en prod. |
| Visual | **Storybook + Chromatic** | — | Todo primitivo tiene `.stories.tsx`. |
| Calidad | **ESLint + Prettier + Lighthouse CI + Husky/lint-staged** | — | Gates en CI. |

**Regla de oro:** este stack no se vota por proyecto. Se hereda. Agregar una
dependencia nueva al tier "core" requiere ADR + aprobación de CTO.

---

## 2. Arquitectura de aplicación

### 2.1 Server vs Client Components

| Qué usar | Cuándo | Dónde | Evitar |
| --- | --- | --- | --- |
| **Server Component** (default) | Lectura de datos, layout, gating por flags/rol, SEO | `page.tsx`, `layout.tsx`, vistas de solo-lectura | Marcar `"use client"` "por si acaso" |
| **Client Component** | Interactividad: forms, estado local, listeners, hooks de browser | Hojas del árbol (`*-view`, inputs, dialogs) | Subir el `"use client"` al tope del árbol |

**Regla:** `"use client"` lo más abajo posible en el árbol. Un layout o page que
resuelve feature flags **debe** ser Server Component (los flags se leen en runtime
del Worker; un client component los inlinea en build → siempre OFF).

### 2.2 Estructura de carpetas (canónica)

```
src/
  app/                      # App Router: rutas, layouts, error/loading/not-found
    (group)/                # route groups por área (auth, app, onboarding)
  components/
    ui/                     # primitivos shadcn crudos (botón base, etc.)
    <brand>/                # design system de marca (capa 1) — ver §4
    <dominio>/              # componentes de feature (capa 2): *-view, forms, dialogs
    shell/                  # layout app: sidebar, header, breadcrumbs
    providers/              # AppProviders (Query, Toaster, theme)
  hooks/                    # hooks reutilizables
  lib/
    api/                    # client, types generados, módulos por dominio, errores
    auth/                   # tipos y helpers de sesión
    formatters/             # formato agnóstico (fecha, número, moneda)
    validators/             # esquemas Zod reutilizables
    i18n/                   # config next-intl
  styles/
    tokens.css              # tokens crudos --<brand>-*
  test/                     # setup MSW, fixtures
```

**Convención:** un componente de feature se llama por su rol —
`*-view.tsx` (container que orquesta data), `*-form.tsx`, `*-dialog.tsx`,
`*-format.ts` (lógica pura testeable). La lógica pura **siempre** sale a un `.ts`
con su `.test.ts` al lado.

### 2.3 Capas de componentes

- **Capa 0 — `ui/`:** primitivos shadcn crudos. No se usan directo en features.
- **Capa 1 — design system de marca (`<brand>/`):** botón, card, input, badge,
  empty, error, skeleton, etc. **Es la única capa que las features importan** para
  UI base. Tematizada, con stories y a11y resuelta.
- **Capa 2 — features (`<dominio>/`):** componen Capa 1 + datos. Aquí vive la lógica
  de negocio. Nunca redefinen estilos base; consumen la Capa 1.

---

## 3. Datos, estado y errores

### 3.1 Fetching

| Qué usar | Cuándo | Dónde |
| --- | --- | --- |
| **Server fetch + Suspense** | Carga inicial de una pantalla | Server Component + `loading.tsx` por segmento |
| **TanStack Query** | Datos que mutan, refetch, paginación, cache cliente | Client `*-view` |
| **Server Action / route handler** | Mutaciones | Forms |

**Obligatorio:** todo segmento de ruta con datos tiene un `loading.tsx` (skeleton de
navegación) y un `error.tsx` (degradación local). `global-error.tsx` para el
catch-all del layout.

### 3.2 Configuración de TanStack Query (estándar)

`QueryClient` **nunca** se instancia pelado. Defaults obligatorios:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // ajustar por criticidad del dato
      retry: 1,                     // no 3 (default) — evita tormentas
      refetchOnWindowFocus: false,  // activar solo en dashboards "live"
    },
    mutations: {
      onError: (e) => toast.error(messageFor(e)), // feedback global garantizado
    },
  },
});
```

### 3.3 Estados async — el primitivo `AsyncBoundary`

**Prohibido** escribir `if (isLoading) … if (isError) …` a mano en cada vista. Existe
un único primitivo que compone los cuatro estados:

| Estado | Componente | Regla |
| --- | --- | --- |
| Loading | `Skeleton` (Capa 1) | Forma que **anticipa** el contenido (no un spinner genérico) |
| Error | `InlineError` (Capa 1) | `role="alert"` + mapeo `ApiError → mensaje de usuario` |
| Empty | `Empty` (Capa 1) | Título + descripción + CTA accionable (voz de marca) |
| Success | `children` | El contenido real |

```tsx
<AsyncBoundary query={query} skeleton={<KpiSkeleton />} empty={<Empty .../>}>
  {(data) => <Content data={data} />}
</AsyncBoundary>
```

**Acceptance de cualquier vista nueva:** cero `isLoading`/`isError` escritos a mano.

### 3.4 Errores de API

- Un tipo `ApiError` único en `lib/api/errors.ts`.
- Un mapeador `apiErrorToUserMessage(error)` único → copys de usuario (nunca el raw).
- Las vistas **nunca** muestran `error.message` crudo. Siempre el mapeador o un
  fallback de marca.

---

## 4. Design System (Capa 1)

### 4.1 Tokens

| Qué | Dónde | Regla |
| --- | --- | --- |
| Valores crudos | `styles/tokens.css` (`--<brand>-*`) | Única fuente de verdad de color/radio/sombra/tipografía |
| Exposición a Tailwind | `globals.css` → `@theme inline` | Mapea `--<brand>-*` a utilidades. Componentes usan utilidades, no el crudo |

**Escalas obligatorias:**

- **Color de marca:** primary (+ 50/100/600/700), deep, light. Acento = primary.
- **Neutrales:** escala completa **50→900** (no 3 pasos). Texto, bordes, superficies.
- **Semánticos:** `success / warning / danger / info` (comunican estado, no estética —
  **nunca** se reusan como color de marca).
- **Tipografía:** tokens de jerarquía (`display / title / body / caption / data`), no
  `text-sm` suelto por componente. Números siempre `tabular-nums`.
- **Radios y sombras:** `sm/md/lg/xl`. Sombras tintadas con el navy de marca, no
  negro puro.

**Modo:** preparar tokens para dark desde el día 1 (estructura), aunque se lance
solo claro. Hardcodear contra un solo set es deuda.

### 4.2 Catálogo de primitivos — qué usar, cuándo, dónde

| Componente | Usar para | No usar para | Notas |
| --- | --- | --- | --- |
| **Button** | Acción primaria/secundaria/destructiva | Navegación pura (usar Link) | Variantes: `primary, secondary, ghost, danger`. `loading` con spinner + disable. `focus-visible:ring` obligatorio. Máx 1 primary por vista. |
| **Link** | Navegar | Disparar acciones | No disfrazar botones de links ni viceversa |
| **Card** | Agrupar contenido relacionado | Layout de página | Variantes `default/bordered/elevated`. Header/footer opcionales |
| **Input / Field** | Captura de datos | — | Siempre con `<label>` asociado, estado de error inline, `aria-describedby` |
| **Badge** | Estado/categoría corta | Acciones | Color por semántica, no decorativo |
| **Skeleton** | Loading | Spinners genéricos | Forma anticipa el contenido |
| **Empty** | Sin datos / módulo vacío | Errores duros | Siempre con CTA accionable |
| **InlineError** | Error recuperable de query | Validación de campo | `role="alert"`, mensaje mapeado |
| **Toast** (Sonner) | Resultado de una acción puntual | Errores de carga de página | Ver §6 |
| **Dialog / Sheet** | Tarea enfocada / confirmación destructiva | Contenido primario | Foco atrapado, cierre con Esc, retorno de foco |
| **DataTable** | Listados tabulares | Layout | Ver §7 |
| **SourceTag / Freshness** | Origen y frescura de un dato | — | "Actualizado X · estimado/stale" |

**Regla de adopción:** todo primitivo nuevo nace con `.stories.tsx` (estados:
default, loading, error, empty, edge) y test si tiene lógica. Sin story, no entra al
design system.

---

## 5. Formularios

| Qué usar | Regla |
| --- | --- |
| **react-hook-form** | Un `useForm` por formulario. Nada de estado manual de campos |
| **Zod** | Esquema de validación reutilizable en `lib/validators`. El mismo esquema valida cliente y (si aplica) se comparte de contrato |
| **`@hookform/resolvers`** | Pegamento RHF↔Zod |

**UX obligatoria:** validación en `onBlur`/`onSubmit` (no `onChange` agresivo);
error inline por campo con `aria-describedby`; el submit muestra `loading` y se
deshabilita; éxito → `toast.success` + redirect/reset; error de servidor →
`toast.error` o error de formulario, nunca silencioso.

---

## 6. Feedback (Toasts)

- **El `<Toaster>` se monta exactamente una vez** en `AppProviders`. Si está
  instalado pero no montado, es un bug bloqueante.
- Tematizado con tokens (`success/danger/warning`), `position` consistente en todo
  el producto.
- **Qué va a toast:** resultado de una acción del usuario (guardó, borró, copió,
  envió). **Qué NO va a toast:** errores de carga de página (esos son `InlineError` o
  `error.tsx`), validación de campo (esa es inline).
- A11y: severidad → `aria-live` (`polite` para éxito, `assertive` para error).

---

## 7. Tablas y densidad de datos

- Un único primitivo **`DataTable`** sobre TanStack Table. Las features no arman
  `<table>` a mano.
- **Estándar visual:** header sticky, `tabular-nums`, montos/números alineados a la
  derecha, texto a la izquierda, zebra opcional, fila hover, densidad configurable.
- **Mobile (caso base):** patrón definido — columnas colapsables o **vista en cards**
  por fila. **Prohibido** el scroll horizontal accidental como única solución.
- Estados: loading (skeleton de N filas), empty (`Empty`), error (`InlineError`).
  Paginación o virtualización para > ~100 filas.

---

## 8. Navegación y shell

- **Shell estándar:** sidebar (agrupado por dominio) + header + breadcrumbs +
  skip-link.
- **Sidebar:** agrupado por área con labels de sección. Para módulos con subrutas,
  **sub-navegación** (sub-items colapsables o tabs intra-módulo) — la nav plana no
  escala más allá de ~10 destinos.
- **Estado activo** visible en el nav (no solo en breadcrumb). `aria-current="page"`.
- **Gating del nav:** filtra por rol **y** por feature flag. Lo que no está
  disponible **no se muestra** en el nav (se evita el callejón "no disponible").
  Seguridad real la impone el backend; el gate de nav es UX.
- **Mobile:** drawer con backdrop, foco atrapado, cierre con Esc/tap fuera.

---

## 9. Accesibilidad (piso AA)

| Área | Estándar |
| --- | --- |
| Estática | `focus-visible:ring` en todo interactivo; `aria-label` en iconos de acción; `skip-link`; `prefers-reduced-motion` respetado; contraste AA |
| Dinámica | Región `aria-live` global para cambios de datos; `aria-busy` durante fetch; filtros/resultados anunciados ("N resultados"); mutaciones anunciadas |
| Teclado | Todo flujo operable sin mouse. Dialogs con foco atrapado y retorno de foco |
| Formularios | Label asociado, error con `aria-describedby`, `aria-invalid` |
| Gate de CI | **Lighthouse a11y ≥ 0.95** como assertion dura (no solo performance) |

La a11y dinámica (lo que cambia tras una acción) es tan obligatoria como la
estática; se centraliza en `AsyncBoundary` y `Toaster`.

---

## 10. Performance

| Métrica | Presupuesto |
| --- | --- |
| Lighthouse Performance (mobile) | ≥ 85 en pantallas de auth, ≥ 90 en app autenticada |
| Lighthouse Accessibility | ≥ 95 |
| LCP | Dato server-rendered en pantallas clave (no spinner) |
| Bundle | Budget verificado en CI (`size:check`). Code-split por ruta. Lazy de dialogs/charts pesados |

**Reglas:** RSC para reducir JS al cliente; `next/image`/`next/font`; evitar
librerías pesadas client-side cuando hay alternativa server; `Suspense` para
streaming.

---

## 11. Edge / Deploy (Cloudflare Workers)

- Target: **Cloudflare Workers** vía `@opennextjs/cloudflare` (`nodejs_compat`).
- **Nunca** declarar `export const runtime = 'edge'` (rompe el adapter; el default
  Node-on-workerd es el correcto).
- **Prohibido:** APIs Node-only (`fs`, `path`, `child_process`, `Buffer` global) y
  Storage del navegador (`localStorage`/`sessionStorage`/`IndexedDB`) para datos
  sensibles o tokens. Tokens solo en **cookies httpOnly**.
- Feature flags y vars versionadas en `wrangler.toml` (no en el panel: `deploy`
  resetea). Flags leídos en **Server Components** (runtime del Worker).
- Secrets nunca en código/logs/commits.

---

## 12. Tipos y contrato con backend

- Los tipos del API se **generan** (`openapi-typescript`) a `lib/api/types.ts`.
  **Nunca** se editan a mano.
- Un client de API central + un módulo por dominio. Un `ApiError` y un mapeador de
  mensajes únicos.
- Si falta un endpoint, se documenta como requerimiento al backend; el frontend no
  inventa lógica de negocio que corresponde al servidor.

---

## 13. Testing

| Tipo | Herramienta | Qué cubre | Regla |
| --- | --- | --- | --- |
| Unit | Vitest | Lógica pura (`*-format.ts`, validadores, hooks) | Toda lógica pura tiene test al lado |
| Componente | Vitest + Testing Library | Estados de primitivos | — |
| Visual | Storybook + Chromatic | Regresión visual de Capa 1 | Story por primitivo, con estados |
| E2E | Playwright | Flujos núcleo + smoke en prod | Los contratos e2e no se rompen sin actualizar el test |
| Mock | MSW | Dev/CI sin backend | Render-blocking hasta que el worker esté listo |

**DoD de tests:** unit + e2e verdes localmente antes de PR. Las migraciones de
vistas existentes se hacen **incrementales con e2e por dominio**, nunca big-bang.

---

## 14. Convenciones de código y Git

- **TypeScript strict, sin `any`** (si es inevitable, justificado en comentario).
- Prettier + ESLint en pre-commit (Husky + lint-staged). No se commitea rojo.
- **Commits con scope:** `feat(scope)`, `fix(scope)`, `docs(scope)`, etc.
- **1 PR = 1 issue** (`closes #N`). Objetivo < 300 líneas modificadas (excl. tests y
  generados).
- **Regla de no-regresión:** no se toca código que funciona salvo que el ticket lo
  exija. Cero refactors/mejoras visuales no pedidas. Bugs ajenos al ticket → issue
  separado, no fix de paso.
- Nunca force-push a ramas compartidas; nunca merge sin aprobación humana.

---

## 15. Definition of Done (toda feature)

1. Server-first respetado (`"use client"` solo donde corresponde).
2. Estados async vía `AsyncBoundary` (loading/error/empty/success) — cero a mano.
3. Feedback de mutaciones vía `Toaster`.
4. A11y: estática + dinámica; navegable por teclado; Lighthouse a11y ≥ 95.
5. Responsive con mobile como caso base.
6. Tipos generados, sin `any`, sin Node-only APIs, tokens (no valores hardcodeados).
7. Tests: unit de lógica + e2e del flujo. Storybook si toca Capa 1.
8. Performance dentro de presupuesto; bundle check verde.
9. Sin secrets; flags en `wrangler.toml`.
10. PR atómico, scope correcto, no-regresión validada.

---

## 16. Checklist rápido de PR (pegar en la descripción)

```
- [ ] Server-first (use client justificado)
- [ ] AsyncBoundary para loading/error/empty (nada a mano)
- [ ] Toast en mutaciones; InlineError/error.tsx en cargas
- [ ] A11y estática + dinámica; teclado OK
- [ ] Mobile como caso base
- [ ] Tipos generados, sin any, sin Node-only / Storage de tokens
- [ ] Tokens (sin colores/tamaños hardcodeados)
- [ ] Tests unit + e2e verdes; story si toca Capa 1
- [ ] Lighthouse perf + a11y dentro de presupuesto
- [ ] PR atómico (1 issue), no-regresión validada
```

---

---

## 17. Observabilidad y errores de cliente

Un estándar maduro **sabe cuándo se rompe en producción**.

| Qué | Estándar | Dónde |
| --- | --- | --- |
| Errores no capturados | Reporter en `error.tsx` / `global-error.tsx` + `onError` de Query | Boundaries |
| Errores de red/API | Tag por `status`/`code` de `ApiError` (no por mensaje) | `lib/api/client` |
| Performance real (RUM) | Web Vitals reportados (`useReportWebVitals`) | Layout raíz |
| PII | **Nunca** en logs/tags. Scrub antes de enviar | Reporter |

```tsx
// app/error.tsx — boundary por segmento, reporta y degrada local.
"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { reportError(error); }, [error]); // Sentry/equivalente, sin PII
  return <InlineError error={error} what="esta sección" onRetry={reset} />;
}
```

**Regla:** el proveedor concreto (Sentry, etc.) es intercambiable; lo normativo es
que **exista un único `reportError(e)`** y que toda boundary lo llame.

## 18. Internacionalización

Aunque el producto lance con un solo locale, **los copys no se hardcodean en JSX**.

- Todo texto visible sale de `next-intl` (`useTranslations`/`getTranslations`).
- Plurales con ICU (`{n, plural, one {# fila} other {# filas}}`), no `if`.
- Fechas/números **siempre** vía formatters centralizados (`lib/formatters`), nunca
  `toLocaleString` disperso. Moneda/zona horaria del *tenant*, no del navegador.
- Claves namespaced por dominio (`dashboard.*`, `auth.*`), nunca por pantalla suelta.

## 19. Theming, dark mode y white-label

El sistema de tokens (§4.1) es la base; el theming es **runtime**, no rebuild.

- **Dark mode:** se resuelve con un segundo set de variables bajo `[data-theme="dark"]`
  / `prefers-color-scheme`. Los componentes **nunca** referencian un set; usan la
  utilidad semántica (`text-foreground`, `bg-surface`), que cambia con el tema.
- **White-label / multi-tenant:** un tenant puede sobreescribir `--<brand>-primary*`
  inyectando variables en el `<html>` desde el server (Server Component lee el tema
  del tenant). Cero recompilación por marca.
- **Prohibido** hardcodear hex en componentes. Si un color no es token, no existe.

```css
:root { --c-surface: #fff; --c-foreground: #1d1d1b; }
[data-theme="dark"] { --c-surface: #0a0f1c; --c-foreground: #e8edf5; }
/* tenant override (inyectado server-side): */
[data-tenant="acme"] { --brand-primary: #7c3aed; }
```

## 20. Autenticación y sesión (SSR)

- **Tokens solo en cookies `httpOnly` + `Secure` + `SameSite`.** Jamás en JS/Storage.
- La sesión se lee en el **servidor** (Server Component / middleware leyendo la
  cookie), no en el cliente. El gating de UI por rol es UX; la autorización real la
  impone el backend (403).
- **Redirect de no-autenticado** en middleware/layout server, no en un `useEffect`
  (evita flash de contenido protegido).
- Un 401 en una query de datos dispara el flujo de re-login **una sola vez**
  (interceptor central), con `skipAuthRetry` para pasos opcionales que no deben
  expulsar al usuario.

## 21. Implementaciones de referencia (código canónico)

Esto es lo que las features copian. No es pseudocódigo: es el contrato.

### 21.1 `QueryClient` (providers)

```tsx
// components/providers/app-providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster, toast } from "@/components/<brand>/toaster";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { onError: (e) => toast.error(apiErrorToUserMessage(e)) },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster /> {/* montado UNA vez, acá. Si no está montado, es un bug. */}
    </QueryClientProvider>
  );
}
```

### 21.2 `AsyncBoundary` (el primitivo que mata el boilerplate)

```tsx
// components/<brand>/async-boundary.tsx
import type { UseQueryResult } from "@tanstack/react-query";
import { InlineError } from "./inline-error";

type Props<T> = {
  query: UseQueryResult<T>;
  skeleton: React.ReactNode;        // forma que anticipa el contenido
  empty?: React.ReactNode;          // Empty de marca con CTA
  isEmpty?: (data: T) => boolean;
  what: string;                     // "las facturas", "el resumen"…
  children: (data: T) => React.ReactNode;
};

export function AsyncBoundary<T>({ query, skeleton, empty, isEmpty, what, children }: Props<T>) {
  if (query.isLoading) return <>{skeleton}</>;
  if (query.isError) return <InlineError error={query.error} what={what} />;
  if (query.data === undefined) return null;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
```

```tsx
// uso en cualquier *-view — CERO if/isLoading a mano:
<AsyncBoundary query={q} what="las facturas" skeleton={<TableSkeleton rows={6} />}
  isEmpty={(d) => d.items.length === 0} empty={<Empty title="Sin facturas" .../>}>
  {(data) => <InvoiceTable data={data} />}
</AsyncBoundary>
```

### 21.3 Mapeo de errores (un solo lugar)

```ts
// lib/api/error-messages.ts — el usuario NUNCA ve error.message crudo.
import { ApiError } from "./errors";
export function apiErrorToUserMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isNetworkError()) return "Sin conexión. Revisá tu internet e intentá de nuevo.";
    if (e.isUnauthorized()) return "Tu sesión expiró. Iniciá sesión nuevamente.";
    if (e.isForbidden()) return "No tenés permisos para esta acción.";
    if (e.isValidation()) return "Revisá los datos ingresados.";
    if (e.isServerError()) return "Tuvimos un problema. Reintentá en unos minutos.";
  }
  return "Algo salió mal. Intentá nuevamente.";
}
```

### 21.4 Formulario (RHF + Zod)

```tsx
const schema = z.object({ email: z.string().email(), name: z.string().min(2) });
const form = useForm({ resolver: zodResolver(schema), mode: "onBlur" });
const mutation = useMutation({
  mutationFn: api.create,
  onSuccess: () => { toast.success("Guardado."); form.reset(); },
  // onError ya está cubierto por el default global del QueryClient.
});
// submit deshabilitado + loading mientras corre; errores inline por campo.
```

## 22. Modelo de conformidad (niveles)

Un repo declara su nivel; el objetivo es **Gold**.

| Nivel | Criterio |
| --- | --- |
| 🥉 **Bronze** | Stack canónico (§1) + carpetas (§2.2) + tipos generados + sin Node-only/Storage. Pasa `eslint-config-tooxs`. |
| 🥈 **Silver** | Bronze + `AsyncBoundary`/`Toaster`/`QueryClient` de referencia (§21) + a11y estática + Storybook de Capa 1. |
| 🥇 **Gold** | Silver + streaming RSC con `loading.tsx`/`error.tsx` por segmento + a11y dinámica + observabilidad (§17) + Lighthouse perf **y** a11y en gate + e2e de flujos núcleo. |

**Regla:** un producto que entra a clientes debe estar en **Silver mínimo**; el
estándar de excelencia es **Gold**.

## 23. Enforcement (no es opcional)

El preset [`eslint-config-tooxs.mjs`](./eslint-config-tooxs.mjs) convierte las
prohibiciones duras en errores de build:

- `export const runtime` → error (rompe el adapter Cloudflare).
- `localStorage`/`sessionStorage`/`indexedDB`/`Buffer` → error.
- imports Node-only (`fs`, `path`, `child_process`, `os`) → error.
- `any` sin justificación → error (relajado en tests/stories).
- `error.message` crudo en UI → error (usá `apiErrorToUserMessage`).
- import default de `api/types` (generado) → error.

Rollout sin romper CI: arrancar las reglas en `warn`, limpiar 1 PR por regla, subir
a `error`. **Un estándar sin enforcement es una sugerencia.**

## 24. Versionado y migración

- **SemVer normativo:** MAJOR = cambio que obliga a migrar repos existentes; MINOR =
  agrega reglas/secciones sin romper; PATCH = editorial.
- Todo bump MAJOR trae **guía de migración** (qué cambia, cómo adaptar, codemods si
  aplica) y ventana de adopción.
- Cambios nacen por **ADR** en el repo del producto; si son generalizables, se
  proponen de vuelta a este estándar.
- El preset de ESLint se versiona junto al doc: el repo declara qué versión del
  estándar cumple.

---

> **Mantenimiento:** este estándar evoluciona por ADR. Un cambio generalizable
> nacido en un producto se propone de vuelta acá. La versión se bumpea con cada
> cambio normativo (no editorial). El repo `qavante-web` es la implementación de
> referencia viva del estándar.
</content>
