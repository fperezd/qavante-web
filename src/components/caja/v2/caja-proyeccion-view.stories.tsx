import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CajaProyeccionView } from "./caja-proyeccion-view";
import { causasDelPiso, proyeccionDeMovimientos } from "./caja-proyeccion-model";
import type { MovimientoCaja } from "./caja-cascada-model";

/* CajaProyeccionView — el rediseño del "Saldo proyectado" del Caja v3: medidor de días + cascada de
   próximos movimientos, ambos derivados de vencimientos. Estado honesto si no hay proyección. */

const HOY = new Date(2026, 6, 21);
const mov = (dia: number, label: string, monto: number): MovimientoCaja => ({
  fecha: new Date(2026, 6, 21 + dia),
  fechaLabel: `${21 + dia > 31 ? 21 + dia - 31 : 21 + dia}-${21 + dia > 31 ? "ago" : "jul"}`,
  label,
  monto,
});

const MOVS: MovimientoCaja[] = [
  mov(9, "Sueldos", -6_800_000),
  mov(10, "Kaufmann", 2_900_000),
  mov(20, "Proveedores", -5_100_000),
  mov(35, "Cliente B", 6_900_000),
];

const meta = {
  title: "Propuestas / Caja / CajaProyeccionView",
  component: CajaProyeccionView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 760,
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CajaProyeccionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConProyeccion: Story = {
  args: {
    proyeccion: proyeccionDeMovimientos(6_200_000, MOVS, HOY, null),
    minimo: null,
    movimientos: MOVS,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // medidor (gauge) + cascada (título) juntos — textos únicos (evito "Saldo hoy", que está en ambos)
    await expect(c.getByText("días de caja")).toBeInTheDocument();
    await expect(c.getByText("Próximos movimientos · de dónde salen los días")).toBeInTheDocument();
    await expect(c.getByText("Kaufmann")).toBeInTheDocument();
  },
};

export const ConSaldoStale: Story = {
  args: {
    proyeccion: proyeccionDeMovimientos(6_200_000, MOVS, HOY, null),
    minimo: null,
    movimientos: MOVS,
    ultimaSync: "18-jul",
    saldoStale: true,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Proyección sobre el saldo del banco al 18-jul/)).toBeInTheDocument();
  },
};

/* Con quiebre: la caja toca negativo → aparece el bloque "Qué te lleva al punto más bajo"
   con los mayores egresos hasta el piso (F29 + Sueldos + Proveedores). */
const BREAK_MOVS: MovimientoCaja[] = [
  mov(9, "Sueldos", -6_800_000),
  { ...mov(12, "F29", -9_200_000), tipo: "impuesto" },
  mov(20, "Proveedores", -5_100_000),
  mov(35, "Cliente B", 6_900_000),
];

export const ConCausasDeQuiebre: Story = {
  args: {
    proyeccion: proyeccionDeMovimientos(3_000_000, BREAK_MOVS, HOY, null),
    minimo: null,
    movimientos: BREAK_MOVS,
    causas: causasDelPiso(
      BREAK_MOVS,
      HOY,
      proyeccionDeMovimientos(3_000_000, BREAK_MOVS, HOY, null)?.piso?.dia ?? 0,
      3,
    ),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Qué te lleva al punto más bajo")).toBeInTheDocument();
    await expect(c.getByText("F29")).toBeInTheDocument();
  },
};

export const SinDato: Story = {
  args: { proyeccion: null, minimo: null, movimientos: [], ultimaSync: "18-jul" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      c.getByText("Todavía no hay suficiente movimiento para proyectar"),
    ).toBeInTheDocument();
  },
};
