import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { InicioEjecutivoView } from "./inicio-ejecutivo-view";

/* Inicio Ejecutivo (Sprint C8). Container con `useDashboardSummary`. Contrato
   FE-first (endpoint aún no existe) → MSW reproduce los estados, incluida la
   degradación parcial (bloques null sin tumbar el resto). */

const PATH = "*/api/dashboard/summary";

const FIXTURE = {
  executive_phrase:
    "Tu caja alcanza ~6 semanas; hay $7,9M vencidos por cobrar y un pago crítico esta semana.",
  pulso: {
    score: 68,
    status: "stable",
    confidence: "medium",
    top_driver_positive: "Ventas en alza vs. mes anterior",
    top_driver_negative: "Cobranza más lenta de lo normal",
    preliminary: false,
  },
  cash_today: { total: "9800000", last_updated: "2026-06-02T08:00:00Z", data_state: "available" },
  cash_forecast: { min_14d: "5400000", min_30d: "2100000", days_of_cash: 42 },
  cash_gap: { critical_obligations_14d: "6600000", projected_cash_14d: "5400000", has_gap: true },
  overdue_collections: {
    total_receivable: "24800000",
    overdue: "7900000",
    top_clients: [
      { name: "Constructora Andes SpA", amount: "3200000" },
      { name: "Comercial del Sur Ltda", amount: "2400000" },
      { name: "Minera Atacama SA", amount: "1100000" },
    ],
  },
  critical_payments: {
    due_7d: "3800000",
    due_14d: "6200000",
    next_critical: { label: "IVA / F29 mayo", due_date: "2026-06-12", amount: "2400000" },
  },
  operational_result: {
    revenue: "18500000",
    gross_margin: "11100000",
    ebitda_proxy: "3900000",
    result: "3900000",
  },
  priority_actions: [
    {
      priority: 1,
      reason: "Cobra $3,2M vencidos a Constructora Andes",
      deadline: "esta semana",
      cta_label: "Ver cobranza",
      cta_href: "/cobrar",
    },
    {
      priority: 2,
      reason: "IVA / F29 vence el 12 — asegura la caja",
      deadline: "12 jun",
      cta_label: "Ver pagos",
      cta_href: "/pagar",
    },
  ],
  generated_at: "2026-06-02T12:00:00Z",
};

const OK = http.get(PATH, () => HttpResponse.json(FIXTURE, { status: 200 }));
const PARCIAL = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      executive_phrase: "Estamos completando tus fuentes; algunos datos faltan.",
      pulso: { ...FIXTURE.pulso, status: "weak", score: 41, preliminary: true },
      cash_today: null, // fuente caída → bloque "sin dato"
      cash_gap: null,
      operational_result: null,
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
  title: "Capa 2 / Inicio / InicioEjecutivoView",
  component: InicioEjecutivoView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inicio Ejecutivo (Sprint C8, Maestro §7.1): frase ejecutiva + Pulso + caja hoy/proyectada + brecha + cobranza + pagos + resultado + 3 acciones. Cada bloque nullable (degradación parcial sin tumbar el dashboard). Estados vía MSW. Contrato FE-first.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof InicioEjecutivoView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completo: Story = { parameters: { msw: { handlers: [OK] } } };
export const Parcial: Story = {
  name: "Degradación parcial (bloques sin dato)",
  parameters: { msw: { handlers: [PARCIAL] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING] } } };
export const Error500: Story = { name: "Error (500)", parameters: { msw: { handlers: [ERROR] } } };
