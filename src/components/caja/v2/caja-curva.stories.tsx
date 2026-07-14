import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaCurva } from "./caja-curva";
import type { SaldoPunto } from "./caja-curva-model";

/* La curva de saldo proyectado del Caja v2 (rediseño 2026-07-14): baja hacia la línea de
   caja mínima y marca cuándo la caja toca el piso. Grid vertical por período, eventos como
   guías verticales alineadas, punto más bajo en rojo. */

const meta = {
  title: "Propuestas / Caja / CajaCurva",
  component: CajaCurva,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, border: "1px solid var(--color-border)", borderRadius: 12, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaCurva>;

export default meta;
type Story = StoryObj<typeof meta>;

const SERIE: SaldoPunto[] = [
  { label: "hoy", saldo: 18_400_000 },
  { label: "20-jul", saldo: 12_100_000 },
  { label: "27-jul", saldo: 9_800_000 },
  { label: "03-ago", saldo: 6_200_000 },
  { label: "10-ago", saldo: 7_500_000 },
  { label: "17-ago", saldo: 3_100_000 },
  { label: "24-ago", saldo: 5_400_000 },
  { label: "31-ago", saldo: 6_800_000 },
  { label: "07-sep", saldo: 5_900_000 },
];

export const CruzaElMinimo: Story = {
  args: {
    serie: SERIE,
    minimo: 4_000_000,
    eventos: [
      { indice: 1, label: "Sueldos" },
      { indice: 3, label: "IVA / F29" },
      { indice: 5, label: "Bajo el mínimo", tono: "crit" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Eventos como guías verticales con etiqueta.
    await expect(canvas.getByText("Sueldos")).toBeInTheDocument();
    await expect(canvas.getByText("IVA / F29")).toBeInTheDocument();
    await expect(canvas.getByText("Bajo el mínimo")).toBeInTheDocument();
    // Eje x por período.
    await expect(canvas.getByText("hoy")).toBeInTheDocument();
    await expect(canvas.getByText("07-sep")).toBeInTheDocument();
  },
};

/** Caja sana: nunca cruza el mínimo → sin evento crítico. */
export const NoCruza: Story = {
  args: {
    serie: [
      { label: "hoy", saldo: 18_400_000 },
      { label: "20-jul", saldo: 16_900_000 },
      { label: "27-jul", saldo: 17_800_000 },
      { label: "03-ago", saldo: 15_200_000 },
      { label: "10-ago", saldo: 16_400_000 },
    ],
    minimo: 4_000_000,
    eventos: [{ indice: 1, label: "Sueldos" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sueldos")).toBeInTheDocument();
    await expect(canvas.queryByText("Bajo el mínimo")).not.toBeInTheDocument();
  },
};

/** Degradado: sin caja mínima configurada y saldo negativo. En vez de inventar un piso en
 *  $0 y pintar todo de rojo, muestra una referencia neutra de $0 y la curva. */
export const SinMinimoNegativo: Story = {
  args: {
    serie: [
      { label: "hoy", saldo: -5_905_530 },
      { label: "2026-W27", saldo: -6_759_006 },
      { label: "2026-W28", saldo: -6_774_558 },
    ],
    minimo: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Referencia neutra de $0 (no "Caja mínima" ni zona roja).
    await expect(canvas.getByText("$0")).toBeInTheDocument();
    await expect(canvas.queryByText("Caja mínima")).not.toBeInTheDocument();
    await expect(canvas.getByText("hoy")).toBeInTheDocument();
  },
};
