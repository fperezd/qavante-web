import type {
  ReanalyzeResponse,
  ReconcileResponse,
  ReviewItem,
  ReviewQueueResponse,
} from "@/lib/api/reconciliation";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatPct } from "@/lib/formatters/pct";
import { bloqueoDe, type BloqueoAplicacion } from "@/lib/api/application-blocker";

/* Modelo puro de la cola de conciliación (ADR-0036/0042). Acá vive lo testeable: el motor deja en
   cola los matches de confianza media (score 60-90) y esta capa los prepara para mostrar. Sin
   fetch a propósito — los hooks viven en `lib/api/reconciliation.ts`. */

/** `document_kind = "receivable"` → el movimiento es plata que ENTRÓ contra algo que te deben (un
 *  cobro). `"payable"` → plata que SALIÓ contra algo que debías (un pago). */
export function esCobro(documentKind: string): boolean {
  return documentKind === "receivable";
}

/** Etiqueta del tipo de documento, en lenguaje de dueño. Un kind desconocido se muestra tal cual
 *  (honesto: no inventamos una traducción para algo que no conocemos). */
export function documentoLabel(documentKind: string): string {
  if (documentKind === "receivable") return "Cuenta por cobrar";
  if (documentKind === "payable") return "Cuenta por pagar";
  return documentKind;
}

/** Score del match (0-100). `null` si el backend no lo mandó o no es numérico. */
export function parseScore(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** "78,4%" o "" si no hay score. Pasa por `formatPct`, el único formateador de porcentaje de la
 *  app: antes redondeaba al entero por su cuenta, así que el mismo score se escribía distinto acá
 *  que en cualquier otra pantalla. El decimal que aparece es el que el motor ya calculaba. */
export function scoreTexto(raw: string | null | undefined): string {
  const n = parseScore(raw);
  return n == null ? "" : formatPct(n);
}

export type FilaCola = {
  id: string;
  fecha: string;
  /** Fecha CRUDA del backend (ISO `YYYY-MM-DD`) — para ORDENAR cronológicamente. La `fecha`
   *  formateada ("DD-MM-YYYY") no sirve para ordenar (compararía por día del mes). */
  fechaISO: string;
  /** Monto con signo según dirección: cobro entra (+), pago sale (−). Formateado CLP. */
  montoTexto: string;
  esCobro: boolean;
  glosaBanco: string;
  documentoTipo: string;
  contraparte: string;
  /** `true` si el motor le puso nombre a la contraparte; si no, no fabricamos uno. */
  tieneNombre: boolean;
  score: number | null;
  scoreTexto: string;
  /**
   * `suggestion.can_confirm`: si la propuesta tiene respaldos completos. Es la ÚNICA
   * autorización válida para ofrecer el botón; el servidor revalida igual al confirmar.
   * `false` por defecto: sin el campo no se ofrece conciliar.
   */
  puedeConfirmar: boolean;
  /**
   * `suggestion.blocker`: la causa por la que no se puede conciliar, nombrada por el servidor y
   * con el monto del problema adentro. Se muestra DONDE IBA EL BOTÓN. `null` si se puede.
   */
  bloqueo: BloqueoAplicacion | null;
  /**
   * `suggestion.bulk_eligible`: si puede entrar en una confirmación masiva "sin ocultar falta de
   * identidad". Una fila confirmable de a una no es necesariamente apta para el lote.
   */
  elegibleEnLote: boolean;
};

/** Prepara una fila para la vista. El `amount` del backend es una magnitud; el signo lo pone la
 *  dirección (cobro/pago), no lo asumimos del string (evita doble negación si ya viniera firmado). */
export function mapFila(item: ReviewItem): FilaCola {
  const cobro = esCobro(item.suggestion.document_kind);
  const magnitud = Math.abs(Number(item.amount));
  const valor = Number.isFinite(magnitud) ? magnitud : 0;
  const nombre = item.suggestion.name?.trim();
  return {
    id: item.movement_id,
    fecha: formatDateLike(item.date),
    fechaISO: item.date ?? "",
    montoTexto: formatClp(cobro ? valor : -valor),
    esCobro: cobro,
    glosaBanco: item.description?.trim() || "Sin glosa",
    documentoTipo: documentoLabel(item.suggestion.document_kind),
    contraparte: nombre || "Sin nombre en el documento",
    tieneNombre: Boolean(nombre),
    score: parseScore(item.suggestion.score),
    scoreTexto: scoreTexto(item.suggestion.score),
    /* Sin `can_confirm` no se asume que se puede: el default del contrato es `false` y el
       default honesto de la pantalla es no ofrecer el botón. Acá antes no se leía NINGUNO de
       los tres campos, así que la fila ofrecía "Sí, es este" pasara lo que pasara. */
    puedeConfirmar: item.suggestion.can_confirm === true,
    bloqueo: bloqueoDe(item.suggestion.blocker ?? null),
    elegibleEnLote: item.suggestion.bulk_eligible === true,
  };
}

/** Cola ordenada: mayor score primero (las decisiones más fáciles arriba; los sin score al final,
 *  por fecha). No muta la entrada. */
export function mapCola(resp: ReviewQueueResponse | undefined): FilaCola[] {
  const filas = (resp?.items ?? []).map(mapFila);
  return filas.sort((a, b) => {
    // Sin score: los más recientes primero, por la fecha ISO cruda (cronológica), NO la formateada.
    if (a.score == null && b.score == null) return a.fechaISO < b.fechaISO ? 1 : -1;
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score;
  });
}

/**
 * Las filas que el lote PUEDE aplicar: las que el servidor declara confirmables y además aptas
 * para una confirmación masiva.
 *
 * Acá vivía `todosLosIds(filas)`, que devolvía la cola entera. El botón decía "Conciliar todas
 * (N)" con N = filas, mandaba las N y el backend rechazaba las que no podía aplicar: un botón
 * que promete N y aplica menos es la misma mentira con otro número. Se borró a propósito en vez
 * de dejarlo al lado, para que ningún llamador pueda volver a tomar el de antes.
 *
 * `bulk_eligible` es una condición SEPARADA de `can_confirm`, no un sinónimo: el contrato la
 * describe como "puede incluirse en una confirmación masiva sin ocultar falta de identidad", o
 * sea una fila puede ser confirmable de a una —con el dueño mirándola— y no serlo en un lote
 * donde nadie la mira. Se exigen las dos.
 */
export function filasParaLote(filas: FilaCola[]): FilaCola[] {
  return filas.filter((f) => f.puedeConfirmar && f.elegibleEnLote);
}

/** Los ids que el lote aplica. El conteo del botón sale de acá, no de `filas.length`. */
export function idsParaLote(filas: FilaCola[]): string[] {
  return filasParaLote(filas).map((f) => f.id);
}

export type ResumenReconcile = {
  /** Movimientos que el motor concilió solo (matches de alta confianza). */
  autoConciliados: number;
  /** Movimientos que quedaron en la cola de revisión (confianza media). */
  paraRevisar: number;
  /** Mensaje en lenguaje de dueño para el toast/aviso post-corrida. */
  mensaje: string;
};

/** Resume el resultado de correr el motor (`POST /reconcile`) en lenguaje de dueño. Solo expone lo
 *  accionable: cuánto se concilió solo (matched + consolidated) y cuánto quedó para revisar. El
 *  resto de los contadores del motor (excluidos, ambiguos, sin candidato, retención IVA, etc.) es
 *  detalle interno y no se le muestra al dueño. */
export function resumenReconcile(res: ReconcileResponse): ResumenReconcile {
  const auto = (res.matched ?? 0) + (res.consolidated ?? 0);
  const revisar = res.review ?? 0;
  return { autoConciliados: auto, paraRevisar: revisar, mensaje: mensajeReconcile(auto, revisar) };
}

/** Resume una corrida de RE-ANÁLISIS. Misma forma que el motor normal, pero el mensaje tiene que
 *  decir que la cola se rehízo desde cero: si el dueño ve "no encontré nada" después de apretar un
 *  botón que borró sugerencias viejas, la pantalla le está mintiendo por omisión. */
export function resumenReanalyze(res: ReanalyzeResponse): ResumenReconcile {
  const auto = (res.matched ?? 0) + (res.consolidated ?? 0);
  const revisar = res.review ?? 0;
  const reevaluadas = res.review_reseteadas ?? 0;
  return {
    autoConciliados: auto,
    paraRevisar: revisar,
    mensaje: mensajeReanalyze(auto, revisar, reevaluadas),
  };
}

function mensajeReanalyze(auto: number, revisar: number, reevaluadas: number): string {
  // `review_reseteadas` es cuántas sugerencias que estaban en cola se volvieron a evaluar desde
  // cero. Es el número que explica por qué la cola cambió de tamaño, así que va primero: sin él,
  // "quedaron 2 para revisar" después de haber tenido 9 parece una pérdida inexplicable.
  const cabeza =
    reevaluadas > 0
      ? `Rehíce la cola: reevalué ${conciliados(reevaluadas)} desde cero`
      : "Rehíce la cola";

  if (auto > 0 && revisar > 0) {
    return `${cabeza}, concilié ${conciliados(auto)} y dejé ${revisar} para que revises.`;
  }
  if (auto > 0) {
    return `${cabeza} y concilié ${conciliados(auto)}. No quedó nada para revisar.`;
  }
  if (revisar > 0) {
    return revisar === 1
      ? `${cabeza}. Quedó 1 movimiento para que revises.`
      : `${cabeza}. Quedaron ${revisar} movimientos para que revises.`;
  }
  return `${cabeza}. No quedó ningún movimiento por conciliar.`;
}

function conciliados(n: number): string {
  return n === 1 ? "1 movimiento" : `${n} movimientos`;
}

export type ErrorConciliar = {
  /** El movimiento ya no estaba en la cola (404 not_in_review): la cola que vemos quedó vieja. */
  yaNoEnRevision: boolean;
  mensaje: string;
};

/** Interpreta el error de una acción de conciliación en lenguaje de dueño, mostrando la razón REAL
 *  del backend en vez de un genérico "intenta de nuevo" (surface honesto). Distingue el caso
 *  esperado —el movimiento ya no está en revisión (lo concilió el cron o quedó vieja la cola)— para
 *  refrescar en vez de solo quejarse. */
export function interpretarErrorConciliar(err: unknown): ErrorConciliar {
  if (err instanceof ApiError && (err.code === "not_in_review" || err.status === 404)) {
    return {
      yaNoEnRevision: true,
      mensaje:
        "Ese movimiento ya no estaba en revisión (quizás ya se concilió). Actualicé la cola.",
    };
  }
  if (err instanceof ApiError) {
    return { yaNoEnRevision: false, mensaje: apiErrorToUserMessage(err) };
  }
  return { yaNoEnRevision: false, mensaje: "No pudimos completar la acción. Intenta de nuevo." };
}

function mensajeReconcile(auto: number, revisar: number): string {
  if (auto > 0 && revisar > 0) {
    return `Concilié ${conciliados(auto)} automáticamente y dejé ${revisar} para que revises.`;
  }
  if (auto > 0) {
    return `Concilié ${conciliados(auto)} automáticamente. No quedó nada para revisar.`;
  }
  if (revisar > 0) {
    return revisar === 1
      ? "Encontré 1 movimiento para que revises."
      : `Encontré ${revisar} movimientos para que revises.`;
  }
  return "No encontré movimientos nuevos para conciliar.";
}
