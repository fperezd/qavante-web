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
describe("Inicio: atención financiera acotada", () => {
  const action = {
    priority: 1,
    reason: "Revisar cobro",
    deadline: "Hoy",
    cta_href: "/cobrar",
    cta_label: "Ver cobro",
  };
  it("no duplica ni altera las acciones recibidas; excluye proyección y clasificación", () => {
    const data = {
      ...DEFICIT,
      priority_actions: [
        { ...action, priority: 5, reason: "Pago", cta_href: "/pagar?estado=pendiente" },
        { ...action, cta_href: "/caja/proyeccion" },
        action,
        action,
        { ...action, cta_href: "/caja/por-clasificar" },
        { ...action, cta_href: "https://example.com/cobrar" },
      ],
    };
    const before = JSON.stringify(data);
    expect(accionesFinancierasInicio(data).map((a) => a.reason)).toEqual(["Revisar cobro", "Pago"]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("ordena por prioridad y limita el resumen a tres sin afirmar que no hay más", () => {
    const data = {
      ...DEFICIT,
      priority_actions: [4, 3, 2, 1].map((priority) => ({
        ...action,
        priority,
        reason: String(priority),
      })),
    };
    expect(accionesFinancierasInicio(data).map((a) => a.priority)).toEqual([1, 2, 3]);
    expect(accionesFinancierasInicio(null)).toEqual([]);
  });
});
