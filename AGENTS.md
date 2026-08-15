# AGENTS.md — entrada portable de la Factory de `qavante-web`

Este repo adopta **TOOXS AI Factory Standard v1.0** con overlay específico de Qavante Web.
Este archivo es la entrada portable para Codex, Claude, Gemini u otros agentes.

Antes de tocar código:

1. Lee `docs/factory/FACTORY_POLICY.md`.
2. Lee `docs/factory/PROJECT_POLICY.md`.
3. Lee el Issue/PR que define el trabajo.
4. Lee sólo ADRs, contratos y código relevantes al scope.

## Source of truth

1. código en `main`;
2. CI/checks requeridos;
3. contrato OpenAPI generado/consumido y configuración real;
4. Issue/PR;
5. ADR aceptado;
6. documentación operativa vigente;
7. documentación histórica.

## Ejecución por defecto

- 1 agente implementador activo por defecto.
- Máximo 2 implementadores en paralelo sólo para tareas realmente independientes y aisladas por worktree/ownership.
- No agent swarms.
- R1/R2 requieren review independiente.
- Modelo/razonamiento fuerte sólo cuando riesgo/complejidad lo justifique.
- Tests focalizados en la sesión; suite completa, build, Lighthouse y demás gates donde CI los defina.
- No implementar lógica financiera que pertenece al backend.
- No inventar datos ni convertir silenciosamente monedas/estados faltantes.

## Neutralidad de proveedor

Codex, Claude u otro modelo son ejecutores reemplazables. Ninguna regla obligatoria debe depender exclusivamente de configuración de un proveedor.
