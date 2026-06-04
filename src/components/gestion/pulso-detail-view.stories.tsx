import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { PulsoDetailView } from "./pulso-detail-view";

/* Pulso detalle (Sprint C6/C7). Container con `usePulsoDetail`. Contrato FE-first
   (endpoint aún no existe) → MSW reproduce los estados. */

const PATH = "*/api/management/pulso";

const FIXTURE = {
  score: 68,
  status: "stable",
  confidence: "medium",
  preliminary: false,
  headline: "Tu Pulso está estable: la rentabilidad ayuda, pero la cobranza más lenta lo frena.",
  components: [
    { key: "liquidity", label: "Liquidez", score: 72, weight: 0.3 },
    { key: "profitability", label: "Rentabilidad", score: 81, weight: 0.3 },
    { key: "collections", label: "Cobranza", score: 48, weight: 0.25 },
    { key: "debt", label: "Endeudamiento", score: 65, weight: 0.15 },
  ],
  drivers: [
    {
      label: "Margen en alza",
      direction: "positive",
      impact: "high",
      detail: "El margen bruto subió 4 pts vs. el mes anterior.",
      cta_label: "Ver resultado",
      cta_href: "/gestion",
    },
    {
      label: "Cobranza lenta",
      direction: "negative",
      impact: "high",
      detail: "Hay $7,9M vencidos; el plazo promedio de cobro subió a 52 días.",
      cta_label: "Ver cobranza",
      cta_href: "/cobrar",
    },
    {
      label: "Pago crítico esta semana",
      direction: "negative",
      impact: "medium",
      detail: "IVA / F29 vence el 12 — asegura la caja.",
      cta_label: null,
      cta_href: null,
    },
  ],
  trend: [
    { period: "ene", score: 61 },
    { period: "feb", score: 58 },
    { period: "mar", score: 64 },
    { period: "abr", score: 66 },
    { period: "may", score: 68 },
  ],
  generated_at: "2026-06-03T12:00:00Z",
};

const OK = http.get(PATH, () => HttpResponse.json(FIXTURE, { status: 200 }));
const CRITICO = http.get(PATH, () =>
  HttpResponse.json(
    {
      ...FIXTURE,
      score: 34,
      status: "critical",
      confidence: "low",
      preliminary: true,
      headline: "Tu Pulso está en zona crítica: la caja no cubre las obligaciones próximas.",
    },
    { status: 200 },
  ),
);
const VACIO = http.get(PATH, () =>
  HttpResponse.json(
    {
      score: 0,
      status: "stable",
      confidence: "low",
      preliminary: true,
      headline: null,
      components: [],
      drivers: [],
      trend: [],
      generated_at: FIXTURE.generated_at,
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
  title: "Capa 2 / Gestión / PulsoDetailView",
  component: PulsoDetailView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Pulso detalle (Sprint C6/C7, Maestro §7): score + estado + ejes que lo componen + drivers (+/-) + tendencia. Cada sección degrada sola. Estados vía MSW. Contrato FE-first.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof PulsoDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completo: Story = { parameters: { msw: { handlers: [OK] } } };
export const Critico: Story = {
  name: "Pulso crítico",
  parameters: { msw: { handlers: [CRITICO] } },
};
export const Vacio: Story = {
  name: "Sin cálculo aún (empresa nueva)",
  parameters: { msw: { handlers: [VACIO] } },
};
export const Cargando: Story = { parameters: { msw: { handlers: [LOADING] } } };
export const Error500: Story = { name: "Error (500)", parameters: { msw: { handlers: [ERROR] } } };
