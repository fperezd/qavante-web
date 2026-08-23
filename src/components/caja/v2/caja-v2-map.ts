/* Mapper PURO del Caja v2 live (sin React): deriva la serie de la curva de saldo desde el
   saldo de hoy + los netos del reporte de caja, y la caja mínima (CLP) desde el endpoint
   cash-minimum. El backend aún NO manda running_balance/min_cash en el cash-flow (brecha
   abierta), así que el FE los deriva; cuando lleguen, se usan directo. Montos string-decimal
   → `parseAmount`. */

import { parseAmount } from "@/components/inicio/dashboard-format";
import { weekMondayFrom } from "@/components/caja/cash-flow-format";
import { formatMoney } from "@/lib/formatters/clp";
import { saldoAcumulado, type SaldoPunto } from "./caja-curva-model";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un período del cash-flow: `2026-07-14`→`14-jul`, `2026-07`→`jul`. */
export function labelBucketCorto(period: string): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(period);
  if (dm) return `${dm[3]}-${MESES[Number(dm[2]) - 1] ?? dm[2]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return MESES[Number(m[2]) - 1] ?? period;
  return period;
}

/** Serie de saldo proyectado = saldo de hoy + los netos por bucket, acumulados. El primer
 *  punto es "hoy" (saldo inicial); cada bucket mueve el saldo por su neto. */
export function serieDesdeCashFlow(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  label: (period: string) => string = labelBucketCorto,
): SaldoPunto[] {
  const netos = buckets.map((b) => parseAmount(b.net));
  const acum = saldoAcumulado(saldoHoy, netos);
  return [
    { label: "hoy", saldo: saldoHoy },
    ...buckets.map((b, i) => ({ label: label(b.period), saldo: acum[i] ?? saldoHoy })),
  ];
}

type CFGranularity = "week" | "month" | "day";

/** Fin (exclusivo) del bucket según la granularidad. `null` si el `period` no matchea el formato. */
function bucketFin(period: string, granularity: CFGranularity): Date | null {
  if (granularity === "week") {
    const m = weekMondayFrom(period);
    return m ? new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7) : null;
  }
  if (granularity === "month") {
    const mm = /^(\d{4})-(\d{2})$/.exec(period);
    return mm ? new Date(Number(mm[1]), Number(mm[2]), 1) : null; // 1° del mes siguiente
  }
  const dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  return dd ? new Date(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3]) + 1) : null;
}

/** ¿El bucket ya terminó ANTES de `now`? Se usa para proyectar SOLO desde hoy hacia adelante:
 *  un bucket cuyo período ya pasó no debe re-aplicarse al saldo de hoy (ese flujo ya está dentro
 *  del saldo → doble conteo). No parseable → false (no lo descartamos). */
export function bucketPasado(period: string, granularity: CFGranularity, now: Date): boolean {
  const fin = bucketFin(period, granularity);
  return fin != null && fin <= now;
}

/** Inicio (inclusivo) del bucket según la granularidad. `null` si el `period` no matchea el formato. */
function bucketInicio(period: string, granularity: CFGranularity): Date | null {
  if (granularity === "week") return weekMondayFrom(period);
  if (granularity === "month") {
    const mm = /^(\d{4})-(\d{2})$/.exec(period);
    return mm ? new Date(Number(mm[1]), Number(mm[2]) - 1, 1) : null;
  }
  const dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  return dd ? new Date(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3])) : null;
}

/** ¿El bucket ya EMPEZÓ (su inicio es <= `now`)? El bucket EN CURSO (empezó pero no terminó) da true.
 *  Se usa para ANCLAR la serie en el saldo de hoy sin doble contar el tramo ya transcurrido: el saldo
 *  de hoy YA incluye lo que va del bucket en curso, así que el ancla es ese bucket (no el último ya
 *  cerrado). No parseable → false. */
export function bucketEmpezado(period: string, granularity: CFGranularity, now: Date): boolean {
  const inicio = bucketInicio(period, granularity);
  return inicio != null && inicio <= now;
}

/** Filtra los buckets del reporte a los que NO terminaron antes de hoy: la proyección arranca
 *  DESDE HOY, no desde el inicio del período. Evita el doble conteo de buckets pasados. */
export function bucketsDesdeHoy(
  buckets: CashFlowBucket[],
  granularity: CFGranularity = "week",
  now: Date = new Date(),
): CashFlowBucket[] {
  return buckets.filter((b) => !bucketPasado(b.period, granularity, now));
}

/** Suma entra/sale/neto de una lista de buckets — para recomputar el flujo del período tras
 *  filtrar a futuro (el `grand_total` del backend suma TODOS los buckets, incluidos los pasados). */
export function flujoDeBuckets(buckets: CashFlowBucket[]): {
  entra: number;
  sale: number;
  neto: number;
} {
  let entra = 0;
  let sale = 0;
  let neto = 0;
  for (const b of buckets) {
    entra += parseAmount(b.total_inflow);
    sale += parseAmount(b.total_outflow);
    neto += parseAmount(b.net);
  }
  return { entra, sale, neto };
}

/** Serie del saldo ANCLADA en el saldo de hoy, sobre TODOS los buckets del rango. Reconstruye el
 *  saldo al cierre de cada período. El ANCLA es el bucket EN CURSO (el que contiene hoy): el saldo de
 *  hoy YA incluye lo que va de ese bucket, así que su punto ES el saldo de hoy — NO se le vuelve a
 *  sumar el neto del período en curso (eso duplicaba el tramo ya transcurrido, #735). Los períodos
 *  anteriores se reconstruyen hacia atrás y los futuros se proyectan hacia adelante. Un punto por
 *  bucket (cierre del período). */
export function serieAnclada(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  granularity: CFGranularity,
  now: Date,
  label: (period: string) => string,
): SaldoPunto[] {
  if (buckets.length === 0) return [];
  // Cumulativo de netos desde el inicio del rango.
  const cum: number[] = [];
  let acc = 0;
  for (const b of buckets) {
    acc += parseAmount(b.net);
    cum.push(acc);
  }
  // Ancla = último bucket que YA EMPEZÓ (el EN CURSO, que contiene hoy; o el último cerrado si el rango
  // no llega a hoy). Su cumulativo mapea al saldo de hoy → el bucket en curso cierra en el saldo de hoy
  // (no en saldo+neto), sin doble contar el tramo transcurrido (#735). Si todos son futuros (-1), el
  // ancla es 0 → todo se proyecta desde el saldo de hoy.
  let anchor = -1;
  buckets.forEach((b, i) => {
    if (bucketEmpezado(b.period, granularity, now)) anchor = i;
  });
  const base = anchor >= 0 ? (cum[anchor] ?? 0) : 0;
  const offset = saldoHoy - base;
  return buckets.map((b, i) => ({ label: label(b.period), saldo: (cum[i] ?? 0) + offset }));
}

/** Índice del primer período NO pasado cuyo saldo cae ESTRICTAMENTE bajo el mínimo — el cruce
 *  ACCIONABLE. La serie anclada reconstruye períodos pasados; un dip reconstruido en una semana
 *  que ya terminó NO es un cruce a advertir ("adelanta una cobranza" no aplica al pasado). Solo
 *  cuenta de hoy en adelante. `null` si no hay mínimo o no hay cruce futuro. */
export function primerCruceFuturo(
  serie: SaldoPunto[],
  buckets: CashFlowBucket[],
  granularity: CFGranularity,
  now: Date,
  minimo: number | null,
): number | null {
  if (minimo == null) return null;
  for (let i = 0; i < serie.length; i++) {
    const b = buckets[i];
    if (b && bucketPasado(b.period, granularity, now)) continue; // ignora los períodos ya pasados
    if ((serie[i]?.saldo ?? Number.POSITIVE_INFINITY) < minimo) return i;
  }
  return null;
}

/** Caja mínima en CLP desde el endpoint cash-minimum, o `null` si no hay umbral CLP. */
export function cajaMinimoCLP(cm: CashMinimumResponse | undefined): number | null {
  const t = (cm?.thresholds ?? []).find((x) => (x.currency_code ?? "").toUpperCase() === "CLP");
  return t ? parseAmount(t.amount) : null;
}

/* ── Completitud del flujo del período (INV-FX-001) ─────────────────────────────────────── */

/** Porción de ingreso sin clasificar a partir de la cual el flujo "committed" miente por omisión. */
export const UMBRAL_SIN_CLASIFICAR = 0.2;

/** Valor de mercado OBSERVADO (2026-08) de una unidad de cada moneda, en pesos. **No se usa para
 *  convertir nada**: es la base documentada de la cota de más abajo, y está acá para que el techo
 *  sea auditable (se ve de dónde sale y cuánto margen tiene) en vez de ser un número mágico.
 *
 *  Las CLAVES no son una lista inventada: son exactamente las monedas `fiat` del catálogo real
 *  `core.currencies` menos CLP (qavante-api
 *  `api/app/platform/db/migrations/0026_multicurrency_base.sql:47-56`, espejado en
 *  `api/app/core/core_currency.py:29-38`). CLP no va porque su porción se compara exacta, sin
 *  cota. `UF` (`currency_type = 'indexed_unit'`) queda FUERA a propósito: ver abajo. */
export const REFERENCIA_CLP_POR_UNIDAD: Readonly<Record<string, number>> = Object.freeze({
  USD: 950,
  EUR: 1_030,
  PEN: 255,
  BRL: 165,
  MXN: 47,
  COP: 0.23,
});

/** Margen del techo sobre la referencia observada. 60% = el peso tendría que devaluarse un 60%
 *  contra esa moneda para que el techo dejara de ser cota (el máximo histórico del USD/CLP,
 *  ~1.060 en 2022, está 12% sobre la referencia de hoy, o sea el margen cubre ese escenario y
 *  bastante más). Es el parámetro que se toca si el peso se mueve en serio, no cada techo. */
export const MARGEN_TECHO_FX = 1.6;

/** COTA SUPERIOR **por moneda** de cuántos pesos puede valer UNA unidad. No es un tipo de cambio:
 *  con esto nunca se convierte ni se muestra un monto; se usa en un solo sentido lógico —
 *  descartar que lo extranjero pueda mover el veredicto —, o sea solo puede concluir `completo`.
 *
 *  **Por qué por moneda y con allowlist, y no un techo universal** (hallazgo del review adversarial
 *  del #936, FAIL sobre `a949550`): el techo único de 10.000 se justificaba con "la fiat más cara
 *  del mundo vale 3.100", y la palabra *fiat* hacía todo el trabajo. El catálogo del propio sistema
 *  trae `UF` con `currency_type = 'indexed_unit'` a ~39.500 CLP, **4x por encima** de ese techo. Y
 *  el catálogo tampoco es el límite: `treasury.bank_accounts.currency_code` es CHAR(3) SIN FK a
 *  `core.currencies` y el alta valida solo el largo (`api/app/core/treasury_schemas.py:574-578`,
 *  `api/app/api/bank_accounts.py:95`), así que hoy entra por la API pública un código arbitrario
 *  tipo `XAU` (oro, ~2.900.000 CLP la onza). Medido sobre `a949550`: `UF 500` y `XAU 20` contra
 *  $50M clasificados daban **`completo`** cuando la verdad es `incompleto`.
 *
 *  **Y esa es la única dirección peligrosa.** La rama del techo tiene dos salidas, `completo` e
 *  `indeterminado`: jamás dice `incompleto` (verificado por estructura y con fuzz). Un techo corto
 *  entonces NO cuesta un `indeterminado` de más — cuesta un **`completo` falso, que es justamente
 *  el estado que OCULTA el aviso de datos incompletos**. Todo el riesgo del número está concentrado
 *  en la única salida que le miente al usuario, así que la respuesta correcta no es agrandar el
 *  número (siempre habrá una moneda arriba) sino **negarse a acotar lo que no se sabe acotar**:
 *  toda moneda fuera de esta tabla — UF y cualquier unidad indexada, un código fuera del catálogo,
 *  una fiat nueva que el catálogo agregue y esta tabla todavía no — no tiene cota aplicable y cae
 *  en `indeterminado`, el mismo trato que ya recibe la moneda desconocida. Envejecer se paga en
 *  falsa alarma, nunca en falsa tranquilidad. */
export const TECHO_CLP_POR_UNIDAD: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(REFERENCIA_CLP_POR_UNIDAD).map(([code, ref]) => [code, ref * MARGEN_TECHO_FX]),
  ),
);

/** Veredicto sobre si el flujo clasificado del período es representativo:
 *  - `completo`: lo sin clasificar es marginal → mostrar Entra/Sale.
 *  - `incompleto`: falta clasificar una porción material → NO mostrar el parcial.
 *  - `indeterminado`: el veredicto DEPENDE del tipo de cambio (hay tasas plausibles que dan
 *    `completo` y tasas plausibles que dan `incompleto`), y elegir tasa y fecha es decisión
 *    humana → se declara, no se adivina. Es el estado de excepción, no el de reposo: si lo
 *    extranjero es chico frente al ingreso, la respuesta no depende de la tasa y se decide. */
export type CompletitudFlujo = "completo" | "incompleto" | "indeterminado";

/** Lo que necesita el veredicto del resumen de sin-clasificar (subset de `UnclassifiedSummary`). */
export interface SinClasificarInput {
  count: number;
  inflowByCurrency: { currency: string; inflow: number; count: number }[];
  unknownInflowCount: number;
  hasUnseenMovements?: boolean;
}

/** Entradas sin clasificar EN PESOS (solo las de cuentas CLP). Nunca mezcla monedas. */
export function entradasSinClasificarCLP(sc: SinClasificarInput | undefined): number {
  return sc?.inflowByCurrency.find((c) => c.currency === "CLP")?.inflow ?? 0;
}

/** ¿Hay entradas sin clasificar que NO son pesos (otra moneda, o moneda desconocida)? */
export function haySinClasificarNoCLP(sc: SinClasificarInput | undefined): boolean {
  if (!sc) return false;
  if (sc.unknownInflowCount > 0) return true;
  return sc.inflowByCurrency.some((c) => c.currency !== "CLP" && c.inflow > 0);
}

/** Monedas con entradas sin clasificar para las que NO hay cota superior aplicable (fuera de
 *  `TECHO_CLP_POR_UNIDAD`: UF y toda unidad indexada, códigos fuera del catálogo). Orden estable. */
export function monedasSinTecho(sc: SinClasificarInput | undefined): string[] {
  return (sc?.inflowByCurrency ?? [])
    .filter((c) => c.currency !== "CLP" && c.inflow > 0 && TECHO_CLP_POR_UNIDAD[c.currency] == null)
    .map((c) => c.currency);
}

/** COTA SUPERIOR en pesos del total sin clasificar que NO es CLP, o `null` si alguna de esas
 *  monedas no tiene techo aplicable (⇒ no existe cota y no se puede afirmar `completo`).
 *
 *  Esto NO es un monto y no se muestra nunca: es `Σ_m unidades_m · techo_m`, o sea el máximo que
 *  esa bandeja podría valer a CUALQUIER tasa por debajo de los techos. Pintarlo como dinero sería
 *  una violación de INV-FX-001. La versión anterior sumaba unidades de monedas distintas y las
 *  multiplicaba por un techo único; con techo POR moneda esa factorización ya no vale, así que la
 *  ponderación va adentro y el número intermedio sin sentido (unidades mezcladas) desaparece. */
export function cotaSuperiorNoCLPEnPesos(sc: SinClasificarInput | undefined): number | null {
  let cota = 0;
  for (const c of sc?.inflowByCurrency ?? []) {
    if (c.currency === "CLP") continue;
    const unidades = Number.isFinite(c.inflow) ? Math.max(c.inflow, 0) : 0;
    if (unidades === 0) continue;
    const techo = TECHO_CLP_POR_UNIDAD[c.currency];
    if (techo == null) return null; // sin cota para esa moneda ⇒ sin cota para el total
    cota += unidades * techo;
  }
  return cota;
}

/** ¿El flujo clasificado del período es representativo? PURO.
 *
 *  `entra` viene del cash-flow report, que ya llega en moneda FUNCIONAL (CLP) — el backend
 *  convierte. Lo sin clasificar, en cambio, son montos CRUDOS en la moneda de cada cuenta, así
 *  que solo la porción CLP es comparable contra `entra` sin tipo de cambio.
 *
 *  Sea `E = entra`, `U_clp` lo sin clasificar en pesos y `U_fx ≥ 0` el equivalente en pesos de lo
 *  extranjero a la tasa (desconocida) que sea. El ratio es `r(U) = U/(E+U)` con `U = U_clp + U_fx`.
 *
 *  **Por qué la cota inferior decide `incompleto` (el argumento correcto, no el de la monotonía
 *  sola):** `dr/dU = E/(E+U)²` es positiva **solo si `E > 0`**; con `E = 0` la derivada es 0
 *  (`r ≡ 1`, constante) y con `E < 0` es NEGATIVA, o sea `r` DECRECE y "creciente en U" sería
 *  falso. Lo que hace correcta a esta implementación en los tres casos no es la monotonía sino
 *  el clamp `Math.max(entra, 0)` de más abajo, que manda `E < 0` (y `NaN`) a `E = 0`, donde vale
 *  el argumento fuerte: `r ≡ 1 > umbral` a CUALQUIER tasa. Con `E > 0` sí vale la monotonía y
 *  `U ≥ U_clp` ⇒ si la cota CLP ya pasa el umbral, el ratio real también, sin convertir nada.
 *
 *  **Por qué existe la cota superior (y por qué `indeterminado` es la excepción y no la regla):**
 *  la versión anterior devolvía `indeterminado` apenas hubiera un peso de moneda extranjera, o
 *  sea reemplazaba a `completo` en vez de a `incompleto`: con `E = 50.000.000`, `U_clp = 1.000.000`
 *  y UN dólar pendiente el titular desaparecía, y como la bandeja por clasificar nunca está en
 *  cero, desaparecía siempre (misma forma de falla que mató al indicador del #956). El arreglo es
 *  acotar lo extranjero por arriba con `TECHO_CLP_POR_UNIDAD[moneda]`, que no es una tasa sino un
 *  techo por moneda: si NI SIQUIERA al techo lo extranjero alcanza a cruzar el umbral, entonces
 *  ninguna tasa lo cruza y el veredicto `completo` es demostrable.
 *
 *  **Y por qué el techo es POR MONEDA y con allowlist** (FAIL del review sobre `a949550`): un techo
 *  único obliga a cubrir la moneda más cara que pueda aparecer, y no existe tal cosa — el catálogo
 *  del sistema ya trae `UF` a ~39.500 y `bank_accounts.currency_code` no tiene FK, así que puede
 *  llegar `XAU`. Como la rama del techo solo puede concluir `completo`, un techo corto no cuesta un
 *  `indeterminado` de más: produce un **`completo` falso que esconde el aviso**. Por eso, en vez de
 *  estirar el número, toda moneda sin techo en la tabla cae en `indeterminado`. Queda entonces así:
 *  `indeterminado` solo cuando el resultado de verdad depende de la tasa (lo extranjero es grande
 *  frente al ingreso), cuando la moneda no se conoce, o cuando se conoce pero no se sabe acotar.
 *
 *  **Sesgo declarado:** `entra` viene filtrado por `fi.amount_functional IS NOT NULL`
 *  (`qavante-api` `app/core/cash_flow_repo.py:187-193`), o sea las filas sin FX resuelto quedan
 *  fuera y `E` está SUBESTIMADO. Como `r` decrece con `E`, subestimar `E` sobreestima `r`: el
 *  sesgo empuja hacia `incompleto`/`indeterminado`, nunca hacia un `completo` falso, así que
 *  suma al mismo lado conservador que el techo. */
export function completitudFlujo(
  entra: number,
  sc: SinClasificarInput | undefined,
): CompletitudFlujo {
  if (!sc || sc.count <= 0) return "completo";
  const clp = entradasSinClasificarCLP(sc);
  const hayFxConocida = sc.inflowByCurrency.some((c) => c.currency !== "CLP" && c.inflow > 0);
  const monedaDesconocida = sc.unknownInflowCount > 0;
  const hayMovimientosNoVistos = sc.hasUnseenMovements === true;
  const baseEntra = Number.isFinite(entra) ? Math.max(entra, 0) : 0;
  const hayEntradasPendientes = clp > 0 || hayFxConocida || monedaDesconocida;

  /* `E = 0` con cualquier entrada pendiente: `r = U/(0+U) = 1 > umbral` sea cual sea la tasa, e
     incluso sin saber la moneda. Es el caso MÁS informativo (el tenant que no clasificó nada) y
     antes se regalaba a `indeterminado` por no distinguirlo del resto. */
  if (baseEntra === 0) {
    if (hayEntradasPendientes) return "incompleto";
    return hayMovimientosNoVistos ? "indeterminado" : "completo";
  }

  // Cota INFERIOR (`U_fx = 0`): si ya con lo CLP se pasa el umbral, se pasa a cualquier tasa.
  const totalMin = baseEntra + clp;
  if (clp / totalMin > UMBRAL_SIN_CLASIFICAR) return "incompleto";

  // Si quedó backlog fuera de la página, no hay cota superior cerrada para afirmar `completo`.
  if (hayMovimientosNoVistos) return "indeterminado";

  // Sin nada extranjero ni desconocido, la cota inferior es el ratio real: veredicto cerrado.
  if (!hayFxConocida && !monedaDesconocida) return "completo";

  /* Sin cota superior no se puede afirmar `completo`: ni la moneda desconocida (no se sabe QUÉ
     acotar) ni una moneda sin techo en la tabla (UF, unidad indexada, código fuera de catálogo:
     no se sabe CUÁNTO acota). Los dos casos son el mismo y se tratan igual, que es lo que arregla
     el `completo` falso de `UF 500` / `XAU 20`. */
  const maxFxEnPesos = monedaDesconocida ? null : cotaSuperiorNoCLPEnPesos(sc);
  if (maxFxEnPesos == null) return "indeterminado";

  /* Cota SUPERIOR: lo extranjero valuado al techo de SU moneda. Si ni así cruza el umbral, ninguna
     tasa por debajo de esos techos lo cruza ⇒ `completo` demostrado. Si lo cruza, el veredicto SÍ
     depende de la tasa y recién ahí `indeterminado` significa algo. */
  const totalMax = baseEntra + clp + maxFxEnPesos;
  return (clp + maxFxEnPesos) / totalMax > UMBRAL_SIN_CLASIFICAR ? "indeterminado" : "completo";
}

/** Lo que se rendea: el veredicto, o `cargando` cuando todavía NO hay veredicto que rendear. */
export type CompletitudFlujoVisible = CompletitudFlujo | "cargando";

/** Veredicto PARA RENDEAR, que es el de arriba más una regla: **mientras el resumen carga no se
 *  afirma nada**. PURO.
 *
 *  Con las cuentas todavía en vuelo el mapa de monedas está vacío ⇒ toda entrada cae en "moneda
 *  desconocida" ⇒ el titular parpadeaba a "No podemos determinar si está completo" y recién después
 *  se acomodaba. El primer intento de arreglo devolvía `completo` durante la carga, y el review
 *  adversarial mostró que eso cambia un flash alarmante por uno de **falsa tranquilidad**: `completo`
 *  es el estado que muestra Entra/Sale como flujo del período, o sea afirma justo lo que todavía no
 *  se sabe (Tooxs julio: `main` decía `incompleto` y avisaba; ese `completo` transitorio mostraba
 *  $1,6M sobre $63M reales como si fuera el flujo). Mientras carga no se puede afirmar ni completitud
 *  ni incompletitud: se declara `cargando` y el consumidor no rendea veredicto ninguno. */
export function completitudFlujoVisible(
  entra: number,
  sc: (SinClasificarInput & { isLoading?: boolean }) | undefined,
): CompletitudFlujoVisible {
  if (sc?.isLoading === true) return "cargando";
  return completitudFlujo(entra, sc);
}

/** Entradas sin clasificar formateadas UNA POR MONEDA ("$61.500.000 · US$1.200,00"), nunca
 *  sumadas entre sí. `null` si no hay entradas con moneda conocida. */
export function entradasSinClasificarLabel(sc: SinClasificarInput | undefined): string | null {
  const partes = (sc?.inflowByCurrency ?? [])
    .filter((c) => c.inflow > 0)
    .map((c) => formatMoney(c.inflow, c.currency));
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Por qué no se puede determinar la completitud. `null` si sí se puede. Nombra las monedas:
 *  el usuario tiene que entender que no es un bug, es que falta una decisión (el tipo de cambio).
 *
 *  Se rendea SOLO en la rama `indeterminado`, y desde el rediseño del veredicto esa rama exige
 *  que lo extranjero sea grande frente al ingreso (o que ni la moneda se conozca): el motivo ya
 *  no aparece por un dólar suelto. */
export function motivoIndeterminado(sc: SinClasificarInput | undefined): string | null {
  if (!sc || !haySinClasificarNoCLP(sc)) return null;
  const otras = sc.inflowByCurrency
    .filter((c) => c.currency !== "CLP" && c.inflow > 0)
    .map((c) => c.currency);
  const sinMoneda = sc.unknownInflowCount;
  const trozos: string[] = [];
  if (otras.length > 0) trozos.push(`en ${otras.join(" y ")}`);
  if (sinMoneda > 0) {
    trozos.push(
      `de ${sinMoneda} ${sinMoneda === 1 ? "movimiento" : "movimientos"} cuya moneda no conocemos`,
    );
  }
  return `Hay entradas sin clasificar ${trozos.join(" y ")}. No las convertimos a pesos: el tipo de cambio (tasa y fecha) lo eliges tú, no lo inventamos.`;
}
