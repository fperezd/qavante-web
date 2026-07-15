import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { CajaHero } from "./caja-hero";

/* La "respuesta de dueño" del Caja v2: cuánta caja hay + cuánto dura + cuándo toca piso. */

const meta = {
  title: "Propuestas / Caja / CajaHero",
  component: CajaHero,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Apretada: Story = {
  args: {
    titulo: "La empresa tiene en caja",
    saldo: 18_400_000,
    runway: (
      <>
        Alcanza cómodo ~4 semanas · el <b>11-ago</b> cae bajo tu mínimo ($4M).
      </>
    ),
    runwayTono: "warn",
    subtitulo: "Saldo hoy en banco",
    infoHint: "Saldo disponible en las cuentas de banco, hoy. La proyección usa este saldo + las entradas y salidas esperadas.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("La empresa tiene en caja")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$18.400.000")).toBeInTheDocument(), { timeout: 3000 });
    await expect(canvas.getByText(/cae bajo tu mínimo/)).toBeInTheDocument();
  },
};

export const Sana: Story = {
  args: {
    titulo: "La empresa tiene en caja",
    saldo: 24_800_000,
    runway: "La caja cubre los próximos 3 meses con holgura.",
    runwayTono: "ok",
    subtitulo: "Saldo hoy en banco",
  },
};

/** Caja en negativo: el número mismo va en rojo y el tono es crítico (no un ✓ verde). */
export const Negativa: Story = {
  args: {
    titulo: "La empresa tiene en caja",
    saldo: -5_905_530,
    runway: "Tu caja está hoy en negativo · 0 días de caja.",
    runwayTono: "crit",
    subtitulo: "Saldo hoy. Conecta tu banco para confirmar el saldo real por cuenta",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("−$5.905.530")).toBeInTheDocument(), { timeout: 3000 });
    await expect(canvas.getByText(/en negativo/)).toBeInTheDocument();
  },
};
