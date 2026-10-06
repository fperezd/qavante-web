import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Lo que fija este test (D13, issue #202): la pantalla VIVA del detalle F29 —la que está encendida en
   producción— pintaba su "Desglose" de seis filas al lado del total y NUNCA lo reconciliaba. Una
   diferencia entre lo que suman los códigos del F29 y lo que el SII cobra existía igual y nadie la
   veía.

   Este test no mira el módulo nuevo: monta `F29MonthDetail` y exige que la diferencia aparezca
   ROTULADA en la tarjeta. Contra `main` falla por la afirmación, no por un import que no resuelve.

   Patrón de mock igual que `header.test.tsx`: se mockea la capa de datos SII completa y el harness
   `arnes` deja cambiar qué responde cada consulta por caso. */

const arnes = vi.hoisted(() => ({
  impuesto: {} as Record<string, unknown>,
  giros: {} as Record<string, unknown>,
  bridge: {} as Record<string, unknown>,
}));

vi.mock("@/lib/api/sii", () => ({
  useSiiF29Impuesto: () => arnes.impuesto,
  useSiiF29Giros: () => arnes.giros,
  useSiiF29Bridge: () => arnes.bridge,
  siiF29PdfUrl: () => null,
  siiKeys: { f29Pdf: (folio: number) => ["sii", "f29-pdf", folio] },
}));

import { F29MonthDetail } from "./f29-month-detail";

/* El período real medido en prod: folio 9238206586, 2026-07. IVA débito 7.213.010, crédito NULL, PPM
   52.519 → los códigos observados suman 7.265.529, contra un total oficial (código 91) de 7.450.761.
   `unexplained_delta` es `composed_total − declaration_total` = −185.232. */
const IMPUESTO_2026_07 = {
  declarado: true,
  folio: 9238206586,
  total_con_iva: 7_450_761,
  total_sin_iva: 7_450_761,
  iva_debito: 7_213_010,
  iva_credito: null,
  iva_determinado: 7_213_010,
  iva_postergado: 0,
  iva_postergable: 0,
  remanente: null,
  ppm: 52_519,
  impuesto_trabajadores: 0,
  fuente_impuesto_trabajadores: "buk",
};

const BRIDGE_2026_07 = {
  data_state: "partial",
  declaration_id: "decl-9238206586",
  declaration_total: 7_450_761,
  folio: 9238206586,
  observed_at: "2026-08-01T10:00:00Z",
  official_components: { code_538: 7_213_010, code_537: null, code_62: 52_519 },
  payment: {
    applications: [],
    bank_evidence: { applied_amount: "0", bank_movement_id: null },
    declaration_receipt: {
      folio: 9238206586,
      declaration_total: 7_450_761,
      source: "sii_f29_pdf",
    },
    evidence_declared: 0,
    evidence_required: 1,
    missing_requirements: ["bank_movement_declared"],
    payment_state: "pending",
  },
  payment_state: "pending",
  period_month: 7,
  period_year: 2026,
  reconciled: false,
  unexplained_delta: -185_232,
};

function html() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <F29MonthDetail anio={2026} mes={7} mesLabel="julio" onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("F29MonthDetail — el Desglose ahora se reconcilia contra lo que cobra el SII", () => {
  beforeEach(() => {
    arnes.impuesto = { data: IMPUESTO_2026_07, isLoading: false, isError: false };
    arnes.giros = { data: { estado: "sin_giro", postergado_iva: false }, isError: false };
    arnes.bridge = { data: { bridges: [BRIDGE_2026_07] }, isError: false };
  });

  it("rotula la diferencia no explicada del período, con su monto", () => {
    const markup = html();
    expect(markup).toContain("Diferencia no explicada");
    expect(markup).toContain("185.232");
  });

  it("muestra las dos cifras que producen la diferencia, no sólo el total", () => {
    const markup = html();
    expect(markup).toContain("7.265.529"); // lo que suman los códigos del F29
    expect(markup).toContain("7.450.761"); // lo que cobra el SII (código 91)
  });

  it("dice que nadie declaró todavía el movimiento que pagó este período", () => {
    expect(html()).toContain("Nadie declaró todavía un movimiento ni un comprobante");
  });

  it("GEMELO: con la diferencia en cero NO rotula nada, y el desglose sigue ahí", () => {
    arnes.bridge = {
      data: {
        bridges: [
          { ...BRIDGE_2026_07, unexplained_delta: 0, reconciled: true, data_state: "complete" },
        ],
      },
      isError: false,
    };
    const markup = html();
    expect(markup).not.toContain("Diferencia no explicada");
    expect(markup).toContain("explican el total completo");
    expect(markup).toContain("Desglose");
  });

  it("GEMELO: sin bridge para el período el desglose se muestra igual, sin inventar un cuadre", () => {
    arnes.bridge = { data: { bridges: [] }, isError: false };
    const markup = html();
    expect(markup).toContain("Desglose");
    expect(markup).not.toContain("Diferencia no explicada");
    expect(markup).not.toContain("explican el total completo");
  });

  it("si la consulta del puente falla, la tarjeta lo dice en vez de callarse", () => {
    arnes.bridge = { data: undefined, isError: true, error: new Error("boom") };
    const markup = html();
    expect(markup).toContain("cuadra este F29 con lo que cobra el SII");
    expect(markup).not.toContain("Diferencia no explicada");
  });
});
