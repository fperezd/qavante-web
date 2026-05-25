import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { UseQueryResult } from "@tanstack/react-query";
import { BheListView } from "./bhe-list-view";
import type { BheResponse } from "@/lib/api/sii";

/* BheListView — vista de Boletas de Honorarios Electrónicas (Sprint C1).
   Presentacional: recibe `query` por prop. Shape distinto a RCV: tiene
   `monto_bruto`, `retencion`, `monto_liquido` (no IVA / total). */

type BheQuery = UseQueryResult<BheResponse, unknown>;

function buildQuery(opts: Partial<BheQuery>): BheQuery {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    isPending: false,
    status: "success",
    fetchStatus: "idle",
    ...opts,
  } as BheQuery;
}

const SUCCESS: BheResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 2,
  bhe: [
    {
      periodo: "2026-04",
      rut_emisor: "12345678-9",
      nombre_emisor: "Profesional Asesor 1",
      folio: 101,
      fecha_emision: "2026-04-15",
      monto_bruto: 1000000,
      retencion: 137500,
      monto_liquido: 862500,
    },
    {
      periodo: "2026-04",
      rut_emisor: "98765432-1",
      nombre_emisor: "Estudio Jurídico XYZ",
      folio: 202,
      fecha_emision: "2026-04-22",
      monto_bruto: 500000,
      retencion: 68750,
      monto_liquido: 431250,
    },
  ],
  error: null,
} as BheResponse;

const EMPTY: BheResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 0,
  bhe: [],
  error: null,
} as BheResponse;

const meta = {
  title: "Capa 2 / SII / BheListView",
  component: BheListView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Vista de Boletas de Honorarios Electrónicas recibidas. Shape distinto a RCV: tiene `monto_bruto`, `retencion` (13.75% en 2026 — el pagador retiene y entera en su F29), `monto_liquido`. Presentacional: recibe `query` por prop.",
      },
    },
  },
  args: {
    onPeriodChange: fn(),
  },
} satisfies Meta<typeof BheListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  name: "Inicial (sin período consultado)",
  args: {
    period: null,
    query: buildQuery({ isSuccess: false, status: "pending", isPending: true }),
  },
};

export const ConResultados: Story = {
  args: {
    period: "2026-04",
    query: buildQuery({ data: SUCCESS }),
  },
};

export const PeriodoVacio: Story = {
  args: {
    period: "2026-04",
    query: buildQuery({ data: EMPTY }),
  },
};

export const Cargando: Story = {
  args: {
    period: "2026-04",
    query: buildQuery({
      isLoading: true,
      isFetching: true,
      isPending: true,
      isSuccess: false,
      status: "pending",
    }),
  },
};

export const ConError: Story = {
  name: "Error de red / SII",
  args: {
    period: "2026-04",
    query: buildQuery({
      isError: true,
      isSuccess: false,
      status: "error",
      error: new globalThis.Error("El SII no responde en este momento."),
    }),
  },
};
