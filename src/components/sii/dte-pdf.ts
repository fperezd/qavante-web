/* Arma la URL del PDF del DTE de una fila del Libro, según sea Compras o Ventas.
   Centraliza la asimetría de los dos endpoints del SII para que GroupedTable y
   RcvDetalleGrid no la dupliquen:
   - Compras → `dte-recibidos/pdf` (la contraparte es el EMISOR/proveedor).
   - Ventas  → `dte-emitidos/pdf`  (la contraparte es el RECEPTOR/cliente, y el
     backend lo exige — qavante-api #501 lo habilitó por folio + rango).
   La ventana del PDF es SOLO el mes de emisión de la fila (`monthBounds(doc.fecha)`):
   el SII ubica el folio por su fecha de EMISIÓN, y **TRUNCA los rangos grandes**
   (mismo quirk que recibidos, qavante-api #556) → mandarle el rango consultado
   completo (p.ej. 6 meses) hace que el listado vuelva 0 documentos y dé un
   `dte_not_found` engañoso. Un mes es preciso y suficiente: cubre la emisión de la
   fila (arregla el caso del folio fuera del rango consultado, #511) sin disparar la
   truncación. El `window` consultado solo se usa como fallback si la fila no trae
   fecha. */

import { siiDteRecibidoPdfUrl, siiDteEmitidoPdfUrl } from "@/lib/api/sii";
import type { RcvDoc } from "./rcv-grouped-item";
import type { RcvKind } from "./rcv-list-view";
import { monthBounds } from "./dte-date";

export function dtePdfUrlForDoc(
  kind: RcvKind,
  doc: RcvDoc,
  window?: { desde: string; hasta: string } | null,
): string | null {
  // SOLO el mes de emisión de la fila: el SII trunca rangos grandes → un rango
  // ancho vuelve 0 documentos (dte_not_found engañoso). Fallback al rango
  // consultado únicamente si la fila no trae fecha.
  const win = monthBounds(doc.fecha) ?? window ?? null;
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
