import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PagarV2ViewProps } from "./pagar-v2-view";

const arnes = vi.hoisted(() => ({
  props: undefined as PagarV2ViewProps | undefined,
  cuentasPorPagar: {
    items: [
      {
        id: "payroll-1",
        label: "Remuneraciones",
        category: "payroll",
        due_date: "2026-09-14",
        amount: "10000",
        criticality: "high",
        source: "BUK",
        source_external_id: "payroll-202608",
        currency: "CLP",
      },
      {
        id: "tax-1",
        label: "F29",
        category: "tax",
        due_date: "2026-09-16",
        amount: "20000",
        criticality: "medium",
        source: "SII",
        currency: "CLP",
      },
    ],
    total_by_currency: [],
    projected_cash_14d: "1000",
  },
}));

vi.mock("@/lib/api/pagos", () => ({
  useAccountsPayable: () => ({
    data: arnes.cuentasPorPagar,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api/preferences", () => ({
  usePreferences: () => ({ data: { preferences: {} }, isLoading: false }),
}));

vi.mock("@/components/terminos/use-maestro-docs", () => ({
  useMaestroDocs: () => ({ docs: [] }),
}));

vi.mock("@/lib/hooks/use-table-sort", () => ({
  useTableSort: () => ({ sorted: <T,>(items: T[]) => items, sortKey: null, sortDir: "asc" }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("./pagar-v2-view", () => ({
  PagarV2View: (props: PagarV2ViewProps) => {
    arnes.props = props;
    return <div>Vista de pagos v2</div>;
  },
}));

import { PagarV2ViewLive } from "./pagar-v2-view-live";

describe("PagarV2ViewLive · Brief canónico", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00-03:00"));
    arnes.props = undefined;
  });

  afterEach(() => vi.useRealTimers());

  it("deja sólo la tabla cronológica y no monta selecciones/rankings locales", () => {
    renderToStaticMarkup(<PagarV2ViewLive suppressRecommendations />);

    expect(arnes.props?.hero).toBe(false);
    expect(arnes.props?.estadoCaja).toBeNull();
    expect(arnes.props?.fechasClave).toBeNull();
    expect((arnes.props?.movibles ?? []).map((movible) => movible.id)).toEqual(["vencimientos"]);
  });

  it("mantiene las piezas heredadas cuando no existe Brief", () => {
    renderToStaticMarkup(<PagarV2ViewLive />);

    expect(arnes.props?.hero).not.toBe(false);
    expect(arnes.props?.estadoCaja).not.toBeNull();
    expect(arnes.props?.fechasClave).not.toBeNull();
    expect((arnes.props?.movibles ?? []).map((movible) => movible.id)).toEqual([
      "vencimientos",
      "compromisos",
    ]);
  });
});
