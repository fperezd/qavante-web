/* qavante-api#928: sin Empresa activa, Inicio publica los bloques de Cobrar y Pagar con montos
   `null` y `amount_unknown_reason: "missing_scope"`. Se dice "Sin dato" y se pide elegir la
   Empresa; nunca "$0", nunca "al día" y nunca la explicación de la cuarentena. Cada negativo
   tiene su gemelo positivo sobre el mismo fixture. */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  DashboardCriticalPayments,
  DashboardOverdueCollections,
  DashboardSummaryResponse,
} from "@/lib/api/dashboard";
import {
  AMOUNT_UNKNOWN_MISSING_SCOPE,
  AMOUNT_UNKNOWN_QUARANTINE,
  MONTO_EN_REVISION,
  MONTO_EN_REVISION_MOTIVO,
  MONTO_SIN_EMPRESA,
  MONTO_SIN_EMPRESA_MOTIVO,
  formatClpODesconocido,
  motivoImporteDesconocido,
  rotuloImporteDesconocido,
} from "@/lib/formatters/amount";
import { Dashboard } from "./inicio-ejecutivo-view";
import { indicadoresHoy } from "./v01/hoy-model";
import { mapCobranza } from "./v2/inicio-v2-map";
import { CobranzaRealizable } from "./v2/cobranza-realizable";

const SIN_EMPRESA = AMOUNT_UNKNOWN_MISSING_SCOPE;

function cobranza(
  reason: DashboardOverdueCollections["amount_unknown_reason"],
): DashboardOverdueCollections {
  return reason == null
    ? { total_receivable: "2100000", overdue: "1400000", top_clients: [], source: "sii_rcv" }
    : {
        total_receivable: null,
        overdue: null,
        amount_unknown_reason: reason,
        top_clients: [],
        source: "sii_rcv",
      };
}

function pagos(
  reason: DashboardCriticalPayments["amount_unknown_reason"],
): DashboardCriticalPayments {
  return reason == null
    ? { due_7d: "150000", due_14d: "350000", source: "sii_rcv" }
    : { due_7d: null, due_14d: null, amount_unknown_reason: reason, source: "sii_rcv" };
}

function summary(
  reason: DashboardOverdueCollections["amount_unknown_reason"],
): DashboardSummaryResponse {
  return {
    generated_at: "2026-09-28T12:00:00Z",
    executive_phrase: null,
    pulso: null,
    cash_today: null,
    cash_forecast: null,
    cash_gap: null,
    overdue_collections: cobranza(reason),
    critical_payments: pagos(reason),
    operational_result: null,
    priority_actions: null,
  };
}

describe("amount · texto por motivo de importe desconocido", () => {
  it("sin Empresa activa dice 'Sin dato' y pide elegir la Empresa", () => {
    expect(rotuloImporteDesconocido(SIN_EMPRESA)).toBe(MONTO_SIN_EMPRESA);
    expect(motivoImporteDesconocido(SIN_EMPRESA)).toBe(MONTO_SIN_EMPRESA_MOTIVO);
    expect(formatClpODesconocido(null, SIN_EMPRESA)).toBe(MONTO_SIN_EMPRESA);
  });

  it("gemelo: la cuarentena conserva 'En revisión' y un monto conocido se formatea", () => {
    expect(rotuloImporteDesconocido(AMOUNT_UNKNOWN_QUARANTINE)).toBe(MONTO_EN_REVISION);
    expect(motivoImporteDesconocido(AMOUNT_UNKNOWN_QUARANTINE)).toBe(MONTO_EN_REVISION_MOTIVO);
    // Sin motivo: el único `null` anterior a #928 era la cuarentena.
    expect(rotuloImporteDesconocido(null)).toBe(MONTO_EN_REVISION);
    expect(formatClpODesconocido("150000", SIN_EMPRESA)).toBe("$150.000");
    expect(formatClpODesconocido("0", SIN_EMPRESA)).toBe("$0");
  });

  it("un motivo que la web aún no conoce dice 'Sin dato', nunca $0 ni una razón inventada", () => {
    expect(rotuloImporteDesconocido("motivo_futuro")).toBe("Sin dato");
    expect(motivoImporteDesconocido("motivo_futuro")).not.toBe(MONTO_EN_REVISION_MOTIVO);
    expect(motivoImporteDesconocido("motivo_futuro")).not.toBe(MONTO_SIN_EMPRESA_MOTIVO);
  });
});

describe("Inicio ejecutivo · Cobranza vencida y Pagos críticos", () => {
  it("sin Empresa activa: 'Sin dato' con el pedido de Empresa, sin $0 ni 'En revisión'", () => {
    const html = renderToStaticMarkup(<Dashboard data={summary(SIN_EMPRESA)} />);
    expect(html).toContain(MONTO_SIN_EMPRESA);
    expect(html).toContain(MONTO_SIN_EMPRESA_MOTIVO);
    expect(html).not.toContain("$0");
    expect(html).not.toContain(MONTO_EN_REVISION);
    expect(html).not.toContain(MONTO_EN_REVISION_MOTIVO);
  });

  it("gemelo: con montos conocidos publica las cifras y no pide Empresa", () => {
    const html = renderToStaticMarkup(<Dashboard data={summary(null)} />);
    expect(html).toContain("$1.400.000");
    expect(html).toContain("$150.000");
    expect(html).not.toContain(MONTO_SIN_EMPRESA_MOTIVO);
  });

  it("gemelo: la cuarentena sigue diciendo 'En revisión'", () => {
    const html = renderToStaticMarkup(<Dashboard data={summary(AMOUNT_UNKNOWN_QUARANTINE)} />);
    expect(html).toContain(MONTO_EN_REVISION);
    expect(html).toContain(MONTO_EN_REVISION_MOTIVO);
    expect(html).not.toContain(MONTO_SIN_EMPRESA_MOTIVO);
  });
});

describe("Inicio v2 y Hoy · cobranza sin Empresa activa", () => {
  it("mapCobranza y CobranzaRealizable dicen 'Sin dato' con el pedido de Empresa", () => {
    const props = mapCobranza(summary(SIN_EMPRESA))!;
    expect(props).toMatchObject({
      enRevision: true,
      totalPorCobrar: null,
      esperadoATiempo: null,
      rotuloDesconocido: MONTO_SIN_EMPRESA,
      motivoDesconocido: MONTO_SIN_EMPRESA_MOTIVO,
    });
    const html = renderToStaticMarkup(<CobranzaRealizable {...props} />);
    expect(html).toContain(MONTO_SIN_EMPRESA);
    expect(html).toContain(MONTO_SIN_EMPRESA_MOTIVO);
    expect(html).not.toContain("$0");
    expect(html).not.toContain(MONTO_EN_REVISION);
  });

  it("gemelo: con total conocido publica la cifra", () => {
    const props = mapCobranza(summary(null))!;
    expect(props.enRevision).toBe(false);
    expect(props.totalPorCobrar).toBe(2_100_000);
    const html = renderToStaticMarkup(<CobranzaRealizable {...props} />);
    expect(html).toContain("$2.100.000");
    expect(html).not.toContain(MONTO_SIN_EMPRESA_MOTIVO);
  });

  it("Hoy · 'Te deben' pide la Empresa; el gemelo conocido publica el vencido", () => {
    const sin = indicadoresHoy(summary(SIN_EMPRESA)).find((i) => i.label === "Te deben")!;
    expect(sin.valor).toBeNull();
    expect(sin.detalle).toBe(MONTO_SIN_EMPRESA_MOTIVO);
    const con = indicadoresHoy(summary(null)).find((i) => i.label === "Te deben")!;
    expect(con.valor).toBe("$1.400.000");
    expect(con.detalle).not.toBe(MONTO_SIN_EMPRESA_MOTIVO);
  });
});
