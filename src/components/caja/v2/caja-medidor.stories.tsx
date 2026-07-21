import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaMedidor, CajaMedidorSinDato } from "./caja-medidor";
import { diasDeCaja } from "./caja-dias-model";
import type { SaldoPunto } from "./caja-curva-model";

/* El medidor de días de caja del Caja v3: responde "¿me alcanza?" en DÍAS. Gauge velocímetro
   (zonas rojo/ámbar/verde + aguja) + readout con titular, piso y recuperación. Presentacional
   puro — la derivación vive en `caja-dias-model` (con unit tests). */

const serie = (saldos: number[]): SaldoPunto[] =>
  saldos.map((v, i) => ({ label: i === 0 ? "hoy" : `+${i}sem`, saldo: v }));

const MIN = 4_000_000;

const meta = {
  title: "Propuestas / Caja / CajaMedidor",
  component: CajaMedidor,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 640,
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaMedidor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ajustada: Story = {
  args: {
    model: diasDeCaja(serie([9_000_000, 6_000_000, 3_500_000, 4_500_000, 6_000_000]), MIN)!,
    minimo: MIN,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Caja ajustada")).toBeInTheDocument();
    await expect(c.getByText("días de caja")).toBeInTheDocument();
    await expect(c.getByText(/Te alcanza/)).toBeInTheDocument();
  },
};

export const EnRojo: Story = {
  args: {
    model: diasDeCaja(serie([5_000_000, 1_000_000, -3_000_000, -1_000_000, 2_000_000]), MIN)!,
    minimo: MIN,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Caja en riesgo")).toBeInTheDocument();
    await expect(c.getByText(/en rojo/i)).toBeInTheDocument();
  },
};

export const Holgada: Story = {
  args: {
    model: diasDeCaja(serie([20_000_000, 18_000_000, 16_000_000, 17_000_000]), MIN)!,
    minimo: MIN,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Caja holgada")).toBeInTheDocument(); // badge (único)
    await expect(c.getByText("Te alcanza de sobra")).toBeInTheDocument(); // titular distinto
  },
};

export const SinDato: Story = {
  args: {
    model: diasDeCaja(serie([9_000_000, 6_000_000, 3_500_000]), MIN)!,
    minimo: MIN,
  },
  render: () => <CajaMedidorSinDato ultimaSync="18-jul" />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      c.getByText("Todavía no hay suficiente movimiento para proyectar"),
    ).toBeInTheDocument();
    await expect(c.getByText(/Actualiza el banco/)).toBeInTheDocument();
  },
};
