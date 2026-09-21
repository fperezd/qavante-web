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
- Mantén el scope mínimo y corre tests focalizados; Docker local ejecuta las suites adicionales y publica estados `local-*` sobre el SHA exacto.
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
