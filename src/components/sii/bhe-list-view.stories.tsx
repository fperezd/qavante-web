import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import type { UseQueryResult } from "@tanstack/react-query";
import { BheListView } from "./bhe-list-view";
import type { BheResponse } from "@/lib/api/sii";

/* BheListView — vista de Boletas de Honorarios Electrónicas (Sprint C1).
   Presentacional: recibe `query` por prop. Shape distinto a RCV: tiene
   `monto_bruto`, `retencion`, `monto_liquido` (no IVA / total). */

type BheQuery = UseQueryResult<BheResponse, unknown>;

const DOCUMENT_STATES = http.post(
  "*/api/treasury/reconciliation/document-resolution/statuses",
  async ({ request }) => {
    const body = (await request.json()) as {
      documents: Array<{ document_kind: string; source_external_id: string }>;
    };
    return HttpResponse.json({
      items: body.documents.map((document) => ({
        ...document,
        classification_status: "unclassified",
        reconciliation_status: "unreconciled",
        assignment_count: 0,
      })),
    });
  },
);
const MANAGEMENT_ACCOUNTS = http.get("*/api/management/accounts/tree", () =>
  HttpResponse.json({ items: [] }),
);
const DOCUMENT_DETAIL = http.get(
  "*/api/treasury/reconciliation/document-resolution",
  ({ request }) => {
    const url = new URL(request.url);
    const sourceExternalId = url.searchParams.get("source_external_id") ?? "documento";
    return HttpResponse.json({
      document_id: sourceExternalId,
      document_kind: "professional_fee",
      source_external_id: sourceExternalId,
      document_type: null,
      folio: "101",
      rut: "12345678-9",
      name: "Profesional Asesor 1",
      issue_date: "2026-04-15",
      due_date: null,
      total_amount: "1000000",
      outstanding_amount: "862500",
      currency_code: "CLP",
      status: "open",
      blocked_reason: null,
      classification: null,
      assignments: [],
      candidates: [],
    });
  },
);

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
} as unknown as BheResponse;

const EMPTY: BheResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 0,
  bhe: [],
  error: null,
} as unknown as BheResponse;

const meta = {
  title: "Capa 2 / SII / BheListView",
  component: BheListView,
  parameters: {
    layout: "padded",
    msw: { handlers: [DOCUMENT_STATES, MANAGEMENT_ACCOUNTS, DOCUMENT_DETAIL] },
    docs: {
      description: {
        component:
          "Vista de Boletas de Honorarios Electrónicas recibidas. Shape distinto a RCV: tiene `monto_bruto`, `retencion` (13.75% en 2026 · el pagador retiene y entera en su F29), `monto_liquido`. Presentacional: recibe `query` por prop.",
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentRow = canvas.getAllByRole("row").find((row) => {
      const scoped = within(row);
      return scoped.queryByText("101") && scoped.queryByText("Profesional Asesor 1");
    });
    await expect(documentRow).toBeDefined();
    await userEvent.click(documentRow!);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).getByText("Clasificación y pago")).toBeInTheDocument();
    await expect(await within(dialog).findByText(/monto líquido/)).toBeInTheDocument();
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
