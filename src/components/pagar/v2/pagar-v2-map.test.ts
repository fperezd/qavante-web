import { describe, it, expect } from "vitest";
import {
  postergabilidadDe,
  montoCLP,
  mapVencimientos,
  mapFechasClave,
  mapConcentracion,
  mapBrecha,
  cpToPayableItem,
  sumItemsHasta,
} from "./pagar-v2-map";
import type { PayableItem, AccountsPayableResponse } from "@/lib/api/pagos";
import type { ContraparteMaestro, DocMaestro } from "@/components/terminos/terminos-pago";

const NOW = new Date(2026, 6, 14); // 14-jul-2026

const item = (over: Partial<PayableItem>): PayableItem =>
  ({
    label: "X",
    category: "supplier",
    due_date: "2026-07-20",
    amount: "1000",
    criticality: "medium",
    source: "SII",
    ...over,
  }) as PayableItem;

describe("postergabilidadDe", () => {
  it("impuestos/sueldos/deuda = no postergable", () => {
    expect(postergabilidadDe(item({ category: "tax" }))).toBe("no_postergable");
    expect(postergabilidadDe(item({ category: "payroll" }))).toBe("no_postergable");
    expect(postergabilidadDe(item({ category: "debt" }))).toBe("no_postergable");
  });
  it("baja criticidad = cubierto; resto = negociable", () => {
    expect(postergabilidadDe(item({ category: "supplier", criticality: "low" }))).toBe("cubierto");
    expect(postergabilidadDe(item({ category: "supplier", criticality: "medium" }))).toBe("negociable");
    expect(postergabilidadDe(item({ category: "rent", criticality: "high" }))).toBe("negociable");
  });
});

describe("montoCLP", () => {
  it("usa amount_clp si es moneda extranjera", () => {
    expect(montoCLP(item({ currency: "USD", amount: "1240", amount_clp: "1190000" }))).toBe(1_190_000);
  });
  it("usa amount si es CLP", () => {
    expect(montoCLP(item({ amount: "5000" }))).toBe(5000);
  });
});

describe("mapVencimientos", () => {
  it("pone el vencido primero y setea postergabilidad + USD de origen", () => {
    const items = [
      item({ label: "F29", category: "tax", due_date: "2026-07-20", amount: "4200000" }),
      item({ label: "Google", category: "supplier", due_date: "2026-07-10", amount: "1240", currency: "USD", amount_clp: "1190000", counterparty_name: "Google Cloud" }),
    ];
    const out = mapVencimientos(items, NOW);
    expect(out[0]?.vencido).toBe(true); // Google venció (10-jul)
    expect(out[0]?.acreedor).toBe("Google Cloud");
    expect(out[0]?.montoOrigen).toMatch(/US\$/);
    const f29 = out.find((v) => v.acreedor === "F29");
    expect(f29?.postergabilidad).toBe("no_postergable");
  });
});

describe("mapFechasClave", () => {
  it("arma imposiciones / impuestos / sueldos si están", () => {
    const items = [
      item({ label: "Cotizaciones Previred", category: "payroll", source: "Previred", amount: "3850000", due_date: "2026-07-13" }),
      item({ label: "IVA F29", category: "tax", amount: "4200000", due_date: "2026-07-20" }),
      item({ label: "Sueldos julio", category: "payroll", source: "Manual", amount: "8900000", due_date: "2026-07-30" }),
    ];
    const out = mapFechasClave(items, NOW);
    expect(out.map((f) => f.id)).toEqual(["imposiciones", "impuestos", "sueldos"]);
    expect(out[0]?.monto).toBe(3_850_000);
  });
  it("propaga el flag `estimated` del backend (ej. F29 estimado)", () => {
    const items = [item({ label: "IVA F29", category: "tax", amount: "4200000", estimated: true })];
    const out = mapFechasClave(items, NOW);
    expect(out.find((f) => f.id === "impuestos")?.estimado).toBe(true);
  });
});

describe("mapConcentracion", () => {
  it("agrupa por acreedor, ordena desc y calcula pct", () => {
    const items = [
      item({ counterparty_name: "KAUFMANN", amount: "2000000" }),
      item({ counterparty_name: "KAUFMANN", amount: "1000000" }),
      item({ counterparty_name: "DIVEIMPORT", amount: "1000000" }),
    ];
    const out = mapConcentracion(items);
    expect(out[0]).toEqual({ nombre: "KAUFMANN", rut: undefined, monto: 3_000_000, pct: 75 });
    expect(out[1]?.nombre).toBe("DIVEIMPORT");
  });
});

describe("mapBrecha", () => {
  it("caja proyectada vs (vencido + no-postergables ≤14d); postergable aparte", () => {
    const items = [
      item({ label: "prov vencido", category: "supplier", due_date: "2026-07-10", amount: "2000000" }), // vencido
      item({ label: "F29", category: "tax", due_date: "2026-07-20", amount: "4200000" }), // crítico ≤14d
      item({ label: "prov neg", category: "supplier", due_date: "2026-07-17", amount: "1000000" }), // negociable ≤14d
    ];
    const resp = { projected_cash_14d: "9400000" } as AccountsPayableResponse;
    const b = mapBrecha(resp, items, NOW);
    expect(b.cajaProyectada).toBe(9_400_000);
    expect(b.pagosCriticos).toBe(6_200_000); // 2M vencido + 4.2M F29
    expect(b.postergable).toBe(1_000_000);
  });

  it("projected_cash_14d null → cajaProyectada null (NO $0: faltante ≠ 0, §13)", () => {
    const items = [item({ label: "F29", category: "tax", due_date: "2026-07-20", amount: "4200000" })];
    const resp = { projected_cash_14d: null } as unknown as AccountsPayableResponse;
    const b = mapBrecha(resp, items, NOW);
    expect(b.cajaProyectada).toBeNull(); // el backend no la calculó → desconocida, no cero
    expect(b.pagosCriticos).toBe(4_200_000);
  });
});

const docM = (over: Partial<DocMaestro>): DocMaestro => ({
  folio: 1,
  fecha: "01/06/2026",
  fechaEmision: new Date(2026, 5, 1),
  monto: 1_000_000,
  vencimiento: new Date(2026, 6, 1),
  estado: "vencido",
  diasParaVencer: -13,
  pagado: false,
  tipoDoc: 33,
  esNotaCredito: false,
  refFolio: null,
  anulacion: null,
  neto: null,
  ...over,
});
const cpM = (over: Partial<ContraparteMaestro>): ContraparteMaestro => ({
  rut: "77111222-3",
  name: "Proveedor X",
  docCount: 1,
  total: 1_000_000,
  vencido: 1_000_000,
  porVencer: 0,
  vigente: 0,
  pagado: 0,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: null,
  docs: [docM({})],
  ...over,
});

describe("cpToPayableItem", () => {
  it("neto por pagar + due del vencimiento más urgente; high si hay vencido", () => {
    const it = cpToPayableItem(cpM({}), "SII · compras")!;
    expect(it.category).toBe("supplier");
    expect(it.amount).toBe("1000000");
    expect(it.criticality).toBe("high"); // vencido > 0
    expect(it.due_date).toBe("2026-07-01");
    expect(it.counterparty_rut).toBe("77111222-3");
  });
  it("null si no queda saldo (todo conciliado)", () => {
    expect(cpToPayableItem(cpM({ total: 1_000_000, pagado: 1_000_000 }), "SII")).toBeNull();
  });
  it("ignora NC y conciliados para la fecha; usa el más temprano no conciliado", () => {
    const cp = cpM({
      total: 3_000_000,
      vencido: 0,
      docs: [
        docM({ folio: 1, esNotaCredito: true, vencimiento: new Date(2026, 4, 1) }),
        docM({ folio: 2, pagado: true, vencimiento: new Date(2026, 4, 15) }),
        docM({ folio: 3, vencimiento: new Date(2026, 7, 10), estado: "vigente" }),
      ],
    });
    const it = cpToPayableItem(cp, "SII")!;
    expect(it.criticality).toBe("medium"); // vencido 0
    expect(it.due_date).toBe("2026-08-10");
  });
});

describe("sumItemsHasta", () => {
  it("suma los que vencen en [0, maxDias]; excluye vencidos y fuera de ventana", () => {
    const items = [
      item({ due_date: "2026-07-10", amount: "100" }), // vencido (antes de NOW) → excluye
      item({ due_date: "2026-07-18", amount: "200" }), // en 4 días → ≤7
      item({ due_date: "2026-07-25", amount: "400" }), // en 11 días → solo ≤30
    ];
    expect(sumItemsHasta(items, NOW, 7)).toBe(200);
    expect(sumItemsHasta(items, NOW, 30)).toBe(600);
  });
});
