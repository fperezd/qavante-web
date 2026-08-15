# Migración a TOOXS AI Factory Standard v1.0

Este PR moderniza la Factory de Qavante Web sin cambiar código productivo.

## Qué cambia
- se crea `AGENTS.md` como entrada portable para Codex/Claude/otros;
- `CLAUDE.md` se reduce a adapter mínimo y deja de cargar el prompt histórico de Sprint C0;
- se incorpora `FACTORY_POLICY.md` local para que un agente cloud no dependa de otro repo para conocer reglas;
- se agrega `PROJECT_POLICY.md` con reglas específicas de Next.js/Cloudflare/OpenAPI/data honesty.

## Qué NO cambia
- componentes ni lógica UI;
- llamadas API;
- feature flags;
- Cloudflare config;
- contratos generados;
- workflows CI/deploy;
- branch protection.

## Correcciones de operación IA
- 1 implementador por defecto; máximo 2 si existe independencia real;
- worktrees/ownership aislados;
- no agent swarms;
- una prioridad explícita para trabajo autónomo;
- contexto mínimo suficiente;
- CI hace validación completa; agente hace validación focalizada;
- capacidad incluida separada de créditos incrementales;
- sin auto top-up/fallback pagado por defecto.
