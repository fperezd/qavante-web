import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InicioCreditosLive } from "./inicio-creditos-live";

const mocks = vi.hoisted(() => ({ bankAccounts: vi.fn() }));
vi.mock("@/lib/api/treasury", () => ({
  useBankAccounts: mocks.bankAccounts,
}));

const render = () => renderToStaticMarkup(<InicioCreditosLive enabled />);

beforeEach(() => {
  mocks.bankAccounts.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      items: [
        {
          id: "card-1",
          active: true,
          account_type: "credit_card",
          bank_name: "Banco de Chile",
          name: "Visa",
          currency_code: "CLP",
          balance: "4000000",
        },
      ],
    },
  });
});

describe("Inicio: tarjetas y créditos desde treasury (Fintoc)", () => {
  it("muestra el saldo informado de la tarjeta, con el banco de la cuenta", () => {
    expect(render()).toContain("Banco de Chile · Visa · CLP");
    expect(render()).toContain("4.000.000");
    expect(render()).not.toContain("BICE");
  });

  it("un error de cuentas se declara, no se inventa vacío", () => {
    mocks.bankAccounts.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    expect(render()).toContain("No se pudieron consultar las cuentas de crédito");
    expect(render()).not.toContain("Sin tarjetas ni créditos informados");
  });

  it("sin tarjetas ni préstamos lo dice", () => {
    mocks.bankAccounts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [{ active: true, account_type: "checking", bank_name: "Banco de Chile" }] },
    });
    expect(render()).toContain("Sin tarjetas ni créditos informados");
  });
});
