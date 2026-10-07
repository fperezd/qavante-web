import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { movimientosV03 } from "./banco-v03-model";
import { categorias, cuentasQavante, movimientos } from "./banco-v03-fixtures";
import { BankResolutionDetailDrawer } from "./bank-resolution-detail-drawer";
import type { BankMovementResolutionDetail } from "./bank-resolution-detail-model";

const movement = movimientosV03({
  items: movimientos(),
  cuentas: new Map(cuentasQavante().map((account) => [account.id, account])),
  categorias: categorias(),
})[0]!;

const detail: BankMovementResolutionDetail = {
  movementId: movement.id,
  contraparte: movement.contraparte,
  reconciliation: {
    status: "conciliado",
    canUnreconcile: true,
    topology: "1:N",
    balanceFormatted: "$0",
    source: "Motor canónico",
    confidence: "98%",
    evidence: ["RUT coincidente", "Monto distribuido íntegramente"],
    components: [
      {
        id: "principal:facturas-450-451",
        kind: "principal",
        amountFormatted: "$6.000.000",
        source: "receivables",
        sourceReference: "450, 451",
      },
    ],
    allocations: [
      {
        id: "doc-1",
        label: "Factura 450 · Cliente Norte SpA",
        kind: "document",
        amountFormatted: "$4.000.000",
        origin: { label: "Ver factura de origen", href: "/cobrar/facturas-emitidas" },
      },
      {
        id: "doc-2",
        label: "Factura 451 · Cliente Norte SpA",
        kind: "document",
        amountFormatted: "$2.000.000",
        origin: { label: "Ver factura de origen", href: "/cobrar/facturas-emitidas" },
      },
    ],
  },
  classification: {
    status: "clasificado",
    canonicalType: "Cobro de cliente",
    source: "Regla aprobada",
    confidence: "100%",
    actor: "Sistema",
    classifiedAt: "2026-08-21T12:00:00Z",
    allocations: [
      {
        id: "class-1",
        label: "Ventas de servicios",
        kind: "classification",
        amountFormatted: "$4.200.000",
        percentage: "70%",
        dimensions: [{ name: "Sucursal", value: "Santiago" }],
      },
      {
        id: "class-2",
        label: "Ingresos recurrentes",
        kind: "classification",
        amountFormatted: "$1.800.000",
        percentage: "30%",
        dimensions: [{ name: "Sucursal", value: "Concepción" }],
      },
    ],
  },
};

const meta = {
  title: "Propuestas / Banco / Detalle de resolución",
  component: BankResolutionDetailDrawer,
  args: {
    open: true,
    movement,
    detail,
    onClose: fn(),
    onUnreconcile: fn(),
    onReclassify: fn(),
    onUnclassify: fn(),
  },
} satisfies Meta<typeof BankResolutionDetailDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConciliacionUnoAMuchosYClasificacionDistribuida: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole("dialog", { name: "Cómo se resolvió" })).toBeInTheDocument();
    await expect(canvas.queryByText("1:N")).not.toBeInTheDocument();
    await expect(canvas.getByText("Factura 451 · Cliente Norte SpA")).toBeInTheDocument();
    await expect(canvas.getByText("Factura 450 · Cliente Norte SpA")).toBeInTheDocument();
    await expect(canvas.getByText("Componentes financieros")).toBeInTheDocument();
    await expect(canvas.getByText("Ventas de servicios")).toBeInTheDocument();
    await expect(canvas.getByText("Sucursal: Santiago")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Modificar clasificación" }));
    await expect(args.onReclassify).toHaveBeenCalledOnce();
  },
};
