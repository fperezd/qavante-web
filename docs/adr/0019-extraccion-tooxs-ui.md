# ADR-0019: Extraer la Capa 1 a `@tooxs/ui` (workspace, sin publicar aún)

- **Status:** Accepted
- **Fecha:** 2026-06-23
- **Decididores:** Fernando (+ CC-WEB)
- **Tickets / PRs:** rama `claude/tender-hypatia-4fji2p`

## Contexto

El design system (Capa 1) de Qavante ya era extraíble tras el desacople B (ver
[mapa de extracción](../standards/capa1-extraction-map.md)). Decisión de negocio:
materializar el paquete reutilizable `@tooxs/ui` ahora, para que sea consumible por
los próximos SaaS de Tooxs.

Restricción dura: **no romper Qavante**. La migración de Qavante a consumir el
paquete (rewire de ~todos los imports de `@/components/qavante`) es de alto riesgo y
no se justifica todavía.

## Decisión

Creamos `packages/ui` (`@tooxs/ui`) como **workspace del monorepo**: paquete real,
de-brandeado, con los primitivos agnósticos + tokens themeables + `cn`. Qavante
**no** se rewirea en este paso (cero regresión); el paquete es el artefacto extraído
y la migración del consumidor queda como paso opcional posterior.

Acoplamientos resueltos en la copia (mapa de extracción): alias `@/`→relativo,
nombres `Qavante*`→neutros, `InlineError`/`AsyncBoundary` ya agnósticos, `SourceTag`
e `Input` de-dominados (catálogo de fuentes y máscaras quedan en cada app), colores
de marca como defaults themeables.

## Alternativas consideradas

- **Rewire completo de Qavante a `@tooxs/ui` — descartada (ahora):** alto riesgo
  (toca todas las vistas), sin beneficio hasta que exista un 2º consumidor.
- **No extraer hasta el SaaS #2 — descartada:** el negocio pidió el paquete ya; el
  desacople estaba hecho, el costo de materializarlo es bajo si no se rewirea.
- **Workspace sin rewire — elegida:** entrega el paquete real y verificable, con
  Qavante intacto. Reversible.

## Consecuencias

### Positivas

- `@tooxs/ui` existe, typecheckea y queda linkeado (`node_modules/@tooxs/ui`).
- Listo para que un SaaS #2 lo consuma (o se publique a registry con un build).
- Qavante sigue como implementación de referencia, sin tocar.

### Negativas / tradeoffs aceptados

- **Duplicación temporal:** los primitivos viven en `packages/ui` y en
  `src/components/qavante`. Hay riesgo de drift hasta migrar Qavante.
- Falta `build` del paquete (tsup/tsc) para publicar a npm; hoy se consume como
  source vía workspace.
- `Input` del paquete es básico (sin máscaras RUT/moneda, que son de dominio).

### Acciones que destraba o requiere

- [ ] Migrar Qavante a `@tooxs/ui` de forma incremental (1 dominio por PR) cuando se
      decida eliminar la duplicación — o al aparecer el 2º consumidor.
- [ ] Agregar build + mover `@dnd-kit`/`recharts`/`@tanstack/react-table` a
      `peerDependencies` antes de publicar a registry.

## Referencias

- [Mapa de extracción de la Capa 1](../standards/capa1-extraction-map.md)
- [Tooxs Frontend Standard](../standards/tooxs-frontend-standard.md)
- `packages/ui/README.md`

## Actualización (2026-06-23) — paquete publicable

Se hizo publicable: `peerDependencies` para los deps con contexto de React
(`react`, `react-dom`, `recharts`, `@tanstack/react-table`, `@dnd-kit/*`) → una sola
instancia en el consumidor; el resto como `dependencies`. Distribución como
**source TypeScript** (el consumidor transpila con `transpilePackages`).

Se **evaluó y descartó** un bundle (tsup + `esbuild-plugin-preserve-directives`, y
`bunchee`): el merge RSC co-loca `cn` en un chunk `"use client"` y rompe los
componentes server que lo usan (ej. `Card`). Shipping source es correcto por
construcción (Next respeta las directivas por archivo). El bundle queda como opción
futura si se quiere evitar `transpilePackages`, previa validación en un Next real.
Pasos de publicación y consumo en `packages/ui/PUBLISHING.md`.
