# Factory Policy — autonomía verificable

## 1. Principio

La Factory optimiza para una persona aumentada por agentes:

**Autonomía por defecto**, con proveedor/modelo agnóstico y reemplazable.

> máxima autonomía para lo reversible y verificable; intervención humana sólo por excepción.

El camino normal es implementar, producir evidencia mecánica, integrar y verificar. Un reviewer IA, una segunda sesión o una aprobación ceremonial no son gates universales.

## 2. Contexto mínimo

`AGENTS.md` es la entrada. Esta política y `PROJECT_POLICY.md` son contexto especializado bajo demanda; no se leen completos para todo cambio.

La autoridad, en orden, es: código/configuración en `main`, checks y contratos ejecutables, issue/PR, ADR vigente y documentación operativa.

## 3. Ejecución

- Un implementador por defecto.
- Tests focalizados durante la implementación; el ejecutor local corre en Docker los checks aplicables según paths y publica estados `local-*` sobre el SHA exacto.
- Un reintento autónomo ante el mismo fallo. Después se cambia de estrategia o se escala.
- No duplicar trabajo determinístico de CI con agentes adicionales.
- Cada PR mantiene un propósito, evidencia reproducible, blast radius y rollback.

## 4. Routing de riesgo

### R0 — verificable y reversible

Documentación, refactors locales y cambios sin fronteras protegidas. Camino: evidencia mecánica → auto-merge cuando la configuración externa lo permita.

### R1 — impacto acotado

Cambios de comportamiento con tests y rollback claros. Camino: checks del área → merge autónomo si todo está verde.

### R2 — excepción protegida

Dinero/invariantes financieras, auth/tenant/RLS, secretos/permisos, migraciones destructivas, contrato incompatible, writes externos irreversibles, producción y cambio de los propios gates.

R2 se implementa, integra y despliega autónomamente cuando la operación es reversible y existe evidencia mecánica sobre el SHA/árbol/digest exactos. Producción y la protección de rama no requieren un checkpoint humano: requieren preflight, observación posterior y rollback probado.

La clasificación se valida mecánicamente por paths y labels. No declarar label equivale a R0 sólo cuando ningún path protegido exige R2.

## 5. Evidencia en lugar de reviewer obligatorio

El antiguo gate local `local-change-evidence` validaba sobre el head del PR; fue retirado y se conserva aquí sólo como referencia histórica:

- clasificación de riesgo compatible con los paths;
- secciones de evidencia y rollback para cambios materiales;
- ausencia de contradicciones mecánicas obvias.

No certifica calidad subjetiva ni reemplaza tests. Ningún nivel de riesgo exige reviewer IA ni sign-off ceremonial cuando el cambio es reversible y los controles mecánicos aplicables están verdes.

## 6. Controles no negociables

Nunca se relajan para ahorrar tiempo o tokens:

- contratos API y compatibilidad;
- invariantes financieras y de tenant;
- auth/security, secret scan y dependency audit aplicable;
- build e integración de las áreas modificadas;
- artefacto inmutable cuando corresponda;
- smoke, health/runtime verification y rollback de producción;
- trazabilidad entre PR, SHA, árbol y artefacto.

Un job omitido por routing sólo es válido si el workflow vigente confirma que no aplicaba, no si falló o fue cancelado.

## 7. Producción

Deploy exitoso no cierra el ciclo: `deploy → smoke → health/telemetry → PASS`. Ante fallo, rollback automático sólo cuando sea seguro; si no, escalamiento.

Producción no se debilita para ganar autonomía. La ruta vigente de GitHub Actions conserva evidencia del SHA/árbol/digest exactos, protección de secretos y credenciales, observación de runtime y rollback cuando sea seguro.

## 8. Escalamiento humano

Escalar únicamente cuando se necesita una decisión o autoridad que el sistema no posee:

1. operación irreversible o destructiva;
2. ampliación de acceso, permisos o secretos;
3. definición ambigua de una cifra o comportamiento material;
4. cambio incompatible de contrato;
5. gasto, credencial o acción externa no autorizada;
   Una operación R2 reversible, un cambio declarativo de branch protection o un deploy con rollback no son por sí solos causales de escalamiento.

CI local rojo, deuda de tests o documentación desalineada se corrigen; no son escalamiento por sí solos.

## 9. Eficiencia

Usar el modelo y contexto mínimos suficientes. No comprar capacidad incremental ni crear loops de agentes sin autorización. GitHub Actions es la ruta vigente de CI y release; la validación local sólo aporta feedback.

## 10. Enforcement

Una regla obligatoria debe vivir en CI, tests, contratos, branch protection o release gates. La prosa explica; no simula enforcement. Si guard y documento difieren, se corrigen juntos en el mismo PR.
