# ADR-0010: Selectores de clasificación sin librería combobox (dependency-free)

- **Status:** Accepted (promovido 2026-06-05; los selectores dependency-free están en prod)
- **Fecha:** 2026-05-16
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** [#100](https://github.com/fperezd/qavante-web/pull/100) (selectores), [#102](https://github.com/fperezd/qavante-web/pull/102) (drawer), addendum frontend v2.0 §17/§20

## Contexto

El addendum §17.2/§20 pide selectores con **búsqueda**: `CanonicalCategorySelect`,
`ManagementAccountSelect`, `DimensionValuePicker`. El patrón vigente del repo
para selects es **`<select>` nativo estilizado** (`role-select.tsx`), con un
comentario explícito: _"Para C0-15 alcanza sin recurrir a Base UI Combobox…
Si en C1+ necesitamos search dentro del select, migramos a Combobox."_

Ese momento llegó (los selectores del addendum requieren búsqueda), pero:

- El repo **no tiene** ninguna librería combobox instalada. `src/components/ui/command.tsx`
  es un stub (un `<div>`), no una implementación cmdk real.
- CLAUDE.md restringe agregar dependencias sin justificación + PR propio si
  cambia arquitectura. Es la misma situación que ADR-0009 resolvió para DnD:
  una decisión de dependencia no se mete de contrabando en un PR de UI.
- `generate:api` y la integración real están **diferidos** (reconciliation
  P4-2/P4-4) — meter una librería ahora, para componentes que todavía no se
  montan en ninguna ruta, es comprometer stack antes de tiempo.

## Decisión

**Los selectores de `src/components/clasificacion/` se implementan
dependency-free**: un `<input>` de filtro + una lista de elementos
seleccionables nativos (botones / `radio` / `checkbox`), con el helper puro
`filter.ts` (substring, case/acento-insensible). **No se instala cmdk, Base
UI Combobox, Downshift ni similar en este ciclo.**

La evaluación de una librería combobox queda **diferida y condicionada** (igual
que `@dnd-kit` en ADR-0009) a que se cumplan las tres cosas:

1. La integración real esté desbloqueada (decisiones P4-2/P4-4 tomadas).
2. Una necesidad de UX que el patrón dependency-free no cubra bien
   (ej. listas de cientos de ítems con virtualización, autocomplete async).
3. PR propio y enfocado que la introduzca, con aprobación explícita de
   Fernando — preferencia: **Base UI** (ya es la base del Design System
   Qavante) sobre cmdk/Downshift, salvo que Base UI no resuelva el caso.

**Invariantes no negociables** del patrón dependency-free (mientras viva):

- Accesible por teclado sin JS de roving-tabindex custom: los ítems
  seleccionables son elementos nativamente focusables (`<button>` /
  `<input type=radio|checkbox>`), navegables por Tab, con estado de selección
  expuesto a tecnologías asistivas (`aria-pressed` / `checked`).
- **No anidar interactivos**: no usar `role="listbox"`/`role="option"` con
  `<button>` dentro (patrón ARIA inválido — option no debe contener
  interactivos). Se usa agrupación (`role="group"` + `aria-label`) o
  `fieldset/legend`, no un listbox falso.
- El filtro nunca oculta el estado: si la búsqueda no matchea, se muestra
  copy de "sin resultados", no una lista vacía muda.

## Alternativas consideradas

- **Opción A — cmdk / Downshift / react-select (descartada por ahora):**
  dependencia nueva para componentes que aún no se montan en producción
  (integración diferida). Compromete stack antes de que la UX lo exija.
  Mismo razonamiento que ADR-0009 con `react-beautiful-dnd`.
- **Opción B — `<select>` nativo (como `role-select.tsx`) (descartada):**
  no soporta búsqueda dentro del control, que el addendum §17.2/§20 pide
  explícitamente para tipos de movimiento y categorías de gestión.
- **Opción C — input de filtro + lista de elementos nativos accesibles
  (elegida):** cubre la búsqueda requerida, accesible por construcción
  (elementos nativos), cero dependencias, testeable (helper puro). El costo
  (sin virtualización ni combobox ARIA completo) es aceptable para los
  volúmenes de Fase 1 (26 canonical categories, árboles de gestión PYME).

## Consecuencias

### Positivas

- Cero dependencias nuevas; PRs #100/#102 chicos y sin riesgo de stack.
- Accesibilidad por construcción (elementos nativos), sin reinventar un
  combobox ARIA a mano (notoriamente frágil).
- Coherente con la disciplina de dependencias del repo (ADR-0009 precedente).

### Negativas / tradeoffs aceptados

- Sin virtualización: listas muy largas (miles de ítems) no rinden ideal.
  Aceptable para los volúmenes Fase 1; si crece, dispara la Opción A.
- Sin el patrón combobox ARIA completo (autocomplete con
  `aria-activedescendant`): la UX es "filtrar + elegir de una lista", no
  "typeahead". Suficiente para el addendum; revisable si UX lo pide.

### Acciones que destraba o requiere

- [ ] PRs #100/#102: cumplen los invariantes de a11y de esta decisión
      (corrección del patrón ARIA aplicada en este mismo ciclo).
- [ ] Si a futuro se evalúa una librería combobox: ADR-superseder + PR
      enfocado con aprobación explícita de Fernando (no cambio silencioso).
- [ ] Actualizar el comentario de `role-select.tsx` para apuntar a este ADR
      cuando se haga el próximo PR que lo toque (no se toca ahora — fuera de
      scope, no-regresión).

## Referencias

- [Addendum frontend v2.0 §17/§20](../addendum/frontend-v2.md)
- [ADR-0009](./0009-politica-drag-and-drop.md) — precedente: dependencia
  diferida y condicionada (DnD)
- [ADR-0007](./0007-estructura-carpetas-dominios-addendum.md) — ubicación
  `src/components/<dominio>/`
- CLAUDE.md — restricción de dependencias nuevas
