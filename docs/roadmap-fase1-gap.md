# Roadmap a Fase 1 — gap análisis (FE)

> **CC-WEB → Fernando. Actualizado 2026-06-02** (original 2026-06-01). Cruce del Documento Maestro v2.6.4 (Anexo E rutas + Sec 11 sprints C0-C9 + Sec 7 pantallas + Sec 13 DoD) contra lo **realmente construido** en `qavante-web`. Es el "camino al término" priorizado.

## TL;DR (la verdad sin maquillar)

Cambio importante vs. la versión del 2026-06-01: **las pantallas ejecutivas YA están construidas en el FE** bajo el patrón **FE-first gated** — Resultado Operacional (C5, #283), Cobrar y Pagar de gestión (C4, #284/#285) e Inicio Ejecutivo (C8, #286). **Ninguna está activa en prod**: todas esperan que el backend exponga su endpoint para destrabar el flag. Además se cerró el mayor agujero de calidad: los **e2e de flujos reales** ya existen (clasificar, cobrar, pagar, gestión, estructura-gestión).

**Conclusión (sin cambios):** el **camino crítico de Fase 1 corre por el backend**. El FE hizo su parte por adelantado (pantallas + contratos + MSW + stories + e2e); lo que falta para que el producto ejecutivo sea real son los endpoints de CC-API (`/api/dashboard/summary`, pulso, drivers, resultado operacional, AR/AP/aging/obligaciones). El FE puede seguir: (a) activar flags a medida que el backend destrabe, (b) endurecer el DoD (100% FE), (c) Asistente al final.

## ⚠️ Divergencia de rutas — reconciliar (decisión tuya)

El Anexo E especifica una estructura de rutas **distinta a la construida**. No es menor:

| Anexo E (target)                                                                                                      | Construido (real)                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `caja/movimientos`, `caja/conciliacion`, `caja/cuentas-bancarias`                                                     | `caja/por-clasificar`, `caja/clasificados`, `caja/proyeccion`                                                                      |
| `cobrar/clientes`, `cobrar/documentos`, `cobrar/aging`, `cobrar/cliente/[rut]`                                        | `cobrar` (gestión, gated `accountsReceivable`) + `cobrar/facturas-emitidas` (SII)                                                  |
| `pagar/proveedores`, `pagar/documentos`, `pagar/obligaciones`, `pagar/proveedor/[rut]`                                | `pagar` (gestión, gated `accountsPayable`) + `pagar/facturas-recibidas`, `pagar/honorarios-recibidos`, `pagar/impuestos/f29` (SII) |
| `gestion/resultado-operacional`, `gestion/pulso`, `gestion/historico`                                                 | `gestion` (resultado operacional, gated `operationalResult`)                                                                       |
| `administracion/empresa`, `/roles`, `/fuentes`, `/plan-cuentas`, `/plazos-pago`, `/auditoria`, `/certificado-digital` | `estructura-gestion`, `vistas-gestion`, `monedas`, `plantillas`, `reglas-clasificacion`                                            |

El equipo evolucionó la estructura (las vistas SII + editores no estaban tal cual en el Anexo E). **Decisión a tomar:** ¿actualizamos el Anexo E del Maestro a la realidad construida, o reconciliamos las rutas? Lo recomendado: **actualizar el doc** (la realidad construida es coherente), pero es tu llamada de producto.

## Estado por sprint (C0-C9 = Fase 1; no hay sprint Fase 2)

| Sprint                                | Qué es                                  | Estado real                                                                                                                                         | Dependencia backend                                                        |
| ------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **C0** Base SaaS                      | shell, login, sidebar, DS, cliente API  | ✅ **LIVE**                                                                                                                                         | —                                                                          |
| **C1** Fuentes (F29/Previred)         | mostrar fuentes + afecto en confianza   | 🟡 **construido/gated** — vistas SII, gated por `siiQueries` (OFF)                                                                                  | cookie en `/api/sii/*` + flujo credenciales                                |
| **C2** Modelo gestión + clasificación | clasificar movimientos                  | ✅ **LIVE** (por-clasificar/clasificados/reglas) + editores de estructura/dimensiones                                                               | accounts ✅; dimensions ⛔ (issue #205)                                    |
| **C3** Caja 13 semanas                | flujo proyectado                        | 🟡 **parcial** — `caja/proyeccion` LIVE; falta el resto de la pantalla "Caja" (caja por cuenta, brecha, cobros/pagos esperados, supuestos, alertas) | reporte cash-flow ✅; el resto = endpoints nuevos                          |
| **C4** Cobrar y Pagar                 | aging, top deudores, obligaciones, CTAs | 🟡 **construido FE-first/gated** (#284 `accountsReceivable`, #285 `accountsPayable`) — antes placeholder                                            | `GET /api/treasury/accounts-receivable` + `/accounts-payable` (no existen) |
| **C5** Resultado Operacional          | gana/pierde, margen, EBITDA proxy       | 🟡 **construido FE-first/gated** (#283 `operationalResult`) — antes placeholder                                                                     | `GET /api/management/operational-result` (no existe)                       |
| **C6** Drivers + acciones             | "por qué pasa" + "qué hacer primero"    | 🔴 **sin construir** (las `priority_actions` viven en el summary de C8)                                                                             | endpoint drivers/next-best-actions (= Brecha 2)                            |
| **C7** Pulso Empresa                  | índice de salud                         | 🟡 **bloque construido dentro de C8** (gated) — pantalla `gestion/pulso` dedicada sin construir                                                     | cálculo de pulso (score + knock-outs)                                      |
| **C8** Inicio Ejecutivo               | la pantalla principal (10 bloques)      | ✅ **LIVE en prod** (#286/#296, `dashboardSummary` ON desde 2026-06-03) — endpoint expuesto con cookie + tipos generados                            | — (drivers/pulso dedicados = C6/C7)                                        |
| **C9** Asistente                      | chat con tools                          | 🔴 **stub** — botón flotante sin chat                                                                                                               | `POST /api/assistant/chat` + 12 tools                                      |

**Lo que está LIVE hoy en prod:** C0 + el slice de clasificación/tesorería (C2 + parte de C3) + editor de cuentas + admin (usuarios/credenciales). **Todas las pantallas ejecutivas (C4/C5/C8) están construidas pero gated OFF**, esperando sus endpoints para activarse.

## El camino priorizado (tu orden: 1 → 3 → 4 → 5, el Asistente al final)

### Balde 1 — Activar lo gated (liviano; bloqueante backend)

FE listo, es "destrabar cookie/endpoint + activar flag + smoke E2E". Orden por valor:

- **Dimensiones** (`managementDimensions`) — issue `qavante-api` #205.
- **SII** (`siiQueries`) — destraba C1 + cobrar/pagar/f29 de un saque (cookie en `/api/sii/*`).
- **Resultado/Cobrar/Pagar/Inicio** (`operationalResult`/`accountsReceivable`/`accountsPayable`/`dashboardSummary`) — se activan en cuanto exista cada endpoint.
- **Mi cuenta** (`miCuenta`), **Monedas** (`multiCurrency`), **Plantillas** (`industryTemplates`), **Inicio-MVP** (`inicioMvp`).
  > Esfuerzo FE: bajo. Bloqueante: backend.

### Balde 3 — Inicio Ejecutivo + Gestión (el corazón del producto)

- **Inicio (C8):** los 10 bloques **ya construidos** (#286), gated. **Bloqueante duro: `GET /api/dashboard/summary` no existe** (entrega incremental acordada — ver contrato).
- **Gestión (C5+C7):** resultado operacional **construido** (#283); drivers + Pulso dedicado pendientes. **Bloqueante: endpoints resultado/drivers/pulso.**
  > Esfuerzo FE restante: bajo-medio (queda activar + drivers/pulso dedicados). **El grueso es backend.**

### Balde 4 — Cobrar/Pagar de gestión (C4)

- Pantallas de gestión **ya construidas** (#284/#285): resumen + relación-vs-caja + tabla de documentos/obligaciones. **Bloqueante: endpoints AR/AP/aging/obligaciones.**
  > Esfuerzo FE restante: bajo (activar). Falta backend.

### Balde 5 — DoD de cierre (lo único 100% FE, sin backend)

Avance desde el 2026-06-01:

- ✅ **E2E de flujos reales** — hechos: `clasificar`, `cobrar`, `pagar`, `gestion`, `estructura-gestion` (antes solo routing/render).
- ⏳ **Login e2e real nunca corre** — smoke `test.skip` esperando secrets `SMOKE_RUT`/`SMOKE_PASSWORD` (acción tuya: setearlos en GitHub).
- ✅ **Lighthouse mide `/app/inicio`** — agregado a las URLs con perf ≥0.90 enforced (`assertMatrix`) — PR #290.
- ✅ **Gate de a11y automático** — LHCI a11y de `warn`→`error` ≥0.90 en todas las URLs — PR #290.
- ⏳ **Chromatic** — cableado (corre en CI), baselines visuales pendientes de aceptar a mano.
- ⏳ **Ledger de DoD por sprint** — ver `docs/dod-ledger.md` (nuevo).

### Balde 2 — Asistente (al final, como dijiste)

Stub hoy. Es Sprint C9 completo: drawer + chat + SSE + indicador de tool + sugerencias. **Bloqueante: `POST /api/assistant/chat` + 12 tools (backend).** Read-only en Fase 1.

## Mi recomendación de CTO

1. **Lo 100% FE (Balde 5 / DoD)** sigue siendo lo único que avanzo sin esperar a nadie: cerrar Lighthouse `/app/inicio`, gate de a11y, ledger.
2. **El camino crítico de Fase 1 es backend:** sin `dashboard/summary`, pulso, drivers, resultado, AR/AP → las pantallas (ya construidas) no se pueden **activar**. Esta es la conversación #1 con CC-A.
3. **El Asistente (Balde 2) último**, coincido.
4. **Reconciliar el Anexo E** (actualizar el Maestro a la estructura real).

---

_Fuentes: Documento Maestro v2.6.4 (Anexo E, Sec 7/11/13, Anexo G/I/K), auditoría del código `qavante-web` al 2026-06-02 (rutas, flags, tests, CI; PRs #282-#288). Generado por CC-WEB._
