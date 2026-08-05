import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { DeudorRow } from "./cobrar-v2-view";
import type { DocMaestro } from "@/components/terminos/terminos-pago";

/* DeudorRow (Cobrar v2) — la fila expandible de un deudor con su detalle por documento. Cubre que el
   detalle MARQUE las cedidas (factor) / reclamadas: no son por-cobrar de la empresa → no se listan
   como cobrables (sin botón "Marcar"), su monto va tachado y el total del deudor las excluye (#812). */

const doc = (over: Partial<DocMaestro>): DocMaestro => ({
  folio: 1,
  fecha: "2026-05-10",
  fechaEmision: new Date("2026-05-10"),
  monto: 1_000_000,
  vencimiento: new Date("2026-06-09"),
  estado: "vencido",
  diasParaVencer: -30,
  pagado: false,
  tipoDoc: 33,
  esNotaCredito: false,
  refFolio: null,
  anulacion: null,
  neto: null,
  ...over,
});

const DOCS: DocMaestro[] = [
  doc({ folio: 101, monto: 10_000_000, diasParaVencer: -5 }), // deuda real de la empresa
  doc({ folio: 102, monto: 4_000_000, diasParaVencer: -90, cedido: true }), // la cobra el factor
  doc({ folio: 103, monto: 2_000_000, diasParaVencer: -60, reclamado: true }), // reclamada en el SII
];

const meta = {
  title: "Propuestas / Cobrar / DeudorRow",
  component: DeudorRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <ul className="max-w-xl">
        <Story />
      </ul>
    ),
  ],
  args: {
    name: "COMERCIAL SYNNEX",
    rut: "96.529.660-1",
    total: 10_000_000, // solo la deuda real (cedida + reclamada excluidas)
    overdue: 10_000_000,
    pct: 40,
    gestionado: null,
    copiado: false,
    waHref: "#",
    mailtoHref: "#",
    gestionadoPending: false,
    isOpen: true, // arranca expandida → el panel de documentos es visible
    docs: DOCS,
    gestionadoDocs: {},
    onCopiar: () => {},
    onToggleGestionado: () => {},
    onToggleOpen: () => {},
    onToggleDoc: () => {},
  },
} satisfies Meta<typeof DeudorRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConCedidaYReclamada: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // El detalle MARCA la cedida y la reclamada (no las lista como cobrables normales).
    await expect(c.getByText("Cedida")).toBeInTheDocument();
    await expect(c.getByText("Reclamada")).toBeInTheDocument();
    // Dentro del panel de documentos (la tabla), solo la deuda REAL ofrece "Marcar" (cobrar): la
    // cedida/reclamada no → exactamente un botón "Marcar" en la tabla.
    const tabla = within(c.getByRole("table"));
    await expect(tabla.getAllByRole("button", { name: /Marcar/ })).toHaveLength(1);
  },
};
