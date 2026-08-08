import { describe, it, expect } from "vitest";
import { componerAgenda, agruparAgenda, totalesAgenda, HORIZONTE_AGENDA } from "./agenda-model";
import { addDays, type ContraparteMaestro } from "@/components/terminos/terminos-pago";
import type { PayableItem } from "@/lib/api/pagos";

const HOY = new Date(2026, 7, 8); // 8 ago 2026 (mes 0-index: 7 = agosto)

/** Contraparte con UN doc no pagado que vence a `dias` de hoy. */
const cp = (name: string, total: number, dias: number): ContraparteMaestro =>
  ({
    rut: "76000000-0",
    name,
    total,
    pagado: 0,
    docs: [
      {
        vencimiento: addDays(HOY, dias),
        pagado: false,
        esNotaCredito: false,
        monto: total,
      },
    ],
  }) as unknown as ContraparteMaestro;

const pay = (
  label: string,
  category: PayableItem["category"],
  dias: number,
  amount: number,
): PayableItem =>
  ({
    label,
    category,
    due_date: fmt(addDays(HOY, dias)),
    amount: String(amount),
  }) as PayableItem;

function fmt(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

describe("componerAgenda", () => {
  it("cobros (+) y pagos (−) de los próximos 14 días, ordenados por fecha; excluye lo de más de 14 días", () => {
    const movs = componerAgenda(
      [cp("Kaufmann", 1_000_000, 3)], // cobro +3d
      [cp("A&B", 200_000, 9)], // pago proveedor +9d
      [], // honorarios
      [
        pay("Sueldos", "payroll", 0, 2_600_000),
        pay("IVA F29", "tax", 12, 210_000),
        pay("Lejano", "rent", 20, 900_000),
      ],
      HOY,
    );
    // 4 movimientos en ventana (el de +20d se excluye).
    expect(movs.length).toBe(4);
    // Ordenados por fecha: sueldos (0), Kaufmann (3), A&B (9), IVA (12).
    expect(movs.map((m) => m.label)).toEqual(["Sueldos", "Kaufmann", "A&B", "IVA F29"]);
    // Signos: cobro +, pagos −.
    expect(movs.find((m) => m.label === "Kaufmann")!.monto).toBe(1_000_000);
    expect(movs.find((m) => m.label === "A&B")!.monto).toBe(-200_000);
    expect(movs.find((m) => m.label === "Sueldos")!.monto).toBe(-2_600_000);
  });

  it("solo obligaciones de categorías de pago futuro (payroll/tax/rent/debt/leasing); ignora 'supplier'/'other'", () => {
    const movs = componerAgenda(
      [],
      [],
      [],
      [
        pay("Sueldos", "payroll", 2, 1_000_000),
        pay("Ruido", "other", 2, 500_000),
        pay("Prov", "supplier", 2, 300_000),
      ],
      HOY,
    );
    expect(movs.map((m) => m.label)).toEqual(["Sueldos"]);
  });
});

describe("agruparAgenda", () => {
  it("separa en esta semana (0–6) y próxima (7–13)", () => {
    const movs = componerAgenda(
      [cp("Cobro cercano", 500_000, 2)],
      [cp("Pago próxima", 300_000, 10)],
      [],
      [],
      HOY,
    );
    const grupos = agruparAgenda(movs, HOY);
    expect(grupos.map((g) => g.titulo)).toEqual(["Esta semana", "Próxima semana"]);
    expect(grupos[0]!.items.map((m) => m.label)).toEqual(["Cobro cercano"]);
    expect(grupos[1]!.items.map((m) => m.label)).toEqual(["Pago próxima"]);
    // El rango legible de la primera semana empieza hoy.
    expect(grupos[0]!.rango).toMatch(/8/);
  });

  it("grupos vacíos se conservan (la vista dice 'nada')", () => {
    const grupos = agruparAgenda([], HOY);
    expect(grupos.length).toBe(2);
    expect(grupos.every((g) => g.items.length === 0)).toBe(true);
  });
});

describe("totalesAgenda", () => {
  it("suma cobros y pagos por separado (ambos positivos)", () => {
    const movs = componerAgenda(
      [cp("Cobro", 1_000_000, 2)],
      [cp("Pago", 400_000, 3)],
      [],
      [pay("Sueldos", "payroll", 1, 600_000)],
      HOY,
    );
    const t = totalesAgenda(movs);
    expect(t.cobros).toBe(1_000_000);
    expect(t.pagos).toBe(1_000_000); // 400k + 600k
    expect(t.n).toBe(3);
  });
});

describe("HORIZONTE_AGENDA", () => {
  it("es 14 días", () => expect(HORIZONTE_AGENDA).toBe(14));
});
