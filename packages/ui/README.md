# @tooxs/ui

Design system reutilizable de Tooxs — **Capa 1**: primitivos agnósticos de dominio

- tokens themeables. Extraído de la implementación de referencia (`qavante-web`)
  según el [Tooxs Frontend Standard](../../docs/standards/tooxs-frontend-standard.md)
  y el [mapa de extracción](../../docs/standards/capa1-extraction-map.md).

## Qué incluye

- **Base:** `Button`, `Card`, `Badge`, `Input`, `Empty`, `Skeleton`, `InlineError`,
  `AsyncBoundary` (+ `resolveAsyncState`), `Toaster`/`toast`,
  `FeatureUnavailableState`, `SourceTag`, `Logo`.
- **Avanzados:** `Collapsible`, charts (`AreaChartTooxs`/`BarChartTooxs`/
  `LineChartTooxs`), `DataTable` (orden + mostrar/ocultar + reorden de columnas),
  `Board` (kanban con drag & drop).
- **Tokens:** `styles/tokens.css` (themeables) + `styles/index.css` (@theme Tailwind).

## Uso

```bash
npm i @tooxs/ui
npm i react react-dom recharts @tanstack/react-table \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities   # peers
```

**Zero-config** — no necesita `transpilePackages`. En tu `globals.css` (Tailwind v4
ignora `node_modules` → hay que apuntarle al `dist`):

```css
@import "tailwindcss";
@source "../node_modules/@tooxs/ui/dist";
@import "@tooxs/ui/styles.css";
```

> Guía completa de publicación y consumo: [PUBLISHING.md](./PUBLISHING.md).

En tu código:

```tsx
import { Button, Card, AsyncBoundary, Toaster } from "@tooxs/ui";
```

## Theming / white-label

Los colores de marca son **defaults sobreescribibles**. Cada app (o tenant) redefine
los tokens sin tocar el paquete:

```css
:root {
  --brand-primary: #7c3aed;
}
```

## Lo que NO incluye (queda en cada app)

- Lógica de API / mapeo de errores (el `InlineError`/`AsyncBoundary` reciben el
  mensaje ya resuelto vía `message`/`resolveError`).
- Contenido de dominio: el catálogo de fuentes de `SourceTag` y las máscaras de
  `Input` (ej. RUT chileno) los define el consumidor.
- Tokens de dominio (ej. bandas financieras).

## Estado

`0.1.0` — **bundleado con bunchee** (`dist/` ESM + `.d.ts`, `"use client"` por
componente). **Zero-config** (sin `transpilePackages`), validado con un `next build`
real. React-context deps (`recharts`, `@tanstack/react-table`, `@dnd-kit/*`) son
`peerDependencies` para garantizar una sola instancia. Ver
[PUBLISHING.md](./PUBLISHING.md).

Para que el bundle sea correcto en RSC, el barrel exporta **solo componentes (todos
`"use client"`) + tipos**; las utilidades puras (`cn`, lógica de estado) quedan
internas (exportarlas desde un bundle las metería en un chunk client). El consumidor
usa su propio `cn`.
