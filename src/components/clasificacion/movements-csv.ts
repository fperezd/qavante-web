/* Export CSV de movimientos bancarios — helper PURO, testeable.
 *
 * Espeja `docsToCsv` del Libro SII (`sii/libro-kpis/libro-kpis-format.ts`): mismo
 * separador `;` (convención Excel es-CL) y mismo escape RFC 4180. La función de
 * escape se reimplementa acá en vez de importarse desde `sii/` para no acoplar dos
 * dominios; si aparece un tercer export, conviene extraerla a `lib/csv.ts`.
 *
 * Decisiones deliberadas:
 * - El MONTO va tal como lo entrega el backend, CON SIGNO (los débitos llegan
 *   negativos). La grilla muestra magnitudes porque es más legible en pantalla,
 *   pero un export se abre en Excel para sumar: con signo, `SUMA()` da el neto
 *   correcto de una. La columna "Tipo" (Abono/Cargo) queda igual para filtrar.
 * - La MONEDA no viene en `BankMovement` (no está en el contrato OpenAPI); vive en
 *   la cuenta. Se deriva por `bank_account_id`. Si la cuenta no está en el lookup
 *   —p.ej. una cuenta desactivada, que `bank-accounts` no devuelve por defecto— la
 *   celda queda VACÍA. No se rellena con CLP: inventar la moneda es justo lo que
 *   prohíbe INV-FX-001.
 */

export interface MovementCsvRow {
  bank_account_id: string;
  date: string;
  description: string;
  amount: string | number;
  direction: "credit" | "debit" | string;
  canonical_category?: string | null;
  management_account_id?: string | null;
  reconciliation_status?: string | null;
  external_id?: string | null;
}

export interface MovementCsvLookups {
  /** account id → código de moneda (CLP, USD…). Ausente = no derivable. */
  currencyByAccountId?: ReadonlyMap<string, string | undefined>;
  /** account id → nombre visible de la cuenta bancaria. */
  accountNameById?: ReadonlyMap<string, string>;
  /** código canónico → etiqueta legible. */
  categoryLabelByCode?: ReadonlyMap<string, { label: string }>;
  /** management account id → nombre visible (o ruta completa). */
  managementAccountNameById?: ReadonlyMap<string, { path?: string; displayName?: string }>;
}

export const MOVEMENT_CSV_HEADERS = [
  "Fecha",
  "Glosa",
  "Tipo",
  "Monto",
  "Moneda",
  "Cuenta bancaria",
  "Categoria",
  "Cuenta de gestion",
  "Estado conciliacion",
  "Referencia",
] as const;

/** Escapa una celda CSV (RFC 4180): entrecomilla si trae separador, comillas o salto. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "credit" → Abono, "debit" → Cargo. Un valor desconocido se deja tal cual, sin
 *  traducirlo a ninguna de las dos: rotularlo mal seria peor que no rotularlo. */
export function directionLabel(direction: string): string {
  if (direction === "credit") return "Abono";
  if (direction === "debit") return "Cargo";
  return direction;
}

/** Monto crudo, normalizado a número. Un valor no numérico queda vacío en vez de 0:
 *  un cero inventado se suma en Excel y corrompe el total sin avisar. */
function amountCell(amount: string | number): string | number {
  const n = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(n) ? n : "";
}

/** Serializa los movimientos a CSV. El orden de las filas es el que reciba:
 *  la vista pasa lo ya filtrado y ordenado, para que el archivo calce con la pantalla. */
export function movementsToCsv(
  movements: readonly MovementCsvRow[],
  lookups: MovementCsvLookups = {},
): string {
  const rows = movements.map((m) => {
    const mgmt = m.management_account_id
      ? lookups.managementAccountNameById?.get(m.management_account_id)
      : undefined;
    return [
      m.date ?? "",
      m.description ?? "",
      directionLabel(m.direction),
      amountCell(m.amount),
      lookups.currencyByAccountId?.get(m.bank_account_id) ?? "",
      lookups.accountNameById?.get(m.bank_account_id) ?? "",
      m.canonical_category
        ? (lookups.categoryLabelByCode?.get(m.canonical_category)?.label ?? m.canonical_category)
        : "",
      mgmt?.path ?? mgmt?.displayName ?? "",
      m.reconciliation_status ?? "",
      m.external_id ?? "",
    ]
      .map(csvCell)
      .join(";");
  });
  return [MOVEMENT_CSV_HEADERS.join(";"), ...rows].join("\r\n");
}

/** Nombre del archivo: `movimientos-<rango>.csv`. Sin rango, solo `movimientos.csv`. */
export function movementsCsvFilename(periodo?: string): string {
  return `movimientos${periodo ? `-${periodo}` : ""}.csv`;
}
