import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { ColaConciliacion } from "./cola-conciliacion";
import { mapCola } from "./reconciliacion-cola-map";

const filas = mapCola({
  count: 3,
  items: [
    {
      movement_id: "mv1",
      date: "2026-07-12",
      amount: "1250000",
      description: "TRANSFERENCIA RECIBIDA COMERCIAL LOS ANDES",
      suggestion: { document_kind: "receivable", document_id: "r1", name: "Comercial Los Andes SpA", score: "86" },
    },
    {
      movement_id: "mv2",
      date: "2026-07-11",
      amount: "340000",
      description: "PAGO PROVEEDOR",
      suggestion: { document_kind: "payable", document_id: "p1", name: "Distribuidora del Sur Ltda", score: "72" },
    },
    {
      movement_id: "mv3",
      date: "2026-07-10",
      amount: "89900",
      description: "CARGO PAC",
      suggestion: { document_kind: "payable", document_id: null, name: null, score: "64" },
    },
  ],
});

const meta = {
  title: "Capa 2 / Caja / Conciliación / ColaConciliacion",
  component: ColaConciliacion,
  parameters: { layout: "padded" },
  args: {
    filas,
    onConfirmar: fn(),
    onRechazar: fn(),
    onConciliarTodas: fn(),
    pendientes: new Set<string>(),
    conciliandoTodas: false,
  },
} satisfies Meta<typeof ColaConciliacion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** La cola con 3 movimientos, ordenados por certeza (86% arriba). */
export const ConItems: Story = {};

/** Una fila con un match en curso: sus botones quedan deshabilitados. */
export const ConfirmandoUno: Story = {
  args: { pendientes: new Set(["mv1"]) },
};

/** "Conciliar todas" en curso: deshabilita todo. */
export const ConciliandoTodas: Story = {
  args: { conciliandoTodas: true },
};

/** Confirmar dispara onConfirmar con el id correcto. */
export const ConfirmaUno: Story = {
  play: async ({ canvas, args, userEvent }) => {
    // El botón lleva la contraparte en su aria-label → único, sin scopear al <li>.
    await userEvent.click(
      await canvas.findByRole("button", { name: /Confirmar: .*Comercial Los Andes/i }),
    );
    await expect(args.onConfirmar).toHaveBeenCalledWith("mv1"); // 86% quedó primero
  },
};

/** "No es" dispara onRechazar. */
export const RechazaUno: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Descartar la sugerencia para .*1\.250\.000/i }),
    );
    await expect(args.onRechazar).toHaveBeenCalledWith("mv1");
  },
};

/** "Conciliar todas (3)" dispara onConciliarTodas. */
export const ConciliaTodas: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /Conciliar todas \(3\)/i }));
    await expect(args.onConciliarTodas).toHaveBeenCalled();
  },
};
