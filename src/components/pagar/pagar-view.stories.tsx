import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { PagarView } from "./pagar-view";

/* Pagar — cuentas por pagar (Sprint C4). Container con `useAccountsPayable`.
   Contrato FE-first (endpoint aún no existe) → MSW reproduce los estados. */

const PATH = "*/api/treasury/accounts-payable";

const FIXTURE = {
  total: "12600000",
  due_7d: "3800000",
  due_14d: "6200000",
  due_30d: "9100000",
  items: [
    {
      label: "IVA / F29 mayo",
      category: "tax",
      due_date: "2026-06-12",
      amount: "2400000",
      criticality: "high",
      source: "SII",
    },
    {
      label: "Sueldos junio",
      category: "payroll",
      due_date: "2026-06-30",
      amount: "4200000",
      criticality: "high",
      source: "Previred",
    },
    {
      label: "Arriendo bodega",
      category: "rent",
      due_date: "2026-06-05",
      amount: "1300000",
      criticality: "medium",
      source: "Manual",
    },
    {
      label: "Leasing camioneta",
      category: "leasing",
      due_date: "2026-06-22",
      amount: "640000",
      criticality: "low",
      source: "Manual",
    },
  ],
  projected_cash_14d: "5400000",
  covers_critical: false,
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const OK = http.get(PATH, () => HttpResponse.json(FIXTURE, { status: 200 }));
const CUBRE = http.get(PATH, () =>
  HttpResponse.json({ ...FIXTURE, covers_critical: true }, { status: 200 }),
);
const EMPTY = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      total: "0",
      due_7d: "0",
      due_14d: "0",
      due_30d: "0",
      items: [],
      covers_critical: null,
      projected_cash_14d: null,
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
  title: "Capa 2 / Pagar / PagarView",
  component: PagarView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Pagar / cuentas por pagar (Sprint C4, Maestro §7.4): resumen (total + 7/14/30 días), relación contra caja (alerta si no alcanza) y pagos/obligaciones ordenados por criticidad. Estados canónicos vía MSW. Contrato FE-first.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof PagarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAlcanzaLaCaja: Story = {
  name: "Caja no cubre los críticos (alerta)",
  parameters: { msw: { handlers: [OK] } },
};
export const CajaCubre: Story = {
  name: "Caja cubre los críticos",
  parameters: { msw: { handlers: [CUBRE] } },
};
export const SinPagos: Story = {
  name: "Sin pagos pendientes",
  parameters: { msw: { handlers: [EMPTY] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING] } } };
export const Error500: Story = { name: "Error (500)", parameters: { msw: { handlers: [ERROR] } } };
