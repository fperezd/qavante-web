import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { PagarHero } from "./pagar-hero";

/* La "respuesta de dueño" de Pagar v2: cuánto debe pagar + ¿la caja alcanza? */

const meta = {
  title: "Propuestas / Pagar / PagarHero",
  component: PagarHero,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PagarHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAlcanza: Story = {
  args: {
    titulo: "La empresa debe pagar",
    montoTotal: 34_525_000,
    cobertura: "La caja cae bajo cero dentro de 14 días · brecha máxima $8.700.000.",
    coberturaTono: "bad",
    subtitulo: "128 obligaciones con vencimiento · se muestran las más próximas",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("La empresa debe pagar")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$34.525.000")).toBeInTheDocument(), {
      timeout: 3000,
    });
    await expect(canvas.getByText(/La caja cae bajo cero/)).toBeInTheDocument();
  },
};

export const Cubre: Story = {
  args: {
    titulo: "La empresa debe pagar",
    montoTotal: 12_300_000,
    cobertura: "La caja se mantiene sobre cero y cubre los vencimientos críticos conocidos.",
    coberturaTono: "ok",
    subtitulo: "3 vencimientos esta semana",
  },
};
