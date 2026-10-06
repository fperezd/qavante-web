import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PayrollWorkerOutstanding } from "@/lib/api/payroll-evidence";
import { EvidenciaPagosView } from "./evidencia-pagos-view";

/* #203: la vista tiene que MOSTRAR la separación, no sólo tenerla en el modelo.

   Cada test viene con su gemelo. Lo que no se negocia: un período sin evidencia no pinta a nadie
   pagado, y un `null` del contrato no se convierte en `$0` en pantalla. */

function render(data: PayrollWorkerOutstanding): string {
  return renderToStaticMarkup(<EvidenciaPagosView periodLabel="agosto 2026" data={data} />);
}

const SELLADO: PayrollWorkerOutstanding = {
  period: "202608",
  currency_code: "CLP",
  snapshot_id: "3f2f8a1e-1111-4222-8333-444455556666",
  obligation_observed_at: "2026-09-01T12:00:00Z",
  obligation_amount: "13953387.0000",
  batch_allocated_amount: "13113627.0000",
  worker_allocated_amount: "13113627.0000",
  distribution_gap_amount: "0.0000",
  superseded_obligation_allocated_amount: "0.0000",
  confirmed_outstanding_amount: "839760.0000",
  legacy_payable_outstanding_amount: "3000010.00",
  legacy_worker_outstanding_amount: "839760.00",
  legacy_divergence_amount: "2160250.00",
  legacy_assumed_paid_amount: "0.00",
  legacy_outstanding_quality: "legacy_unverified",
  workers: [
    {
      worker_rut: "10.341.986-7",
      worker_name: "Trabajador Con Evidencia",
      obligation_amount: "13113627.0000",
      confirmed_paid_amount: "13113627.0000",
      outstanding_amount: "0.0000",
      line_count: 1,
      currency_code: "CLP",
      state: "confirmed_paid",
      legacy_evidence_quality: "legacy_bank_evidenced",
    },
    {
      worker_rut: "14.632.789-3",
      worker_name: "Trabajador Sin Pago",
      obligation_amount: "839760.0000",
      confirmed_paid_amount: "0.0000",
      outstanding_amount: "839760.0000",
      line_count: 1,
      currency_code: "CLP",
      state: "unallocated",
    },
  ],
  abstention_reasons: [],
};

describe("EvidenciaPagosView", () => {
  it("muestra las seis cifras separadas, cada una con qué cubre", () => {
    const html = render(SELLADO);
    for (const titulo of [
      "Obligación sellada",
      "Saldo según la evidencia",
      "Pago asignado al período",
      "Repartido persona por persona",
      "Brecha de reparto",
      "Pago sobre un sello anterior",
    ]) {
      expect(html).toContain(titulo);
    }
    // Y los montos, al peso y sin decimales (regla de CLP).
    expect(html).toContain("13.953.387");
    expect(html).toContain("13.113.627");
    expect(html).toContain("839.760");
  });

  it("separa lo repartido por persona de lo asignado al lote", () => {
    const html = render(SELLADO);
    expect(html).toContain(
      "De ese pago, la parte que tiene nombre y apellido. Es la única que pone a alguien en verde.",
    );
    expect(html).toContain(
      "Lotes confirmados aplicados al período, con o sin reparto por persona.",
    );
  });

  it("etiqueta las cifras de la capa anterior como lo que son", () => {
    const html = render(SELLADO);
    expect(html).toContain("Las cifras de la capa anterior, para contrastar");
    expect(html).toContain("no confirman a nadie");
    expect(html).toContain("Dado por pagado sin enlace");
  });

  it("un trabajador con evidencia sale distinto de uno sin pago repartido", () => {
    const html = render(SELLADO);
    expect(html).toContain("Pago con evidencia");
    expect(html).toContain("Sin pago repartido a su nombre");
  });

  it("un período con pago asignado y sin repartir NO pinta a nadie pagado", () => {
    // El gemelo del caso que api#422 prohíbe producir: el lote baja el total y no nombra a nadie.
    const html = render({
      ...SELLADO,
      batch_allocated_amount: "13113627.0000",
      worker_allocated_amount: "0.0000",
      distribution_gap_amount: "13113627.0000",
      workers: SELLADO.workers!.map((w) => ({
        ...w,
        confirmed_paid_amount: "0.0000",
        outstanding_amount: w.obligation_amount,
        state: "unallocated",
      })),
      abstention_reasons: ["batch_not_distributed_per_worker"],
    });
    expect(html).not.toContain("Pago con evidencia</span>");
    expect(html).toContain("Sin pago repartido a su nombre");
    expect(html).toContain("todavía no está repartido persona por persona");
    expect(html).toContain("Por qué el período no afirma más que esto");
  });

  it("un monto que el contrato publica en null NO se pinta como $0", () => {
    // El gemelo central de la copia: un período sin sello no tiene obligación, y afirmar $0
    // seria afirmar que no se debe nada.
    const html = render({
      ...SELLADO,
      snapshot_id: null,
      obligation_observed_at: null,
      obligation_amount: null,
      confirmed_outstanding_amount: null,
      batch_allocated_amount: "0.0000",
      worker_allocated_amount: "0.0000",
      distribution_gap_amount: "0.0000",
      workers: [],
      abstention_reasons: ["obligation_snapshot_missing"],
    });
    expect(html).toContain("El período todavía no tiene una obligación sellada.");
    expect(html).toContain("Sin obligación sellada no hay saldo que restar.");
    expect(html).toContain("El período todavía no tiene una obligación sellada contra la que");
    // Sin líneas selladas, la tabla no inventa filas.
    expect(html).toContain("tiene 0 líneas selladas");
  });

  it("una línea sellada sin RUT dice que su monto no se le atribuye a nadie", () => {
    const html = render({
      ...SELLADO,
      workers: [
        {
          worker_rut: null,
          worker_name: null,
          obligation_amount: "1000000.0000",
          confirmed_paid_amount: "0.0000",
          outstanding_amount: "1000000.0000",
          line_count: 1,
          currency_code: "CLP",
          state: "unallocated",
        },
      ],
      abstention_reasons: ["obligation_lines_without_worker"],
    });
    expect(html).toContain("sin RUT");
    expect(html).toContain("no se le atribuye a una persona");
    expect(html).toContain("su monto no se le puede atribuir a una persona");
  });

  it("sin abstenciones no inventa una sección de advertencias", () => {
    // El gemelo: vacío significa que no hay nada que declarar, no que falte información.
    expect(render(SELLADO)).not.toContain("Por qué el período no afirma más que esto");
  });
});
