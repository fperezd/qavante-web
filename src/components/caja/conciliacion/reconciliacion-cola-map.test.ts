import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ReconcileResponse, ReviewItem } from "@/lib/api/reconciliation";
import {
  documentoLabel,
  esCobro,
  interpretarErrorConciliar,
  mapCola,
  mapFila,
  parseScore,
  resumenReconcile,
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
      document_count: 1,
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

  it("sin score, ordena por fecha ISO cronológica (más reciente primero), no por día del mes", () => {
    // Bug viejo: comparaba la fecha formateada "DD-MM-YYYY" → "05-01-2026" < "30-12-2025"
    // (por el día 05 < 30) ponía dic-2025 como "más reciente". Con la fecha ISO cruda se ordena bien.
    const resp = {
      count: 2,
      items: [
        item({ movement_id: "viejo", date: "2025-12-30", suggestion: { score: null } }),
        item({ movement_id: "nuevo", date: "2026-01-05", suggestion: { score: null } }),
      ],
    };
    expect(mapCola(resp).map((f) => f.id)).toEqual(["nuevo", "viejo"]);
  });

  it("respuesta vacía o undefined → []", () => {
    expect(mapCola(undefined)).toEqual([]);
    expect(mapCola({ count: 0, items: [] })).toEqual([]);
  });

  it("no muta la entrada", () => {
    const resp = {
      count: 2,
      items: [
        item({ movement_id: "a", suggestion: { score: "65" } }),
        item({ movement_id: "b", suggestion: { score: "88" } }),
      ],
    };
    const antes = resp.items.map((i) => i.movement_id);
    mapCola(resp);
    expect(resp.items.map((i) => i.movement_id)).toEqual(antes);
  });
});

describe("todosLosIds", () => {
  it("devuelve los ids en orden", () => {
    expect(
      todosLosIds(
        mapCola({
          count: 2,
          items: [
            item({ movement_id: "a", suggestion: { score: "65" } }),
            item({ movement_id: "b", suggestion: { score: "88" } }),
          ],
        }),
      ),
    ).toEqual(["b", "a"]);
  });
});

describe("resumenReconcile", () => {
  const res = (over: Partial<ReconcileResponse> = {}): ReconcileResponse => ({
    matched: 0,
    consolidated: 0,
    review: 0,
    excluded: 0,
    ambiguous: 0,
    no_candidate: 0,
    iva_retention: 0,
    nc_netting: 0,
    holding: 0,
    prepago_applied: 0,
    processor_batch: 0,
    ...over,
  });

  it("auto + para revisar: menciona los dos números", () => {
    const r = resumenReconcile(res({ matched: 8, consolidated: 2, review: 5 }));
    expect(r.autoConciliados).toBe(10); // matched + consolidated
    expect(r.paraRevisar).toBe(5);
    expect(r.mensaje).toMatch(/10 movimientos automáticamente.*5 para que revises/);
  });

  it("solo auto: no promete cola", () => {
    const r = resumenReconcile(res({ matched: 3 }));
    expect(r.mensaje).toMatch(/3 movimientos automáticamente.*No quedó nada para revisar/);
  });

  it("solo para revisar: singular correcto", () => {
    expect(resumenReconcile(res({ review: 1 })).mensaje).toBe(
      "Encontré 1 movimiento para que revises.",
    );
  });

  it("nada nuevo: lo dice sin inventar", () => {
    expect(resumenReconcile(res()).mensaje).toMatch(/No encontré movimientos nuevos/);
  });

  it("ignora los contadores internos del motor (excluidos/ambiguos/etc.)", () => {
    // Solo movió categorías internas → para el dueño no hubo nada accionable.
    const r = resumenReconcile(
      res({ excluded: 4, ambiguous: 2, no_candidate: 7, iva_retention: 3 }),
    );
    expect(r.autoConciliados).toBe(0);
    expect(r.paraRevisar).toBe(0);
    expect(r.mensaje).toMatch(/No encontré movimientos nuevos/);
  });
});

describe("interpretarErrorConciliar", () => {
  it("404 not_in_review: marca que la cola quedó vieja y hay que refrescar", () => {
    const r = interpretarErrorConciliar(new ApiError("x", 404, "not_in_review"));
    expect(r.yaNoEnRevision).toBe(true);
    expect(r.mensaje).toMatch(/ya no estaba en revisión/i);
  });

  it("404 sin code también cuenta como ya-no-en-revisión", () => {
    expect(interpretarErrorConciliar(new ApiError("x", 404)).yaNoEnRevision).toBe(true);
  });

  it("otro ApiError (500) con detalle real lo surfacea, y NO refresca", () => {
    const r = interpretarErrorConciliar(new ApiError("El documento ya estaba pagado", 500));
    expect(r.yaNoEnRevision).toBe(false);
    expect(r.mensaje).toBe("El documento ya estaba pagado"); // apiErrorToUserMessage surfacea el detalle
  });

  it("error no-Api (red caída, throw plano) cae a un mensaje seguro", () => {
    const r = interpretarErrorConciliar(new Error("network"));
    expect(r.yaNoEnRevision).toBe(false);
    expect(r.mensaje).toMatch(/No pudimos completar/i);
  });
});
