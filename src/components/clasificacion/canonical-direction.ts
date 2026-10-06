import type { components } from "@/lib/api/types";

type CanonicalCategoryMeta = components["schemas"]["CanonicalCategoryMeta"];

/**
 * LA MISMA REGLA DE DIRECCIÓN EN TODAS LAS PANTALLAS QUE CLASIFICAN.
 *
 * Un cargo (sale plata) no puede ser un "Cobro de cliente", y un abono no puede ser un "Pago a
 * proveedor". La Bandeja ya filtraba así; `/caja/clasificados` ofrecía la lista completa, de modo
 * que reclasificar un cargo permitía elegir un tipo de ENTRADA y guardar un dato financiero al
 * revés. Medido en producción el 2026-10-05 sobre Tooxs: 522 de 755 movimientos son cargos, así
 * que no es un caso borde.
 *
 * El criterio no se inventa acá: `allowed_for_bank_movement` y `expected_direction` los publica
 * `GET /api/treasury/canonical-categories`. Esta función LEE esos campos, no deriva una verdad
 * propia. `expected_direction: "any"` sirve para las dos direcciones, por decisión del backend.
 *
 * Con `direccion === null` (la fuente no dijo si entra o sale plata) NO se adivina: se devuelven
 * todos los tipos imputables a un movimiento bancario y la pantalla deja elegir.
 */
export function categoriasParaDireccion(
  items: readonly CanonicalCategoryMeta[],
  direccion: "credit" | "debit" | null,
): CanonicalCategoryMeta[] {
  return items.filter(
    (c) =>
      c.code !== "unknown" &&
      c.allowed_for_bank_movement &&
      (direccion == null || c.expected_direction === "any" || c.expected_direction === direccion),
  );
}
