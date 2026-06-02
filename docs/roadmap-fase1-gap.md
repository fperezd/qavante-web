# Roadmap a Fase 1 — gap análisis (FE)

> **CC-WEB → Fernando. 2026-06-01.** Cruce del Documento Maestro v2.6.4 (Anexo E rutas + Sec 11 sprints C0-C9 + Sec 7 pantallas + Sec 13 DoD) contra lo **realmente construido** en `qavante-web`. Es el "camino al término" priorizado.

## TL;DR (la verdad sin maquillar)

El FE construyó un **slice sólido y profundo** (clasificación bancaria + editores de estructura/dimensiones + vistas SII + admin), pero **el producto ejecutivo que ES Qavante todavía no está**: el **Inicio Ejecutivo** (Pulso, caja hoy/proyectada, brecha, 3 acciones), **Gestión** (resultado operacional, drivers), **Cobrar/Pagar de gestión** (aging, top deudores, obligaciones) y el **Asistente** están **placeholder o sin construir**. Y lo crítico: **casi todo eso está bloqueado por endpoints de backend que no existen** (`/api/dashboard/summary`, pulso, drivers, resultado operacional).

**Conclusión:** Fase 1 NO está cerca de cerrarse, y **el camino crítico corre por el backend**, no por más código FE. El FE puede: (a) activar lo gated, (b) endurecer el DoD, (c) construir las pantallas ejecutivas **a medida que el backend exponga los endpoints**, (d) el Asistente al final.

## ⚠️ Divergencia de rutas — reconciliar (decisión tuya)

El Anexo E especifica una estructura de rutas **distinta a la construida**. No es menor:

| Anexo E (target) | Construido (real) |
|---|---|
| `caja/movimientos`, `caja/conciliacion`, `caja/cuentas-bancarias` | `caja/por-clasificar`, `caja/clasificados` |
| `cobrar/clientes`, `cobrar/documentos`, `cobrar/aging`, `cobrar/cliente/[rut]` | `cobrar/facturas-emitidas` (SII) |
| `pagar/proveedores`, `pagar/documentos`, `pagar/obligaciones`, `pagar/proveedor/[rut]` | `pagar/facturas-recibidas`, `pagar/honorarios-recibidos`, `pagar/impuestos/f29` (SII) |
| `gestion/resultado-operacional`, `gestion/pulso`, `gestion/historico` | `gestion` (placeholder) |
| `administracion/empresa`, `/roles`, `/fuentes`, `/plan-cuentas`, `/plazos-pago`, `/auditoria`, `/certificado-digital` | `estructura-gestion`, `vistas-gestion`, `monedas`, `plantillas`, `reglas-clasificacion` |

El equipo evolucionó la estructura (las vistas SII + editores no estaban tal cual en el Anexo E). **Decisión a tomar:** ¿actualizamos el Anexo E del Maestro a la realidad construida, o reconciliamos las rutas? Lo recomendado: **actualizar el doc** (la realidad construida es coherente), pero es tu llamada de producto.

## Estado por sprint (C0-C9 = Fase 1; no hay sprint Fase 2)

| Sprint | Qué es | Estado real | Dependencia backend |
|---|---|---|---|
| **C0** Base SaaS | shell, login, sidebar, DS, cliente API | ✅ **LIVE** | — |
| **C1** Fuentes (F29/Previred) | mostrar fuentes + afecto en confianza | 🟡 **parcial/gated** — vistas SII construidas, gated por `siiQueries` (OFF). "Fuentes" como pantalla no existe | cookie en `/api/sii/*` + flujo credenciales |
| **C2** Modelo gestión + clasificación | clasificar movimientos | ✅ **LIVE** (por-clasificar/clasificados/reglas) + editores de estructura/dimensiones | accounts ✅; dimensions ⛔ (issue #205) |
| **C3** Caja 13 semanas | flujo proyectado | 🟡 **parcial** — `caja/proyeccion` (CashFlowView) LIVE, pero falta el resto de la pantalla "Caja" (caja disponible por cuenta, brecha, cobros/pagos esperados, supuestos, alertas) | reporte cash-flow ✅; el resto = endpoints nuevos |
| **C4** Cobrar y Pagar | aging, top deudores, obligaciones, CTAs | 🔴 **placeholder** — solo vistas SII de documentos (facturas/honorarios), NO las pantallas de gestión C4 | endpoints de AR/AP, aging, obligaciones |
| **C5** Resultado Operacional | gana/pierde, margen, EBITDA proxy | 🔴 **placeholder** ("Sprint C5") | endpoint resultado operacional |
| **C6** Drivers + acciones | "por qué pasa" + "qué hacer primero" | 🔴 **sin construir** | endpoint drivers/next-best-actions |
| **C7** Pulso Empresa | índice de salud | 🔴 **sin construir** | endpoint pulso |
| **C8** Inicio Ejecutivo | la pantalla principal (10 bloques) | 🔴 **placeholder** — `inicio` solo tiene un MVP de perfil (nombre/email/last-login), NO el dashboard | `GET /api/dashboard/summary` (no existe) |
| **C9** Asistente | chat con tools | 🔴 **stub** — solo un botón flotante sin onClick, sin chat, sin `/api/assistant/chat` | `POST /api/assistant/chat` + 12 tools |

**Lo que está LIVE hoy en prod:** C0 + el slice de clasificación/tesorería (C2 + parte de C3) + editor de cuentas + admin (usuarios/credenciales). **El resto está gated o sin construir.**

## El camino priorizado (tu orden: 1 → 3 → 4 → 5, el Asistente al final)

### Balde 1 — Activar lo gated (liviano; gated en backend)
FE listo, es "destrabar cookie + activar flag + smoke E2E". Orden por valor:
- **Dimensiones** (`managementDimensions`) — issue `qavante-api` #205.
- **SII** (`siiQueries`) — destraba C1 + cobrar/pagar/f29 de un saque (cookie en `/api/sii/*`).
- **Mi cuenta** (`miCuenta`) — solo-lectura ya; edición espera `PATCH /api/me`.
- **Monedas** (`multiCurrency`), **Plantillas** (`industryTemplates`), **Inicio-MVP** (`inicioMvp`).
> Esfuerzo FE: bajo. Bloqueante: backend.

### Balde 3 — Inicio Ejecutivo + Gestión (el corazón del producto)
- **Inicio (C8):** los 10 bloques (Pulso, caja hoy/proyectada, brecha, cobranza vencida, pagos críticos, resultado, 3 acciones). **Bloqueante duro: `GET /api/dashboard/summary` no existe.**
- **Gestión (C5+C7):** resultado operacional + drivers + Pulso. **Bloqueante: endpoints resultado/drivers/pulso.**
> Esfuerzo FE: alto. **Es el mayor pedazo de producto y el más backend-dependiente.** Tu nota "primero asegurar funcionalidad + datos" aplica de lleno acá: sin esos endpoints no se puede.

### Balde 4 — Cobrar/Pagar de gestión (C4)
- Más allá de las vistas SII: resumen + **aging** + top deudores (cobrar); resumen + pagos críticos + **obligaciones** consolidadas + relación-vs-caja (pagar).
> Esfuerzo FE: medio-alto. Bloqueante: endpoints AR/AP/aging/obligaciones.

### Balde 5 — DoD de cierre (lo único 100% FE, sin backend)
Esto **sí lo puedo avanzar ya, sin depender de nadie**:
- **E2E de flujos reales** (el gap más grande): hoy los e2e solo prueban routing/render, **cero flujo de usuario**. Faltan: login-submit, clasificar un movimiento, CRUD de estructura/dimensión. El harness ya existe (`protected-routes.mobile.spec.ts` inyecta cookie + MSW) — solo falta manejar formularios.
- **Login e2e real nunca corre** — el smoke está `test.skip` esperando secrets `SMOKE_RUT`/`SMOKE_PASSWORD` (acción tuya: setearlos en GitHub).
- **Lighthouse no mide `/app/inicio`** (mide `/credenciales` en su lugar); el target ≥90 del DoD no se enforcea. Arreglar `.lighthouserc.json`.
- **Sin gate de a11y automático** (addon-a11y en `todo`, LHCI a11y warn-only). Activar al menos uno.
- **Chromatic sin cablear** (token unset).
- **Sin ledger de DoD por sprint** — hay 13 reviews de ciclo (K.4) pero ningún tracking formal "Sprint Cx: aceptado".

### Balde 2 — Asistente (al final, como dijiste)
Stub hoy. Es Sprint C9 completo: drawer + chat + SSE + indicador de tool + sugerencias. **Bloqueante: `POST /api/assistant/chat` + 12 tools (backend).** Read-only en Fase 1 (sin write tools).

## Mi recomendación de CTO

1. **Lo que puedo hacer YA sin backend = Balde 5 (DoD)** + activar lo que CC-A vaya destrabando (Balde 1). Empezaría por los **e2e de flujos reales** — es el mayor agujero de calidad y no depende de nadie.
2. **El camino crítico de Fase 1 es backend:** sin `dashboard/summary`, pulso, drivers, resultado, AR/AP → los Baldes 3 y 4 (el producto ejecutivo) no se pueden construir. **Esto debería ser la conversación #1 con CC-A**, más allá del issue #205 (que es solo dimensiones).
3. **El Asistente (Balde 2) último**, coincido — primero que los datos y pantallas estén sólidos.
4. **Reconciliar el Anexo E** (actualizar el Maestro a la estructura real).

**Lo más útil que arranco ahora, en orden, sin esperar a nadie:** (a) e2e de los flujos reales que ya están LIVE (clasificar, editar estructura), (b) arreglar el Lighthouse del DoD, (c) activar dimensiones apenas CC-A destrabe. ¿Le doy por ahí?

---

_Fuentes: Documento Maestro v2.6.4 (Anexo E, Sec 7/11/13, Anexo G/I/K), auditoría del código `qavante-web` al 2026-06-01 (rutas, flags, tests, CI). Generado por CC-WEB._
