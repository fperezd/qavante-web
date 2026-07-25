import { describe, it, expect } from "vitest";
import {
  pickPrioridad,
  sortByTotal,
  reminderText,
  waHref,
  mailtoHref,
  readGestionado,
  isGestionado,
  withGestionado,
  withoutGestionado,
  sortDebtors,
  peorMoraDias,
  readGestionadoDocs,
  isGestionadoDoc,
  withGestionadoDoc,
  withoutGestionadoDoc,
  GESTIONADO_KEY,
} from "./cobrar-v2-map";
import type { AccountsReceivableResponse, TopDebtor } from "@/lib/api/cobranza";
import type { DocMaestro } from "@/components/terminos/terminos-pago";

/* Solo importan los campos que lee `peorMoraDias`; el resto es relleno mínimo. */
function doc(over: Partial<DocMaestro>): DocMaestro {
  return {
    folio: 1,
    fecha: "",
    fechaEmision: null,
    monto: 0,
    vencimiento: null,
    estado: "vigente",
    diasParaVencer: null,
    pagado: false,
    tipoDoc: 33,
    esNotaCredito: false,
    refFolio: null,
    anulacion: null,
    neto: null,
    ...over,
  };
}

const debtor = (over: Partial<TopDebtor> & { name: string; total: string }): TopDebtor => ({
  rut: "11111111-1",
  overdue: "0",
  ...over,
});

const base = (top: TopDebtor[]): AccountsReceivableResponse => ({
  total: "162799064.00",
  overdue: "0",
  overdue_pct: "0.0",
  aging: { current: "0", d1_30: "0", d31_60: "0", d61_90: "0", d90_plus: "0" },
  top_debtors: top,
  overdue_documents: [],
  confidence: "medium",
  data_state: "partial",
  generated_at: "2026-07-20T00:39:31Z",
});

// Datos reales Tooxs (2026-07-20): sin vencimientos → todos overdue 0.
const KAUFMANN = debtor({ name: "COMERCIAL KAUFMANN S.A.", rut: "96572360-9", total: "89204419.00" });
const DIVEIMPORT = debtor({ name: "DIVEIMPORT S.A.", rut: "55555555-5", total: "30182477.00" });
const CORREOS = debtor({ name: "EMPRESA DE CORREOS DE CHILE", rut: "60503000-9", total: "9345186.00" });

describe("sortByTotal", () => {
  it("mayor total primero, sin mutar la entrada", () => {
    const input = [DIVEIMPORT, KAUFMANN, CORREOS];
    const out = sortByTotal(input);
    expect(out.map((d) => d.name)).toEqual([KAUFMANN.name, DIVEIMPORT.name, CORREOS.name]);
    expect(input[0]).toBe(DIVEIMPORT); // no mutó
  });
});

describe("pickPrioridad", () => {
  it("modo concentración cuando nadie tiene mora: elige el de mayor total (datos reales Tooxs)", () => {
    const p = pickPrioridad(base([DIVEIMPORT, KAUFMANN, CORREOS]));
    expect(p?.mode).toBe("concentracion");
    expect(p?.debtor.name).toBe(KAUFMANN.name);
    expect(p?.total).toBe(89204419);
    expect(p?.overdue).toBe(0);
    // 89.204.419 / 162.799.064 ≈ 54.8%
    expect(Math.round(p!.pctDelTotal)).toBe(55);
    expect(p?.grandTotal).toBe(162799064);
  });

  it("modo urgencia cuando hay mora: elige el más vencido, no el más grande", () => {
    const grande = debtor({ name: "Grande sin mora", total: "100000000", overdue: "0" });
    const urgente = debtor({ name: "Chico muy vencido", total: "5000000", overdue: "5000000" });
    const p = pickPrioridad(base([grande, urgente]));
    expect(p?.mode).toBe("urgencia");
    expect(p?.debtor.name).toBe("Chico muy vencido");
    expect(p?.overdue).toBe(5000000);
  });

  it("null sin deudores (o top_debtors ausente en estado partial)", () => {
    expect(pickPrioridad(base([]))).toBeNull();
    const sinTop = { ...base([]), top_debtors: undefined };
    expect(pickPrioridad(sinTop)).toBeNull();
  });
});

describe("reminderText", () => {
  it("modo concentración menciona nombre y total, tono formal chileno (sin voseo)", () => {
    const t = reminderText({ name: "COMERCIAL KAUFMANN S.A.", total: 89204419, overdue: 0, mode: "concentracion" });
    expect(t).toContain("Estimados COMERCIAL KAUFMANN S.A.:");
    expect(t).toContain("$89.204.419");
    expect(t).not.toMatch(/vencid/i); // sin mora conocida no habla de vencidos
    // sin imperativos voseo
    expect(t).not.toMatch(/\b(coordiná|revisá|agendá|quedáte)\b/i);
  });

  it("modo urgencia menciona lo vencido y el total", () => {
    const t = reminderText({ name: "Cliente X", total: 10000000, overdue: 4000000, mode: "urgencia" });
    expect(t).toContain("$4.000.000");
    expect(t).toContain("$10.000.000");
    expect(t).toMatch(/vencid/i);
  });
});

describe("waHref / mailtoHref", () => {
  it("wa.me sin número, con el texto url-encoded", () => {
    const href = waHref("Hola & chao");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(href).toContain("Hola%20%26%20chao");
  });

  it("mailto sin destinatario, con asunto y cuerpo encodeados", () => {
    const href = mailtoHref("Cobranza pendiente", "Cuerpo con ñ");
    expect(href.startsWith("mailto:?subject=")).toBe(true);
    expect(href).toContain("Cobranza%20pendiente");
    expect(href).toContain("body=");
    expect(href).toContain("Cuerpo%20con%20%C3%B1");
  });
});

describe("gestionado (prefs)", () => {
  it("readGestionado es defensivo ante blobs basura", () => {
    expect(readGestionado(undefined)).toEqual({});
    expect(readGestionado({ [GESTIONADO_KEY]: "nope" })).toEqual({});
    expect(readGestionado({ [GESTIONADO_KEY]: ["a"] })).toEqual({});
    expect(readGestionado({ [GESTIONADO_KEY]: { "96572360-9": "2026-07-20", bad: 1 } })).toEqual({
      "96572360-9": "2026-07-20",
    });
  });

  it("withGestionado normaliza el RUT y preserva el resto del blob", () => {
    const blob = { otra_pref: "x" };
    const next = withGestionado(blob, "96.572.360-9", "2026-07-20");
    expect(next.otra_pref).toBe("x"); // no pisa el resto (reemplaza, no mergea → superset)
    expect(isGestionado(readGestionado(next), "96572360-9")).toBe(true);
    // el mismo RUT en cualquier formato se reconoce
    expect(isGestionado(readGestionado(next), "96.572.360-9")).toBe(true);
  });

  it("withoutGestionado deshace la marca", () => {
    const marked = withGestionado(undefined, "96572360-9", "2026-07-20");
    const undone = withoutGestionado(marked, "96572360-9");
    expect(isGestionado(readGestionado(undone), "96572360-9")).toBe(false);
  });
});

describe("sortDebtors", () => {
  it("gestionados al fondo, pendientes por tamaño arriba (modo concentración)", () => {
    const gestionado = readGestionado(withGestionado(undefined, KAUFMANN.rut, "2026-07-20"));
    const out = sortDebtors([DIVEIMPORT, KAUFMANN, CORREOS], gestionado);
    // KAUFMANN es el más grande pero ya gestionado → al fondo
    expect(out.map((d) => d.name)).toEqual([DIVEIMPORT.name, CORREOS.name, KAUFMANN.name]);
  });

  it("sin gestionados = orden por tamaño (concentración) intacto", () => {
    const out = sortDebtors([CORREOS, KAUFMANN, DIVEIMPORT], {});
    expect(out.map((d) => d.name)).toEqual([KAUFMANN.name, DIVEIMPORT.name, CORREOS.name]);
  });
});

describe("peorMoraDias", () => {
  it("devuelve los días (positivos) del documento MÁS vencido", () => {
    expect(
      peorMoraDias([
        doc({ diasParaVencer: -10 }),
        doc({ diasParaVencer: -44 }), // el más atrasado
        doc({ diasParaVencer: 5 }),
      ]),
    ).toBe(44);
  });

  it("null si ninguno está vencido (todos por vencer o vigentes)", () => {
    expect(peorMoraDias([doc({ diasParaVencer: 3 }), doc({ diasParaVencer: 20 })])).toBe(null);
  });

  it("ignora NC, pagados y sin fecha de vencimiento", () => {
    expect(
      peorMoraDias([
        doc({ diasParaVencer: -99, esNotaCredito: true }), // NC vieja: no cuenta
        doc({ diasParaVencer: -80, pagado: true }), // ya pagada: no cuenta
        doc({ diasParaVencer: null }), // sin fecha: no cuenta
        doc({ diasParaVencer: -12 }), // única real
      ]),
    ).toBe(12);
  });

  it("lista vacía → null", () => {
    expect(peorMoraDias([])).toBe(null);
  });
});

describe("gestionado por documento (factura)", () => {
  it("marca y detecta una factura por rut+folio; normaliza el RUT", () => {
    const blob = withGestionadoDoc(undefined, "76.114.300-K", 421, "2026-07-25");
    expect(isGestionadoDoc(readGestionadoDocs(blob), "76114300-K", 421)).toBe(true);
    // Otro folio del mismo deudor NO está gestionado.
    expect(isGestionadoDoc(readGestionadoDocs(blob), "76114300-K", 419)).toBe(false);
  });

  it("desmarca (withoutGestionadoDoc) sin tocar otras facturas", () => {
    let blob = withGestionadoDoc(undefined, "1-9", 100, "2026-07-25");
    blob = withGestionadoDoc(blob, "1-9", 200, "2026-07-25");
    blob = withoutGestionadoDoc(blob, "1-9", 100);
    const map = readGestionadoDocs(blob);
    expect(isGestionadoDoc(map, "1-9", 100)).toBe(false);
    expect(isGestionadoDoc(map, "1-9", 200)).toBe(true);
  });

  it("es independiente del gestionado por deudor (claves distintas)", () => {
    const blob = withGestionadoDoc(undefined, "1-9", 100, "2026-07-25");
    // El gestionado por deudor NO se ve afectado.
    expect(isGestionado(readGestionado(blob), "1-9")).toBe(false);
  });
});
