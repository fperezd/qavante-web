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
      suggestion: {
        document_kind: "receivable",
        document_id: "r1",
        name: "Comercial Los Andes SpA",
        score: "86",
        document_count: 1,
        bulk_eligible: true,
        can_confirm: true,
        topology: "1:1",
      },
    },
    {
      movement_id: "mv2",
      date: "2026-07-11",
      amount: "340000",
      description: "PAGO PROVEEDOR",
      suggestion: {
        document_kind: "payable",
        document_id: "p1",
        name: "Distribuidora del Sur Ltda",
        score: "72",
        document_count: 1,
        bulk_eligible: true,
        can_confirm: true,
        topology: "1:1",
      },
    },
    {
      movement_id: "mv3",
      date: "2026-07-10",
      amount: "89900",
      description: "CARGO PAC",
      suggestion: {
        document_kind: "payable",
        document_id: null,
        name: null,
        score: "64",
        document_count: 1,
        bulk_eligible: false,
        can_confirm: false,
        blocker: {
          code: "no_document_suggested",
          message: "No encontramos un documento que calce con este cargo.",
          retryable: false,
        },
        topology: "1:1",
      },
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
    onElegirDocumento: fn(),
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

/** Elegir otro documento abre la revisión documental para ese movimiento. */
export const EligeOtroDocumento: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: /Elegir otro documento para .*1\.250\.000/i }),
    );
    await expect(args.onElegirDocumento).toHaveBeenCalledWith("mv1");
  },
};

/**
 * "Conciliar todas" cuenta los ELEGIBLES, no las filas: la cola trae 3 y el botón dice 2,
 * porque la tercera no es apta para el lote. Antes decía 3, mandaba 3 y el backend rechazaba
 * una en el medio.
 */
export const ConciliaTodas: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: /Conciliar todas \(2\)/i }));
    await expect(args.onConciliarTodas).toHaveBeenCalled();
    // Y la diferencia no queda muda: la cabecera dice cuántas quedan afuera.
    await expect(await canvas.findByText(/2 se pueden aplicar en lote/i)).toBeInTheDocument();
  },
};

/**
 * La fila que el servidor no autoriza NO ofrece "Sí, es este": en su lugar va el motivo que
 * manda el servidor. La propuesta se sigue mostrando y "Elegir otro" sigue disponible.
 */
export const FilaBloqueadaMuestraElMotivo: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(/No encontramos un documento que calce con este cargo/i),
    ).toBeInTheDocument();
    // El cargo de $89.900 es el bloqueado: no tiene botón de confirmar.
    await expect(canvas.queryByRole("button", { name: /Confirmar: .*89\.900/i })).toBeNull();
    // Pero sí el camino que existe.
    await expect(
      await canvas.findByRole("button", { name: /Elegir otro documento para .*89\.900/i }),
    ).toBeInTheDocument();
    // Los dos que el servidor sí autoriza conservan su botón.
    await expect(
      await canvas.findByRole("button", { name: /Confirmar: .*Comercial Los Andes/i }),
    ).toBeInTheDocument();
  },
};
