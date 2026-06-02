# ADR-0016: Adoptar la estructura de rutas construida como canónica (supersede el Anexo E en rutas)

- **Status:** Accepted
- **Fecha:** 2026-06-02
- **Decididores:** Fernando + CC-WEB (rol CTO)
- **Tickets / PRs:** gap análisis [`docs/roadmap-fase1-gap.md`](../roadmap-fase1-gap.md), PRs #281-#291

## Contexto

El **Anexo E del Documento Maestro v2.6.4** define una estructura canónica de 39 rutas. El gap análisis FE (2026-06-01/02) detectó que la estructura **realmente construida y deployada** diverge del Anexo E de forma sistemática: no es deriva accidental, sino una evolución hacia rutas orientadas al flujo concreto del usuario (clasificar, proyección, facturas SII, editores de estructura) en vez de las rutas genéricas del Anexo E.

La divergencia ya está **LIVE en prod** (C0 + clasificación/tesorería + admin) o **construida y gated** (pantallas ejecutivas C4/C5/C8). Reorganizar las rutas para calzar con el Anexo E rompería URLs deployadas sin ganancia funcional, y violaría la regla de no-regresión de CLAUDE.md.

CLAUDE.md establece que **los ADR ganan sobre la interpretación del Documento Maestro**. Este ADR es el mecanismo correcto para formalizar la reconciliación sin editar el .docx (lo cual requiere aprobación explícita de Fernando, regla 2).

## Decisión

**La estructura de rutas construida es canónica. El Anexo E queda superado en su listado de rutas** (no en el resto: layout de `src/`, route group `(app)`, dominios siguen vigentes — ver [[ADR-0007]]).

Mapeo autoritativo Anexo E → real:

| Área               | Anexo E (target)                                                                                 | Real (canónico desde este ADR)                                                                                              | Estado                 |
| ------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Caja**           | `caja/movimientos`, `caja/conciliacion`, `caja/cuentas-bancarias`                                | `caja/por-clasificar`, `caja/clasificados`, `caja/proyeccion`                                                               | LIVE (parcial C3)      |
| **Cobrar**         | `cobrar/clientes`, `/documentos`, `/aging`, `/cliente/[rut]`                                     | `cobrar` (gestión, gated `accountsReceivable`), `cobrar/facturas-emitidas` (SII)                                            | gated / LIVE-gated SII |
| **Pagar**          | `pagar/proveedores`, `/documentos`, `/obligaciones`, `/proveedor/[rut]`                          | `pagar` (gestión, gated `accountsPayable`), `pagar/facturas-recibidas`, `pagar/honorarios-recibidos`, `pagar/impuestos/f29` | gated / LIVE-gated SII |
| **Gestión**        | `gestion/resultado-operacional`, `/pulso`, `/historico`                                          | `gestion` (resultado, gated `operationalResult`) — `pulso`/`historico` dedicadas aún no existen                             | gated                  |
| **Inicio**         | `inicio` (dashboard ejecutivo)                                                                   | `inicio` (gated `dashboardSummary`)                                                                                         | gated ✅ misma ruta    |
| **Administración** | `empresa`, `roles`, `fuentes`, `plan-cuentas`, `plazos-pago`, `auditoria`, `certificado-digital` | `usuarios`, `credenciales`, `estructura-gestion`, `vistas-gestion`, `monedas`, `plantillas`, `reglas-clasificacion`         | LIVE                   |
| **Cuenta**         | (no en Anexo E como tal)                                                                         | `mi-cuenta` (gated `miCuenta`)                                                                                              | gated                  |
| **Auth/público**   | `login`, recuperar                                                                               | `(auth)/login`, `/recuperar-clave`, `/aceptar-invitacion`, `/` (landing), `/playground`                                     | LIVE                   |

**Equivalencias semánticas** (el Anexo E pedía la capacidad, la construimos con otro nombre/desglose):

- Caja `movimientos`/`conciliacion` → flujo `por-clasificar` → `clasificados` (clasificación bancaria, §17). `cuentas-bancarias` vive hoy dentro de los editores de admin, no como ruta propia.
- Cobrar/Pagar `documentos` → vistas SII (`facturas-emitidas`/`recibidas`/`honorarios`/`f29`); `aging`/`obligaciones` → los bloques de las pantallas de gestión `cobrar`/`pagar` (gated).
- Admin `roles` → matriz de roles dentro de `usuarios`; `fuentes`/`certificado-digital` → `credenciales`; `plan-cuentas` → `estructura-gestion` + `vistas-gestion`.

## Alternativas consideradas

- **Opción A — reconciliar el código al Anexo E (descartada):** renombrar/reorganizar las rutas del FE para calzar con el doc. Alto costo, rompe URLs ya deployadas en prod, sin ganancia funcional. Viola no-regresión.
- **Opción B — dejar la divergencia sin formalizar (descartada):** mantiene la contradicción doc-vs-realidad latente; cualquier lectura futura del Anexo E induce a error.
- **Opción C — ADR adopta lo real + Anexo E superado en rutas (elegida):** cero refactor, formaliza la realidad coherente, deja registro autoritativo. El .docx se actualiza cuando Fernando lo decida; mientras tanto este ADR es la fuente de verdad de rutas.

## Consecuencias

### Positivas

- Cero regresión. Lo deployado no se toca; las URLs en prod siguen válidas.
- Fuente de verdad inequívoca para rutas (este ADR), sin esperar a editar el Maestro.
- El gap doc y el ledger de DoD quedan alineados con un ADR que los respalda.

### Negativas / tradeoffs aceptados

- El Documento Maestro (Anexo E) queda temporalmente desincronizado de la realidad hasta que Fernando lo actualice. Mitigado: este ADR es autoritativo por CLAUDE.md.
- Algunas capacidades del Anexo E aún no tienen ruta dedicada (`gestion/pulso`, `gestion/historico`, `caja/cuentas-bancarias` como ruta) — quedan como trabajo futuro, no como deuda de reconciliación.

### Acciones que destraba o requiere

- [ ] Fernando actualiza el Anexo E del Maestro a esta tabla cuando tenga el .docx a mano (opcional; este ADR ya es canónico).
- [ ] Toda ruta nueva sigue la convención de flujo de este ADR, no el listado del Anexo E.
- [ ] Si se construyen `gestion/pulso` / `gestion/historico` dedicadas (C6/C7), se agregan como rutas nuevas — no requieren superseder este ADR.

## Referencias

- [Gap análisis FE → Fase 1](../roadmap-fase1-gap.md)
- [Ledger de DoD por sprint](../dod-ledger.md)
- Documento Maestro v2.6.4 — Anexo E (estructura de rutas), superado en rutas por este ADR
- [[0007-estructura-carpetas-dominios-addendum]] (layout de `src/`, sigue vigente)
- [[0008-feature-flags-gating-pantallas-sin-backend]] (las pantallas gated)
- CLAUDE.md — regla 2 (no editar Maestro sin OK), regla de no-regresión, "ADR gana sobre interpretación del doc"
