import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ObligationProgressCard } from "./obligation-progress-card";

/* Progreso macro del préstamo (Timeline). Se prueba en aislamiento con props
   (ADR-0018): render determinístico, sin red — el helper `computeObligationProgress`
   tiene su propio unit test para la lógica. */

const meta = {
  title: "Capa 2 / Pagar / ObligationProgressCard",
  component: ObligationProgressCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ObligationProgressCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const cuota = (number: number, due_date: string, status: string) => ({ number, due_date, status });

export const EnCurso: Story = {
  name: "En curso (con una vencida)",
  args: {
    installments: [
      cuota(1, "2026-01-15", "paid"),
      cuota(2, "2026-02-15", "paid"),
      cuota(3, "2026-03-15", "overdue"),
      cuota(4, "2026-04-15", "pending"),
    ],
    installmentsTotal: 6,
    originationDate: "2026-01-01",
    principalFormatted: "$12.000.000",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Progreso del préstamo")).toBeVisible();
    await expect(canvas.getByText("Originado")).toBeVisible();
    await expect(canvas.getByText(/2 de 6 cuotas pagadas/)).toBeVisible();
    await expect(canvas.getByText(/1 vencida/)).toBeVisible();
  },
};

export const Liquidado: Story = {
  args: {
    installments: [cuota(1, "2025-10-15", "paid"), cuota(2, "2025-11-15", "pagada")],
    installmentsTotal: 2,
    originationDate: "2025-09-15",
    principalFormatted: "$6.000.000",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Liquidado")).toBeVisible();
    await expect(canvas.getByText(/2 de 2 cuotas pagadas/)).toBeVisible();
  },
};
