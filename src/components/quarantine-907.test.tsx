/* #907 (qavante-api, cuarentena #687): importes `null` + `amount_unknown_reason` en Caja, Cobrar,
   Inicio, Bandeja y Banco. Regla única: desconocido se DICE ("En revisión"), nunca es $0, ni un
   piso, ni "sin deuda". Cada negativo tiene su gemelo positivo sobre el mismo fixture. */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MONTO_EN_REVISION, MONTO_EN_REVISION_MOTIVO } from "@/lib/formatters/amount";
import { cobranza, pagos as pagosCaja, summary } from "@/components/caja/v02/caja-v02-fixtures";
import { entra14d, sale14d } from "@/components/caja/v02/caja-v02-model";
import {
  compararTotalDesc,
  shareOfTotal,
  sortByUrgency,
} from "@/components/cobrar/cobranza-format";
import { pickPrioridad, reminderText, sortByTotal } from "@/components/cobrar/v2/cobrar-v2-map";
import { formatCollectionMoney, isReminderEligible } from "@/components/cobrar/gestion-cobros-live";
import {
  mapCobranza,
  mapCobranzaForecast,
  mapPlanBrecha,
} from "@/components/inicio/v2/inicio-v2-map";
import { indicadoresHoy } from "@/components/inicio/v01/hoy-model";
import { CobranzaRealizable } from "@/components/inicio/v2/cobranza-realizable";
import { AgendaWidget } from "@/components/inicio/v2/agenda-widget";
import { pagosEnRevisionAgenda } from "@/components/inicio/v2/agenda-model";
import { formattedInboxAmount } from "@/components/bandeja/work-inbox-model";
import { MontosEnRevisionState } from "@/components/treasury/sync-pending-state";
import { PagarHero } from "@/components/pagar/v2/pagar-hero";
import type { PayableItem } from "@/lib/api/pagos";
import type { AccountsReceivableResponse, ReceivableDocumentItem } from "@/lib/api/cobranza";

/* Cartera por cobrar con la forma del contrato vivo (`AccountsReceivableResponse`). Vivía en las
   fixtures de V04 · Cobrar, que se retiró; `pickPrioridad` es lo único que la seguía usando, así
   que la fixture se queda acá, al lado de su único test. Cifras inventadas, no de un tenant. */
function ar(over: Partial<AccountsReceivableResponse> = {}): AccountsReceivableResponse {
  return {
    total: "42579467",
    overdue: "27779467",
    overdue_pct: "65.2",
    undated_amount: "0",
    estimated_due_date_count: 0,
    document_count: 15,
    aging: {
      current: "14800000",
      d1_30: "9400000",
      d31_60: "8900000",
      d61_90: "5400000",
      d90_plus: "4079467",
    },
    top_debtors: [
      { name: "Diveimport S.A.", rut: "76.111.111-1", total: "11582539", overdue: "3300000" },
      {
        name: "Comercial Kaufmann S.A.",
        rut: "76.222.222-2",
        total: "4322373",
        overdue: "4322373",
      },
      { name: "GPS7000", rut: "77.444.444-4", total: "1792441", overdue: "1792441" },
    ],
    ...over,
  } as AccountsReceivableResponse;
}

const Q = "reconciliation_quarantine" as const;

describe("Caja v02 · entra/sale 14 días", () => {
  it("un bucket del forecast en revisión vuelve desconocido lo que entra", () => {
    expect(entra14d(cobranza())).toMatchObject({ enRevision: false, esperado: 14_498_964 });
    const conNull = cobranza({
      buckets: [
        { label: "0-7d", days_from: 0, days_to: 7, nominal: null, expected: null },
        { label: "8-14d", days_from: 8, days_to: 14, nominal: "8500000", expected: "7498964" },
      ],
    });
    expect(entra14d(conNull)).toEqual({ esperado: null, nominal: null, enRevision: true });
    expect(entra14d(cobranza({ amount_unknown_reason: Q }))!.enRevision).toBe(true);
  });

  it("con cuarentena AP lo que sale es desconocido, no 'no vino' ni $0", () => {
    expect(sale14d(pagosCaja())!.total).not.toBeNull();
    const s = sale14d(pagosCaja({ amount_unknown_reason: Q, due_14d: null }));
    expect(s).toEqual({ total: null, enRevision: true, noPostergable: null });
  });
});

describe("Cobrar · deudores y recordatorios", () => {
  it("shareOfTotal y el orden no inventan cifras para un total en revisión", () => {
    expect(shareOfTotal("50", "100")).toBe(50);
    expect(shareOfTotal(null, "100")).toBeNull();
    expect(shareOfTotal("50", null)).toBeNull();
    expect(compararTotalDesc("10", "20")).toBeGreaterThan(0);
    const orden = sortByTotal([
      { name: "a", total: null },
      { name: "b", total: "5" },
      { name: "c", total: "9" },
    ]);
    expect(orden.map((d) => d.name)).toEqual(["c", "b", "a"]);
    const urg = sortByUrgency([
      { name: "a", overdue: "0", total: null },
      { name: "b", overdue: "0", total: "1" },
    ]);
    expect(urg.map((d) => d.name)).toEqual(["b", "a"]);
  });

  it("el recordatorio no cita un total en revisión (gemelo: con total sí lo cita)", () => {
    const base = { name: "Cliente", overdue: 0, mode: "concentracion" as const };
    expect(reminderText({ ...base, total: 1_000 })).toContain("$1.000");
    const sinTotal = reminderText({ ...base, total: null });
    expect(sinTotal).not.toMatch(/\$/);
    expect(sinTotal).toContain("documentos pendientes");
  });

  it("pickPrioridad no recomienda sobre montos en revisión", () => {
    expect(pickPrioridad(ar())).not.toBeNull();
    expect(pickPrioridad(ar({ total: null, amount_unknown_reason: Q }))).toBeNull();
  });

  it("gestión de cobros: moneda en revisión se nombra y no se envía recordatorio", () => {
    expect(formatCollectionMoney([{ currency: "CLP", amount: "1000" }])).toBe("$1.000");
    expect(formatCollectionMoney([{ currency: "CLP", amount: null }])).toBe(
      `${MONTO_EN_REVISION} (CLP)`,
    );
    const doc = {
      status: "open",
      ceded: false,
      credit_note: false,
      outstanding_amount: "5000",
      due_date_certainty: "confirmed",
    } as ReceivableDocumentItem;
    expect(isReminderEligible(doc)).toBe(true);
    expect(isReminderEligible({ ...doc, outstanding_amount: null })).toBe(false);
  });
});

describe("Inicio · cobranza, Hoy y agenda", () => {
  it("mapCobranza declara la revisión; el gemelo conocido publica el total", () => {
    const conocido = mapCobranza(
      summary({
        overdue_collections: {
          total_receivable: "1000",
          overdue: "10",
          top_clients: [],
        } as never,
      }),
    )!;
    expect(conocido.totalPorCobrar).toBe(1000);
    expect(conocido.enRevision).toBe(false);
    const revision = mapCobranza(
      summary({
        overdue_collections: {
          total_receivable: null,
          overdue: null,
          amount_unknown_reason: Q,
          top_clients: [],
        } as never,
      }),
    )!;
    expect(revision.totalPorCobrar).toBeNull();
    expect(revision.esperadoATiempo).toBeNull();
    expect(revision.enRevision).toBe(true);
  });

  it("forecast en revisión: props en revisión y sin plan de brecha", () => {
    expect(mapCobranzaForecast(cobranza())!.enRevision).toBeFalsy();
    const f = cobranza({ amount_unknown_reason: Q, total_nominal: null, total_expected: null });
    expect(mapCobranzaForecast(f)).toMatchObject({ enRevision: true, totalPorCobrar: null });
    expect(mapPlanBrecha(1_000_000, cobranza())).not.toBeNull();
    expect(mapPlanBrecha(1_000_000, f)).toBeNull();
  });

  it("Hoy · 'Te deben' explica la revisión en vez de 'el SII no entrega'", () => {
    const ind = indicadoresHoy(
      summary({
        overdue_collections: {
          total_receivable: null,
          overdue: null,
          amount_unknown_reason: Q,
          top_clients: [],
        } as never,
      }),
    ).find((i) => i.label === "Te deben")!;
    expect(ind.valor).toBeNull();
    expect(ind.detalle).toBe(MONTO_EN_REVISION_MOTIVO);
  });

  it("agenda: cuenta los pagos en revisión de la ventana y el widget no escribe $0", () => {
    const hoy = new Date(2026, 7, 30);
    const item = (amount: string | null): PayableItem =>
      ({
        label: "Sueldos",
        category: "payroll",
        due_date: "2026-09-02",
        amount,
        amount_unknown_reason: amount == null ? Q : null,
        criticality: "high",
        source: "BUK",
      }) as PayableItem;
    expect(pagosEnRevisionAgenda([item("100")], hoy)).toBe(0);
    expect(pagosEnRevisionAgenda([item(null)], hoy)).toBe(1);
    const html = renderToStaticMarkup(
      <AgendaWidget grupos={[]} cobros={0} pagos={0} pagosEnRevision={1} />,
    );
    expect(html).toContain("1 pago tiene su monto en revisión de conciliación");
    expect(html).not.toContain("Nada por cobrar ni pagar");
    const gemelo = renderToStaticMarkup(<AgendaWidget grupos={[]} cobros={0} pagos={0} />);
    expect(gemelo).toContain("Nada por cobrar ni pagar");
  });
});

describe("Componentes · 'En revisión' en lugar de la cifra", () => {
  it("CobranzaRealizable y PagarHero", () => {
    const cobr = renderToStaticMarkup(
      <CobranzaRealizable
        esperadoATiempo={null}
        subtitulo="s"
        segmentos={[]}
        totalPorCobrar={null}
        vencido={null}
        enRevision
      />,
    );
    expect(cobr).toContain(MONTO_EN_REVISION);
    expect(cobr).toContain(MONTO_EN_REVISION_MOTIVO);
    expect(cobr).not.toContain("$0");
    const hero = renderToStaticMarkup(
      <PagarHero titulo="t" montoTotal={null} cobertura="c" coberturaTono="neutral" />,
    );
    expect(hero).toContain(MONTO_EN_REVISION);
    const heroConocido = renderToStaticMarkup(
      <PagarHero titulo="t" montoTotal={1000} cobertura="c" coberturaTono="neutral" />,
    );
    expect(heroConocido).not.toContain(MONTO_EN_REVISION);
  });

  it("MontosEnRevisionState y la bandeja", () => {
    const html = renderToStaticMarkup(<MontosEnRevisionState what="tus cuentas por cobrar" />);
    expect(html).toContain("Los montos de tus cuentas por cobrar están en revisión.");
    expect(formattedInboxAmount(null, "CLP")).toBe(`${MONTO_EN_REVISION} (CLP)`);
    expect(formattedInboxAmount(null, null)).toBe(MONTO_EN_REVISION);
    expect(formattedInboxAmount("1000", "CLP")).toBe("$1.000");
    expect(formattedInboxAmount(null, "CLP")).not.toContain("null");
  });
});
