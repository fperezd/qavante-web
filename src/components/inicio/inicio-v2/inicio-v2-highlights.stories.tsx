import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InicioV2Highlights } from "./inicio-v2-highlights";
import type { InicioV2Data } from "./types";

/* PROPUESTA UX — Inicio Ejecutivo v2 (highlights).
   Agrega los DELTAS y las 3 fechas clave que el contrato DashboardSummaryV2 ya
   define pero la vista no renderiza: runway héroe, caja con variación % +
   sparkline, ventas vs año anterior, obligaciones del mes con cobertura. */

const sano: InicioV2Data = {
  cash_today: "48250000",
  cash_delta_pct: 8.4,
  cash_sparkline: [31, 34, 33, 38, 41, 48],
  days_of_cash: 62,
  ventas_mes: "31200000",
  ventas_delta_yoy: 12.5,
  key_obligations: [
    { key: "sueldos", label: "Sueldos julio", due_date: "2026-07-05", amount: "4200000", coverage: "covered" },
    { key: "impuestos_mensuales", label: "Impuestos mensuales (F29)", due_date: "2026-07-12", amount: "2480000", coverage: "covered" },
    { key: "imposiciones", label: "Imposiciones (Previred)", due_date: "2026-07-13", amount: "1350000", coverage: "tight" },
  ],
};

const enRiesgo: InicioV2Data = {
  cash_today: "9800000",
  cash_delta_pct: -22.3,
  cash_sparkline: [24, 22, 19, 16, 13, 10],
  days_of_cash: 11,
  ventas_mes: "18400000",
  ventas_delta_yoy: -9.1,
  key_obligations: [
    { key: "sueldos", label: "Sueldos julio", due_date: "2026-07-05", amount: "4200000", coverage: "tight" },
    { key: "impuestos_mensuales", label: "Impuestos mensuales (F29)", due_date: "2026-07-12", amount: "2480000", coverage: "uncovered" },
    { key: "imposiciones", label: "Imposiciones (Previred)", due_date: "2026-07-13", amount: "1350000", coverage: "uncovered" },
  ],
};

const meta = {
  title: "Propuestas / Inicio / Inicio Ejecutivo v2",
  component: InicioV2Highlights,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InicioV2Highlights>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empresa sana: caja creciendo, ventas +12,5% vs año anterior, obligaciones cubiertas. */
export const Sano: Story = { args: { data: sano } };

/** En riesgo: caja cayendo, runway 11 días, F29 e imposiciones sin cubrir. */
export const EnRiesgo: Story = { args: { data: enRiesgo } };
