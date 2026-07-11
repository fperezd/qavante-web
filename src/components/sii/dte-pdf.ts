/* Arma la URL del PDF del DTE de una fila del Libro, según sea Compras o Ventas.
   Centraliza la asimetría de los dos endpoints del SII para que GroupedTable y
   RcvDetalleGrid no la dupliquen:
   - Compras → `dte-recibidos/pdf` (la contraparte es el EMISOR/proveedor).
   - Ventas  → `dte-emitidos/pdf`  (la contraparte es el RECEPTOR/cliente, y el
     backend lo exige — qavante-api #501 lo habilitó por folio + rango).
   La ventana del PDF es la UNIÓN del mes de emisión de la fila (`monthBounds`)
   con el rango consultado (`window`): el SII ubica el folio por SU fecha, que
   puede caer FUERA del rango consultado (una factura emitida 30/01 y recibida en
   feb aparece en el Libro de feb pero su PDF vive en enero). Unir ambos cubre
   emisión y recepción — antes se usaba solo el rango consultado y esos folios
   daban `dte_not_found`. */

import { siiDteRecibidoPdfUrl, siiDteEmitidoPdfUrl } from "@/lib/api/sii";
import type { RcvDoc } from "./rcv-grouped-item";
import type { RcvKind } from "./rcv-list-view";
import { monthBounds } from "./dte-date";

/** Une dos ventanas (o devuelve la que exista): desde = la más temprana, hasta =
 *  la más tardía. Garantiza que la ventana incluya AMBAS fechas relevantes. */
export function unionWindow(
  a: { desde: string; hasta: string } | null,
  b: { desde: string; hasta: string } | null,
): { desde: string; hasta: string } | null {
  if (!a) return b;
  if (!b) return a;
  return {
    desde: a.desde < b.desde ? a.desde : b.desde,
    hasta: a.hasta > b.hasta ? a.hasta : b.hasta,
  };
}

export function dtePdfUrlForDoc(
  kind: RcvKind,
  doc: RcvDoc,
  window?: { desde: string; hasta: string } | null,
): string | null {
  // La ventana DEBE incluir la fecha de emisión de la fila. Unimos el mes de
  // emisión con el rango consultado para cubrir emisión y recepción.
  const win = unionWindow(monthBounds(doc.fecha), window ?? null);
  if (!win) return null;
  const folio = doc.folio ?? 0;
  if (kind === "ventas") {
    return siiDteEmitidoPdfUrl({
      desde: win.desde,
      hasta: win.hasta,
      folio,
      rutReceptor: doc.rut_contraparte,
    });
  }
  return siiDteRecibidoPdfUrl({
    desde: win.desde,
    hasta: win.hasta,
    folio,
    rutEmisor: doc.rut_contraparte,
  });
}
