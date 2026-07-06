/* Arma la URL del PDF del DTE de una fila del Libro, según sea Compras o Ventas.
   Centraliza la asimetría de los dos endpoints del SII para que GroupedTable y
   RcvDetalleGrid no la dupliquen:
   - Compras → `dte-recibidos/pdf` (la contraparte es el EMISOR/proveedor).
   - Ventas  → `dte-emitidos/pdf`  (la contraparte es el RECEPTOR/cliente, y el
     backend lo exige — qavante-api #501 lo habilitó por folio + rango).
   La ventana del PDF es la del rango consultado (`window`); si no viene, cae al
   mes de emisión de la fila (`monthBounds`) — ver periodToPdfWindow para el
   porqué del rango completo. */

import { siiDteRecibidoPdfUrl, siiDteEmitidoPdfUrl } from "@/lib/api/sii";
import type { RcvDoc } from "./rcv-grouped-item";
import type { RcvKind } from "./rcv-list-view";
import { monthBounds } from "./dte-date";

export function dtePdfUrlForDoc(
  kind: RcvKind,
  doc: RcvDoc,
  window?: { desde: string; hasta: string } | null,
): string | null {
  // Preferimos la ventana del rango consultado; si no vino, caemos al mes de
  // emisión de la fila (menos robusto, ver periodToPdfWindow).
  const win = window ?? monthBounds(doc.fecha);
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
