# Mapa de extracción — Capa 1 reutilizable

> **Versión:** 1.0 · **Fecha:** 2026-06-23
> **Para:** extraer el design system de Qavante (`components/qavante/` + tokens) a
> la capa reutilizable Tooxs, **sin** arrastrar lógica financiera.
> **Complementa:** [Tooxs Frontend Standard](./tooxs-frontend-standard.md) ·
> [Design System Premium](./tooxs-design-system-premium.md)

Este documento es el **plano previo a cualquier paquete**: archivo por archivo, qué
se copia tal cual, qué se de-brandea, qué se desacopla del dominio. No crea código
todavía — define el trabajo real (que no es renombrar, es desacoplar 3 cosas).

## Regla de fase (N=1)

Hoy Qavante es el **único** consumidor. Extraer a un paquete publicable ahora =
abstraer a partir de un caso → API que calza Qavante y nadie más. Por eso:

1. **Ahora:** consolidar la Capa 1 in-repo como **extraíble** (resolver los
   acoplamientos de abajo), pero **sin publicar**.
2. **Disparador:** el día que aparezca el SaaS #2 (o el primer copy-paste cross-repo
   de un primitivo), se extrae a `@tooxs/ui`. La extracción será casi mecánica
   porque los acoplamientos ya estarán resueltos.

## Clasificación archivo por archivo

| Primitivo                            | Acción                  | Acoplamiento a resolver                                                       | Esfuerzo |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------------------- | -------- |
| `button`                             | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `card`                               | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `badge`                              | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `empty`                              | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `skeleton`                           | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `toaster`                            | ✅ Copia                | nombre (sonner es genérico)                                                   | S        |
| `feature-unavailable-state`          | ✅ Copia                | nombre + alias `@/`                                                           | S        |
| `async-boundary-state` (lógica pura) | ✅ Copia                | nada — ya es genérico y testeado                                              | S        |
| `inline-error`                       | 🔌 **Desacoplar**       | importa `ApiError` + `apiErrorToUserMessage` (lógica de API de Qavante)       | M        |
| `async-boundary`                     | 🔌 **Desacoplar**       | transitivo: usa `inline-error`                                                | M        |
| `input`                              | 🌎 **De-dominio**       | máscara **RUT** (dígito verificador K = Chile); `currency` es genérico        | M        |
| `source-tag`                         | 🌎 **De-dominio**       | lista de fuentes hardcodeada (SII/BICE/Buk/TGR/Previred)                      | M        |
| `logo`                               | 🎨 **Reemplazar**       | asset + wordmark + tagline de Qavante                                         | —        |
| **`tokens.css`**                     | 🎨 De-brand + themeable | prefijo `--qv-*`, colores de marca, **drop** tokens de dominio (bandas Pulso) | M        |
| **`cn` (`lib/utils`)**               | ✅ Copia                | ninguno                                                                       | S        |

**Resumen:** 9 se copian casi tal cual · 2 se desacoplan de la API · 2 se
de-dominan · 1 se reemplaza por marca · tokens se de-brandan.

## Los 4 acoplamientos y cómo se rompen

### A. Alias `@/` (todos)

Los primitivos importan `import { cn } from "@/lib/utils"`. En un paquete no existe
`@/`. → El paquete trae su propio `cn` (o lo re-exporta) y los imports pasan a ser
relativos al paquete.

### B. `InlineError` / `AsyncBoundary` ↔ `ApiError` (el desacople clave)

Hoy `InlineError` conoce el `ApiError` y el mapeador de Qavante:

```tsx
// HOY — el primitivo arrastra lógica de API de Qavante
const message =
  error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
```

El primitivo **no debe** saber cómo mapear errores de un backend específico. → Se
invierte: el primitivo recibe el mensaje **ya resuelto**, o un resolver por prop. El
mapeo `ApiError → texto` se queda en cada app.

```tsx
// PAQUETE — agnóstico: la app decide cómo resolver el error
export interface InlineErrorProps {
  message: string; // ya resuelto por la app
  // o, opcional: resolve?: (error: unknown, what: string) => string;
}
```

En Qavante, un wrapper local pega el `apiErrorToUserMessage` y mantiene la ergonomía
actual (`<AppInlineError error={e} what="las facturas" />`).

### C. Colores de marca → defaults themeables

`tokens.css` hardcodea `#1d5bff` / navy. → En el paquete pasan a ser **defaults**
sobreescribibles por el consumidor:

```css
:root {
  --brand-primary: var(--brand-primary-override, #1d5bff); /* default Tooxs */
}
/* cada SaaS sobreescribe sin tocar el paquete */
```

Los **tokens de dominio** (bandas Pulso `excelente→crítica`) **no van al paquete** —
son financieros de Qavante.

### D. Contenido de dominio en primitivos genéricos

- **`source-tag`:** el componente queda, recibe la metadata de fuentes por **config**
  (`createSourceTag(sources)`); la lista SII/BICE/Buk/TGR/Previred se queda en
  Qavante.
- **`input`:** las máscaras se vuelven **pluggables**; `currency` puede ir genérico,
  `rut` (Chile) se registra desde Qavante.

## Mapa de de-branding (renombrado)

| Qavante                               | Paquete                        |
| ------------------------------------- | ------------------------------ |
| `QavanteButton`, `QavanteButtonProps` | `Button`, `ButtonProps`        |
| `QavanteCard`, `QavanteEmpty`, …      | `Card`, `Empty`, …             |
| `--qv-*` (tokens)                     | `--brand-*` / `--ui-*`         |
| `QavanteSource`                       | `SourceTagConfig` (genérico)   |
| `QavanteLogo`                         | `<Logo src=… />` parametrizado |

## Estructura propuesta del paquete (cuando llegue el #2)

```
@tooxs/ui/
  src/
    primitives/   button, card, badge, input, empty, inline-error,
                  skeleton, async-boundary, toaster, source-tag, feature-state
    tokens/       tokens.css (defaults themeables) + @theme map
    lib/          cn
    index.ts      barrel
  package.json    peerDeps: react, react-dom, tailwind; deps: cva, clsx,
                  tailwind-merge, lucide-react, sonner
```

`@tooxs/eslint-config` (el preset ya verificado) viaja como paquete hermano.

## Lo que NUNCA se extrae

- Vistas de feature (`caja`, `cobrar`, `pagar`, `gestion`, dashboards).
- Capa de API (`lib/api/*`, `ApiError`, mapeo de errores, tipos generados).
- Formatters de dominio (`clp`, `rut`) y tokens de dominio (Pulso).
- El asset de logo y la voz de marca de Qavante.

## Estado de desacoplamientos

- ✅ **B — hecho** (2026-06-23). Se creó el primitivo agnóstico `InlineError`
  (`{ message }`, sin import de API) y `QavanteInlineError` quedó como **wrapper de
  app** que mapea `ApiError → texto` y delega en él. `AsyncBoundary` ahora usa el
  primitivo agnóstico + un `resolveError` inyectable. Cero churn en las ~13 vistas
  (mantienen `QavanteInlineError` con `{ error, what }`). Verificado: typecheck OK,
  lint 0 errores, 559 unit tests verdes.
- ⏳ **A** (alias `@/`) · **C** (colores themeables) · **D** (dominio en
  `source-tag`/`input`): se resuelven en la extracción real, cuando llegue el #2.

Con **B** resuelto, la Capa 1 ya es **extraíble**: los primitivos agnósticos
(`InlineError`, `AsyncBoundary`, `Skeleton`, `Button`, `Card`, …) no arrastran
lógica de API. Lo único acoplado que queda (`QavanteInlineError`) es,
deliberadamente, el wrapper de app que NO se extrae.
