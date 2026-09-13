import { describe, expect, it } from "vitest";
import { bancosInicio, fechaSaldoSantiago } from "./inicio-bancos-model";
import { MULTI_BANK_ACCOUNTS } from "./inicio-bancos.fixtures";
import { accionesFinancierasInicio } from "./inicio-resumen-model";
import { DEFICIT } from "./inicio-resumen.fixtures";

describe("Inicio: varias cuentas, bancos y monedas", () => {
  it("usa el mismo día Santiago al cruzar medianoche UTC sin desplazar fechas civiles", () => {
    expect(fechaSaldoSantiago("2026-09-12T01:00:00Z")).toBe("2026-09-11");
    expect(fechaSaldoSantiago("2026-09-12")).toBe("2026-09-12");
    expect(fechaSaldoSantiago("2026-02-30")).toBeNull();
    expect(fechaSaldoSantiago("invalida")).toBeNull();
  });
  it("consolida solo saldos de la misma moneda, sin FX ni crédito", () => {
    const model = bancosInicio(MULTI_BANK_ACCOUNTS);
    expect(model.bankCount).toBe(3);
    expect(model.accounts).toHaveLength(5);
    expect(model.currencies).toEqual([
      { currency: "CLP", total: 17900000, partial: false },
      { currency: "USD", total: 8500, partial: false },
    ]);
  });
  it("no suma tarjetas, préstamos, inversiones, cuentas inactivas ni duplicadas", () => {
    const a = MULTI_BANK_ACCOUNTS[0]!;
    expect(
      bancosInicio([
        a,
        a,
        ...["credit_card", "loan", "investment"].map((account_type) => ({
          ...a,
          id: account_type,
          account_type,
        })),
        { ...a, id: "inactive", active: false },
      ]).currencies,
    ).toEqual([{ currency: "CLP", total: 10000000, partial: false }]);
  });
  it("un faltante conserva el subtotal e identifica que está incompleto", () => {
    const model = bancosInicio(
      MULTI_BANK_ACCOUNTS.map((a) => (a.id === "chile-clp" ? { ...a, balance: null } : a)),
    );
    expect(model.currencies[0]).toEqual({ currency: "CLP", total: 12000000, partial: true });
    expect(model.missing).toHaveLength(1);
  });
  it("ningún saldo informado no significa cero; cero informado sí", () => {
    const a = MULTI_BANK_ACCOUNTS[0]!;
    expect(bancosInicio([{ ...a, balance: "" }]).currencies[0]).toEqual({
      currency: "CLP",
      total: null,
      partial: true,
    });
    expect(bancosInicio([{ ...a, balance: "0" }]).currencies[0]?.total).toBe(0);
    expect(bancosInicio([{ ...a, currency_code: "" }]).missing).toHaveLength(1);
    expect(bancosInicio([]).currencies).toEqual([]);
  });
});
describe("Inicio: acciones prioritarias server-owned", () => {
  const action = {
    priority: 1,
    reason: "Revisar cobro",
    deadline: "Hoy",
    cta_href: "/cobrar",
    cta_label: "Ver cobro",
  };
  it("conserva orden, multiplicidad y CTA aunque una decisión navegue a conciliación", () => {
    const data = {
      ...DEFICIT,
      priority_actions: [
        { ...action, priority: 5, reason: "Pago", cta_href: "/pagar?estado=pendiente" },
        {
          ...action,
          priority: 1,
          reason: "Revisa el pago que evita que tu caja quede bajo cero",
          cta_label: "Ver propuesta",
          cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa-a",
        },
        {
          ...action,
          priority: 2,
          reason: "Revisa el pago que evita que tu caja quede bajo cero",
          cta_label: "Ver propuesta",
          cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa-b",
        },
        { ...action, priority: 3, cta_href: "/caja/proyeccion" },
      ],
    };
    const before = JSON.stringify(data);
    const actions = accionesFinancierasInicio(data);

    expect(actions).toEqual(data.priority_actions);
    expect(actions).not.toBe(data.priority_actions);
    expect(actions.map((item) => item.cta_href)).toEqual([
      "/pagar?estado=pendiente",
      "/caja/conciliacion?decision_id=evitar-caja-negativa-a",
      "/caja/conciliacion?decision_id=evitar-caja-negativa-b",
      "/caja/proyeccion",
    ]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("no reordena ni limita las acciones que el servidor publicó", () => {
    const data = {
      ...DEFICIT,
      priority_actions: [4, 3, 2, 1].map((priority) => ({
        ...action,
        priority,
        reason: String(priority),
      })),
    };
    expect(accionesFinancierasInicio(data).map((a) => a.priority)).toEqual([4, 3, 2, 1]);
    expect(accionesFinancierasInicio(null)).toEqual([]);
  });
});
