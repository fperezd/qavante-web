# Ledger de DoD por sprint — Fase 1 (C0-C9)

> **CC-WEB. 2026-06-02.** Tracking formal del Definition of Done por sprint (Maestro Sec 13). Complementa las revisiones integrales K.4 (ciclos) con un estado punto-por-sprint. Estados: ✅ aceptado en prod · 🟡 construido FE-first, gated OFF (espera backend para activar) · 🔴 sin construir / stub.
>
> "Construido FE-first/gated" NO es "aceptado": la pantalla existe con contrato + MSW + stories + tests, pero el DoD del sprint solo se cierra cuando el dato real fluye en prod (flag ON contra endpoint real).

## Estado por sprint

| Sprint | Pantalla                                                 | Estado                                       | Flag                   | Evidencia                                                                   | Falta para "aceptado"                                       |
| ------ | -------------------------------------------------------- | -------------------------------------------- | ---------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **C0** | Base SaaS (login, shell, sidebar, DS, API client)        | ✅ aceptado                                  | —                      | LIVE prod                                                                   | —                                                           |
| **C1** | Fuentes / SII (F29, RCV, BHE)                            | 🟡 gated                                     | `siiQueries`           | vistas SII + tests                                                          | cookie en `/api/sii/*` (backend)                            |
| **C2** | Clasificación bancaria + editores estructura/dimensiones | ✅ aceptado (clasificación) · 🟡 dimensiones | `managementDimensions` | clasificar/clasificados/reglas LIVE; e2e `clasificar`, `estructura-gestion` | dimensions api-key-only (issue #205)                        |
| **C3** | Caja 13 semanas                                          | 🟡 parcial                                   | —                      | `caja/proyeccion` LIVE                                                      | resto de pantalla Caja (endpoints nuevos)                   |
| **C4** | Cobrar (gestión)                                         | 🟡 gated                                     | `accountsReceivable`   | #284, contrato + MSW + stories + e2e `cobrar`                               | `GET /api/treasury/accounts-receivable`                     |
| **C4** | Pagar (gestión)                                          | 🟡 gated                                     | `accountsPayable`      | #285, contrato + MSW + stories + e2e `pagar`                                | `GET /api/treasury/accounts-payable`                        |
| **C5** | Resultado Operacional                                    | 🟡 gated                                     | `operationalResult`    | #283, contrato + MSW + stories + e2e `gestion`                              | `GET /api/management/operational-result`                    |
| **C6** | Drivers + acciones                                       | 🔴 sin construir                             | —                      | `priority_actions` viven en summary C8                                      | endpoint drivers (= Brecha 2)                               |
| **C7** | Pulso Empresa                                            | 🟡 bloque en C8                              | `dashboardSummary`     | bloque Pulso en el summary                                                  | cálculo de pulso; pantalla `gestion/pulso` dedicada         |
| **C8** | Inicio Ejecutivo                                         | 🟡 gated                                     | `dashboardSummary`     | #286, contrato + MSW + stories + e2e mobile                                 | `GET /api/dashboard/summary` (entrega incremental acordada) |
| **C9** | Asistente                                                | 🔴 stub                                      | —                      | botón flotante                                                              | `POST /api/assistant/chat` + 12 tools                       |

## Checklist DoD global (Maestro Sec 13 + CLAUDE.md regla 15)

Aplica transversalmente, no por sprint:

| Ítem                                | Estado | Nota                                                                                     |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Tests vitest verdes pre-PR          | ✅     | corre en CI (`test`)                                                                     |
| E2E de flujos reales                | ✅     | `clasificar`, `cobrar`, `pagar`, `gestion`, `estructura-gestion`                         |
| E2E smoke login real                | ⏳     | `test.skip` — espera secrets `SMOKE_RUT`/`SMOKE_PASSWORD` (acción Fernando)              |
| Lighthouse mobile ≥85 `/login`      | ✅     | enforced (`categories:performance` error ≥0.85)                                          |
| Lighthouse mobile ≥90 `/app/inicio` | ⏳     | hoy mide `/credenciales`, no `/inicio` — en curso                                        |
| Gate de a11y automático             | ⏳     | LHCI a11y en `warn` — en curso                                                           |
| Chromatic / regresión visual        | 🟡     | corre en CI; baselines pendientes de aceptar a mano                                      |
| Sin regresiones (navegación manual) | ✅     | por ciclo K.4                                                                            |
| Types generados desde OpenAPI       | ✅     | `generate:api`; contratos FE-first hand-rolled documentados en `docs/backend-contracts/` |

## Cómo se actualiza

Al cerrar un ciclo (review K.4) o activar un flag en prod, actualizar la fila correspondiente. Cuando un endpoint backend se exponga y el flag pase a ON en prod con dato real, el sprint pasa de 🟡 a ✅.
