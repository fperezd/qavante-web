import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ConcentracionDimension } from "./concentracion-dimension";
import type { DistribucionItem } from "./concentracion-dimension-model";

/* Distribución de la contraparte por TAMAÑO (tramo) o INDUSTRIA (sector) — reusable para las 4 vistas
   (clientes/proveedores × tamaño/industria). Pendiente de cablear al endpoint #825. Datos de ejemplo
   con la forma que pidió Fernando (referencia BI). */

const meta = {
  title: "Propuestas / Concentración / Por dimensión (tamaño · industria)",
  component: ConcentracionDimension,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConcentracionDimension>;

export default meta;
type Story = StoryObj<typeof meta>;

const clientesTamano: DistribucionItem[] = [
  {
    label: "Corp — Tramo 13",
    monto: 64_000_000,
    pct: 64,
    hint: "Grandes empresas (tramo 13 del SII).",
  },
  { label: "Enterprise — Tramo 13", monto: 13_800_000, pct: 13.8 },
  { label: "Mid-Corp — Tramo 11", monto: 6_910_000, pct: 6.9 },
  { label: "Mid-Corp — Tramo 12", monto: 5_500_000, pct: 5.5 },
  { label: "Consolidada — Tramo 7", monto: 4_400_000, pct: 4.4 },
  { label: "Pequeña — Tramo 4", monto: 3_000_000, pct: 3.0 },
];

const clientesIndustria: DistribucionItem[] = [
  { label: "Comercio al por mayor", monto: 57_800_000, pct: 57.8 },
  { label: "Industria manufacturera", monto: 11_100_000, pct: 11.1 },
  { label: "Suministro de agua", monto: 8_500_000, pct: 8.5 },
  { label: "Actividades profesionales", monto: 5_700_000, pct: 5.7 },
  { label: "Información y comunicaciones", monto: 5_200_000, pct: 5.2 },
];

const proveedoresTamano: DistribucionItem[] = [
  { label: "Mid-Corp — Tramo 11", monto: 38_000_000, pct: 38 },
  { label: "Corp — Tramo 13", monto: 32_000_000, pct: 32 },
  { label: "Consolidada — Tramo 9", monto: 14_000_000, pct: 14 },
  { label: "Enterprise — Tramo 13", monto: 6_000_000, pct: 6 },
  { label: "Mid-Corp — Tramo 12", monto: 2_600_000, pct: 2.6 },
];

/** Clientes por tamaño (ventas). */
export const ClientesPorTamano: Story = {
  args: {
    titulo: "Clientes por tamaño",
    subtitulo: "Distribución de los clientes por tamaño (últimos 12 meses).",
    items: clientesTamano,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Clientes por tamaño")).toBeInTheDocument();
    await expect(c.getByText("Corp — Tramo 13")).toBeInTheDocument();
    // 6 items, max 5 → "Otros" agrupa el 6º.
    await expect(c.getByText("Otros")).toBeInTheDocument();
  },
};

/** Clientes por industria (ventas). */
export const ClientesPorIndustria: Story = {
  args: {
    titulo: "Clientes por industria",
    subtitulo: "Distribución de los clientes por tipo de industria (últimos 12 meses).",
    items: clientesIndustria,
  },
};

/** Proveedores por tamaño (compras). */
export const ProveedoresPorTamano: Story = {
  args: {
    titulo: "Proveedores por tamaño",
    subtitulo: "Distribución de los proveedores por tamaño (últimos 12 meses).",
    items: proveedoresTamano,
  },
};

/** Sin datos. */
export const SinDatos: Story = {
  args: { titulo: "Proveedores por industria", items: [] },
};
