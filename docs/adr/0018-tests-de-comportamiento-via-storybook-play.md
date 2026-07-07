# ADR-0018: Tests de comportamiento de componentes vía Storybook `play`, no jsdom/RTL

- **Status:** Accepted
- **Fecha:** 2026-07-07
- **Decididores:** Fernando + CC-WEB
- **Tickets / PRs:** auditoría FE 2026-07-07 (#479–#485), PR de este ADR

## Contexto

La auditoría exhaustiva del FE (2026-07-07) marcó como brecha de raíz que "no hay
tests de componente" en ~126 componentes. Al investigar el setup surgió un matiz:
el repo **sí** testea componentes, pero solo a nivel de _montaje_. La config de
Vitest (`vitest.config.ts`) tiene dos proyectos:

1. `unit` — entorno **node**, MSW; cubre la lógica pura (`*.test.ts`) y los
   contratos de datos. NO tiene DOM.
2. `storybook` — vía `@storybook/addon-vitest` + `@vitest/browser-playwright`,
   renderea **cada story en Chromium real** y valida que monta sin errores.

Además está instalado `@storybook/addon-a11y` (axe sobre las stories). Lo que
falta no es "un entorno DOM" — es cobertura de **interacción y comportamiento**
(teclado, foco, aria dinámico, estados), que hoy solo cubre parcialmente el e2e
de Playwright a nivel de flujo.

La recomendación inicial fue montar **jsdom + Testing Library**. Al ver el setup
real, eso sería un **segundo stack de testing de componentes en paralelo** al que
ya existe (Storybook en browser), con un DOM _simulado_ (jsdom) menos fiel que el
browser real que ya corremos.

## Decisión

Los tests de **comportamiento/interacción** de componentes se escriben como
**`play` functions de Storybook** (`storybook/test`: `within`, `userEvent`,
`expect`), que corren en el browser real del proyecto `storybook` de Vitest. La
lógica pura sigue en `*.test.ts` (proyecto `unit`). La accesibilidad se valida
con `@storybook/addon-a11y` (axe) sobre las stories.

**NO** introducimos jsdom ni `@testing-library/react`: serían un stack redundante
con DOM simulado, frente al browser real que el proyecto `storybook` ya provee.

Regla práctica de dónde va cada test:

| Qué                                                       | Dónde                                             |
| --------------------------------------------------------- | ------------------------------------------------- |
| Función pura (formatters, validadores, helpers, reducers) | `*.test.ts` (unit)                                |
| Contrato de datos / hooks de react-query                  | `*.test.ts` (unit, MSW)                           |
| Render sin error (smoke)                                  | Story (el proyecto storybook lo cubre automático) |
| Interacción: teclado, foco, click, aria dinámico, estados | `play` en la story                                |
| Accesibilidad (axe)                                       | addon-a11y sobre la story                         |
| Flujo end-to-end multi-pantalla                           | Playwright (`tests/e2e/`)                         |

## Alternativas consideradas

- **jsdom + @testing-library/react — descartada:** segundo stack de testing de
  componentes con DOM simulado; redundante con el browser real ya montado; más
  deps que mantener; menor fidelidad (jsdom no implementa layout, foco real,
  algunos eventos). Su único plus (correr en node, más rápido) no compensa tener
  dos formas de testear lo mismo.
- **Solo e2e de Playwright — descartada:** el e2e es caro y de grano grueso (una
  pantalla entera con login + navegación por interacción). No es el lugar para
  afirmar "esta tecla mueve el foco en este primitivo".
- **`play` de Storybook — elegida:** reusa la infra existente, DOM real, y unifica
  smoke + interacción + a11y en un solo artefacto (la story) que además es la
  documentación viva del componente.

## Consecuencias

### Positivas

- Cero deps nuevas; una sola forma de testear componentes.
- DOM real (foco, teclado, eventos) → los tests de a11y son fieles.
- La story es a la vez doc, smoke test y test de interacción.

### Negativas / tradeoffs aceptados

- El proyecto `storybook` es más lento que `unit` (browser headless). Mitigado:
  corre como gate separado en CI (`test:storybook`), no en el `test` rápido.
- Escribir `play` es algo más verboso que un test RTL; a cambio, corre en browser.

### Acciones que destraba o requiere

- [x] Backfill inicial: `play` de interacción por teclado en `DirectionSegment`
      (radiogroup/flechas) y en `PeriodRangeFilter` (Escape cierra + retorno de
      foco, el hook `useDismiss`).
- [ ] Ir agregando `play` a los primitivos interactivos de mayor riesgo
      (command-palette, dropdowns con data mockeada por MSW, QavanteInput).

## Referencias

- `vitest.config.ts` (projects `unit` + `storybook`), ADR-0005 (MSW).
- Auditoría FE 2026-07-07 (brecha de cobertura de componentes).
