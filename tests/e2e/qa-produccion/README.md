# Gate de aceptación de Qavante (solo lectura)

Dos cosas viven acá, y conviene no confundirlas:

1. **Las doce invariantes** (`invariantes.spec.ts`) — el gate que pidió el dueño del producto. Son
   las doce afirmaciones que tienen que ser ciertas para que las pantallas no se contradigan.
2. **Los hallazgos B01–B28** (`inicio|caja|banco|bandeja|decisiones|seguridad|accesibilidad.spec.ts`)
   — un caso por hallazgo del informe QA del 05-10-2026. Es el detalle; las invariantes son el gate.

## La doble vida

El gate corre en dos vidas, y cada una prueba algo distinto. Confundirlas es cómo un gate se vuelve
verde sin medir.

| Vida                            | Config                                      | Qué prueba                                                                                                                                                                    | Puede fallar                              |
| ------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **CI, contra MSW, sin sesión**  | project `qa-gate` de `playwright.config.ts` | el INSTRUMENTO: `gemelos.spec.ts` (cada invariante se pone rojo con una cifra sembrada distinta) y `lectores.spec.ts` (cada lector encuentra su cifra en la pantalla montada) | no: tiene que quedar verde y determinista |
| **Producción, con sesión real** | `playwright.qa-produccion.config.ts`        | la VERDAD del tenant: los doce invariantes aplicados a las cifras vivas                                                                                                       | sí, y debe poder                          |

`invariantes.spec.ts` **no** corre en CI a propósito: compara superficies contra la verdad de un
tenant, y los fixtures de MSW no son ese tenant. Lo que sí corre en CI es la prueba de que esos
mismos comparadores funcionan y de que los lectores encuentran lo que van a comparar.

## Cómo se niega a concluir

Esto es el corazón del gate, y existe por un antecedente: la noche del 05-10-2026 se encontraron
ocho instrumentos en verde que medían otra cosa, y uno era un barrido que concluía «todas verdes»
recorriendo una lista vacía. Las tres reglas, implementadas en `support/medicion.ts`:

- **Una moneda que no se declaró no se rellena con pesos.** `formatMoney` rinde el monto sin código
  ISO como «1.234,50 · moneda no informada»; el lector conserva esa ausencia y cualquier comparación
  contra una cifra en CLP devuelve `divergen`. La suposición contraria —`currency || "CLP"`— es la
  que mostraba dólares con signo de peso y sin decimales, y a ~950 pesos por dólar equivoca la cifra
  por casi mil veces.
- **Una cifra que no se encontró no es un cero.** Los lectores (`support/superficies.ts`) devuelven
  `noMedible` con el motivo cuando la tarjeta no está, cuando la pantalla no cargó, cuando la ruta
  devolvió 404 o cuando donde debería haber un número el producto dice «sin dato», «Sin información»
  o «s/d». Un `$0` de verdad **sí** se mide como cero: faltante y cero son cosas distintas.
- **Tres estados, no dos.** Un invariante devuelve `coinciden`, `divergen` o `no-medible`, y
  `afirmar` hace FALLAR los dos últimos con mensajes distintos. No hay `test.skip` por una cifra que
  falta: un salto se ve verde en el reporte.
- **Nada se concluye sobre una lista vacía.** `mismaCifra` con menos fuentes que las esperadas, y
  `sinCasos` con universo cero, devuelven `no-medible`. Si no hubo propuestas con RUT que examinar,
  el invariante 7 no dice que la identidad esté sana: dice que no pudo medir.

Y el inventario se audita: `INV-00` exige que sean exactamente doce, numeradas 01–12, cada una con
al menos dos superficies, y que toda superficie excluida contra MSW traiga su motivo escrito. Un
gate que adelgaza en silencio se cae ahí.

## Las doce invariantes

| ID     | Enunciado                                                                     | Dónde se mide                                                                                              |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| INV-01 | Caja hoy: `Inicio == Caja == Banco == API`                                    | `/inicio` (Saldo bancario), `/caja` (KPI «Hoy»), `/banco` (KPI «Caja hoy»), `dashboard/summary.cash_today` |
| INV-02 | Por cobrar: `Caja == Cobrar == API`                                           | `/caja` (KPI «Entra · 14 días»), `/cobrar` (tarjeta «Por cobrar»), `accounts-receivable.total`             |
| INV-03 | Por pagar: `Caja == Pagar == API`                                             | `/caja` (KPI «Sale · 14 días»), `/pagar` (KPI «Por pagar»), `accounts-payable.due_14d`                     |
| INV-04 | Pendientes: `Caja == Bandeja == work-inbox`                                   | aviso `role="note"` de `/caja`, `<h1>` de `/bandeja`, suma de colas de `work-inbox`                        |
| INV-05 | Moneda: nunca sumar CLP + USD en un mismo KPI                                 | línea «Saldo contable según el banco, por moneda» de `/banco`, `accounts-payable.total_by_currency`        |
| INV-06 | Sociedad: una sociedad vacía muestra $0 propio, nunca datos de otra           | `/caja` con una sociedad sin cuentas activa, contra el saldo de cada otra sociedad                         |
| INV-07 | Identidad: un RUT contradictorio nunca produce una sugerencia de conciliación | `reconciliation/review`: RUT de la glosa contra RUT del documento propuesto                                |
| INV-08 | Fechas: el día de negocio es `America/Santiago`, no UTC                       | `bank-movements` contra el día civil chileno, y la última sincronización de `sources/status`               |
| INV-09 | Payroll: obligación / pago / asignación consistentes                          | `buk/payroll?period=` y `payroll-settlements/{YYYYMM}`                                                     |
| INV-10 | F29: declarado / pago / residual consistentes                                 | `sii/f29/impuesto` (declarado) y `sii/f29/giros` (pagado + pendiente)                                      |
| INV-11 | D08: el mismo UUID de contraparte en todas las superficies                    | `counterparty_key` de `accounts-receivable/documents` y de `accounts-payable`                              |
| INV-12 | PULSO y QHS no contradicen a Caja                                             | `cash_gap.has_gap`, el titular de `/alertas` y `/gestion/salud`                                            |

### Lo que los invariantes encuentran hoy en producción

Medido el 06-10-2026, en solo lectura. Los invariantes nacen **rojos por la razón correcta**:

- **INV-02** — 185 cuentas por cobrar vivas por $364.846.883 y **ninguna con `due_date`**: la
  ventana de 14 días recoge $0 mientras el total sigue arriba.
- **INV-01 / INV-06** — 3 cuentas bancarias con `legal_entity_id = NULL`, una CLP con saldo
  −5.709.111, frente a las 2 cuentas CLP de Tooxs que suman 6.326.119: el total de caja cambia
  según se incluyan o no las cuentas sin sociedad. La sociedad «Empresa razón social 2»
  (`77c2808e-5fbc-4abd-9b5b-3a6d60e2838f`) no tiene cuentas: es la que hace observable INV-06.
- **INV-11** — `treasury.receivables` 495 filas y `payables` 765, **cero con `counterparty_key`**;
  `counterparty_capabilities` vacía. El invariante no puede concluir, y lo dice.
- **INV-12** — `/gestion/salud` (QHS) es hoy una pantalla estática en construcción que no consulta
  ninguna API: no publica veredicto, así que el brazo de QHS es `no-medible`. El brazo de PULSO sí
  se mide.
- **INV-05** — hay moneda mezclada de verdad (227 abonos y 538 cargos CLP; 21 abonos y 22 cargos
  USD), así que el invariante es verificable y no un barrido sobre nada.

## Casos que requieren autorización de escritura

`POST /api/treasury/cash-projection-runs` está **bloqueado por omisión**. Es un cálculo idempotente,
con `Idempotency-Key` y sin efectos de negocio, que la propia app dispara al abrir Caja, Pagar y
Decisiones — y eso es un buen argumento, no una autorización. Una suite que corre sola contra
producción no decide por su cuenta escribir en producción.

Sin `QAVANTE_QA_AUTORIZA_PROYECCION=1`, **B01** y **B19** se saltan con el motivo nombrado
(`SIN_AUTORIZACION_DE_ESCRITURA`), nunca se dan por buenos. Importa que se salten en vez de correr:
bloquear el POST fabrica el mismo 503 que B01 mide, así que un caso que corriera con el POST
bloqueado afirmaría el hallazgo por una razón que no es la real.

Los invariantes 1 a 12 **no** necesitan esa autorización: ninguno lee la proyección canónica.

## Cómo correr

```bash
export QAVANTE_SESSION="<valor de la cookie qavante_session>"   # obligatoria; nunca se commitea
# Opcionales:
# export QAVANTE_APP="https://app.qavante.com"  QAVANTE_API="https://api.qavante.com"
# export QAVANTE_LEGAL_ENTITY_ID="<sociedad a revisar>"   # si no, la marcada por defecto
# export QAVANTE_SESSION_READONLY="<cookie de un usuario viewer/accountant>"
# export QAVANTE_FOREIGN_LEGAL_ENTITY_ID="<sociedad de otro tenant>"  QAVANTE_FOREIGN_TENANT_ID="<otro tenant>"
# export QAVANTE_QA_AUTORIZA_PROYECCION=1   # SOLO con autorización del dueño: habilita el POST de la proyección (sin ella, B01/B19 se saltan con motivo)
npm run test:e2e:qa-prod
npx playwright test --config=playwright.real.config.ts   # invariantes cruzados por API (INV-*)
```

Sin `QAVANTE_SESSION` todos los tests quedan `skipped`.

## Solo lectura

- La guardia (`support/fixtures.ts`) aborta toda request no-GET a la app o a la API y **hace fallar
  el test** (incluye Server Actions de Next y `/api/auth/refresh`: si aparece, la cookie expiró).
- Única excepción posible, y **apagada por omisión**: `POST /api/treasury/cash-projection-runs` con
  sólo `horizon_days`, `legal_entity_id`, `currency` y `as_of`. Se habilita con
  `QAVANTE_QA_AUTORIZA_PROYECCION=1` y nada más la habilita. Ver «Casos que requieren autorización
  de escritura».
- Los tests nunca pulsan Confirmar, Conciliar, Clasificar, Guardar, "No es esta" ni "Actualizar
  cuentas", ni usan atajos de teclado. Sólo abren paneles (Buscar el documento, Reclasificar) para
  leer opciones.
- B25 simula el 500 de `bank-accounts` en el navegador (`page.route`); el backend no se toca.

## Evidencia

`test-results/qa-produccion/<ID>/` (ignorado por git), además de adjuntarse al reporte:

- `pagina.png`: screenshot de página completa al terminar el test.
- `api.json`: cada llamada `/api` (método, url, status, headers sin cookies, body truncado a
  ~200 KB), las notas del test y las escrituras bloqueadas. La sesión se redacta.
- `axe.json` / `axe-clasificar.json` en los tests de accesibilidad.
- `test-results/qa-produccion/resultado.json`: resumen del run.

## Mapa de hallazgos

| ID  | Archivo                 | Qué afirma                                                                                                 |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| B01 | `inicio.spec.ts`        | POST cash-projection-runs < 400 en /inicio, /caja y /decisiones                                            |
| B02 | `caja.spec.ts`          | `cash_today` no nulo e igual al saldo CLP de bank-accounts; Caja y Banco sin "sin dato · conecta tu banco" |
| B03 | `bandeja.spec.ts`       | Ninguna propuesta de conciliación con un RUT de documento distinto al RUT de la glosa                      |
| B04 | `bandeja.spec.ts`       | Una tarjeta de un movimiento USD muestra `US$` con decimales, no `$` redondeado                            |
| B05 | `bandeja.spec.ts`       | Clasificar no trae movimientos de cuentas inactivas ni la misma operación en dos cuentas                   |
| B06 | `bandeja.spec.ts`       | Ningún movimiento en Conciliar y Clasificar a la vez (ni repetido entre colas del work-inbox)              |
| B07 | `bandeja.spec.ts`       | Ningún calce exacto (RUT de glosa = RUT del documento, monto al peso) en revisión                          |
| B08 | `bandeja.spec.ts`       | No hay pagos parciales separados contra un documento cuya suma lo calza                                    |
| B09 | `caja.spec.ts`          | "Entra 14 días" no muestra $0 con saldo por cobrar; no descarta buckets que cruzan el día 14               |
| B10 | `caja.spec.ts`          | Críticos a 14 días ≤ total a 14 días (API y pantalla)                                                      |
| B11 | `caja.spec.ts`          | Pendientes de Caja = pendientes de Bandeja; el aviso informa salidas y período                             |
| B12 | `bandeja.spec.ts`       | La tarjeta de un cargo no dice "Entró" ni "por cobrar"                                                     |
| B13 | `bandeja.spec.ts`       | Sin candidato: no cita saldos, no promete Reintentar inexistente y ofrece buscador                         |
| B14 | `bandeja.spec.ts`       | Una sola referencia de días por tarjeta                                                                    |
| B15 | `bandeja.spec.ts`       | El total de Conciliar no suma entradas y salidas                                                           |
| B16 | `banco.spec.ts`         | Ningún movimiento, saldo o plan fechado después de hoy en Chile; nada "actualizada mañana"                 |
| B17 | `banco.spec.ts`         | "Últimos 3 meses" cubre ≥ 90 días corridos                                                                 |
| B18 | `banco.spec.ts`         | "Bancos conectados" enlaza dentro de /banco                                                                |
| B19 | `decisiones.spec.ts`    | Con el cálculo fallido (todos los horizontes): sin "mantenimiento" ni "Calculando período"                 |
| B20 | `caja.spec.ts`          | Clasificados no calcula KPI sobre una descarga parcial ni dice "Todo en orden" con pendientes              |
| B21 | `accesibilidad.spec.ts` | Selectores de Clasificar con etiqueta accesible; sin cuentas agrupadoras elegibles; con código             |
| B22 | `bandeja.spec.ts`       | Ningún `payroll_payment` en Clasificar                                                                     |
| B23 | `inicio.spec.ts`        | Ninguna fuente "ok" con credencial/sesión inutilizable, frescura vencida o sincronización > 35 días        |
| B24 | `banco.spec.ts`         | Sin voseo ni "sembrar sesión" en respuestas de la API ni jerga interna en la pantalla                      |
| B25 | `banco.spec.ts`         | Con 500 simulado en bank-accounts: sin "Conectar banco" y con el último saldo visible                      |
| B26 | `caja.spec.ts`          | Reclasificar un cargo no ofrece tipos de movimiento sólo de entrada                                        |
| B27 | `caja.spec.ts`          | Subtítulo coherente con el botón Reclasificar y botón sin cortar                                           |
| B28 | `banco.spec.ts`         | Nombres de cuenta únicos; Compras al extranjero ofrece subir la cartola si la pide                         |

Además: `A11Y-<página>` (axe WCAG 2 A/AA, falla por serious/critical) y `SEG-*` en
`seguridad.spec.ts`. Los doce invariantes del gate viven en `invariantes.spec.ts`
(`INV-01` … `INV-12`), con sus gemelos en `gemelos.spec.ts` y sus lectores en `lectores.spec.ts`.
Las comprobaciones por API de `data-consistency.real.spec.ts` siguen donde estaban y se solapan con
`INV-01` a `INV-04`; la diferencia es que ésas se SALTAN cuando falta una cifra y los invariantes
del gate FALLAN.

## Fixme y saltos

- `SEG-ROL-escritura-negada` es `test.fixme`: probar que una escritura se niega exige intentarla.
  Debe correr en staging o local con un usuario viewer (pasos en el test).
- Se saltan con motivo cuando faltan datos para observar el patrón: B04 (sin movimientos en moneda
  extranjera), B12/B13/B14 (sin cargos, sin candidatos o sin documentos en Conciliar), B15 (Conciliar
  no mezcla direcciones), B02 (bank-accounts sin saldo), B21 (sin pendientes), B25 (sin banco
  conectado), B26 (sin cargo visible en la primera página), los `SEG-*` opcionales sin su variable,
  y B01/B19 sin `QAVANTE_QA_AUTORIZA_PROYECCION=1` (requieren autorización de escritura).
- B25 depende de una falla simulada: verifica cómo degrada la pantalla, no el incidente original.
