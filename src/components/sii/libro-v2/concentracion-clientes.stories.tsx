import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { ConcentracionClientes, type ConcentracionItem } from "./concentracion-clientes";

/* Panel de apoyo del Libro v2: quién concentra la facturación (top 10 por monto).
   En el rediseño baja de card grande arriba a rail al costado de la tabla. */

const meta = {
  title: "Propuestas / Libro de Ventas / ConcentracionClientes",
  component: ConcentracionClientes,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConcentracionClientes>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: ConcentracionItem[] = [
  { nombre: "COMERCIAL KAUFMANN S.A.", rut: "96.572.360-9", monto: 12980000, pct: 22 },
  { nombre: "CIA INDUSTRIAL EL VOLCAN", rut: "90.209.000-2", monto: 8420000, pct: 14 },
  { nombre: "DIVEIMPORT S.A.", rut: "55.555.555-5", monto: 6250000, pct: 11 },
  { nombre: "PUERTO COLUMBO S.A.", rut: "76.008.959-1", monto: 5640000, pct: 9 },
  { nombre: "EMPRESA DE CORREOS DE CHILE", rut: "60.503.000-9", monto: 3150000, pct: 5 },
  { nombre: "COMERCIAL MANQUEHUE LTDA", rut: "86.887.200-4", monto: 2310000, pct: 4 },
  { nombre: "GPS7000 SPA", rut: "76.106.531-9", monto: 1890000, pct: 3 },
  { nombre: "SERVICIOS AUSTRAL SPA", rut: "77.101.202-3", monto: 1540000, pct: 3 },
  { nombre: "INGENIERÍA DEL SUR LTDA", rut: "77.404.505-6", monto: 1180000, pct: 2 },
  { nombre: "COMERCIAL ANDINA S.A.", rut: "96.808.909-1", monto: 980000, pct: 2 },
  { nombre: "NO DEBERÍA VERSE (11)", rut: "11.111.111-1", monto: 500000, pct: 1 },
  { nombre: "NO DEBERÍA VERSE (12)", rut: "22.222.222-2", monto: 300000, pct: 1 },
];

export const Top10: Story = {
  args: { titulo: "Concentración por cliente", items: ITEMS, onExport: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El más concentrado, con su monto en CLP.
    await expect(canvas.getByText("COMERCIAL KAUFMANN S.A.")).toBeInTheDocument();
    await expect(canvas.getByText("$12.980.000")).toBeInTheDocument();
    // Muestra 10; el 11º/12º quedan fuera (max por defecto).
    await expect(canvas.getByText("COMERCIAL ANDINA S.A.")).toBeInTheDocument();
    await expect(canvas.queryByText(/NO DEBERÍA VERSE/)).not.toBeInTheDocument();
    // Export visible.
    await expect(canvas.getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
  },
};

export const Vacia: Story = {
  args: { titulo: "Concentración por cliente", items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Sin documentos en el período.")).toBeInTheDocument();
  },
};
