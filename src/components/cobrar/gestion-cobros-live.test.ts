import { describe, expect, it } from "vitest";
import type { AccountsReceivableResponse, ReceivableDocumentItem } from "@/lib/api/cobranza";
import {
  collectedMetric,
  formatCollectionMoney,
  hasAmbiguousReminderFailure,
  isReminderEligible,
  matchesCollectionStatus,
  recuadroPorCobrar,
  recuadroVencido,
  reminderIdempotencyKey,
} from "./gestion-cobros-live";

const BASE: ReceivableDocumentItem = {
  id: "00000000-0000-0000-0000-000000000001",
  folio: "101",
  customer_name: "Cliente de prueba",
  issue_date: "2026-09-01",
  due_date: "2026-09-15",
  due_date_certainty: "confirmed",
  status: "open",
  total_amount: "125000",
  outstanding_amount: "125000",
  currency_code: "CLP",
  days_overdue: 1,
  ceded: false,
  claimed: false,
  credit_note: false,
};

describe("filtros de gestión de cobros", () => {
  it("excluye documentos cedidos de todo lo cobrable", () => {
    const ceded = { ...BASE, ceded: true };
    expect(matchesCollectionStatus(ceded, "collectable", "2026-09-16")).toBe(false);
    expect(matchesCollectionStatus(ceded, "overdue", "2026-09-16")).toBe(false);
  });

  it("separa vencimiento desconocido de vencido", () => {
    const undated = {
      ...BASE,
      due_date: null,
      due_date_certainty: "unconfirmed" as const,
      days_overdue: null,
    };
    expect(matchesCollectionStatus(undated, "undated", "2026-09-16")).toBe(true);
    expect(matchesCollectionStatus(undated, "overdue", "2026-09-16")).toBe(false);
  });

  it("no permite recordar notas de crédito ni saldos no positivos", () => {
    expect(isReminderEligible({ ...BASE, credit_note: true })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "0" })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "-100" })).toBe(false);
    expect(isReminderEligible(BASE)).toBe(true);
  });
});

describe("totales monetarios", () => {
  it("mantiene monedas distintas explícitamente separadas", () => {
    const label = formatCollectionMoney([
      { currency: "CLP", amount: "125000" },
      { currency: "USD", amount: "12.5" },
    ]);
    expect(label).toContain("$125.000");
    expect(label).toContain("US$ 12,50");
    expect(label).toContain(" · ");
  });

  it("no convierte una abstención de cobros en $0 y dice qué hacer para tener la cifra", () => {
    const metric = collectedMetric({
      collected: null,
      collected_coverage: "unverified_legacy_collections",
      collected_reason: "legacy_collection_lineage_unavailable",
    });

    expect(metric).toEqual({
      value: "Conciliación por cerrar",
      detail: "Últimos 7 días",
      note: "Los cobros históricos se suman acá en cuanto cada uno quede conciliado con su movimiento de banco.",
      accion: { texto: "Ir a Banco y conciliar", href: "/banco" },
    });
  });
});

/* ── El cero fabricado de Cobrar ──────────────────────────────────────────────────────────────
 *
 * Producción, tenant Tooxs, 2026-10-02: $44.829.044 por cobrar en 22 documentos y CERO con
 * fecha de vencimiento → `overdue: null`, `overdue_pct: null`, los cuatro tramos de mora en
 * `null` y `undated_amount` igual al total. El recuadro "Vencido" mostraba "$0", o sea
 * "no tienes nada vencido" sobre la cartera completa.
 *
 * El contrato ya lo decía ("`null` ... es 'no sé', no '$0'"). Lo que faltaba era que la pantalla
 * viva lo leyera: `GestionCobrosLive` tomaba `overdue` de `/documents`, donde es una lista no
 * nullable y "nada vencido" y "todavía no se puede calcular" llegan los dos como `[]`. */

/** Resumen agregado SIN una sola fecha de vencimiento: el caso vivo de producción. Los montos
 *  no son los de ningún tenant — son una cartera inventada con la misma FORMA. */
function arSinFechas(over: Partial<AccountsReceivableResponse> = {}): AccountsReceivableResponse {
  return {
    total: "9000000",
    overdue: null,
    overdue_pct: null,
    undated_amount: "9000000",
    document_count: 7,
    estimated_due_date_count: 0,
    aging: { current: "0", d1_30: null, d31_60: null, d61_90: null, d90_plus: null },
    confidence: "low",
    data_state: "partial",
    generated_at: "2026-10-02T20:00:00Z",
    ...over,
  } as AccountsReceivableResponse;
}

/** Las palabras que el dueño del producto prohibió en la UI. */
const PROHIBIDAS = [
  "no disponible",
  "sin dato",
  "sin información",
  "no hay",
  "preliminar",
  "estimado",
];

function sinPalabrasProhibidas(textos: (string | undefined)[]) {
  const junto = textos.filter(Boolean).join(" ").toLocaleLowerCase("es-CL");
  return PROHIBIDAS.filter((palabra) => junto.includes(palabra));
}

describe("recuadro Vencido · nunca un cero fabricado", () => {
  it("con la cartera entera sin fecha dice lo que SÍ se sabe, no $0", () => {
    const r = recuadroVencido(arSinFechas());

    expect(r.value).not.toContain("$0");
    // La cifra que se conoce y de qué está hecha.
    expect(r.value).toBe("$9.000.000 por cobrar");
    expect(r.detail).toBe("7 documentos");
    // Y la acción concreta, con el camino para hacerlo.
    expect(r.accion).toEqual({ texto: "Revisar la conexión con el SII", href: "/conexiones" });
    expect(r.note).toContain("fecha de vencimiento");
  });

  it("no usa ninguna de las palabras prohibidas", () => {
    const r = recuadroVencido(arSinFechas());
    expect(sinPalabrasProhibidas([r.value, r.detail, r.note, r.accion?.texto])).toEqual([]);
  });

  it("un vencido conocido se muestra tal cual, y lo sin fechar queda declarado como lo que falta", () => {
    const r = recuadroVencido(
      arSinFechas({ overdue: "4000000", overdue_pct: "44.4", undated_amount: "1000000" }),
    );

    expect(r.value).toBe("$4.000.000");
    expect(r.detail).toBe("44,4% de la cartera");
    expect(r.note).toContain("$1.000.000");
    expect(r.accion).toBeDefined();
  });

  it("con toda la cartera fechada no inventa un pendiente ni ofrece una acción de más", () => {
    const r = recuadroVencido(
      arSinFechas({ overdue: "4000000", overdue_pct: "44.4", undated_amount: "0" }),
    );

    expect(r.value).toBe("$4.000.000");
    expect(r.note).toBeUndefined();
    expect(r.accion).toBeUndefined();
  });

  it("un cero MEDIDO sigue siendo cero: nada vencido con todo fechado no se disfraza", () => {
    const r = recuadroVencido(arSinFechas({ overdue: "0", overdue_pct: "0", undated_amount: "0" }));

    expect(r.value).toBe("$0");
    expect(r.accion).toBeUndefined();
  });
});

describe("recuadro Por cobrar · próximos 7 días", () => {
  it("sin una sola fecha no son $0 en 7 días: es la cartera esperando fecha", () => {
    const r = recuadroPorCobrar({ due_soon: [] }, arSinFechas());

    expect(r.value).toBe("$9.000.000 por agendar");
    expect(r.value).not.toContain("$0");
    expect(r.accion).toEqual({ texto: "Revisar la conexión con el SII", href: "/conexiones" });
    expect(sinPalabrasProhibidas([r.value, r.detail, r.note, r.accion?.texto])).toEqual([]);
  });

  it("con la cartera fechada muestra la ventana real, incluido un cero medido", () => {
    const r = recuadroPorCobrar({ due_soon: [] }, arSinFechas({ undated_amount: "0" }));

    expect(r.value).toBe("$0");
    expect(r.detail).toBe("Próximos 7 días");
    expect(r.accion).toBeUndefined();
  });

  it("con fechas parciales suma la ventana y declara lo que queda afuera", () => {
    const r = recuadroPorCobrar(
      { due_soon: [{ currency: "CLP", amount: "2000000" }] },
      arSinFechas({ undated_amount: "1000000" }),
    );

    expect(r.value).toBe("$2.000.000");
    expect(r.note).toContain("$1.000.000");
  });
});

describe("idempotencia manual", () => {
  it("conserva la misma clave al reintentar la misma selección", () => {
    const keys = new Map<string, string>();
    const first = reminderIdempotencyKey(keys, ["b", "a"], () => "stable-key");
    const retry = reminderIdempotencyKey(keys, ["a", "b"], () => "other-key");

    expect(retry).toEqual(first);
  });

  it("mantiene el intento abierto cuando el proveedor devuelve un error ambiguo", () => {
    expect(
      hasAmbiguousReminderFailure([{ receivable_id: "a", status: "error", detail: "timeout" }]),
    ).toBe(true);
    expect(
      hasAmbiguousReminderFailure([
        { receivable_id: "a", status: "sent", detail: "ok" },
        { receivable_id: "b", status: "sin_destinatario", detail: "sin correo" },
      ]),
    ).toBe(false);
  });
});
