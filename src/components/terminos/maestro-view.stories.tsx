import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { MaestroContrapartes } from "./maestro-view";
import type { ContraparteMaestro, DocMaestro } from "./terminos-pago";

/* Maestro de contrapartes: vencimientos derivados (emisión + término editable). */

const doc = (over: Partial<DocMaestro>): DocMaestro => ({
  folio: 1,
  fecha: "01/06/2026",
  fechaEmision: new Date(2026, 5, 1),
  monto: 5_000_000,
  vencimiento: new Date(2026, 6, 1),
  estado: "vencido",
  diasParaVencer: -19,
  ...over,
});

const kaufmann: ContraparteMaestro = {
  rut: "96572360-9",
  name: "COMERCIAL KAUFMANN S.A.",
  docCount: 2,
  total: 8_000_000,
  vencido: 5_000_000,
  porVencer: 0,
  vigente: 3_000_000,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: new Date(2026, 6, 31),
  docs: [
    doc({ folio: 1 }),
    doc({ folio: 2, fecha: "01/07/2026", fechaEmision: new Date(2026, 6, 1), monto: 3_000_000, vencimiento: new Date(2026, 6, 31), estado: "vigente", diasParaVencer: 11 }),
  ],
};

const diveimport: ContraparteMaestro = {
  rut: "55555555-5",
  name: "DIVEIMPORT S.A.",
  docCount: 1,
  total: 1_000_000,
  vencido: 0,
  porVencer: 0,
  vigente: 1_000_000,
  termino: 45,
  terminoCustom: true,
  proximoVencimiento: new Date(2026, 7, 1),
  docs: [doc({ folio: 3, monto: 1_000_000, vencimiento: new Date(2026, 7, 1), estado: "vigente", diasParaVencer: 12 })],
};

const meta = {
  title: "Propuestas / Términos / MaestroContrapartes",
  component: MaestroContrapartes,
  parameters: { layout: "padded" },
  args: {
    kind: "ventas",
    contrapartePlural: "clientes",
    cps: [kaufmann, diveimport],
    totals: { total: 9_000_000, vencido: 5_000_000, porVencer: 0, contrapartes: 2, docs: 3 },
    defaultTerm: 30,
    onSetTerm: () => {},
    onResetTerm: () => {},
    onSetDefault: () => {},
    periodosLabel: "ene–jul 2026",
  },
} satisfies Meta<typeof MaestroContrapartes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clientes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Maestro de clientes")).toBeInTheDocument();
    await expect(canvas.getByText("COMERCIAL KAUFMANN S.A.")).toBeInTheDocument();
    // El vencido derivado se muestra.
    await expect(canvas.getByText("$5.000.000")).toBeInTheDocument();
    // Input de término editable por contraparte.
    await expect(
      canvas.getByLabelText(/Término de pago de COMERCIAL KAUFMANN/),
    ).toHaveValue(30);
  },
};
