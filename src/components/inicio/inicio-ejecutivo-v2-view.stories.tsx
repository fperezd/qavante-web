import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { InicioEjecutivoV2View } from "./inicio-ejecutivo-v2-view";

/* Inicio Ejecutivo v2 (rediseño lente Xero). Container con `useDashboardSummary`
   + `useMe`. Campos extendidos (key_obligations, sparkline, delta) son FE-first
   → MSW reproduce los estados, incluida la degradación parcial. */

const SUMMARY = "*/api/dashboard/summary";
const ME = "*/api/me";

const meHandler = http.get(ME, () =>
  HttpResponse.json(
    { user: { id: "1", email: "fperez@tooxs.com", name: "Fernando Pérez", role: "owner" } },
    { status: 200 },
  ),
);

const FIXTURE = {
  executive_phrase:
    "Tu caja alcanza ~6 semanas; hay $7,9M vencidos por cobrar y un pago crítico esta semana.",
  pulso: {
    score: 68,
    status: "stable",
    confidence: "medium",
    top_driver_positive: "Ventas en alza",
    top_driver_negative: "Cobranza lenta",
    preliminary: false,
  },
  cash_today: { total: "9800000", last_updated: "2026-06-04T08:00:00Z", data_state: "available" },
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
    next_critical: {
      label: "Impuestos Mensuales (F29)",
      due_date: "2026-06-12",
      amount: "2400000",
    },
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
      reason: "Asegura los Impuestos Mensuales del 12 — te faltan $1,2M",
      deadline: "12 jun",
      cta_label: "Ver pagos",
      cta_href: "/pagar",
    },
  ],
  // Campos extendidos v2:
  key_obligations: [
    {
      key: "imposiciones",
      label: "Imposiciones (Previred)",
      due_date: "2026-06-10",
      amount: "1100000",
      coverage: "covered",
    },
    {
      key: "impuestos_mensuales",
      label: "Impuestos Mensuales (F29)",
      due_date: "2026-06-12",
      amount: "2400000",
      coverage: "tight",
    },
    {
      key: "sueldos",
      label: "Sueldos",
      due_date: "2026-06-30",
      amount: "4200000",
      coverage: "covered",
    },
  ],
  cash_sparkline: [61, 58, 64, 66, 70, 68, 72],
  cash_delta_pct: 8,
  generated_at: "2026-06-04T12:00:00Z",
};

const OK = http.get(SUMMARY, () => HttpResponse.json(FIXTURE, { status: 200 }));
const SIN_FECHAS = http.get(SUMMARY, () =>
  HttpResponse.json(
    { ...FIXTURE, key_obligations: null, cash_sparkline: null, cash_delta_pct: null },
    { status: 200 },
  ),
);
const VACIO = http.get(SUMMARY, () =>
  HttpResponse.json(
    {
      executive_phrase: null,
      pulso: null,
      cash_today: null,
      cash_forecast: null,
      cash_gap: null,
      overdue_collections: null,
      critical_payments: null,
      operational_result: null,
      priority_actions: null,
      generated_at: FIXTURE.generated_at,
    },
    { status: 200 },
  ),
);
const LOADING = http.get(SUMMARY, async () => {
  await delay("infinite");
  return HttpResponse.json(FIXTURE, { status: 200 });
});
const ERROR = http.get(SUMMARY, () =>
  HttpResponse.json({ code: "internal_error", detail: "Falló." }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Inicio / InicioEjecutivoV2View",
  component: InicioEjecutivoV2View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inicio Ejecutivo v2 (rediseño lente Xero): saludo + Pulso compacto + frase héroe + caja con tendencia + tus 3 fechas clave del mes (imposiciones / Impuestos Mensuales F29 / sueldos) + qué hacer primero + money in/out. Campos extendidos FE-first; degradan si faltan.",
      },
    },
    msw: { handlers: [OK, meHandler] },
  },
} satisfies Meta<typeof InicioEjecutivoV2View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completo: Story = { parameters: { msw: { handlers: [OK, meHandler] } } };
export const SinFechasClave: Story = {
  name: "Sin campos v2 (degrada al básico)",
  parameters: { msw: { handlers: [SIN_FECHAS, meHandler] } },
};
export const Vacio: Story = {
  name: "Sin datos (empresa nueva)",
  parameters: { msw: { handlers: [VACIO, meHandler] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING, meHandler] } } };
export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR, meHandler] } },
};
