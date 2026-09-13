import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, expect, waitFor } from "storybook/test";
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
/* CONTRATO NUEVO (qavante-api#123, hallazgo H6): el backend NO pudo computar la
   mora → `overdue`/`overdue_pct` y los cuatro tramos de aging vienen en `null`
   (la clave viene, el valor no), y `undated_amount` EXPLICA por qué. La pantalla
   tiene que decir "sin dato" con el porqué, y NO pintar 100% "Vigente". */
const SIN_VENCIMIENTOS = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      overdue: null,
      overdue_pct: null,
      aging: { current: "16900000", d1_30: null, d31_60: null, d61_90: null, d90_plus: null },
      overdue_documents: [],
      undated_amount: "7900000",
      data_state: "partial",
      missing_sources: ["Términos de pago sin definir"],
    },
    { status: 200 },
  ),
);
/* Cero VERIFICADO: la API SÍ computó y da 0. "Estás al día" es una afirmación
   real y tiene que sobrevivir intacta al fix del null. */
const AL_DIA = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      overdue: "0",
      overdue_pct: "0",
      aging: { current: "24800000", d1_30: "0", d31_60: "0", d61_90: "0", d90_plus: "0" },
      overdue_documents: [],
      top_debtors: FIXTURE.top_debtors.map((d) => ({ ...d, overdue: "0" })),
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

export const Disponible: Story = {
  parameters: { msw: { handlers: [OK] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Prueba que el handler MSW alimenta al container: antes de #95 esta story
       terminaba en config_missing sin llegar a esta respuesta. */
    await waitFor(() =>
      expect(canvas.getAllByText("Constructora Andes SpA").length).toBeGreaterThan(0),
    );
    await expect(canvas.getByText("Factura 1234")).toBeInTheDocument();
  },
};
export const SinSii: Story = {
  name: "Sin acceso SII (siiEnabled=false)",
  args: { siiEnabled: false },
  parameters: { msw: { handlers: [OK] } },
};
export const SinDeuda: Story = {
  name: "Sin cuentas por cobrar",
  parameters: { msw: { handlers: [EMPTY] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("No tienes cuentas por cobrar")).toBeInTheDocument(),
    );
  },
};
/* Estados del contrato #123 (H6). Desde #95 el preview fija un host `.invalid`
   sólo para Storybook: MSW intercepta antes de que exista una salida a red. Estas
   plays fijan el dato que provee cada handler, no sólo que el container monte. */
export const VencidoSinDato: Story = {
  name: "Vencido sin dato (contrato #123)",
  parameters: { msw: { handlers: [SIN_VENCIMIENTOS] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Vencido")).toBeInTheDocument());
    await expect(canvas.getAllByText("Sin información").length).toBeGreaterThan(0);
    await expect(
      canvas.getAllByText(/No podemos calcular cuánto está vencido/i).length,
    ).toBeGreaterThan(0);
  },
};
export const AlDia: Story = {
  name: "Cero verificado · estás al día",
  parameters: { msw: { handlers: [AL_DIA] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Vencido")).toBeInTheDocument());
    await expect(canvas.getByText(/Estás al día: no tienes saldo vencido/i)).toBeInTheDocument();
  },
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
  name: "Deudor expandido · facturas + mora pendiente",
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
  name: "Deudor expandido · sin facturas en el rango",
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
