# Modelo único de caja — decisión definitiva (RFC para ratificar con CC-API)

**Fecha:** 2026-07-31
**Autor:** CC-WEB, en rol de CFO
**Para:** Fernando (ratifica) · **CC-API** (dueño del motor; ya trabajando en `a/cash-projection-snapshot`)
**Reemplaza (cuando se ratifique):** la proyección propia del FE en Caja v3 (`caja-proyeccion-model`)

> No es un parche al medidor. Es la decisión de **una sola fuente de verdad de caja**. Se coordina
> con CC-API porque el motor vive donde están los datos (banco + SII), no en el frontend.

---

## 1. El problema (por qué "Pulso 85 · Sólida" y "Caja en riesgo" a la vez)

Hoy Qavante tiene **tres respuestas distintas** a "¿cuánta caja tengo y cuándo?", y se contradicen
en pantalla (Tooxs, 31-jul-2026):

| Fuente                         | Qué dice                                                          | Cómo lo calcula                                                     |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Backend `cash_forecast`        | **71 días** de caja; mínimo a 14/30 días = **$8,5M** (nunca baja) | Ingenuo: devuelve el saldo de hoy como mínimo (no modela el futuro) |
| Medidor Caja v3 (**frontend**) | **"En rojo en ~0 días", piso −$11,7M, CAJA EN RIESGO**            | Reproyecta en el FE desde los vencimientos del maestro (AR/AP)      |
| Pulso                          | **85 · Sólida**                                                   | Score de salud (backend)                                            |

Para un producto cuyo norte es **la confianza en la cifra**, tres cifras que se contradicen es el
peor pecado. El medidor es el que grita la falsa alarma, por dos defectos concretos:

1. **Reproyección en el frontend.** Caja v3 arma su _propia_ proyección (`proyeccionDeMovimientos`)
   que no coincide con la del backend ni con el Pulso. Dos motores = dos verdades.
2. **Amontona lo vencido en "hoy" y mide intradía.** Las obligaciones vencidas (proveedores +
   sueldos) se empujan a "hoy" y se procesan **una por una**: el saldo baja a −$11,7M _a mitad del
   día_ (pagaste antes de cobrar) aunque **el día cierre en positivo** ("punto más bajo en ~0 días,
   te recuperas en ~0 días" — ambos 0 ⇒ es un artefacto intradía, no un riesgo de runway).

Y un tercer defecto, de concepto (lo detectó Fernando):

3. **El "Flujo del período" condiciona el flujo a la clasificación.** Dice "no podemos mostrar tu
   entra/sale hasta clasificar" y **excluye $39,7M de entradas** solo porque no están clasificadas.
   Eso mezcla tres cosas que son distintas (ver §2).

---

## 2. Principios de CFO (la base de la decisión)

- **Una sola fuente de verdad de caja.** El medidor, los "días de caja", la cascada, el flujo y el
  Pulso leen del **mismo** modelo. Nunca dos proyecciones.
- **Caja = todos los movimientos del banco.** El flujo de caja (entra/sale) **no depende de
  clasificar ni de conciliar**. Son tres capas distintas:
  - **Movimiento bancario = flujo** (la plata entró/salió; es un hecho al sincronizar).
  - **Clasificar = categorizar para el EERR** (qué casillero del P&L). No decide si es entrada/salida.
  - **Conciliar = amarrar a un documento** (qué factura pagó). Tampoco.
    → El flujo **siempre** muestra el total; "sin clasificar" es un **bucket**, nunca un bloqueo.
- **Vencido ≠ runway.** Lo ya vencido y no pagado es un problema (te atrasaste), **no** el futuro de
  la caja. Se muestra aparte ("tienes $X vencido"), **no** se amontona en "hoy" hundiendo el piso.
- **El riesgo se mide al CIERRE del día**, no a mitad de día. Si el mismo día cobras y pagas, no
  estuviste "en rojo" — el orden intradía es arbitrario (no sabemos la hora).
- **Sin falsa precisión** (principio 5 del doc de producto): cada cifra dice de qué capa viene
  (REAL / ESPERADO / ESTIMADO) y qué tan fresca es.

---

## 3. La decisión definitiva

**CC-API es dueño de UNA proyección de caja** (la cascada de la Parte 1 del doc de producto:
REAL → ESPERADO → ESTIMADO, horizonte 13 semanas). El frontend **la consume; deja de reproyectar**.

### Contrato propuesto (para alinear con `a/cash-projection-snapshot`)

`GET /api/treasury/cash-projection` → un objeto autoritativo con:

- `saldo_hoy` — saldo bancario real (**todos** los movimientos, clasificados o no).
- `dias_de_caja` — el runway, **un solo número** (el mismo que usa el Pulso).
- `minimo` — caja mínima configurada.
- `serie[]` — por día (o semana) del horizonte: `{ fecha, saldo_cierre, capa }`. **Saldo al CIERRE
  del día**, ya neteado, con la capa (real/esperado/estimado).
- `punto_quiebre` — `{ fecha, saldo, causas[] }` o `null`. Primer día cuyo **saldo al cierre** cae
  bajo el mínimo, con las 3–5 causas por monto. `null` = no hay quiebre en el horizonte.
- `vencido` — `{ total, items[] }` **separado**: obligaciones ya vencidas no pagadas. NO entra en la
  serie forward.
- `generado_at` / `fuentes` — freshness por fuente.

### Flujo del período = todos los movimientos

`GET /api/treasury/reports/cash-flow` (u otro) debe **incluir todos los movimientos bancarios**;
lo no clasificado va en un bucket **`sin_clasificar`**. Nunca "no se puede mostrar hasta clasificar".

---

## 4. División del trabajo

**CC-API (dueño del motor — ya en `a/cash-projection-snapshot`):**

1. La proyección única (contrato §3): serie a cierre de día, punto de quiebre con causas, `vencido`
   separado, `dias_de_caja` consistente con el Pulso.
2. El reporte de flujo incluye lo `sin_clasificar` (no lo excluye).

**CC-WEB (adopta, no reproyecta):** 3. **Retira** `caja-proyeccion-model` (la reproyección propia) y consume `cash-projection`. El medidor,
los días de caja y la cascada salen del backend → una sola verdad, adiós falsa alarma intradía. 4. **"Vencido" como bloque propio** (no como cliff de "hoy"). 5. **Reformula el panel de flujo**: muestra el total real de entra/sale + el bucket "sin clasificar";
nunca "no podemos mostrar hasta clasificar".

## 5. Alternativas descartadas

- **Parchar el medidor del FE** (netear intradía en `proyeccionDeMovimientos`): tapa el síntoma pero
  deja dos motores que se seguirán contradiciendo. Fernando pidió explícitamente **algo definitivo,
  no un fix**.
- **Que el FE sume el flujo real del banco a mano**: reimplementa lógica de negocio que es del
  backend (regla: no lógica de negocio en el FE).

## 6. Migración

1. CC-API publica el contrato §3 (coordinar en `a/cash-projection-snapshot`).
2. CC-WEB adopta: `npm run generate:api`, cablea el medidor/cascada/flujo al nuevo contrato, retira la
   reproyección. Cada pantalla degrada honesto si falta una capa.
3. Se apaga la reproyección del FE en el mismo PR que enciende el consumo del backend (sin ventana de
   dos verdades).

---

_RFC de CC-WEB para ratificar con Fernando + CC-API. Al aceptarse, se promueve a ADR (numeración de
la secuencia compartida) y se referencia en STATE_OF_THE_TRAIN._
