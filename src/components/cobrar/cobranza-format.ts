/* Helpers puros de la pantalla Cobrar (Sprint C4). SIN React → testeables.
   `parseAmount` se repite en gestion-format/cash-flow-format (string-decimal
   del backend → number); consolidación pendiente, se mantiene local para no
   acoplar dominios. */

import type { ReceivableAging } from "@/lib/api/cobranza";
import { formatClp } from "@/lib/formatters/clp";
import { normalizeRut } from "@/lib/validators/rut";

/* ── Los TRES estados de una cifra de dinero (hallazgo H6) ─────────────────────
 * Esta pantalla tiene que distinguir, y NUNCA confundir:
 *   (a) un número real          → se muestra;
 *   (b) `0` VERIFICADO          → "estás al día", el mensaje más valioso de la
 *       pantalla; jamás se pierde ni se degrada a "sin dato";
 *   (c) `null` = no se sabe     → se dice que no se sabe, con el porqué.
 * Confundir (b) con (c) es afirmar "nada vencido" sobre datos incompletos: la
 * pantalla mintiendo con cara de certeza. */

/** string-decimal del backend → number. SOLO para campos que el contrato
 *  garantiza presentes y no-null.
 *
 *  La firma NO acepta `null` A PROPÓSITO (H6 / qavante-api#123): si un campo del
 *  contrato pasa a nullable, esto deja de COMPILAR y obliga a decidir qué mostrar,
 *  en vez de aplastar silenciosamente "no se sabe" a `0`. Para campos nullable
 *  está `parseAmountOrNull`.
 *
 *  Un string no numérico ("x") cae a 0 como defensa contra basura del transporte
 *  — eso es un contrato roto, no un "no se sabe" legítimo. */
export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** string-decimal → number PRESERVANDO el "no se sabe": `null`/`undefined`/vacío/
 *  no numérico → `null`.
 *
 *  `"0"` → `0`: el cero VERIFICADO se conserva como cero, no se confunde con
 *  desconocido. Es la distinción entera de H6. */
export function parseAmountOrNull(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Vencido de UN deudor: monto, o `null` si no se sabe.
 *
 *  `TopDebtor.overdue` es nullable en el contrato desde qavante-api#124, y su
 *  descripción lo dice con todas las letras: *"La tabla no debe renderizarlo como
 *  `$0`"*. En producción hoy viene `null` para el 100% de los deudores. */
export function vencidoDeDeudor(d: { overdue: string | null }): number | null {
  return parseAmountOrNull(d.overdue);
}

/** Estado del vencido del conjunto de deudores. TRES valores, no dos.
 *
 *  Colapsar esto a un booleano es el bug que venía arrastrándose: con todos los
 *  `overdue` en `null`, un `debtors.some(d => parseAmount(d.overdue) > 0)`
 *  responde `false` — o sea "nadie debe vencido"— cuando la respuesta real es
 *  "no lo sabemos". */
export type EstadoVencido = "con-mora" | "al-dia" | "no-se-sabe";

export function estadoVencidoDeudores(
  debtors: ReadonlyArray<{ overdue: string | null }>,
): EstadoVencido {
  if (debtors.length === 0) return "al-dia";
  if (debtors.some((d) => (vencidoDeDeudor(d) ?? 0) > 0)) return "con-mora";
  return debtors.some((d) => vencidoDeDeudor(d) === null) ? "no-se-sabe" : "al-dia";
}

/** Suma del vencido de los deudores, o `null` si ALGUNO no se sabe.
 *
 *  Misma regla dura que `agingBreakdown`: si un sumando es desconocido, la suma
 *  también lo es. Sumar los conocidos y presentarlo como total sub-reporta la
 *  mora, que es el peor sentido en el que puede fallar una cifra de cobranza. */
export function totalVencidoDeudores(
  debtors: ReadonlyArray<{ overdue: string | null }>,
): number | null {
  let acc = 0;
  for (const d of debtors) {
    const v = vencidoDeDeudor(d);
    if (v === null) return null;
    acc += v;
  }
  return acc;
}

/* Ordena deudores por URGENCIA (herramienta de decisión: "¿a quién persigo
   primero?"). PURO. No muta el array de entrada.
   
   Tres grupos, en este orden, y el del medio es el que importa:
     1. vencido CONOCIDO y mayor a cero — de mayor a menor;
     2. vencido DESCONOCIDO — porque "no sé si me debe" pide más atención que
        "sé que está al día", no menos;
     3. vencido conocido e igual a cero.
   Dentro de cada grupo, desempata el total mayor. */
export function sortByUrgency<T extends { overdue: string | null; total: string | null }>(
  items: ReadonlyArray<T>,
): T[] {
  const grupo = (x: T) => {
    const v = vencidoDeDeudor(x);
    if (v === null) return 1;
    return v > 0 ? 0 : 2;
  };
  return [...items].sort((a, b) => {
    const ga = grupo(a);
    const gb = grupo(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) {
      const ov = (vencidoDeDeudor(b) ?? 0) - (vencidoDeDeudor(a) ?? 0);
      if (ov !== 0) return ov;
    }
    return compararTotalDesc(a.total, b.total);
  });
}

/** Desempate por total mayor. Un total en revisión de conciliación (`null`, qavante-api#907) no
 *  vale 0: sólo se ordena después de los conocidos, sin inventarle una cifra. */
export function compararTotalDesc(a: string | null, b: string | null): number {
  const va = parseAmountOrNull(a);
  const vb = parseAmountOrNull(b);
  if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
  return vb - va;
}

/* Participación (%) de un monto sobre el total — indicador de CONCENTRACIÓN de
   control de gestión ("qué parte del total es esta contraparte"). Agnóstico al
   tenant. `total<=0` → 0. `null` si el monto o el total están en revisión de
   conciliación (qavante-api#907): no hay proporción que calcular. PURO. */
export function shareOfTotal(amount: string | null, total: string | null): number | null {
  if (amount == null || total == null) return null;
  const t = parseAmount(total);
  return t > 0 ? (parseAmount(amount) / t) * 100 : 0;
}

export interface AgingBar {
  key: keyof ReceivableAging;
  label: string;
  /** Monto del tramo. `null` = la API no pudo computarlo (qavante-api#123).
   *  NUNCA 0 por defecto: un tramo desconocido no es un tramo vacío. */
  amount: number | null;
  /** % del total por cobrar. `null` cuando el tramo —o el total— no se conoce. */
  pct: number | null;
}

export interface AgingBreakdown {
  bars: AgingBar[];
  /** `true` si algún tramo vino `null` → la barra apilada NO se puede pintar. */
  incomplete: boolean;
  /** Suma de los tramos que SÍ se conocen (para el texto de apoyo). */
  knownTotal: number;
}

const AGING_ORDER: ReadonlyArray<keyof ReceivableAging> = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
];
const AGING_LABEL: Record<keyof ReceivableAging, string> = {
  current: "Vigente",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90_plus: "90+ días",
};

/** Tramos de antigüedad en orden, con monto + % del total (para barra apilada
 *  + tabla). El "vigente" no está vencido; el resto sí.
 *
 *  REGLA DURA (H6): si CUALQUIER tramo viene `null`, el porcentaje queda `null`
 *  en TODOS los tramos, incluido `current`. El denominador (el total repartido)
 *  es desconocido, así que ni siquiera "Vigente" puede reclamar un %. Sin esta
 *  regla, con los cuatro tramos de mora en null la barra pintaba 100% "Vigente"
 *  — o sea "todo al día" justo cuando no se sabe nada. */
export function agingBreakdown(aging: ReceivableAging): AgingBreakdown {
  const amounts = AGING_ORDER.map((k) => parseAmountOrNull(aging[k]));
  const incomplete = amounts.some((a) => a === null);
  const knownTotal = amounts.reduce<number>((acc, a) => acc + (a ?? 0), 0);
  return {
    bars: AGING_ORDER.map((k, i) => ({
      key: k,
      label: AGING_LABEL[k],
      amount: amounts[i]!,
      /* `null` SOLO por desconocimiento. Un aging completo y todo en cero es un
         cero VERIFICADO ("no tienes nada por cobrar") y su reparto es 0, no
         "sin dato": confundirlos sería el mismo error de H6 al revés. */
      pct: incomplete ? null : knownTotal > 0 ? (amounts[i]! / knownTotal) * 100 : 0,
    })),
    incomplete,
    knownTotal,
  };
}

export interface VencidoSinDato {
  /** Saldo vivo sin fecha de vencimiento (CLP), o `null` si el backend tampoco lo dice. */
  undated: number | null;
  /** QUÉ pasa y POR QUÉ, en una frase. */
  motivo: string;
  /** QUÉ hacer para que el dato aparezca. */
  accion: string;
}

/** Explicación accionable de por qué NO se puede decir cuánto está vencido.
 *
 *  El `null` de `overdue` sin explicación es tan inútil como el `0` mentiroso: el
 *  dueño queda igual de a ciegas. `undated_amount` (qavante-api#123) es lo que lo
 *  EXPLICA — saldo vivo sin fecha de vencimiento, que por definición no se puede
 *  clasificar como vencido o vigente. PURO → el copy se testea sin React. */
export function explicarVencidoSinDato(d: {
  undated_amount?: string | null;
  missing_sources?: string[];
}): VencidoSinDato {
  const undated = parseAmountOrNull(d.undated_amount);
  const base =
    undated != null && undated > 0
      ? `No podemos calcular cuánto está vencido: ${formatClp(undated)} de tu saldo por cobrar no tiene fecha de vencimiento.`
      : /* `undated_amount` en 0 (o ausente) NO autoriza a decir "faltan las fechas":
           eso sería inventar una causa. Si el backend no explica el null, se dice
           que no se puede calcular y punto — el detalle lo aportan `missing_sources`. */
        "No podemos calcular cuánto está vencido con los datos que tenemos.";
  const fuentes = d.missing_sources?.filter((s) => s.trim() !== "") ?? [];
  const motivo = fuentes.length > 0 ? `${base} Falta: ${fuentes.join(" · ")}.` : base;
  return {
    undated,
    motivo,
    accion:
      "Asigna el término de pago de esos clientes en Clientes, o sincroniza el SII para traer los vencimientos.",
  };
}

/** RUT NORMALIZADO para usar como CLAVE (mapas, comparaciones). El contrato admite
 *  `rut: null` ("null si falta") y `normalizeRut` exige `string`: el ausente se
 *  colapsa a `""`, que como clave es inofensivo. Para MOSTRAR el RUT NO se usa
 *  esto — un RUT ausente se dice, no se pinta vacío. */
export function rutKey(rut: string | null | undefined): string {
  return normalizeRut(rut ?? "");
}
