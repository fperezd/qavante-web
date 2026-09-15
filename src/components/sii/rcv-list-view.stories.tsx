import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import type { UseQueryResult } from "@tanstack/react-query";
import { RcvListView } from "./rcv-list-view";
import type { RcvComprasResponse, RcvVentasResponse } from "@/lib/api/sii";

/* RcvListView — vista del Libro de Compras / Libro de Ventas (Sprint C1).
   Presentacional: recibe la query por prop, no invoca hooks. Eso permite
   storyearla sin MSW: pasamos un fake-UseQueryResult con el shape de los
   estados canónicos (loading, success, empty, error). */

type RcvQuery = UseQueryResult<RcvComprasResponse | RcvVentasResponse, unknown>;

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
const DOCUMENT_LINKS = http.post("*/api/sii/document-links/current", async ({ request }) => {
  const body = (await request.json()) as {
    documents: Array<{ document_kind: "payable" | "receivable"; source_external_id: string }>;
  };
  return HttpResponse.json({
    classification_version: "dte-reference-v2",
    items: body.documents.map((document) => ({
      ...document,
      status: "unresolved",
      effect_kind: "none",
      evidence_authorizes_effect: false,
      authoritative_source: null,
      observed_at: null,
      conflict_digests: [],
      reason_codes: ["no_authoritative_evidence"],
    })),
  });
});
const MANAGEMENT_ACCOUNTS = http.get("*/api/management/accounts/tree", () =>
  HttpResponse.json({ items: [] }),
);
const DOCUMENT_DETAIL = http.get(
  "*/api/treasury/reconciliation/document-resolution",
  ({ request }) => {
    const url = new URL(request.url);
    const sourceExternalId = url.searchParams.get("source_external_id") ?? "documento";
    return HttpResponse.json({
      document_id: "document-1",
      document_kind: "payable",
      source_external_id: sourceExternalId,
      document_type: 33,
      folio: "1001",
      rut: "76555444-K",
      name: "Proveedor SpA",
      issue_date: "2026-04-03",
      due_date: null,
      total_amount: "952000",
      outstanding_amount: "952000",
      currency_code: "CLP",
      status: "open",
      blocked_reason: null,
      classification: null,
      assignments: [],
      candidates: [],
    });
  },
);

/* Helper para construir un fake-UseQueryResult sin caer en `as any`. Solo
   las props que el componente lee están tipadas estrictas; el resto se
   completa con defaults razonables. */
function buildQuery(opts: Partial<RcvQuery>): RcvQuery {
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
  } as RcvQuery;
}

const SUCCESS_COMPRAS: RcvComprasResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 4,
  compras: [
    {
      tipo_doc: 33,
      folio: 1001,
      fecha: "2026-04-03",
      rut_contraparte: "76555444-K",
      razon_social: "Proveedor SpA",
      monto_neto: 800000,
      monto_iva: 152000,
      monto_total: 952000,
    },
    {
      tipo_doc: 33,
      folio: 1002,
      fecha: "2026-04-18",
      rut_contraparte: "77123456-7",
      razon_social: "Insumos Chile Ltda",
      monto_neto: 1200000,
      monto_iva: 228000,
      monto_total: 1428000,
    },
    {
      tipo_doc: 34,
      folio: 1003,
      fecha: "2026-04-20",
      rut_contraparte: "78444555-6",
      razon_social: "Servicios Exentos S.A.",
      monto_neto: 500000,
      monto_iva: 0,
      monto_total: 500000,
    },
    {
      tipo_doc: 61,
      folio: 1004,
      fecha: "2026-04-22",
      rut_contraparte: "76555444-K",
      razon_social: "Proveedor SpA",
      monto_neto: -100000,
      monto_iva: -19000,
      monto_total: -119000,
    },
  ],
  error: null,
} as unknown as RcvComprasResponse;

const SUCCESS_VENTAS: RcvVentasResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 2,
  ventas: [
    {
      tipo_doc: 33,
      folio: 5001,
      fecha: "2026-04-05",
      rut_contraparte: "78000111-K",
      razon_social: "Cliente A SA",
      monto_neto: 3000000,
      monto_iva: 570000,
      monto_total: 3570000,
    },
    {
      tipo_doc: 33,
      folio: 5002,
      fecha: "2026-04-25",
      rut_contraparte: "79222333-4",
      razon_social: "Cliente B Ltda",
      monto_neto: 2000000,
      monto_iva: 380000,
      monto_total: 2380000,
    },
  ],
  error: null,
} as unknown as RcvVentasResponse;

/* Ventas con documentos correctores: la vista compacta conserva una fila por DTE.
   Incluye dos facturas idénticas y una NC con referencia explícita para comprobar
   que la UI no deriva identidad ni efecto desde RUT+monto. */
const VENTAS_ANULADAS: RcvVentasResponse = {
  status: "ok",
  periodo: "2026-07",
  count: 9,
  ventas: [
    {
      tipo_doc: 33,
      folio: 5010,
      fecha: "2026-07-02",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
    },
    {
      tipo_doc: 61,
      folio: 88,
      fecha: "2026-07-03",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
      ref_tipo_doc: 33,
      ref_folio: 5010,
    },
    {
      tipo_doc: 33,
      folio: 5020,
      fecha: "2026-07-01",
      rut_contraparte: "76106531-9",
      razon_social: "GPS7000 SPA",
      monto_neto: 1241020,
      monto_iva: 235794,
      monto_total: 1476814,
    },
    {
      tipo_doc: 33,
      folio: 5021,
      fecha: "2026-07-01",
      rut_contraparte: "76106531-9",
      razon_social: "GPS7000 SPA",
      monto_neto: 1241020,
      monto_iva: 235794,
      monto_total: 1476814,
    },
    {
      tipo_doc: 61,
      folio: 89,
      fecha: "2026-07-02",
      rut_contraparte: "76106531-9",
      razon_social: "GPS7000 SPA",
      monto_neto: 1241020,
      monto_iva: 235794,
      monto_total: 1476814,
      ref_tipo_doc: 33,
      ref_folio: 5021,
    },
    {
      tipo_doc: 33,
      folio: 5030,
      fecha: "2026-07-05",
      rut_contraparte: "90209000-2",
      razon_social: "CIA INDUSTRIAL EL VOLCAN S A",
      monto_neto: 1837159,
      monto_iva: 349060,
      monto_total: 2186219,
    },
    // Anomalía real (Kaufmann Junio): 3 NC apuntan a la MISMA factura 5040 →
    // sobre-crédito. La factura se muestra "Anulada · revisar" y el modal avisa;
    // el neto nunca se muestra en negativo.
    {
      tipo_doc: 33,
      folio: 5040,
      fecha: "2026-07-01",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
    },
    {
      tipo_doc: 61,
      folio: 71,
      fecha: "2026-07-02",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
      ref_tipo_doc: 33,
      ref_folio: 5040,
    },
    {
      tipo_doc: 61,
      folio: 72,
      fecha: "2026-07-02",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
      ref_tipo_doc: 33,
      ref_folio: 5040,
    },
    {
      tipo_doc: 61,
      folio: 73,
      fecha: "2026-07-03",
      rut_contraparte: "96572360-9",
      razon_social: "Comercial Kaufmann S.A.",
      monto_neto: 1210749,
      monto_iva: 230042,
      monto_total: 1440791,
      ref_tipo_doc: 33,
      ref_folio: 5040,
    },
  ],
  error: null,
} as unknown as RcvVentasResponse;

const EMPTY_COMPRAS: RcvComprasResponse = {
  status: "ok",
  periodo: "2026-04",
  count: 0,
  compras: [],
  error: null,
} as unknown as RcvComprasResponse;

const meta = {
  title: "Capa 2 / SII / RcvListView",
  component: RcvListView,
  parameters: {
    layout: "padded",
    msw: { handlers: [DOCUMENT_STATES, DOCUMENT_LINKS, MANAGEMENT_ACCOUNTS, DOCUMENT_DETAIL] },
    docs: {
      description: {
        component:
          "Vista del Libro de Compras / Libro de Ventas (Sprint C1 PR-Lib). Presentacional: recibe `query` como prop. Filtros + paginación + totales son client-side sobre el set descargado (el backend solo expone filtro por período). Disclaimer §17.4 al pie: 'dato oficial es el del F29'.",
      },
    },
  },
  args: {
    onPeriodChange: fn(),
  },
} satisfies Meta<typeof RcvListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {
  name: "Compras · Inicial (sin período consultado)",
  args: {
    kind: "compras",
    period: null,
    query: buildQuery({ isSuccess: false, status: "pending", isPending: true }),
  },
};

export const ComprasOk: Story = {
  name: "Compras · con resultados",
  args: {
    kind: "compras",
    period: "2026-04",
    query: buildQuery({ data: SUCCESS_COMPRAS }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentRow = canvas.getAllByRole("row").find((row) => {
      const scoped = within(row);
      return scoped.queryByText("1001") && scoped.queryByText("Proveedor SpA");
    });
    await expect(documentRow).toBeDefined();
    await userEvent.click(documentRow!);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).getByText("Clasificación y pago")).toBeInTheDocument();
    await expect(await within(dialog).findByText("Por conciliar")).toBeInTheDocument();
  },
};

export const ComprasVacio: Story = {
  name: "Compras · período sin documentos",
  args: {
    kind: "compras",
    period: "2026-04",
    query: buildQuery({ data: EMPTY_COMPRAS }),
  },
};

export const VentasOk: Story = {
  name: "Ventas · con resultados",
  args: {
    kind: "ventas",
    period: "2026-04",
    query: buildQuery({ data: SUCCESS_VENTAS }),
  },
};

export const VentasConAnuladas: Story = {
  name: "Ventas · con anuladas (vista compacta)",
  args: {
    kind: "ventas",
    period: "2026-07",
    query: buildQuery({ data: VENTAS_ANULADAS }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const detailButton = canvas.getByRole("button", { name: "Ver detalle" });
    await expect(detailButton).toHaveAttribute("title", "Ver más columnas para cada documento");
    await expect(canvas.queryByText(/agrupar|asociar/i)).not.toBeInTheDocument();

    await userEvent.click(detailButton);
    await expect(canvas.getByRole("button", { name: "Vista compacta" })).toHaveAttribute(
      "title",
      "Ver las columnas esenciales de cada documento",
    );
    await expect(canvas.queryByText(/agrupar|asociar/i)).not.toBeInTheDocument();
  },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  args: {
    kind: "compras",
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
    kind: "compras",
    period: "2026-04",
    query: buildQuery({
      isError: true,
      isSuccess: false,
      status: "error",
      error: new globalThis.Error("El SII no responde en este momento."),
    }),
  },
};
