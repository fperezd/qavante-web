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
npm i @tooxs/ui   # workspace por ahora; publicable a registry cuando haya 2º consumidor
```

En tu `globals.css`:

```css
@import "tailwindcss";
@import "@tooxs/ui/styles.css";
```

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

`0.1.0` — workspace interno, consumido vía monorepo. Para publicar a npm: agregar
build (tsup/tsc) y mover `@dnd-kit`/`recharts`/`@tanstack/react-table` a
`peerDependencies` si se quiere deduplicar en el consumidor.
