import { describe, expect, it } from "vitest";

import {
  MOVEMENT_CSV_HEADERS,
  directionLabel,
  movementsCsvFilename,
  movementsToCsv,
  type MovementCsvRow,
} from "./movements-csv";

function mov(over: Partial<MovementCsvRow> = {}): MovementCsvRow {
  return {
    bank_account_id: "acc-clp",
    date: "2026-01-15",
    description: "TRANSFERENCIA DE CLIENTE",
    amount: "150000",
    direction: "credit",
    reconciliation_status: "matched",
    external_id: "REF-001",
    ...over,
  };
}

/** Celdas de la fila `n` (0 = cabecera). Falla explícito si la fila no existe,
 *  en vez de dejar que un `undefined` se cuele en el assert. */
function celdas(csv: string, n: number): string[] {
  const linea = csv.split("\r\n")[n];
  if (linea === undefined) throw new Error(`El CSV no tiene fila ${n}`);
  return linea.split(";");
}

const lookups = {
  currencyByAccountId: new Map([
    ["acc-clp", "CLP"],
    ["acc-usd", "USD"],
  ]),
  accountNameById: new Map([
    ["acc-clp", "Cuenta Corriente MN"],
    ["acc-usd", "Cta Cte USD"],
  ]),
  categoryLabelByCode: new Map([["revenue_sales", { label: "Ventas" }]]),
  managementAccountNameById: new Map([["mg-1", { path: "Ingresos > Ventas" }]]),
};

describe("movementsToCsv", () => {
  it("emite la cabecera y una fila por movimiento", () => {
    const csv = movementsToCsv([mov(), mov({ external_id: "REF-002" })], lookups);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(MOVEMENT_CSV_HEADERS.join(";"));
    expect(lines).toHaveLength(3);
  });

  it("conserva el SIGNO del monto para que Excel sume el neto correcto", () => {
    // Los débitos llegan negativos del backend; la grilla muestra magnitud, el CSV no.
    const csv = movementsToCsv([mov({ amount: "-98000", direction: "debit" })], lookups);
    const fila = celdas(csv, 1);
    expect(fila[2]).toBe("Cargo");
    expect(fila[3]).toBe("-98000");
  });

  it("deriva la moneda desde la CUENTA, porque el movimiento no la trae", () => {
    const csv = movementsToCsv([mov({ bank_account_id: "acc-usd" })], lookups);
    const fila = celdas(csv, 1);
    expect(fila[4]).toBe("USD");
    expect(fila[5]).toBe("Cta Cte USD");
  });

  it("deja la moneda VACIA cuando la cuenta no se puede resolver — no asume CLP", () => {
    // Caso real: cuenta desactivada, que `bank-accounts` no devuelve por defecto.
    // Rellenar con CLP seria inventar la moneda (INV-FX-001).
    const csv = movementsToCsv([mov({ bank_account_id: "acc-desconocida" })], lookups);
    const fila = celdas(csv, 1);
    expect(fila[4]).toBe("");
    expect(fila[5]).toBe("");
  });

  it("deja el monto VACIO si no es numerico, en vez de escribir un cero", () => {
    const csv = movementsToCsv([mov({ amount: "n/d" })], lookups);
    expect(celdas(csv, 1)[3]).toBe("");
  });

  it("escapa glosas con punto y coma, comillas o saltos de linea", () => {
    const csv = movementsToCsv([mov({ description: 'PAGO; "URGENTE"\nsegunda linea' })], lookups);
    expect(csv).toContain('"PAGO; ""URGENTE""\nsegunda linea"');
    // La cabecera sigue siendo la primera linea pese al salto embebido.
    expect(csv.startsWith(MOVEMENT_CSV_HEADERS.join(";"))).toBe(true);
  });

  it("usa la etiqueta legible de la categoria y cae al codigo si no la conoce", () => {
    const conocida = movementsToCsv([mov({ canonical_category: "revenue_sales" })], lookups);
    expect(celdas(conocida, 1)[6]).toBe("Ventas");
    const inedita = movementsToCsv([mov({ canonical_category: "categoria_nueva" })], lookups);
    expect(celdas(inedita, 1)[6]).toBe("categoria_nueva");
  });

  it("resuelve la cuenta de gestion por su ruta completa", () => {
    const csv = movementsToCsv([mov({ management_account_id: "mg-1" })], lookups);
    expect(celdas(csv, 1)[7]).toBe("Ingresos > Ventas");
  });

  it("sin lookups no revienta: deja vacias las columnas derivadas", () => {
    const csv = movementsToCsv([mov()]);
    const fila = celdas(csv, 1);
    expect(fila[0]).toBe("2026-01-15");
    expect(fila[4]).toBe("");
    expect(fila[5]).toBe("");
  });

  it("sin movimientos entrega solo la cabecera", () => {
    expect(movementsToCsv([], lookups)).toBe(MOVEMENT_CSV_HEADERS.join(";"));
  });

  it("respeta el orden recibido, para que el archivo calce con la pantalla", () => {
    const csv = movementsToCsv([mov({ date: "2026-03-01" }), mov({ date: "2026-01-01" })], lookups);
    const fechas = csv
      .split("\r\n")
      .slice(1)
      .map((l) => l.split(";")[0]);
    expect(fechas).toEqual(["2026-03-01", "2026-01-01"]);
  });
});

describe("directionLabel", () => {
  it("traduce credit y debit", () => {
    expect(directionLabel("credit")).toBe("Abono");
    expect(directionLabel("debit")).toBe("Cargo");
  });

  it("deja pasar un valor desconocido sin rotularlo mal", () => {
    expect(directionLabel("reversa")).toBe("reversa");
  });
});

describe("movementsCsvFilename", () => {
  it("incluye el periodo cuando lo hay", () => {
    expect(movementsCsvFilename("2026-01_2026-08")).toBe("movimientos-2026-01_2026-08.csv");
  });

  it("sin periodo usa el nombre base", () => {
    expect(movementsCsvFilename()).toBe("movimientos.csv");
  });
});
