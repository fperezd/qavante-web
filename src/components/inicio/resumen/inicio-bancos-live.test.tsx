import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InicioBancos, InicioBancosLive } from "./inicio-bancos-live";
import { InicioCreditos } from "./inicio-creditos-live";
import { MULTI_BANK_ACCOUNTS, MULTI_BANK_CREDITS } from "./inicio-bancos.fixtures";
import { NOW } from "./inicio-resumen.fixtures";

const mocks = vi.hoisted(() => ({ accounts: vi.fn() }));
vi.mock("@/lib/api/treasury", () => ({ useBankAccounts: mocks.accounts }));
beforeEach(() =>
  mocks.accounts.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: MULTI_BANK_ACCOUNTS },
  }),
);

describe("Inicio: presentación bancaria", () => {
  it("el detalle y la advertencia coinciden al cruzar medianoche UTC", () => {
    const html = renderToStaticMarkup(
      <InicioBancos
        accounts={[{ ...MULTI_BANK_ACCOUNTS[0]!, balance_as_of: "2026-09-12T01:00:00Z" }]}
        now={new Date("2026-09-12T12:00:00Z")}
      />,
    );
    expect(html).toContain("11 sep 2026");
    expect(html).toContain("Hay saldos sin actualización de hoy");
  });
  it("separa monedas y expone banco, cuenta y fecha al profundizar", () => {
    const html = renderToStaticMarkup(<InicioBancos accounts={MULTI_BANK_ACCOUNTS} now={NOW} />);
    expect(html).toContain("17.900.000");
    expect(html).toContain("8.500");
    expect(html).toContain("Ver saldos por cuenta y fecha");
    expect(html).toContain("Banco de Chile");
    expect(html).toContain("**** **** **** 5678");
    expect(html).toContain("**** **** **** 4321");
    expect(html).not.toContain("Hay saldos sin actualización");
  });
  it("avisa fechas antiguas o ausentes en primer nivel", () => {
    const html = renderToStaticMarkup(
      <InicioBancos accounts={MULTI_BANK_ACCOUNTS} now={new Date("2026-09-15T12:15:00Z")} />,
    );
    expect(html).toContain("Hay saldos sin actualización de hoy");
    expect(
      renderToStaticMarkup(
        <InicioBancos accounts={[{ ...MULTI_BANK_ACCOUNTS[0]!, balance_as_of: null }]} now={NOW} />,
      ),
    ).toContain("sin fecha informada");
  });
  it("marca el subtotal incompleto sin sustituir ausencia por cero", () => {
    const html = renderToStaticMarkup(
      <InicioBancos accounts={[{ ...MULTI_BANK_ACCOUNTS[0]!, balance: null }]} now={NOW} />,
    );
    expect(html).toContain("Subtotal informado");
    expect(html).toContain("Sin dato");
    expect(html).toContain("Hay cuentas sin saldo");
  });
  it("un error no conserva saldo de caché como vigente", () => {
    mocks.accounts.mockReturnValue({
      isLoading: false,
      isError: true,
      data: { items: MULTI_BANK_ACCOUNTS },
    });
    const html = renderToStaticMarkup(<InicioBancosLive />);
    expect(html).toContain("No se pudieron consultar");
    expect(html).not.toContain("17.900.000");
    expect(html).toContain("Reintentar");
  });
  it("carga y vacío son estados distintos", () => {
    mocks.accounts.mockReturnValue({ isLoading: true });
    expect(renderToStaticMarkup(<InicioBancosLive />)).toContain("Consultando saldos");
    mocks.accounts.mockReturnValue({ isLoading: false, data: { items: [] } });
    expect(renderToStaticMarkup(<InicioBancosLive />)).toContain(
      "Sin cuentas bancarias informadas",
    );
  });
  it("varias líneas identifican banco, cuenta, moneda y cupos sin total mezclado", () => {
    const html = renderToStaticMarkup(<InicioCreditos lines={MULTI_BANK_CREDITS} />);
    expect(html).toContain("BICE");
    expect(html).toContain("Banco de Chile");
    expect(html).toContain("Santander");
    expect(html).toContain("Ver todas las líneas (3)");
    expect(html).toContain("9988");
    expect(html).toContain("USD");
    expect(html).not.toContain("6.001.500");
  });
});
