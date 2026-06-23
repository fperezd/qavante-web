# ADR-0018: Sumar primitivos interactivos avanzados a la Capa 1 (charts, tablas, kanban, collapsible)

- **Status:** Accepted
- **Fecha:** 2026-06-23
- **Decididores:** Fernando (+ CC-WEB)
- **Tickets / PRs:** rama `claude/tender-hypatia-4fji2p`

## Contexto

El design system (Capa 1) era 100% estático: botón, card, input, badge, estados,
toaster. No existían primitivos interactivos avanzados (gráficos, tablas con
ordenamiento/visibilidad/reorden de columnas, kanban con drag & drop, secciones
colapsables). Se requiere dejarlos construidos **ahora**, agnósticos de dominio,
como parte del estándar reutilizable Tooxs.

Restricciones: target Cloudflare Workers (sin Node-only APIs; los componentes son
client-side), tipado estricto sin `any`, tokens del Design System, accesibilidad
AA, y la regla de que agregar una dependencia core requiere ADR.

## Decisión

Sumamos a la Capa 1 cinco primitivos agnósticos: `QavanteCollapsible`,
`QavanteAreaChart/BarChart/LineChart`, `QavanteDataTable` (ordenamiento +
mostrar/ocultar + reorden de columnas) y `QavanteBoard` (kanban con DnD). La
lógica de movimiento (board y reorden de columnas) vive en módulos puros
testeados (`board-state.ts`, `data-table-utils.ts`).

Usamos las librerías ya presentes (**recharts**, **@tanstack/react-table**) y
agregamos **@dnd-kit** (`core`, `sortable`, `utilities`) como dependencia core
para drag & drop accesible.

## Alternativas consideradas

- **HTML5 Drag and Drop nativo — descartada:** sin costo de dependencia, pero mala
  accesibilidad, soporte táctil pobre y API engorrosa para multi-contenedor.
- **react-dnd — descartada:** más pesada, API con más fricción, mantenimiento menos
  activo que dnd-kit.
- **@dnd-kit — elegida:** accesible por teclado, liviana, headless, compatible con
  el runtime de borde (client-side). Es el estándar de facto actual.

## Consecuencias

### Positivas

- El design system pasa de estático a cubrir los patrones interactivos comunes de
  un SaaS, sin lógica de dominio.
- Lógica de DnD/reorden testeada de forma pura (14 casos nuevos).
- Reúsa recharts y TanStack Table ya instalados.

### Negativas / tradeoffs aceptados

- +3 paquetes (@dnd-kit/\*) al bundle; mitigado porque son client-only y se
  code-splittean por ruta.
- `QavanteBoard` v1 resuelve el movimiento en `onDragEnd` (sin reordenamiento en
  vivo durante el arrastre); suficiente para v1, mejorable luego.
- Falta capa de stories de Storybook para los nuevos primitivos (los interactivos
  requieren validación en el runner browser).

### Acciones que destraba o requiere

- [x] Stories de Storybook para los 5 primitivos (Collapsible, Charts, DataTable,
      Board). La regresión visual (Chromatic) corre en CI con navegador real; el
      runner browser local no está disponible en este entorno (build de Chromium
      ausente, descarga bloqueada) — validadas por typecheck + eslint-storybook.
- [ ] Al extraer a `@tooxs/ui`, @dnd-kit y recharts pasan a `peerDependencies`.

## Referencias

- Tooxs Design System Premium §7 (tablas) y §10 (dataviz).
- Mapa de extracción de la Capa 1 (`docs/standards/capa1-extraction-map.md`).
