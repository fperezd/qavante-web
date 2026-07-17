import { describe, expect, it } from "vitest";
import type { ReviewItem } from "@/lib/api/reconciliation";
import {
  documentoLabel,
  esCobro,
  mapCola,
  mapFila,
  parseScore,
  scoreTexto,
  todosLosIds,
} from "./reconciliacion-cola-map";

const item = (
  over: Omit<Partial<ReviewItem>, "suggestion"> & {
    suggestion?: Partial<ReviewItem["suggestion"]>;
  } = {},
): ReviewItem => {
  const { suggestion, ...rest } = over;
  return {
    movement_id: "mv1",
    date: "2026-07-10",
    amount: "150000",
    description: "TRANSF RECIBIDA",
    ...rest,
    suggestion: {
      document_kind: "receivable",
      document_id: "doc1",
      name: "Comercial Los Andes",
      score: "78",
      ...suggestion,
    },
  };
};

describe("esCobro / documentoLabel", () => {
  it("receivable = cobro, payable = pago", () => {
    expect(esCobro("receivable")).toBe(true);
    expect(esCobro("payable")).toBe(false);
  });

  it("traduce los conocidos y deja tal cual los desconocidos (honesto)", () => {
    expect(documentoLabel("receivable")).toMatch(/cobrar/i);
    expect(documentoLabel("payable")).toMatch(/pagar/i);
    expect(documentoLabel("loan_installment")).toBe("loan_installment");
  });
});

describe("parseScore / scoreTexto", () => {
  it("parsea 0-100 y redondea a %", () => {
    expect(parseScore("78")).toBe(78);
    expect(scoreTexto("77.6")).toBe("78%");
  });

  it("null/vacío/no numérico → null / cadena vacía", () => {
    expect(parseScore(null)).toBeNull();
    expect(parseScore("")).toBeNull();
    expect(parseScore("alto")).toBeNull();
    expect(scoreTexto(null)).toBe("");
  });
});

describe("mapFila", () => {
  it("cobro: monto positivo; pago: monto negativo (signo por dirección, no por el string)", () => {
    const cobro = mapFila(item());
    expect(cobro.esCobro).toBe(true);
    expect(cobro.montoTexto).toBe("$150.000");

    const pago = mapFila(item({ suggestion: { document_kind: "payable" }, amount: "150000" }));
    expect(pago.esCobro).toBe(false);
    expect(pago.montoTexto).toBe("−$150.000");
  });

  it("un amount ya firmado no dobla el signo (usa magnitud)", () => {
    const pago = mapFila(item({ suggestion: { document_kind: "payable" }, amount: "-150000" }));
    expect(pago.montoTexto).toBe("−$150.000");
  });

  it("sin nombre de contraparte no inventa uno", () => {
    const f = mapFila(item({ suggestion: { name: null } }));
    expect(f.tieneNombre).toBe(false);
    expect(f.contraparte).toMatch(/sin nombre/i);
  });

  it("sin glosa cae a 'Sin glosa'", () => {
    expect(mapFila(item({ description: null })).glosaBanco).toBe("Sin glosa");
    expect(mapFila(item({ description: "  " })).glosaBanco).toBe("Sin glosa");
  });
});

describe("mapCola", () => {
  it("ordena por score descendente; los sin score al final", () => {
    const resp = {
      count: 3,
      items: [
        item({ movement_id: "a", suggestion: { score: "65" } }),
        item({ movement_id: "b", suggestion: { score: "88" } }),
        item({ movement_id: "c", suggestion: { score: null } }),
      ],
    };
    expect(mapCola(resp).map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("respuesta vacía o undefined → []", () => {
    expect(mapCola(undefined)).toEqual([]);
    expect(mapCola({ count: 0, items: [] })).toEqual([]);
  });

  it("no muta la entrada", () => {
    const resp = { count: 2, items: [item({ movement_id: "a", suggestion: { score: "65" } }), item({ movement_id: "b", suggestion: { score: "88" } })] };
    const antes = resp.items.map((i) => i.movement_id);
    mapCola(resp);
    expect(resp.items.map((i) => i.movement_id)).toEqual(antes);
  });
});

describe("todosLosIds", () => {
  it("devuelve los ids en orden", () => {
    expect(todosLosIds(mapCola({ count: 2, items: [item({ movement_id: "a", suggestion: { score: "65" } }), item({ movement_id: "b", suggestion: { score: "88" } })] }))).toEqual(["b", "a"]);
  });
});
