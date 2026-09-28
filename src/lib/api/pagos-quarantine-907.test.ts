/* #907 (qavante-api, cuarentena #687): con una cuarentena de conciliación viva del lado AP el
   backend publica los importes `null` + `amount_unknown_reason: "reconciliation_quarantine"`.
   El borde D02 debe aceptarlo como DESCONOCIDO (no reventar la pantalla) y la pantalla nunca
   debe leerlo como 0. Cada assert negativo tiene su gemelo positivo para poder fallar. */

import { describe, expect, it } from "vitest";
import { pagos } from "@/components/pagar/v05/pagar-v05-fixtures";
import {
  kpiCritico,
  kpiPorPagar,
  kpiVencido,
  kpiVencidoGlobal,
  pagosV05,
  totales,
} from "@/components/pagar/v05/pagar-v05-model";
import {
  montoCLP,
  montoCLPFaltante,
  montoEnRevision,
  multiCurrencyNote,
} from "@/components/pagar/pagos-format";
import { MONTO_EN_REVISION } from "@/lib/formatters/amount";
import { assertAccountsPayableResponse, type AccountsPayableResponse } from "./pagos";

const Q = "reconciliation_quarantine" as const;
const HOY = new Date(2026, 7, 30);

type Summary = NonNullable<AccountsPayableResponse["overdue_summary"]>;

function enCuarentena<T extends Summary>(s: T): T {
  return {
    ...s,
    amount_clp: null,
    known_amount_clp: null,
    complete: false,
    amount_unknown_reason: Q,
  };
}

/** La respuesta que arma `payables_repo.accounts_payable` con `ap_unknown` (qavante-api#907). */
function pagosEnCuarentena(): AccountsPayableResponse {
  const base = pagos();
  const [primero, ...resto] = base.items!;
  return {
    ...base,
    total: null,
    due_7d: null,
    due_14d: null,
    due_30d: null,
    undated_amount: null,
    amount_unknown_reason: Q,
    total_by_currency: base.total_by_currency!.map((b) =>
      b.currency === "CLP" ? { ...b, amount: null, amount_unknown_reason: Q } : b,
    ),
    non_postponable_or_overdue_14d: enCuarentena(base.non_postponable_or_overdue_14d!),
    overdue_summary: enCuarentena(base.overdue_summary!),
    undated_summary: enCuarentena(base.undated_summary!),
    credits: enCuarentena(base.credits!),
    by_category: base.by_category!.map(enCuarentena),
    projected_cash_14d: null,
    min_14d: null,
    cash_gap_amount_14d: null,
    has_gap: null,
    cash_projection_publicable_14d: false,
    covers_critical: null,
    items: [{ ...primero!, amount: null, amount_clp: null, amount_unknown_reason: Q }, ...resto],
  };
}

describe("#907 · borde D02 con cuarentena de conciliación", () => {
  it("acepta la respuesta en cuarentena como desconocida (gemelo: la conocida también pasa)", () => {
    expect(assertAccountsPayableResponse(pagos()).total).not.toBeNull();
    const out = assertAccountsPayableResponse(pagosEnCuarentena());
    expect(out.total).toBeNull();
    expect(out.amount_unknown_reason).toBe(Q);
  });

  it("rechaza un importe null SIN motivo: eso no es cuarentena, es un contrato roto", () => {
    const sinMotivo = { ...pagosEnCuarentena(), amount_unknown_reason: null };
    expect(() => assertAccountsPayableResponse(sinMotivo)).toThrow(/contrato completo/);
    const itemSinMotivo = {
      ...pagos(),
      items: [{ ...pagos().items![0]!, amount: null }],
    };
    expect(() => assertAccountsPayableResponse(itemSinMotivo)).toThrow(/contrato completo/);
  });

  it("rechaza el motivo junto a una cifra: desconocido no se mezcla con un número", () => {
    const conCifra = { ...pagosEnCuarentena(), total: "19205210" };
    expect(() => assertAccountsPayableResponse(conCifra)).toThrow(/contrato completo/);
    const curvaPublicada = { ...pagosEnCuarentena(), projected_cash_14d: "5200000" };
    expect(() => assertAccountsPayableResponse(curvaPublicada)).toThrow(/contrato completo/);
    const itemConCifra = {
      ...pagos(),
      items: [{ ...pagos().items![0]!, amount_unknown_reason: Q }],
    };
    expect(() => assertAccountsPayableResponse(itemConCifra)).toThrow(/contrato completo/);
  });
});

describe("#907 · Pagar nunca lee un importe en revisión como 0", () => {
  // Pasa por el borde real: la pantalla sólo recibe lo que el borde D02 aceptó.
  const ap = assertAccountsPayableResponse(pagosEnCuarentena());
  const conocido = assertAccountsPayableResponse(pagos());
  const filas = pagosV05(ap, HOY);

  it("la fila en revisión dice 'En revisión', no suma y no es 'sin convertir'", () => {
    const enRevision = filas.find((p) => p.enRevision)!;
    expect(enRevision.montoLabel).toBe(MONTO_EN_REVISION);
    expect(enRevision.montoLabel).not.toMatch(/\$\s?0\b/);
    expect(enRevision.montoClp).toBeNull();
    expect(enRevision.sinConvertir).toBe(false);
    // Gemelo: las demás filas conservan su cifra.
    expect(
      filas.filter((p) => !p.enRevision).every((p) => p.montoLabel !== MONTO_EN_REVISION),
    ).toBe(true);
  });

  it("KPI globales: en revisión, sin cifra (gemelo: sin cuarentena hay cifra)", () => {
    const critico = kpiCritico(filas, ap);
    expect(critico.enRevision).toBe(true);
    expect(critico.total).toBeNull();
    expect(critico.yaVencido).toBeNull();
    expect(critico.cajaFinal).toBeNull();
    expect(critico.motivoSinCaja).toContain("revisión de conciliación");
    expect(kpiCritico(pagosV05(conocido, HOY), conocido).total).toBe(16_807_705);

    const vencido = kpiVencidoGlobal(ap);
    expect(vencido.enRevision).toBe(true);
    expect(vencido.conocido).toBeNull();
    expect(kpiVencidoGlobal(pagos()).conocido).not.toBeNull();

    const porPagar = kpiPorPagar(ap, 14);
    expect(porPagar.enRevision).toBe(true);
    expect(porPagar.total).toBeNull();
    expect(kpiPorPagar(pagos(), 14).total).not.toBeNull();
  });

  it("footer: total en revisión y la moneda en cuarentena sin cifra", () => {
    const t = totales(ap, filas);
    expect(t.totalClp).toBeNull();
    expect(t.enRevision).toBe(true);
    const clp = t.porMoneda.find((m) => m.moneda === "CLP")!;
    expect(clp.monto).toBeNull();
    expect(clp.label).toBe(MONTO_EN_REVISION.toLowerCase());
    expect(t.porMoneda.find((m) => m.moneda === "USD")!.monto).toBe(1240);
  });

  it("una suma local con un sumando en revisión es desconocida, no un piso", () => {
    const vencidas = pagosV05(conocido, HOY).filter((p) => p.vencido);
    expect(vencidas.length).toBeGreaterThan(0);
    expect(kpiVencido(vencidas).total).not.toBeNull();
    const conRevision = [
      { ...vencidas[0]!, enRevision: true, montoClp: null },
      ...vencidas.slice(1),
    ];
    expect(kpiVencido(conRevision).total).toBeNull();
  });

  it("helpers de fila: en revisión → falta el CLP y montoCLP no inventa una cifra", () => {
    const item = { ...pagos().items![0]!, amount: null, amount_clp: null };
    expect(montoEnRevision(item)).toBe(true);
    expect(montoCLPFaltante(item)).toBe(true);
    expect(montoCLP(item)).toBe(0); // no suma; la fila se rotula "En revisión"
    expect(montoEnRevision(pagos().items![0]!)).toBe(false);
    expect(
      multiCurrencyNote([
        { currency: "CLP", amount: null, currency_status: "verified", amount_unknown_reason: Q },
        { currency: "USD", amount: "1240", currency_status: "verified" },
      ]),
    ).toMatch(/^en revisión \(CLP\) \+ /);
  });
});
