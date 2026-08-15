# FACTORY_POLICY.md — ley operativa de Qavante Web

Alineada a **TOOXS AI Factory Standard v1.0** el 2026-08-15. Aplica a humanos y agentes de cualquier proveedor.

Regla de oro: **el LLM es reemplazable; el sistema de ingeniería no.**

## 1. Source of truth

Orden de autoridad:
1. código en `main`;
2. CI/checks;
3. contrato OpenAPI/configuración real;
4. Issue/PR;
5. ADR aceptado;
6. documentación operativa vigente;
7. documentación histórica.

El antiguo prompt CC-WEB, Sprint C0 y documentos históricos no gobiernan trabajo actual salvo referencia explícita vigente.

## 2. Unidad de trabajo

Todo cambio parte de un Issue/PR con objetivo, acceptance, scope, riesgo, dependencias y validación.
Un PR = un propósito salvo excepción justificada.

## 3. Concurrencia IA

- 1 implementador por defecto.
- Máximo 2 en paralelo sólo con independencia real y worktrees/ownership aislados.
- Estudios/documentación también consumen capacidad IA y cuentan para concurrencia.
- No agent swarms.
- No dos workers compartiendo el mismo working tree; una sesión no debe cambiarle la rama a otra.

## 4. Risk routing

### R0
Docs, tests, tooling, typo, refactor sin cambio observable. Gate: CI → merge policy.

### R1
Bug/feature/UI normal. Gate: CI → review independiente → review humano breve → merge.

### R2
Semántica financiera visible, moneda, auth, secretos, contratos materiales, acción irreversible, seguridad o producción sensible.
Gate: CI → review adversarial → invariantes → E2E/integration → dato real cuando corresponda → human gate → merge → prod verify.

Ante duda, subir riesgo.

## 5. Review independiente

El implementador no certifica su propio R1/R2. Reviewer parte de Issue + acceptance + diff + contrato + evidencia.
Veredicto: `PASS | FAIL | NEEDS_HUMAN`.

Review nuevo tras cambios materiales. No usar la conversación del implementador como fuente de verdad.

## 6. Calidad y tests

El agente ejecuta tests focalizados y changed-area validation. CI ejecuta la suite completa requerida, typecheck, lint, build, Storybook/E2E/Lighthouse y scans según workflows vigentes.

No repetir suites completas dentro de loops caros sólo para duplicar CI.
Nunca se reduce cobertura, seguridad, contrato, review o prod verify para ahorrar uso IA.

## 7. Contexto

Cargar mínimo contexto suficiente. Preferir búsqueda y archivos relevantes.
No leer todo el repo, todos los ADRs ni documentos históricos por defecto.
Reviewer recibe issue + diff + contratos + evidencia, no transcript completo.

## 8. Reintentos

Un solo reintento automático por hallazgo. Una segunda falla exige cambiar enfoque o escalar; no loop.

## 9. Trabajo autónomo

Una sesión autónoma/nocturna recibe una prioridad explícita, un solo frente y un solo implementador por defecto. No expande automáticamente a otros READY ni hace trabajo especulativo.

## 10. Eficiencia y control financiero

### Capacidad incluida en suscripción
Usarla eficientemente. No aplicar un tope monetario diario artificial sobre capacidad ya contratada.

### Uso incremental pagado
Por defecto: sin compra automática, sin auto top-up, sin fallback a créditos pagados y sin sobreconsumo pagado sin autorización configurada del BO.

Si se agota la capacidad incluida y no existe autorización incremental, se detiene el trabajo autónomo.

### Model routing
Usar la capacidad/razonamiento de menor costo que resuelva responsablemente la tarea. Reservar modelos/razonamiento fuertes para R2 o complejidad real, no para rutina.

## 11. Reglas específicas de Qavante Web

Ver `PROJECT_POLICY.md`. Incluye OpenAPI tipado, runtime Cloudflare, data honesty, INV-FX-001, separación de lógica backend/frontend y seguridad cliente.

## 12. Enforcement

Toda regla obligatoria que pueda ser mecánicamente verificada debe vivir en CI, branch protection, CODEOWNERS, tests, contracts o equivalente.
Un check opcional rojo no es un gate real.

La Factory nunca es dependencia de runtime del producto y R2 nunca se auto-mergea.
