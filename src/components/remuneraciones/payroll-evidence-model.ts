/* Modelo PURO de la evidencia de pagos de nómina (D14, api#422 / #203). Sin React → testeable.

   Qué hace y qué NO hace: traduce los códigos del backend a la frase que una persona puede
   leer, y ordena las filas. **No calcula dinero.** Ningún monto se suma, se resta ni se
   convierte a `number` acá: el backend es dueño de cada cifra y llega como `Decimal` exacto en
   un `string`. La pantalla formatea con `formatMoneyFromDecimalString` y nada más.

   Por qué importa: el defecto que #203 viene a cerrar es que la pantalla mezclaba agregado
   cacheado, detalle en vivo y movimientos bancarios, y una diferencia exacta se prestaba para
   inferir qué trabajador había sido pagado. Acá el estado de cada persona viene DICHO por el
   backend (`state`), no derivado de comparar montos en el cliente. */

import type {
  PayrollWorkerOutstanding,
  PayrollWorkerOutstandingWorker,
} from "@/lib/api/payroll-evidence";

/** Estado de un trabajador según la evidencia, tal como lo nombra el backend. */
export type EvidenceWorkerState =
  | "unallocated"
  | "partially_confirmed"
  | "confirmed_paid"
  | "unknown";

export interface EvidenceWorkerStateCopy {
  /** Etiqueta corta para el badge. */
  label: string;
  /** Qué cubre esa etiqueta. Nunca una etiqueta de confianza. */
  detail: string;
  tone: "neutral" | "partial" | "confirmed";
}

const WORKER_STATE_COPY: Record<EvidenceWorkerState, EvidenceWorkerStateCopy> = {
  confirmed_paid: {
    label: "Pago con evidencia",
    detail: "Un pago confirmado cubre su obligación sellada, repartida a su nombre.",
    tone: "confirmed",
  },
  partially_confirmed: {
    label: "Pago parcial con evidencia",
    detail: "Un pago confirmado cubre parte de su obligación sellada; el resto sigue abierto.",
    tone: "partial",
  },
  unallocated: {
    label: "Sin pago repartido a su nombre",
    detail: "La obligación está sellada y ningún pago confirmado se reparte a su nombre todavía.",
    tone: "neutral",
  },
  unknown: {
    label: "Estado que esta pantalla no traduce",
    detail:
      "La lectura publicó un estado que esta pantalla todavía no traduce. El monto y el saldo de la fila son los que publicó la lectura.",
    tone: "neutral",
  },
};

export function workerStateCopy(state: string | null | undefined): EvidenceWorkerStateCopy {
  if (state === "confirmed_paid" || state === "partially_confirmed" || state === "unallocated") {
    return WORKER_STATE_COPY[state];
  }
  return WORKER_STATE_COPY.unknown;
}

/** Qué respalda la cifra LEGADA de un trabajador. Un pago asumido no se lee como observado. */
const LEGACY_QUALITY_COPY: Record<string, string> = {
  legacy_bank_evidenced: "La cifra legada tiene un movimiento bancario enlazado.",
  legacy_manual_adjustment: "La cifra legada la declaró una persona, fuera del banco.",
  assumed_paid_no_bank_evidence:
    "La cifra legada se dio por pagada sin un solo enlace que la explique.",
  legacy_absent: "La capa legada no registra pago para esta persona en el período.",
};

export function legacyQualityCopy(quality: string | null | undefined): string | null {
  if (!quality) return null;
  return (
    LEGACY_QUALITY_COPY[quality] ?? `La cifra de la capa anterior viene etiquetada "${quality}".`
  );
}

/* Las abstenciones del período. Cada una es una razón POR LA QUE el período no afirma más de lo
   que afirma. La traducción vive acá y no en el JSX para que una razón nueva de la lectura no se
   pinte como un string crudo sin que nadie lo note: el fallback la NOMBRA igual, porque callarla
   convertiría una advertencia en silencio. */
const ABSTENTION_COPY: Record<string, string> = {
  obligation_snapshot_missing:
    "El período todavía no tiene una obligación sellada contra la que contar los pagos.",
  obligation_snapshot_conflict:
    "El origen selló dos obligaciones distintas para el mismo instante del período.",
  obligation_coverage_incomplete:
    "La obligación sellada cubre parte del período, no su planilla completa.",
  obligation_lines_without_worker:
    "Hay líneas selladas sin RUT: su monto no se le puede atribuir a una persona.",
  payment_evidence_missing: "Ningún pago confirmado está asignado al período.",
  batch_not_distributed_per_worker:
    "Hay pago asignado al período que todavía no está repartido persona por persona.",
  payment_evidence_on_superseded_obligation:
    "Hay pago asignado a un sello anterior de esta misma obligación, contra montos que el origen ya cambió.",
  payment_payroll_portion_unreadable:
    "Un pago declara cubrir más que nómina y la parte que fue a nómina no se puede leer, así que el pago observado del período está por arriba de lo que la evidencia sostiene.",
  legacy_payable_settled_without_worker_evidence:
    "El payable mensual legado da por pagado más de lo que la capa por trabajador puede respaldar.",
  legacy_worker_paid_without_any_link:
    "La capa legada da por pagado a personas sin un solo enlace que lo respalde.",
  legacy_payable_ambiguous:
    "El período tiene más de un payable legado, así que su saldo no identifica un solo hecho.",
  payment_currency_conflict: "Los pagos observados del período no coinciden en una sola moneda.",
  payment_currency_missing: "Los pagos observados del período no declaran su moneda.",
};

export function abstentionCopy(code: string): string {
  return (
    ABSTENTION_COPY[code] ??
    `El período declaró "${code}", una razón que esta pantalla todavía no traduce.`
  );
}

/** Una fila de la tabla por trabajador, ya ordenada y con su copy resuelto. */
export interface EvidenceWorkerRow {
  /** Clave estable para React. El RUT puede venir en `null`. */
  key: string;
  workerRut: string | null;
  workerName: string | null;
  obligationAmount: string;
  confirmedPaidAmount: string;
  outstandingAmount: string;
  currencyCode: string | null;
  lineCount: number;
  state: EvidenceWorkerStateCopy;
  legacyPaidAmount: string | null;
  legacyQuality: string | null;
}

/** Compara RUTs por sus dígitos, nunca por el formato que el origen usó. */
export function evidenceRutKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

/* Orden: primero quien NO tiene pago repartido a su nombre, después los parciales, al final los
   que la evidencia confirma. Es el orden en que alguien de finanzas lee la tabla: lo que falta
   arriba. Dentro de cada grupo, por nombre y después por RUT, para que el orden sea estable
   entre refrescos. Las líneas sin RUT van al final: no se le pueden atribuir a nadie. */
const STATE_ORDER: Record<string, number> = {
  unallocated: 0,
  partially_confirmed: 1,
  confirmed_paid: 2,
};

export function evidenceWorkerRows(
  response: PayrollWorkerOutstanding | undefined | null,
): EvidenceWorkerRow[] {
  const workers: PayrollWorkerOutstandingWorker[] = response?.workers ?? [];
  return workers
    .map((worker, index) => ({
      key: evidenceRutKey(worker.worker_rut) || `sin-rut-${index}`,
      workerRut: worker.worker_rut ?? null,
      workerName: worker.worker_name ?? null,
      obligationAmount: worker.obligation_amount,
      confirmedPaidAmount: worker.confirmed_paid_amount,
      outstandingAmount: worker.outstanding_amount,
      currencyCode: worker.currency_code ?? response?.currency_code ?? null,
      lineCount: worker.line_count,
      state: workerStateCopy(worker.state),
      legacyPaidAmount: worker.legacy_paid_amount ?? null,
      legacyQuality: legacyQualityCopy(worker.legacy_evidence_quality),
      rawState: worker.state,
    }))
    .sort((a, b) => {
      const withoutRut = Number(!a.workerRut) - Number(!b.workerRut);
      if (withoutRut !== 0) return withoutRut;
      const byState = (STATE_ORDER[a.rawState] ?? 3) - (STATE_ORDER[b.rawState] ?? 3);
      if (byState !== 0) return byState;
      const byName = (a.workerName ?? "").localeCompare(b.workerName ?? "", "es");
      if (byName !== 0) return byName;
      return (a.workerRut ?? "").localeCompare(b.workerRut ?? "", "es");
    })
    .map(({ rawState: _rawState, ...row }) => row);
}

/* Cuántas personas hay en cada estado. Se cuenta sobre el `state` que DICE el backend, nunca
   comparando montos en el cliente: inferir "está pagado" de que dos cifras coincidan es
   exactamente lo que #203 prohíbe. */
export interface EvidenceWorkerTally {
  total: number;
  confirmed: number;
  partial: number;
  unallocated: number;
  withoutRut: number;
}

export function evidenceWorkerTally(
  response: PayrollWorkerOutstanding | undefined | null,
): EvidenceWorkerTally {
  const workers: PayrollWorkerOutstandingWorker[] = response?.workers ?? [];
  return {
    total: workers.length,
    confirmed: workers.filter((w) => w.state === "confirmed_paid").length,
    partial: workers.filter((w) => w.state === "partially_confirmed").length,
    unallocated: workers.filter((w) => w.state === "unallocated").length,
    withoutRut: workers.filter((w) => !w.worker_rut).length,
  };
}
