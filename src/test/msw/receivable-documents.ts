import { http, HttpResponse } from "msw";
import type { components } from "@/lib/api/types";

type DocumentsResponse = components["schemas"]["ReceivableDocumentsResponse"];
type DocumentItem = components["schemas"]["ReceivableDocumentItem"];

/* ── La cartera de DOCUMENTOS, con el mismo criterio que la de deudores ──────────────────────
 *
 * El mismo defecto de #207, un grano más abajo: la pantalla pedía `?limit=100`, nunca mandaba
 * `q` —aunque el contrato lo publica— y buscaba con un `filter` en memoria sobre esas filas. El
 * documento que caía fuera de la página traída era inalcanzable POR CONSTRUCCIÓN.
 *
 * Este handler resuelve `q`, `limit` y `offset` DE VERDAD, y eso es lo que hace que los tests
 * midan algo: contra un handler que devolviera siempre la misma lista, una pantalla que no
 * manda ningún parámetro pasaría igual de verde.
 *
 * SIETE documentos, y el séptimo es el del issue:
 *   1 Constructora Andes   F-1001  $9.800.000  CLP
 *   2 Comercial del Sur    F-1002  $6.100.000  CLP
 *   3 Minera Atacama       F-1003  $4.300.000  CLP
 *   4 Minera Atacama       F-1004  US$ 12.500,40  ← la cuenta en dólares DE VERDAD
 *   5 Transportes Biobío   F-1005  $2.750.000  CLP (sin vencimiento confirmado)
 *   6 Servicios Austral    F-1006  $1.400.000  CLP
 *   7 VOLCAN               F-1007      $13.300  CLP  ← fuera de cualquier primera página corta
 *
 * `total` es SIEMPRE el largo de lo que calza con `q` sin paginar, nunca el de la página: es
 * exactamente la distinción que el pie de la pantalla confundía.
 */

function doc(
  folio: string,
  customerName: string,
  rut: string,
  outstanding: string,
  currency: string,
  n: number,
  extra: Partial<DocumentItem> = {},
): DocumentItem {
  return {
    ceded: false,
    claimed: false,
    counterparty_key: `11111111-1111-4111-8111-00000000000${n}`,
    credit_note: false,
    currency_code: currency,
    customer_name: customerName,
    customer_rut: rut,
    days_overdue: 12,
    document_type: 33,
    due_date: "2026-09-20",
    due_date_certainty: "confirmed",
    folio,
    id: `aaaa1111-1111-4111-8111-00000000000${n}`,
    issue_date: "2026-08-20",
    outstanding_amount: outstanding,
    status: "open",
    total_amount: outstanding,
    ...extra,
  };
}

const CARTERA: DocumentItem[] = [
  doc("F-1001", "Constructora Andes SpA", "76.123.456-7", "9800000", "CLP", 1),
  doc("F-1002", "Comercial del Sur Ltda", "77.222.333-4", "6100000", "CLP", 2),
  doc("F-1003", "Minera Atacama SA", "78.333.444-5", "4300000", "CLP", 3),
  doc("F-1004", "Minera Atacama SA", "78.333.444-5", "12500.40", "USD", 4),
  doc("F-1005", "Transportes Biobío SpA", "79.444.555-6", "2750000", "CLP", 5, {
    due_date: null,
    due_date_certainty: "unconfirmed",
    days_overdue: null,
  }),
  doc("F-1006", "Servicios Austral Ltda", "79.555.666-7", "1400000", "CLP", 6),
  doc("F-1007", "VOLCAN Comercializadora SpA", "80.111.222-3", "13300", "CLP", 7),
];

/** Lo que el servidor filtra: nombre, RUT y folio. Igual que el `q` del contrato. */
function calza(item: DocumentItem, q: string): boolean {
  if (!q) return true;
  return `${item.customer_name} ${item.customer_rut ?? ""} ${item.folio}`
    .toLocaleLowerCase("es-CL")
    .includes(q);
}

/** Qué corte está sirviendo el handler. Subirlo es lo que simula "la cartera se movió bajo los
 *  pies del cursor": a partir de ahí, un `offset` que ya no es el de la primera página contesta
 *  409, que es lo que el contrato publica. */
let corteVigente = 0;
export function moverLaCartera() {
  corteVigente += 1;
}
export function resetCartera() {
  corteVigente = 0;
}

export const receivableDocumentsHandlers = [
  http.get("*/api/treasury/accounts-receivable/documents", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("es-CL");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1) {
      // El 422 del contrato: la página pedida no es una página de esta consulta.
      return new HttpResponse(null, { status: 422 });
    }
    if (corteVigente > 0 && offset > 0) {
      // El 409 del contrato: el corte que el cursor venía recorriendo ya no existe.
      return new HttpResponse(null, { status: 409 });
    }

    const filtrados = CARTERA.filter((item) => calza(item, q));
    const body: DocumentsResponse = {
      collected: [],
      collected_coverage: "not_applicable",
      collected_reason: null,
      due_soon: [],
      generated_at: "2026-10-06T18:30:00-03:00",
      items: filtrados.slice(offset, offset + limit),
      limit,
      offset,
      overdue: [],
      total: filtrados.length,
    };
    return HttpResponse.json(body, { status: 200 });
  }),
];

export const receivableDocumentsFixture = { CARTERA };
