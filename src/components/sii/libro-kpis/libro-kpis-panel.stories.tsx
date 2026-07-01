import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LibroKpisPanel } from "./libro-kpis-panel";
import { comprasDocs, ventasDocs } from "./libro-kpis-fixtures";

/* PROPUESTA UX — Panel de KPIs del Libro (Ventas/Compras).
   Se monta arriba de la tabla del Libro: saca el número de oro del footer al
   hero (ventas netas / IVA crédito), suma concentración por contraparte, neteo
   de notas de crédito y export CSV. FE-only sobre los docs ya descargados. */

const meta = {
  title: "Propuestas / SII / Libro KPIs",
  component: LibroKpisPanel,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibroKpisPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Libro de Ventas: neto + IVA débito + concentración por cliente + 1 NC neteada. */
export const Ventas: Story = { args: { docs: ventasDocs, kind: "ventas", periodo: "2026-06" } };

/** Libro de Compras: el IVA crédito (insumo del F29) al frente + concentración por proveedor. */
export const Compras: Story = { args: { docs: comprasDocs, kind: "compras", periodo: "2026-06" } };
