# ADR-0014: Sesiones autónomas low-risk — reglas y scope

- **Status:** Accepted
- **Fecha:** 2026-05-28
- **Decididores:** Fernando
- **Tickets / PRs:** qavante-web #197-#207 (sesión 2026-05-27/28); precedente: sesión 2026-05-25.

## Contexto

Fernando autorizó dos sesiones autónomas de CC-WEB hasta ahora:

1. **2026-05-25 (7h diurnas)** — shipping nocturno autorizado para PRs independientes.
2. **2026-05-27/28 (~7h nocturnas)** — scope reducido a "low-risk only": docs, coverage no-auth, handoffs, memorias.

Sin reglas escritas, cada sesión obliga a re-aclarar: ¿qué scope? ¿auto-merge? ¿hasta qué hora? ¿cuándo parar? Eso pierde tiempo y genera riesgo de interpretar mal (la sesión 2026-05-27/28 arrancó con scope amplio "Sprint C3 waves" y se redujo a low-risk a mitad de camino tras instrucción nueva de Fernando).

Memoria persistente (`project_sesion_autonoma_2026_05_25.md`, `project_ciclo_c3_mvp_2026_05_27_28.md`) describe los outputs pero no las reglas operativas.

## Decisión

Las sesiones autónomas de CC-WEB siguen este protocolo:

### Modos posibles

- **Modo A — "shipping nocturno general"**: cualquier scope técnicamente low-risk que CC-WEB juzgue. Usado en sesión 2026-05-25.
- **Modo B — "low-risk only"**: scope acotado por Fernando a docs, tests/coverage en áreas no-auth, handoffs cross-repo, memorias y refactors mecánicos sin cambio de comportamiento. Usado en sesión 2026-05-27/28.

Fernando elige modo en la autorización inicial. Si no especifica, default es **Modo B** (más conservador).

### Reglas comunes a ambos modos

1. **Cada PR es independiente** — sin stacked dependencies entre PRs autónomos. Ramea de `main` actualizado.
2. **Auto-merge si CI verde** — `gh pr merge --squash --auto`. Si CI rojo, el PR queda abierto para review humano matutino (no se intenta debug autónomo de fallos de CI). Excepción: cambios triviales en docs/markdown que el linter rompió — sí se puede fixear y re-push.
3. **Sin invasión cross-repo** — nunca abrir PRs ni issues en `qavante-api` ni en otros repos. Documentar brechas backend en `docs/backend-contracts/` y dejar handoff doc para Fernando.
4. **Sin cambios destructivos** — no force-push, no reset --hard, no borrar branches remotas. Sin --no-verify ni skip de hooks.
5. **TodoWrite obligatorio** desde el inicio para trackear progreso. El usuario al despertar lee la lista para entender qué se hizo.
6. **Notas de bloqueo** — si CC-WEB se traba (CI fail no obvio, contrato ambiguo, decisión que solo Fernando puede tomar), parar, dejar PR abierto con descripción explícita del bloqueo, no hacer cosas tangenciales para "rellenar".
7. **Hora de cierre respetada** — no extender la sesión más allá del horario autorizado, incluso si "queda backlog". El propósito es disciplina, no maratón.
8. **Memoria + audit al cierre** — actualizar `MEMORY.md` con resumen del ciclo y crear `docs/audits/<ciclo>.md` con K.4 estructurado (PRs, tests, brechas, estado al cierre).

### Reglas específicas del Modo B (low-risk)

Adicional a las comunes:

- **NO tocar código de auth / login / cookies / middleware** — esos cambios requieren review humano consciente.
- **NO tocar dependencias** (`package.json` `dependencies` o `devDependencies`) — solo `scripts` y `lint-staged` están permitidos.
- **NO tocar `wrangler.toml`**, env vars del workflow, ni archivos de infra. Solo docs/ y código testeable sin deploy.
- **NO regenerar `src/lib/api/types.ts`** si trae diffs — significa que el backend cambió contratos y eso amerita review humano.
- **Tests pueden refactorearse para coverage** pero sin cambiar comportamiento runtime del código testeado (extraer helpers OK; mover lógica entre módulos OK; cambiar shape de respuestas/inputs NO).
- **ADRs solo plan-only** — describir decisiones que ya están tomadas o documentar patrones existentes. No introducir decisiones arquitecturales nuevas no consultadas.

### Definition of Done de una sesión autónoma

Al cierre del horario, CC-WEB deja:

- [ ] TodoWrite con todos los items terminados o explícitamente marcados "bloqueado: <razón>".
- [ ] Cada PR mergeado o con razón clara de por qué quedó abierto.
- [ ] Memoria persistente actualizada con el resumen del ciclo (un archivo nuevo `project_<ciclo>.md` + entry en `MEMORY.md`).
- [ ] Audit K.4 (`docs/audits/<ciclo>.md`) con TL;DR, inventario PRs, tests, brechas, estado al cierre, acciones humanas pendientes.
- [ ] CHANGELOG actualizado con la sección del ciclo.
- [ ] `git status` limpio (sin untracked relevantes; sin uncommitted).

## Alternativas consideradas

- **Opción "sin reglas escritas" — descartada:** la realidad mostró que cada sesión reinventaba el contrato (alcance, auto-merge, etc.). Costó tiempo y generó la divergencia de scope en 2026-05-27/28. Un ADR captura las reglas una vez.

- **Opción "reglas en CLAUDE.md" — descartada en favor de ADR separado:** CLAUDE.md ya está cargado de reglas duras de proyecto. Las sesiones autónomas son un modo operativo, no una regla constante. Mejor referenciar el ADR desde CLAUDE.md sin inflar el prompt.

- **Opción "auto-merge nunca, todo review humano post-PR" — descartada:** anularía el propósito de la sesión (avanzar mientras Fernando duerme). Si Fernando quiere review pre-merge, NO autoriza sesión autónoma; trabaja en modo interactivo normal.

## Consecuencias

### Positivas

- Sesiones autónomas tienen contrato claro pre-sesión. Fernando elige Modo A o B en 1 frase.
- CC-WEB tiene checklist explícito de cierre — reduce riesgo de dejar trabajo a medio camino o sin documentar.
- Patrón replicable: la 3ra+ sesión autónoma arranca sobre suelo firme.

### Negativas / tradeoffs aceptados

- ADRs son contrato — cambiarlos requiere superseded por otro ADR. Si emerge un Modo C, hay que documentarlo en un ADR-NNNN.
- Algunos elementos del Modo B son juicio (qué es "low-risk", qué es "tangencial") — CC-WEB hace el call, Fernando corrige si es necesario en la mañana.

### Acciones que destraba o requiere

- [x] Documentar las reglas en este ADR.
- [ ] Linkear el ADR desde CLAUDE.md "Reglas durante el sprint" para que CC-WEB futuro lo lea al inicio de sesión.
- [ ] Cuando Fernando autorice una sesión autónoma, mencionar el modo (A o B) y referenciar este ADR para evitar re-aclaraciones.

## Referencias

- ADR-0008 — feature flags gating (relevante porque Modo B no activa flags).
- Memoria `project_sesion_autonoma_2026_05_25.md` — output de la 1ra sesión.
- Memoria `project_ciclo_c3_mvp_2026_05_27_28.md` — output de la 2da sesión (incluye 5h en Modo B post-ajuste de scope).
- Audit `docs/audits/c3-mvp-cycle-2026-05-27-28.md` §7 — descripción operativa de la sesión 2026-05-27/28.
- Memoria `feedback_fernando_authoriza_merges.md` — autorización general de auto-merge sobre PRs propios.
