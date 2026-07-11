import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, expect } from "storybook/test";
import { CobrarView, DebtorInvoicesPanel } from "./cobrar-view";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

/* Cobrar — cuentas por cobrar (Sprint C4). Container con `useAccountsReceivable`.
   Contrato FE-first (endpoint aún no existe) → MSW reproduce los estados. */

const PATH = "*/api/treasury/accounts-receivable";

const FIXTURE = {
  total: "24800000",
  overdue: "7900000",
  overdue_pct: "31.9",
  aging: {
    current: "16900000",
    d1_30: "3200000",
    d31_60: "2100000",
    d61_90: "1400000",
    d90_plus: "1200000",
  },
  top_debtors: [
    { name: "Constructora Andes SpA", rut: "76.123.456-7", total: "9800000", overdue: "3200000" },
    { name: "Comercial del Sur Ltda", rut: "77.987.654-3", total: "6100000", overdue: "2400000" },
    { name: "Minera Atacama SA", rut: "96.555.444-2", total: "4300000", overdue: "1100000" },
  ],
  overdue_documents: [
    {
      client_name: "Constructora Andes SpA",
      client_rut: "76.123.456-7",
      document: "Factura 1234",
      due_date: "2026-05-10",
      amount: "3200000",
      balance: "3200000",
      days_overdue: 23,
    },
    {
      client_name: "Minera Atacama SA",
      client_rut: "96.555.444-2",
      document: "Factura 9012",
      due_date: "2026-03-25",
      amount: "1100000",
      balance: "800000",
      days_overdue: 69,
    },
  ],
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const OK = http.get(PATH, () => HttpResponse.json(FIXTURE, { status: 200 }));
const EMPTY = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      total: "0",
      overdue: "0",
      overdue_pct: "0",
      aging: { current: "0", d1_30: "0", d31_60: "0", d61_90: "0", d90_plus: "0" },
      top_debtors: [],
      overdue_documents: [],
    },
    { status: 200 },
  ),
);
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json(FIXTURE, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json({ code: "internal_error", detail: "Falló." }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Cobrar / CobrarView",
  component: CobrarView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Cobrar / cuentas por cobrar (Sprint C4, Maestro §7.3): resumen (total/vencido/%), antigüedad de saldos (aging), top deudores y documentos vencidos. Estados canónicos vía MSW. Contrato FE-first.",
      },
    },
    msw: { handlers: [OK] },
  },
  args: { siiEnabled: true },
} satisfies Meta<typeof CobrarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disponible: Story = { parameters: { msw: { handlers: [OK] } } };
export const SinSii: Story = {
  name: "Sin acceso SII (siiEnabled=false)",
  args: { siiEnabled: false },
  parameters: { msw: { handlers: [OK] } },
};
export const SinDeuda: Story = {
  name: "Sin cuentas por cobrar",
  parameters: { msw: { handlers: [EMPTY] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING] } } };
export const Error500: Story = { name: "Error (500)", parameters: { msw: { handlers: [ERROR] } } };

/* Panel expandido de un deudor (aislado, sin red): facturas del Libro + la nota
   honesta de que la mora llega con los vencimientos del SII. */
const DEBTOR_DOCS: RcvDoc[] = [
  { folio: 1234, fecha: "2026-05-10", monto_total: 3200000, rut_contraparte: "76123456-7" },
  { folio: 1198, fecha: "2026-04-02", monto_total: 1800000, rut_contraparte: "76123456-7" },
];

export const DeudorConFacturas: Story = {
  name: "Deudor expandido — facturas + mora pendiente",
  render: () => (
    <div className="max-w-xl">
      <DebtorInvoicesPanel docs={DEBTOR_DOCS} loading={false} error={false} siiEnabled />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1234")).toBeInTheDocument();
    await expect(canvas.getByText("$3.200.000")).toBeInTheDocument();
    // Honestidad: la mora/saldo llega con los vencimientos del SII.
    await expect(canvas.getByText(/días de mora por factura aparecen/i)).toBeInTheDocument();
  },
};

export const DeudorSinFacturas: Story = {
  name: "Deudor expandido — sin facturas en el rango",
  render: () => (
    <div className="max-w-xl">
      <DebtorInvoicesPanel docs={[]} loading={false} error={false} siiEnabled />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Sin facturas de este cliente/i)).toBeInTheDocument();
  },
};
