/* ¿Dónde se concilia de verdad un documento del maestro? (decisión del dueño 2026-10-04)
 *
 * El maestro de Términos (Clientes / Proveedores / Honorarios) NO concilia: muestra lo
 * facturado y deriva vencimientos. La conciliación real —cruzar el documento contra un
 * MOVIMIENTO BANCARIO— vive en el panel del motor, `DocumentResolutionDrawer`
 * ("Clasificación y pago"), que se abre desde el Libro de cada lado y escribe por
 * `POST /api/treasury/reconciliation/document-resolution/assign`. Ese panel pide los
 * candidatos al motor, que sólo propone movimientos que pasaron filtros duros e identidad:
 * el monto por sí solo nunca crea una sugerencia. Por eso el maestro LLEVA ahí y no compite.
 *
 * Por qué no las otras candidatas:
 *  - `/bandeja?tab=conciliar` y `/banco/cuenta/[numero]` arrancan desde el MOVIMIENTO
 *    (su deep-link es un `movement_id`): no se pueden abrir en un documento.
 *  - `/caja/conciliacion` renderiza la misma cola de Bandeja y descarta el query string.
 *  - `/documentos/{receivable|payable}/{id}` sí es documento-céntrica y abre sola, pero su
 *    URL exige el UUID interno del payable/receivable, y el lote de estados que consume el
 *    maestro (`document-resolution/statuses`) devuelve `source_external_id`, no ese UUID.
 *    Tampoco existe para honorarios (BHE no tiene fila en `treasury.payables`).
 *    Mientras ese contrato no exponga `document_id`, el destino honesto es el Libro. */

import { COMMANDS } from "@/components/shell/command-palette-commands";
import type { MaestroKind } from "./terminos-pago";

/** Ruta del Libro donde el documento se cruza contra un movimiento bancario. */
export const DESTINO_CONCILIACION: Record<MaestroKind, string> = {
  ventas: "/cobrar/facturas-emitidas",
  compras: "/pagar/facturas-recibidas",
  honorarios: "/pagar/honorarios-recibidos",
};

/** Nombre de la pantalla destino. Se LEE del catálogo de navegación (⌘K) en vez de
 *  escribirse a mano: la misma pantalla no puede llamarse distinto según por dónde llegues. */
export function nombreDestino(kind: MaestroKind): string {
  const href = DESTINO_CONCILIACION[kind];
  return COMMANDS.find((c) => c.href === href)?.label ?? href;
}
