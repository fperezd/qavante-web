import type { F29Response } from "@/lib/api/sii";

/**
 * El campo `message` de F29 es texto libre del proveedor. La interfaz se apoya sólo en el
 * estado contractual y conserva el detalle técnico fuera de la pantalla.
 */
export function f29ResponseMessage(status: F29Response["status"]): string {
  if (status === "not_found") {
    return "El folio no corresponde a una declaración del período consultado. Verifica el número y reintenta.";
  }
  return "El SII informó un problema al consultar este folio. Intenta nuevamente más tarde.";
}
