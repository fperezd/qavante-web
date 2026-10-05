import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ReadyView } from "./ready-view";
import type { FinancialReadiness } from "@/lib/api/onboarding-readiness";

/* Las historias cubren los dos extremos de la escalera y la espera. El punto de cada
   una es el mismo: en TODAS hay una cifra con qué cubre, y en ninguna aparece una
   etiqueta de confianza ni un «no disponible». */

function readiness(fin: FinancialReadiness) {
  return http.get("*/api/onboarding/readiness", () =>
    HttpResponse.json({ ready: true, deferred_sources: [], financial: fin }),
  );
}

const COMPLETO: FinancialReadiness = {
  level: "nomina_protegida",
  level_index: 4,
  levels_total: 5,
  unlocked_decision: "Qué mover esta semana, con las remuneraciones separadas de lo postergable.",
  statement: "Mantén 6000000 CLP en caja: cubre 30 días de tus gastos esenciales.",
  covers: "cubre 45 días de tus gastos esenciales",
  currency: "CLP",
  minimum_cash: "6000000",
  cash_today: "9000000",
  essential_outflow_days_covered: 45,
  basis: {
    rung: "egresos_conciliados",
    label: "egresos operacionales conciliados del banco",
    buffer_days: 30,
    months_observed: 6,
    conservative: false,
    daily_essential_outflow: "200000",
  },
  next_action: {
    code: "ver_plan_de_caja",
    label: "Ver tu plan de caja",
    reason: "Tienes lo necesario para decidir qué pagar, qué cobrar y qué mover esta semana.",
  },
  missing: [],
  satisfied: [
    "sociedad_identificada",
    "piso_de_caja",
    "banco_conectado",
    "sii_conectado",
    "remuneraciones_configuradas",
  ],
};

/* Pocos datos: el piso sale del saldo declarado y el colchón sube a 60 días. La
   pantalla se ve IGUAL de firme — el ajuste pasó en el cálculo, no en una
   advertencia. */
const CONSERVADOR: FinancialReadiness = {
  ...COMPLETO,
  level: "piso",
  level_index: 1,
  unlocked_decision: "Cuánto efectivo mantener y cuántos días cubre tu caja.",
  minimum_cash: "6000000",
  cash_today: "9000000",
  essential_outflow_days_covered: 90,
  basis: {
    rung: "saldo_declarado",
    label: "saldo en caja declarado",
    buffer_days: 60,
    months_observed: 0,
    conservative: true,
    daily_essential_outflow: "100000",
  },
  next_action: {
    code: "conectar_banco",
    label: "Conectar tu banco",
    reason: "El banco pone el saldo real en el cálculo y deja de depender de lo declarado.",
  },
  missing: ["banco_conectado", "sii_conectado", "remuneraciones_configuradas"],
  satisfied: ["sociedad_identificada", "piso_de_caja"],
};

const meta = {
  title: "Capa 2 / Onboarding / ReadyView",
  component: ReadyView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [readiness(COMPLETO)] },
  },
} satisfies Meta<typeof ReadyView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Completa: Story = { name: "Escalera completa (nómina protegida)" };

export const Conservadora: Story = {
  name: "Base conservadora (piso desde el saldo declarado)",
  parameters: { msw: { handlers: [readiness(CONSERVADOR)] } },
};

export const Calculando: Story = {
  name: "Calculando (esqueleto de la cifra)",
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/onboarding/readiness", async () => {
          await delay("infinite");
          return HttpResponse.json({ ready: true });
        }),
      ],
    },
  },
};
