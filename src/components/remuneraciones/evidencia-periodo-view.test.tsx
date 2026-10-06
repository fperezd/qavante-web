import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PayrollPeriodEvidence } from "@/lib/api/payroll-evidence";
import { EvidenciaPeriodoView } from "./evidencia-periodo-view";

/* #203, la separación que faltaba en pantalla: **pago observado por verificar** aparte de
   **pago de lote confirmado**.

   Cada test viene con su gemelo, y el par importa. El defecto es que un pago observado y no
   confirmado se lea como pagado; pero una pantalla que no dijera "pagado" NUNCA pasaría ese
   test igual de verde sin arreglar nada. Por eso el gemelo exige que un período confirmado SÍ
   se rotule pagado. */

function render(data: PayrollPeriodEvidence): string {
  return renderToStaticMarkup(<EvidenciaPeriodoView periodLabel="septiembre 2026" data={data} />);
}

const BASE: PayrollPeriodEvidence = {
  period: "202609",
  currency_code: "CLP",
  obligation_amount: "14113637.0000",
  obligation_observed_at: "2026-10-01T12:00:00Z",
  observed_payment_amount: null,
  legacy_outstanding_amount: "12114232.00",
  legacy_outstanding_quality: "legacy_unverified",
  confirmed_outstanding_amount: "14113637.0000",
  allocation_coverage: "unallocated",
  state: "accrued_liquid",
  abstention_reasons: [],
};

describe("EvidenciaPeriodoView · observado no es pagado (#203)", () => {
  it("(a) un pago OBSERVADO y no confirmado no se rotula como pagado", () => {
    /* El caso exacto del issue: lo observado calza al peso con la obligación sellada. Si la
       pantalla dedujera el estado comparando las dos cifras, acá diría "pagado" sin que nadie
       haya confirmado un solo peso. */
    const html = render({
      ...BASE,
      state: "observed_unconfirmed",
      observed_payment_amount: "14113637.0000",
      confirmed_outstanding_amount: "14113637.0000",
      abstention_reasons: ["payment_evidence_missing"],
    });

    /* El rótulo del PERÍODO —el que sale del `state`— dice que está por verificar. */
    expect(html).toContain("Pago observado, por verificar");
    expect(html).toContain("Mientras siga por verificar, el período no cuenta como cubierto");
    /* Y en ningún lado el período queda rotulado como pagado. */
    expect(html).not.toContain("Pagado con evidencia confirmada");
    expect(html).not.toMatch(/Pagado con/);
    /* Lo observado se muestra con su propio recuadro, diciendo que no baja el saldo. */
    expect(html).toContain("todavía nadie confirmó");
    expect(html).toContain("No baja el saldo");
  });

  it("(b) GEMELO: un pago CONFIRMADO sí se rotula como pagado", () => {
    /* Sin este gemelo, una pantalla que jamás dijera "pagado" pasaría (a) en verde sin arreglar
       nada: el arreglo tiene que distinguir, no callar. */
    const html = render({
      ...BASE,
      state: "confirmed_paid",
      observed_payment_amount: "14113637.0000",
      confirmed_outstanding_amount: "0.0000",
      allocation_coverage: "full",
    });

    expect(html).toContain("Pagado con evidencia confirmada");
    expect(html).toContain("Un pago confirmado cubre la obligación sellada del período.");
    /* El recuadro de lo observado sigue en pantalla —el contrato publica esa cifra igual—, pero
       el PERÍODO ya no está rotulado por verificar: la frase del estado desaparece. */
    expect(html).not.toContain("Mientras siga por verificar");
  });

  it("(c) con el reparto por trabajador sin acreditar, lo DICE en vez de deducirlo del monto", () => {
    /* Un lote confirmado que baja el total y sigue `unallocated`: el issue pide que no se
       deduzca qué persona se pagó desde el monto ni desde la glosa. */
    const html = render({
      ...BASE,
      state: "confirmed_outstanding",
      observed_payment_amount: "13113627.0000",
      confirmed_outstanding_amount: "1000010.0000",
      allocation_coverage: "unallocated",
      abstention_reasons: ["batch_not_distributed_per_worker"],
    });

    expect(html).toContain("Sin repartir por persona");
    expect(html).toContain("no alcanza para nombrar a nadie");
    expect(html).toContain(
      "Hay pago asignado al período que todavía no está repartido persona por persona.",
    );
  });

  it("(c) GEMELO: cuando el reparto SÍ está acreditado, la pantalla lo declara repartido", () => {
    const html = render({ ...BASE, state: "confirmed_paid", allocation_coverage: "full" });

    expect(html).toContain("Repartido persona por persona");
    expect(html).not.toContain("no alcanza para nombrar a nadie");
  });

  it("(d) una cifra que el contrato publica en null NO aparece derivada ni como $0", () => {
    /* `confirmed_outstanding_amount: null` es abstención, no impago. Pintar "$0" afirmaría que
       no se debe nada, que es inventar una verdad financiera que el contrato no publica. */
    const html = render({
      ...BASE,
      state: "conflict",
      observed_payment_amount: null,
      confirmed_outstanding_amount: null,
      abstention_reasons: ["payment_currency_conflict"],
    });

    expect(html).toContain(
      "La lectura se abstiene del saldo: las razones de abajo dicen qué le falta al período para tenerlo.",
    );
    expect(html).not.toContain("$0");
    expect(html).toContain("no coinciden en una sola moneda");
  });

  it("(d) GEMELO: la cifra que el contrato SÍ publica se muestra, al peso", () => {
    const html = render({ ...BASE, confirmed_outstanding_amount: "14113637.0000" });

    expect(html).toContain("$14.113.637");
    expect(html).not.toContain("se abstiene del saldo");
  });

  it("una razón de abstención que la pantalla no traduce se NOMBRA igual, no desaparece", () => {
    const html = render({ ...BASE, abstention_reasons: ["una_razon_nueva_del_backend"] });
    expect(html).toContain("una_razon_nueva_del_backend");
  });

  it("GEMELO: sin abstenciones no se inventa una sección de advertencias", () => {
    const html = render({ ...BASE, abstention_reasons: [] });
    expect(html).not.toContain("Por qué el período no afirma más que esto");
  });
});
