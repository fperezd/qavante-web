import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InicioCreditosLive } from "./inicio-creditos-live";

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), balances: vi.fn() }));
vi.mock("@/lib/api/treasury", () => ({
  useBiceSaldo: mocks.accounts,
  treasuryKeys: { biceCuentaBalance: (id: string) => ["balance", id] },
}));
vi.mock("@tanstack/react-query", () => ({ useQueries: mocks.balances }));
const account = { numeroCuenta: "account-1", numeroFormateado: "1234", esExtranjera: false };
const credit = {
  status: "ok",
  data: {
    montoAprobadoMonto: "6000000",
    montoAprobadoCodigoMoneda: "CLP",
    montoDisponibleMonto: "4000000",
    montoDisponibleCodigoMoneda: "CLP",
  },
};
const render = () => renderToStaticMarkup(<InicioCreditosLive enabled />);

beforeEach(() => {
  mocks.accounts.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { status: "ok", cuentas: [account] },
  });
  mocks.balances.mockReturnValue([{ isLoading: false, isError: false, data: credit }]);
});
describe("Inicio: errores funcionales y parciales del banco", () => {
  it("presenta disponible y total del banco sin sumarlos", () => {
    expect(render()).toContain("4.000.000");
    expect(render()).toContain("6.000.000");
    expect(render()).not.toContain("10.000.000");
  });
  it("HTTP 200 con error de cuentas no significa ausencia de líneas", () => {
    mocks.accounts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { status: "error", cuentas: [] },
    });
    expect(render()).toContain("No se pudieron consultar todos los cupos");
    expect(render()).not.toContain("Sin cupos informados");
  });
  it("HTTP 200 con error de balance no muestra datos retenidos", () => {
    mocks.balances.mockReturnValue([
      { isLoading: false, isError: false, data: { ...credit, status: "error" } },
    ]);
    expect(render()).toContain("No se pudieron consultar todos los cupos");
    expect(render()).not.toContain("4.000.000");
  });
  it("conserva la línea válida y advierte la cuenta faltante", () => {
    mocks.accounts.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { status: "ok", cuentas: [account, { ...account, numeroCuenta: "account-2" }] },
    });
    mocks.balances.mockReturnValue([
      { isLoading: false, isError: false, data: credit },
      { isLoading: false, isError: false, data: { status: "error" } },
    ]);
    expect(render()).toContain("4.000.000");
    expect(render()).toContain("No se pudieron consultar todos los cupos");
  });
  it("un error HTTP no conserva un cupo de caché como vigente", () => {
    mocks.balances.mockReturnValue([{ isLoading: false, isError: true, data: credit }]);
    expect(render()).not.toContain("4.000.000");
  });
});
