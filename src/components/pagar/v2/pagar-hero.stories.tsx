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
    cobertura: (
      <>
        La caja no alcanza: faltan <b>$8.700.000</b> para los pagos críticos de 14 días.
      </>
    ),
    coberturaTono: "bad",
    subtitulo: "5 vencimientos esta semana · 1 vencido",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("La empresa debe pagar")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$34.525.000")).toBeInTheDocument(), { timeout: 3000 });
    await expect(canvas.getByText(/La caja no alcanza/)).toBeInTheDocument();
  },
};

export const Cubre: Story = {
  args: {
    titulo: "La empresa debe pagar",
    montoTotal: 12_300_000,
    cobertura: "La caja proyectada cubre los pagos críticos de los próximos 14 días.",
    coberturaTono: "ok",
    subtitulo: "3 vencimientos esta semana",
  },
};
