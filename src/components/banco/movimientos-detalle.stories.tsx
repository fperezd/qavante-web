import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { MovimientosDetalle } from "./movimientos-detalle";
import type { MovimientoBanco } from "./banco-movimientos-model";

/* MovimientosDetalle — el detalle de movimientos de un producto de Banco (cuenta o tarjeta), con el
   filtro de mes (Mes actual / anterior / otro) y el estado "Actualizado a las HH:MM". */

const MOVS: MovimientoBanco[] = [
  {
    id: "m1",
    fecha: "2026-08-04",
    glosa: "MERCADOLIBRE",
    monto: -45990,
    moneda: "CLP",
    cuotas: "03/06",
    esAbono: false,
    estado: "por_conciliar",
  },
  {
    id: "m2",
    fecha: "2026-08-03",
    glosa: "Transferencia recibida",
    monto: 500000,
    moneda: "CLP",
    esAbono: true,
    estado: "conciliado",
  },
  {
    id: "m3",
    fecha: "2026-08-01",
    glosa: "PAGO PROVEEDOR ACME",
    monto: -120000,
    moneda: "CLP",
    esAbono: false,
    estado: "conciliado",
  },
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
    conEstado: true,
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
    // Estado de conciliación por movimiento (Fase 1): el tab + el badge de la fila.
    await expect(c.getAllByText("Por conciliar").length).toBeGreaterThan(0);
    // Tab "Abonos" deja solo el ingreso (Chipax-like).
    await userEvent.click(c.getByRole("tab", { name: /Abonos/ }));
    await expect(c.getByText("Transferencia recibida")).toBeInTheDocument();
    await expect(c.queryByText("MERCADOLIBRE")).not.toBeInTheDocument();
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

/* Fase 2 — conciliar por movimiento (flag `bancoConciliacion` ON): el movimiento "Por conciliar" con
   match propuesto muestra la banda "Pago/Cobro a …" + Conciliar / Rechazar, y aparece el tab
   "Sugerencias". */
export const ConConciliacion: Story = {
  args: {
    conciliarEnabled: true,
    sugerencias: new Map([
      [
        "m1",
        {
          movementId: "m1",
          kind: "payable",
          nombre: "MercadoLibre Chile",
          score: 82,
          documentCount: 1,
        },
      ],
    ]),
    onConciliar: fn(),
    onRechazar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // La banda del match propuesto bajo el movimiento por conciliar (m1 = MERCADOLIBRE).
    await expect(c.getByText("MercadoLibre Chile")).toBeInTheDocument();
    await expect(c.getByText(/82% de certeza/)).toBeInTheDocument();
    // El tab "Sugerencias" deja solo el movimiento con match (badge = 1).
    await userEvent.click(c.getByRole("tab", { name: /Sugerencias/ }));
    await expect(c.getByText("MERCADOLIBRE")).toBeInTheDocument();
    await expect(c.queryByText("Transferencia recibida")).not.toBeInTheDocument();
    // Conciliar dispara el callback con el movement_id.
    await userEvent.click(c.getByRole("button", { name: "Conciliar" }));
    await expect(args.onConciliar).toHaveBeenCalledWith("m1");
    // Rechazar también.
    await userEvent.click(c.getByRole("button", { name: /Rechazar sugerencia/ }));
    await expect(args.onRechazar).toHaveBeenCalledWith("m1");
  },
};
