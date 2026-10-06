import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Se prueba el COMPORTAMIENTO del cableado invocándolo: qué ve una persona mientras carga,
   cuándo se declara un fallo en vez de taparlo con un cero, y con qué scope se consulta el
   contrato — los tres parámetros explícitos, con el `as_of` del servidor. */

const arnes = vi.hoisted(() => ({
  scope: { legal_entity_id: "entity-1", currency: "CLP", as_of: "2026-09-30" } as {
    legal_entity_id: string;
    currency: string;
    as_of: string;
  } | null,
  salud: {
    data: { instrumentos: [] } as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  useSalud: vi.fn(),
}));

const consulta = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

vi.mock("@/lib/api/dashboard", () => ({
  useDashboardSummary: () => consulta({ generated_at: "2026-09-30T12:00:00Z" }),
}));

vi.mock("@/lib/api/financial-scope", () => ({
  useFinancialScope: () => consulta({ legal_entity_id: "entity-1", currency: "CLP" }),
  toFinancialDecisionReadScope: () => arnes.scope,
}));

vi.mock("@/lib/api/salud", () => ({
  useSalud: (scope: unknown) => {
    arnes.useSalud(scope);
    return arnes.salud;
  },
}));

vi.mock("./salud-contrato-model", () => ({
  saludContratoModel: (respuesta: unknown) => respuesta,
}));

vi.mock("./salud-contrato-view", () => ({
  SaludContratoView: () => <p>Lectura de salud en pantalla</p>,
}));

import { SaludContratoLive } from "./salud-contrato-live";

const VISTA = /Lectura de salud en pantalla/;

describe("SaludContratoLive", () => {
  beforeEach(() => {
    arnes.scope = { legal_entity_id: "entity-1", currency: "CLP", as_of: "2026-09-30" };
    arnes.salud.data = { instrumentos: [] };
    arnes.salud.isLoading = false;
    arnes.salud.isError = false;
    arnes.salud.refetch.mockReset();
    arnes.useSalud.mockReset();
  });

  it("consulta el contrato con la sociedad, la moneda y el corte del servidor", () => {
    renderToStaticMarkup(<SaludContratoLive />);

    expect(arnes.useSalud).toHaveBeenCalledWith({
      legal_entity_id: "entity-1",
      currency: "CLP",
      as_of: "2026-09-30",
    });
  });

  it("mantiene la carga, diciendo qué espera, hasta tener los puntajes", () => {
    arnes.salud.isLoading = true;

    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(html).toContain("Consultando la salud de tu empresa");
    expect(html).toContain("los puntajes del último corte");
    expect(html).not.toMatch(VISTA);
  });

  it("declara el fallo de la lectura y no lo convierte en un puntaje", () => {
    arnes.salud.isError = true;

    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(html).toContain("No pudimos consultar los puntajes de salud de tu empresa");
    expect(html).toContain("No mostramos puntajes ni clasificaciones");
    expect(html).not.toMatch(VISTA);
  });

  it("no consulta ni muestra puntajes mientras no haya sociedad y moneda del servidor", () => {
    arnes.scope = null;

    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(arnes.useSalud).toHaveBeenCalledWith(null);
    expect(html).toContain("la sociedad y la moneda de esta lectura");
    expect(html).not.toMatch(VISTA);
  });

  it("no habla de la empresa del usuario como de un inquilino del sistema", () => {
    arnes.salud.isError = true;

    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(html).toContain("tu empresa");
    expect(html.toLowerCase()).not.toContain("tenant");
  });

  it("entrega la vista sólo con la respuesta del contrato disponible", () => {
    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(html).toMatch(VISTA);
  });

  it("no entrega la vista cuando la respuesta llega vacía", () => {
    arnes.salud.data = undefined;

    const html = renderToStaticMarkup(<SaludContratoLive />);

    expect(html).not.toMatch(VISTA);
    expect(html).toContain("No pudimos consultar los puntajes de salud de tu empresa");
  });
});
