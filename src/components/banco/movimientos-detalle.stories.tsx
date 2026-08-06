import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { MovimientosDetalle } from "./movimientos-detalle";
import type { MovimientoBanco } from "./banco-movimientos-model";

/* MovimientosDetalle — el detalle de movimientos de un producto de Banco (cuenta o tarjeta), con el
   filtro de mes (Mes actual / anterior / otro) y el estado "Actualizado a las HH:MM". */

const MOVS: MovimientoBanco[] = [
  { fecha: "2026-08-04", glosa: "MERCADOLIBRE", monto: -45990, moneda: "CLP", cuotas: "03/06" },
  { fecha: "2026-08-03", glosa: "Transferencia recibida", monto: 500000, moneda: "CLP" },
  { fecha: "2026-08-01", glosa: "PAGO PROVEEDOR ACME", monto: -120000, moneda: "CLP" },
];

const meta = {
  title: "Propuestas / Banco / MovimientosDetalle",
  component: MovimientosDetalle,
  parameters: { layout: "padded" },
  args: {
    titulo: "Cuenta Corriente MN",
    subtitulo: "07-04222-1 · BICE",
    mesActual: "2026-08",
    period: "2026-08",
    onPeriodChange: fn(),
    movimientos: MOVS,
    horaTexto: "15:32",
  },
} satisfies Meta<typeof MovimientosDetalle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConMovimientos: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText("MERCADOLIBRE")).toBeInTheDocument();
    await expect(c.getByText(/03\/06/)).toBeInTheDocument(); // cuota de la compra a plazo
    // Egreso en rojo con "−", ingreso en verde con "+".
    await expect(c.getByText(/−\$45\.990/)).toBeInTheDocument();
    // El filtro de mes: elegir "Mes anterior" avisa al contenedor.
    await userEvent.click(c.getByRole("button", { name: "Mes anterior" }));
    await expect(args.onPeriodChange).toHaveBeenCalledWith("2026-07");
  },
};

export const Vacio: Story = {
  args: { movimientos: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Sin movimientos en/)).toBeInTheDocument();
  },
};
