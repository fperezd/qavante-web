import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { BrechaCaja } from "./brecha-caja";

/* La brecha de caja de Pagar v2: cuánto cubre la caja de los pagos críticos + qué parte
   es postergable (la brecha real). */

const meta = {
  title: "Propuestas / Pagar / BrechaCaja",
  component: BrechaCaja,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrechaCaja>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCubreConPostergable: Story = {
  args: {
    cajaProyectada: 9_400_000,
    pagosCriticos: 18_100_000,
    dias: 14,
    postergable: 5_500_000,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Caja vs\. pagos críticos/)).toBeInTheDocument();
    // Leyenda con montos.
    await expect(canvas.getByText("$9.400.000")).toBeInTheDocument();
    await expect(canvas.getByText("$18.100.000")).toBeInTheDocument();
    // El insight: postergable → brecha real.
    await expect(canvas.getByText(/es postergable/)).toBeInTheDocument();
    await expect(canvas.getByText("$3.200.000")).toBeInTheDocument(); // 8.7M − 5.5M
  },
};

export const Cubre: Story = {
  args: {
    cajaProyectada: 20_000_000,
    pagosCriticos: 18_100_000,
    dias: 14,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/La caja cubre lo crítico/)).toBeInTheDocument();
    await expect(canvas.getByText(/holgura \$1\.900\.000/)).toBeInTheDocument();
  },
};

/** A3 interino: mientras la postergabilidad la infiere el FE (no un flag del backend), se avisa. */
export const PostergabilidadEstimada: Story = {
  args: {
    cajaProyectada: 9_400_000,
    pagosCriticos: 18_100_000,
    dias: 14,
    postergable: 5_500_000,
    postergabilidadEstimada: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/lo estima Qavante por tipo de pago/)).toBeInTheDocument();
  },
};

/** Con el flag apagado (cuando CC-API mande la postergabilidad real) NO se muestra la nota. */
export const SinNotaCuandoNoEstimada: Story = {
  args: {
    cajaProyectada: 9_400_000,
    pagosCriticos: 18_100_000,
    dias: 14,
    postergable: 5_500_000,
    postergabilidadEstimada: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/lo estima Qavante por tipo de pago/)).not.toBeInTheDocument();
  },
};
