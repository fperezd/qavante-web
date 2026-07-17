import type { ReviewItem, ReviewQueueResponse } from "@/lib/api/reconciliation";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

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

/** "78%" o "" si no hay score. Redondea: el score llega con decimales del motor. */
export function scoreTexto(raw: string | null | undefined): string {
  const n = parseScore(raw);
  return n == null ? "" : `${Math.round(n)}%`;
}

export type FilaCola = {
  id: string;
  fecha: string;
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
    montoTexto: formatClp(cobro ? valor : -valor),
    esCobro: cobro,
    glosaBanco: item.description?.trim() || "Sin glosa",
    documentoTipo: documentoLabel(item.suggestion.document_kind),
    contraparte: nombre || "Sin nombre en el documento",
    tieneNombre: Boolean(nombre),
    score: parseScore(item.suggestion.score),
    scoreTexto: scoreTexto(item.suggestion.score),
  };
}

/** Cola ordenada: mayor score primero (las decisiones más fáciles arriba; los sin score al final,
 *  por fecha). No muta la entrada. */
export function mapCola(resp: ReviewQueueResponse | undefined): FilaCola[] {
  const filas = (resp?.items ?? []).map(mapFila);
  return filas.sort((a, b) => {
    if (a.score == null && b.score == null) return a.fecha < b.fecha ? 1 : -1;
    if (a.score == null) return 1;
    if (b.score == null) return -1;
    return b.score - a.score;
  });
}

/** Todos los ids de la cola, para "Conciliar todas (N)". */
export function todosLosIds(filas: FilaCola[]): string[] {
  return filas.map((f) => f.id);
}
