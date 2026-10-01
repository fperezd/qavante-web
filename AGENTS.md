# AGENTS.md — Qavante Web

## Principio operativo

Autonomía por defecto: implementa, valida y entrega el cambio sin pedir pasos humanos que puedan sustituirse por evidencia mecánica. Escala sólo ante una decisión irreversible, acceso/secretos, ambigüedad material de producto o finanzas, o falta de autoridad externa.

No es obligatorio leer toda la política de Factory antes de trabajar. Parte del issue/PR y del código afectado; abre documentación especializada sólo cuando el cambio toca esa frontera.

## Source of truth

1. código y configuración en `main`;
2. checks y contratos ejecutables;
3. contrato OpenAPI versionado;
4. issue/PR y ADR vigente;
5. documentación operativa.

## Flujo por defecto

- Un agente implementador. Paraleliza sólo tareas independientes y aisladas.
- Mantén el scope mínimo y corre tests focalizados; Docker local aporta feedback y GitHub Actions publica los checks obligatorios del PR.
- Deja en el PR evidencia reproducible, blast radius y rollback.
- No exijas reviewer IA ni una segunda sesión por rutina.
- Un fallo repetido una vez exige cambiar de estrategia o escalar; no entrar en loops.

## Controles no negociables

- No implementar lógica financiera que pertenece al backend ni inventar datos, monedas o estados.
- Cambios de auth, secretos, contratos, dinero o producción requieren evidencia reforzada. Sólo las acciones destructivas irreversibles, nuevas credenciales/permisos o ambigüedad material se escalan.
- Mantener `npm run contract:check`, build, seguridad, smoke/runtime verification y rollback cuando apliquen.
- Nunca debilitar secretos, branch protection o producción para hacer pasar un cambio.

## Contexto bajo demanda

- Contrato API: `docs/contracts/README.md` y snapshot OpenAPI.
- Deploy/producción: `docs/operations/deploy-runbook.md`.
- Reglas especializadas e invariantes: `docs/factory/PROJECT_POLICY.md`.
- Diseño general de la Factory: `docs/factory/FACTORY_POLICY.md`.

Proveedor/modelo son reemplazables; ninguna regla crítica puede vivir sólo en un adapter.

## E2E y GitHub Actions

- Antes de cambiar un test E2E, leer el log real del check fallido y confirmar el SHA que ejecutó CI.
- Mantener los fixtures MSW alineados con los contratos API, tipos y handlers del endpoint.
- Declarar explícitamente todos los feature flags de Playwright en `playwright.e2e-env.ts`; no depender de `.env.local`, `wrangler.toml` ni variables heredadas.
- Para asincronía, esperar una respuesta HTTP o una señal funcional visible. No usar `waitForTimeout` como solución.
- En listas interactivas, usar identificadores estables; no usar el índice como `key` cuando la lista puede actualizarse o reordenarse.
- Validar primero el test exacto y luego el blast radius mínimo. Ejemplo: `npm run e2e -- --project=flows tests/e2e/<flujo>.flow.spec.ts`.
- Antes de subir cambios, ejecutar `npm run typecheck`, `git diff --check` y revisar `git status`.
- Después del push, verificar el PR con `gh pr checks <numero> --watch` y leer el log del check si vuelve a fallar.
