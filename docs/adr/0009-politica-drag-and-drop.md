# ADR-0009: Política de drag-and-drop para árboles de gestión (preventiva)

- **Status:** Proposed
- **Fecha:** 2026-05-15
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** addendum frontend v2.0 §21, PRs #84 (estructura de gestión) y #85 (vistas de gestión)

## Contexto

El addendum §14/§15 describe editores de árbol (categorías de gestión, valores de dimensiones) con reordenamiento y movimiento entre padres. §21 plantea drag-and-drop con reglas estrictas (no soltar nodo en sí mismo/descendiente, optimistic update con rollback, accesible por teclado, payload `move` específico).

§21 también pone una **restricción obligatoria**: _"No instalar una librería DnD nueva dentro de PR #83 salvo que el proyecto ya la tenga o Fernando apruebe un PR específico. Si se instala, preferir `@dnd-kit/core` y `@dnd-kit/sortable`"_.

El repo **no tiene** ninguna librería DnD instalada hoy. CLAUDE.md restringe agregar dependencias sin justificación + PR propio si cambia arquitectura. Es una decisión preventiva análoga a ADR-0004 (anti-patterns del Asistente): se documenta antes de implementar para que no se improvise.

## Decisión

1. **PR #83 NO incluye DnD.** Es un PR de integración (hooks, tipos, skeletons), no de UI interactiva compleja. §6.1/§5.2 del addendum lo confirman.
2. **DnD se implementa recién en los PRs de pantalla (#84 árbol categorías, #85 árbol valores), y como PR enfocado**, no mezclado con otra cosa.
3. **Librería: `@dnd-kit/core` + `@dnd-kit/sortable`** si y sólo si se confirma que el backend expone los endpoints `move` (`POST /api/management/accounts/{id}/move`, `POST /api/management/dimension-values/{id}/move`). Sin endpoint `move` confirmado en OpenAPI, **no hay DnD** — el reordenamiento se hace por acción explícita de menú ("Mover a…"), que además es el fallback de accesibilidad obligatorio del addendum §21.1.
4. **Agregar `@dnd-kit` es una decisión que requiere aprobación explícita de Fernando** en el PR que la introduzca (este ADR la pre-autoriza _condicionalmente_ a que: (a) backend tenga `move`, (b) sea PR enfocado, (c) se cumplan las reglas de §21.1).
5. **Invariantes no negociables** cuando se implemente (de §21.1): impedir drop en sí mismo/descendientes; optimistic update **sólo** con rollback implementado; mensaje humano en rechazo por ciclo (usar copy de Tabla 18: _"No se puede mover ahí porque generaría una relación circular."_); alternativa por teclado/menú siempre presente.

## Alternativas consideradas

- **Opción A — DnD nativo HTML5 sin librería (descartada):** accesibilidad y manejo de árbol anidado son notoriamente frágiles a mano; reinventar `@dnd-kit` mal.
- **Opción B — otra librería (react-beautiful-dnd, etc.) (descartada):** react-beautiful-dnd está deprecada / sin soporte React 19; `@dnd-kit` es el estándar actual con accesibilidad incorporada. El addendum además ya nombra `@dnd-kit`.
- **Opción C — `@dnd-kit` condicional + fallback menú (elegida):** alinea con el addendum, no agrega dependencia hasta que haya backend que la justifique, garantiza accesibilidad vía fallback.

## Consecuencias

### Positivas

- PR #83 se mantiene chico y sin dependencias nuevas.
- No se instala una librería para una feature que el backend quizás no soporta aún (sin `move` endpoint, DnD no tiene sentido).
- Accesibilidad garantizada por diseño (el fallback menú es obligatorio, no opcional).

### Negativas / tradeoffs aceptados

- Si el backend tarda en exponer `move`, las pantallas #84/#85 salen con reordenamiento por menú en vez de DnD. Aceptable: funcional y accesible; DnD es enhancement, no requisito.

### Acciones que destraba o requiere

- [ ] Brief a CC-API: confirmar existencia y payload exacto de los endpoints `move`.
- [ ] PR #84/#85: si hay `move`, PR enfocado que agrega `@dnd-kit` con aprobación explícita de Fernando en ese PR; si no, reordenamiento por menú.
- [ ] El PR que agregue `@dnd-kit` actualiza este ADR a `Accepted` y documenta la versión pinneada.

## Referencias

- [Addendum frontend v2.0 §21](../addendum/frontend-v2.md)
- [ADR-0004](./0004-asistente-qavante-anti-patterns.md) — precedente de ADR preventivo
- CLAUDE.md — restricción de dependencias nuevas
