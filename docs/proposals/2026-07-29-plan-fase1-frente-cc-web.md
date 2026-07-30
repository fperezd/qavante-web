# Plan de implementación Fase 1 — frente CC-WEB

**Fecha:** 2026-07-29
**Autor:** CC-WEB (sesión autónoma)
**Fuentes:** `qavante-agente-especificacion-v1.1.md` (Partes 1–4) + `qavante-diseno-tecnico-fase1-v0.2.md`
**Para:** Fernando (revisión) · coordinación con CC-API vía `STATE_OF_THE_TRAIN.md`

> Regla de encuadre de los dos docs: **Qavante está en producción.** La Fase 1 es un
> incremento sobre un producto operando, no un rediseño en blanco. Este plan solo cubre el
> **frente frontend (qavante-web)**; el modelo de datos, el matching, la capa MCP y WhatsApp
> son de CC-API. Cada ítem marca si está **listo para construir en FE** o **bloqueado en CC-API**.

---

## 1. Estado real hoy (levantado del código, 2026-07-29)

Lo que ya existe evita construir de cero. Resumen del mapeo:

| Pieza de la visión                                                             | Estado FE hoy                                                                                                                                                  | Archivo(s) clave                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Cascada de caja (Parte 1)**                                                  | Caja v3 LIVE: medidor de días de caja + cascada forward derivada de vencimientos (AR/AP maestros), horizonte 120d, punto de quiebre (días-a-mínimo/cero, piso) | `caja/v2/caja-proyeccion-*`, `caja-cascada-*`, `caja-medidor-*`           |
| Ciclo de caja (DSO/DPO/CCC)                                                    | LIVE tras esta sesión: vista dedicada en Gestión (#758)                                                                                                        | `gestion/v2/ciclo-caja-view.tsx`                                          |
| Márgenes / Costos / Tendencia / Comparativo                                    | LIVE (sub-menú Gestión)                                                                                                                                        | `gestion/v2/*`                                                            |
| **Bandeja de excepción (Parte 2.3)**                                           | La **cola de conciliación** ES la bandeja: auto-aplica ≥90, deja 60–90 a revisión 1-clic                                                                       | `caja/conciliacion/*`, flag `reconciliationReview` ON                     |
| Clasificación de movimientos (Parte 2.2)                                       | LIVE: por-clasificar + reglas + aplicar-reglas                                                                                                                 | `clasificacion/*`                                                         |
| Freshness / última sincronización (principio 5)                                | LIVE: indicador por-fuente en el header + sync manual                                                                                                          | `shell/sync-status-indicator.tsx`                                         |
| Confianza / capa de certeza (principio 5)                                      | LIVE pero **fragmentado**: `confidenceLabel`, `PartialDataBanner`, badges por dominio                                                                          | `inicio/dashboard-format.ts`, `treasury/sync-pending-state.tsx`           |
| Pulso                                                                          | LIVE: score + drivers ± con pesos + tendencia                                                                                                                  | `gestion/pulso-detail-view.tsx`                                           |
| **Asistente conversacional (Parte 2.4)**                                       | **OFF** + backend inexistente: hoy en prod se muestra un FAB stub decorativo                                                                                   | `assistant/*`, flag `assistant` OFF                                       |
| **Niveles de autonomía Observa/Sugiere/Ejecuta (Parte 2.1)**                   | **No existe** UI                                                                                                                                               | —                                                                         |
| **Motor de compensaciones** (traspasos internos / neteo / factoring / prepago) | **No existe** UI; endpoints solo como tipos, sin consumidor; la cola esconde los contadores de neteo a propósito                                               | `types.ts` (detect-internal-transfers, reconciliation/factoring, prepago) |
| WhatsApp (Parte 3)                                                             | Sin superficie FE (infra CC-API + proveedor)                                                                                                                   | —                                                                         |
| Financiamiento (Parte 4)                                                       | Sin superficie FE (estructura de datos, CC-API)                                                                                                                | —                                                                         |

**Conclusión:** la Parte 1 (cascada) y la Parte 2 (excepción + clasificación) ya tienen base sólida
en prod. El trabajo FE de la Fase 1 es **elevar la cascada a la visión de 3 capas + causas**,
**unificar la capa de certeza**, y **decidir el frente del agente** (asistente + autonomía visible).

---

## 2. Mapeo por parte del documento → frente CC-WEB

### Parte 1 — Cascada REAL → ESPERADO → ESTIMADO

Caja v3 ya proyecta forward desde vencimientos, pero como **una sola capa derivada**. La visión pide
tres capas con certeza decreciente explícita. Brechas FE:

- **B1.1 Capas de certeza en la cascada.** Rotular cada movimiento futuro como REAL (en banco) /
  ESPERADO (DTE + comportamiento de pago + calendario tributario) / ESTIMADO (fase 2). Hoy todo es
  `committed`. _Depende de CC-API_ para exponer la capa por ítem; el FE puede empezar por separar
  visualmente ESPERADO (DTE/impuestos) de lo derivado.
- **B1.2 Top 3–5 causas del quiebre.** El punto de quiebre existe pero no dice _por qué_. Rankear las
  causas por monto ("el F29 de $9,2M + el pago a X el mismo día"). **Construible en FE ahora** desde
  los movimientos que ya arma la cascada. → **ola 1**.
- **B1.3 Encuadre a 13 semanas.** Hoy 120 días sin rótulo de "13 semanas" (el estándar de gestión de
  crisis del doc). Ajuste de presentación. **FE ahora**. → **ola 1**.
- **B1.4 Fecha nominal vs. probable por comportamiento.** "vence 12/08, cobro probable 03/09 según
  historial". _Bloqueado_: `due_date NULL` + collection-forecast todo `sin_vencimiento` (ADR-0076 P0).

### Parte 2 — Agente por excepción

- **B2.1 Unificar la capa de certeza.** Un primitivo único (REAL/ESPERADO/ESTIMADO + confianza) que
  reemplace los tres actuales dispersos. **FE ahora**, bajo. → **ola 2**.
- **B2.2 Pulso que explica su movimiento.** Hoy explica su estado presente, no el "por qué bajó de 58
  a 33". _Depende de CC-API_ (delta con eventos causantes) — hoy solo hay drivers de estado.
- **B2.3 Asistente conversacional.** El FAB real existe pero gated OFF y **sin endpoint backend**
  (`/api/assistant/chat` es FE-first). _Bloqueado en CC-API_ (Parte 2.5 + capa MCP). Decisión de
  Fernando: ¿es prioridad Fase 1 o va con la sesión de Mirko?
- **B2.4 Niveles de autonomía visibles.** UI para ver/ajustar Observa–Sugiere–Ejecuta por tipo de
  tarea y el "ascenso ganado". _Depende de CC-API_ (`umbral_autonomia`). Sin backend no se construye
  un panel falso.

### Parte 3 — WhatsApp

Fuera del alcance FE salvo una futura **pantalla de vinculación** (código desde la app + estado).
Se estructura cuando CC-API tenga el proveedor. No es Fase 1 FE.

### Parte 4 — Financiamiento

Estructura de datos desde día 1 = CC-API. El primer frente FE es la **recomendación sin integración**
(Fase 2): en la alerta de quiebre, ofrecer "evaluar factoring / pronto pago" y medir intención. No
antes de que la cascada exponga la `necesidad_financiamiento`.

---

## 3. Plan priorizado (olas FE, un PR por ítem, e2e siempre)

**Ola 0 — control de gestión para el dueño (en curso, pedido directo de Fernando):**

1. ✅ Comparativo potente (#756) + fix $0 (#757)
2. ✅ Ciclo de caja (#758)
3. ⏳ Punto de equilibrio (`cost-classification` existe) — **construible ahora**
4. ⏳ Liquidez = elevar Caja v3 con **B1.2 top causas** + **B1.3 13 semanas** — **construible ahora**

**Ola 1 — cerrar la cascada (Parte 1), FE-only:**

- B1.2 causas del quiebre rankeadas (se solapa con ola 0 #4).
- B1.3 encuadre 13 semanas.
- Separación visual ESPERADO (DTE/impuestos) vs. derivado (preparación de B1.1).

**Ola 2 — honestidad y certeza (principio 5):**

- B2.1 primitivo único de capa de certeza.
- Higiene: comentarios stale de `reconciliationReview` (dicen OFF, está ON).

**Ola 3 — depende de CC-API (no se construye antes del contrato):**

- B1.1 capas por ítem · B1.4 fecha probable · B2.2 Pulso causal · B2.3 asistente · B2.4 autonomía.

### Motor de compensaciones — decisión de producto pendiente

No hay UI y el diseño actual **esconde** el neteo al dueño. Dos caminos, necesito tu intención:

- (a) mantenerlo invisible (el dueño ve el resultado conciliado limpio, sin ruido); o
- (b) darle una superficie ("detectamos 3 traspasos entre tus cuentas — no son ingresos") para
  transparentar por qué la cascada no los cuenta como venta.
  Recomendación: (b) acotado a **traspasos internos** (reduce ruido y explica), factoring/prepago
  quedan internos. No lo construyo hasta que lo confirmes.

---

## 4. Bloqueado en CC-API (asks consolidados al canal)

1. **Cascada — capa por ítem** (REAL/ESPERADO/ESTIMADO) para B1.1.
2. **`due_date` real en DTE** + collection-forecast con vencimientos (hoy todo `sin_vencimiento`,
   ADR-0076 P0) → habilita B1.4 y la precisión de la capa ESPERADO.
3. **Estado "pagado" por documento** vía conciliación → reemplaza la heurística de 7 días de gracia
   de Caja v3 (deuda declarada).
4. **TGR server-side** (api#758) — el FE ya degrada honesto; no enciende hasta que exista.
5. **Previred paid-state** — hoy solo monto+vencimiento+link.
6. **F22** — solo stub `unavailable`; conector es Fase 2.
7. **Endpoint del asistente** (`/api/assistant/chat`) + capa MCP (Parte 2.5) — B2.3.
8. **`umbral_autonomia`** expuesto — B2.4.
9. **Pulso: delta con causas** — B2.2.

---

## 5. Decisiones que necesito de Fernando

- **D1.** Motor de compensaciones: ¿invisible (a) o superficie de traspasos internos (b)?
- **D2.** Asistente conversacional: ¿prioridad Fase 1 o esperar la sesión con Mirko (capa MCP)?
- **D3.** Liquidez (#4 de la ola 0): ¿elevo Caja v3 en su lugar, o quieres además un resumen CFO de
  liquidez dentro de Gestión que enlace a Caja? (Recomiendo elevar Caja v3 y NO duplicar.)

---

_Documento de trabajo CC-WEB. Se actualiza a medida que CC-API destraba los asks de la sección 4._
