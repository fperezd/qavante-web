import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LibroAnuladasView } from "./libro-anuladas-view";
import { comprasJunio, ventasJulio, ventasKaufmann } from "./libro-anuladas-fixtures";

/* PROPUESTA UX — Libro de Ventas con anuladas (estilo Chipax).
   Las facturas anuladas por NC se muestran "Anuladas" (no factura + NC sueltas).
   Clic en la fila → modal "Documentos asociados" con factura + NC + neto.
   Totales neteados (brutas − NC). */

const meta = {
  title: "Propuestas / SII / Libro con anuladas",
  component: LibroAnuladasView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibroAnuladasView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Julio 2026 de Tooxs: GPS7000 y CLINICA con facturas anuladas por NC. Clic en
 *  una fila "Anulada" → modal "Documentos asociados". */
export const Julio2026: Story = { args: { docs: ventasJulio, periodo: "Julio 2026" } };

/** Caso 1:1 (como el modal de Chipax): Kaufmann anulada + una venta vigente. */
export const CasoKaufmann: Story = { args: { docs: ventasKaufmann, periodo: "Junio 2026" } };

/** Libro de COMPRAS: el proveedor emite factura + NC idéntica → compra anulada. */
export const Compras: Story = { args: { docs: comprasJunio, periodo: "Junio 2026", kind: "compras" } };
