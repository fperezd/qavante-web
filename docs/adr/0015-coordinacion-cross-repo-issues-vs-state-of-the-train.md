# ADR-0015: Coordinación cross-repo — issues para pedidos, STATE_OF_THE_TRAIN commiteado para estado

- **Status:** Accepted
- **Fecha:** 2026-06-01
- **Decididores:** Fernando + CC-WEB
- **Tickets / PRs:** `qavante-api` issue #205 (primer pedido por el canal nuevo); PRs #269-#278 (bloque que dejó el FE adelantado al backend)

## Contexto

El proyecto corre con **agentes en paralelo en repos separados**: CC-WEB en
`qavante-web` (frontend), CC-API en `qavante-api` (backend), y Fernando como
puente humano y único gate de prioridad / merges a `main` / acciones prod.

El canal de coordinación de facto era `STATE_OF_THE_TRAIN.md`, **un markdown que
vive dentro del repo del backend** y se edita por append. Al intentar dejarle un
pedido a CC-API (extender la cookie a los endpoints de dimensiones), se
destaparon fallas estructurales del canal:

1. **El doc vive en el repo de un equipo.** CC-WEB no puede commitearlo sin (a)
   violar la frontera de repos, o (b) entrar en la rama de trabajo de CC-API y
   mezclarse con su WIP sin commitear.
2. **Las ediciones sin commitear no llegan a GitHub.** El propio doc dice que la
   coordinación es "solo por GitHub" → una edición en working copy **no la ve el
   otro agente** por su flujo normal, y encima ensucia su WIP.
3. **Hay una copia duplicada stale** (`qavante-api-B`, no-git) además del repo
   real → dos "fuentes de verdad" del mismo doc.
4. **Fernando quedaba como bus de mensajes** (copiar/pegar entre agentes), no
   solo como gate de prioridad → no escala.

El propio `CLAUDE.md` ya prescribía el mecanismo correcto para pedidos
("Documentá el endpoint requerido en un issue del repo backend"), pero no estaba
formalizado como la convención por defecto frente a `STATE_OF_THE_TRAIN`.

## Decisión

Separamos **pedidos** de **estado**:

1. **Pedidos concretos cross-repo van como GitHub issues en el repo destino.**
   Un agente que necesita algo del otro repo abre un issue allí (ej.
   `gh issue create --repo fperezd/qavante-api`), con el pedido accionable,
   endpoints/shapes exactos, criterio de verificación y links a los docs de
   brecha. Durable, trackeable, cerrable, sin tocar el working tree del otro.
2. **`STATE_OF_THE_TRAIN.md` queda para el *snapshot de estado* de alto nivel,
   y siempre commiteado por su dueño.** No se coordina por ediciones sin
   commitear. Un agente NO edita el working tree del repo del otro para
   "dejar un mensaje".
3. **Fernando es el gate de prioridad y prod, no el bus de mensajes.** Con
   issues, cada agente publica su pedido de forma asíncrona y durable; Fernando
   decide el orden y ratifica acciones prod-críticas.
4. **Una sola fuente de verdad por doc compartido.** Se elimina la copia
   duplicada stale (`qavante-api-B`); queda la del repo git.

## Alternativas consideradas

- **Opción A — seguir con `STATE_OF_THE_TRAIN` editado por working copy —
  descartada:** frágil (no llega a GitHub, ensucia WIP ajena, depende del
  courier humano), y ya falló en la práctica.
- **Opción B — un repo de coordinación dedicado (ni FE ni BE) — descartada por
  ahora:** resuelve el "vive en el repo de un equipo" pero agrega un repo y
  ceremonia; los issues ya dan durabilidad y tracking sin repo nuevo.
- **Opción C — issues para pedidos + STATE_OF_THE_TRAIN commiteado para estado
  — elegida:** ver Decisión. Es además lo que `CLAUDE.md` ya prescribía para
  pedidos cross-repo.

## Consecuencias

### Positivas

- Pedidos durables, trackeables y cerrables; nadie pierde un mensaje en un
  working copy.
- Ningún agente toca el working tree del otro repo.
- Fernando prioriza en vez de transcribir → escala a N agentes.
- Historial de coordinación auditable (issues cerrados).

### Negativas / tradeoffs aceptados

- Dos lugares que mirar (issues del repo + STATE_OF_THE_TRAIN) en vez de uno.
  Se acepta: cumplen funciones distintas (pedido vs. estado).
- Requiere disciplina: no volver a "dejar notas" por edición sin commitear.

### Acciones que destraba o requiere

- [x] Primer pedido migrado a issue: `qavante-api` #205 (cookie en dimensiones).
- [ ] Fernando elimina la copia duplicada stale de `STATE_OF_THE_TRAIN`
      (`qavante-api-B`).
- [ ] CC-API confirma la convención (idealmente reflejándola en su lado).

## Referencias

- `qavante-api` issue #205 — primer pedido por el canal nuevo.
- `docs/backend-contracts/fe-ahead-of-backend-unblock-roadmap.md` — roadmap
  priorizado de desbloqueo que motivó el pedido.
- `CLAUDE.md` §"DEPENDENCIAS CROSS-REPO" — ya prescribía issues para pedidos.
- [ADR-0008](./0008-feature-flags-gating-pantallas-sin-backend.md) — feature-flags (cómo se activa cada feature una vez destrabada).
