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

/* ── Los TRES estados del vencido ────────────────────────────────────────────
   El pase §6 del PR #40 encontró que el "vencido: no se sabe" que introdujo el #44
   tenía **cero** cobertura: `grep "vencido: no se sabe"` daba un solo hit, en código
   de producción. La mutación que lo borra —volver a `overdue != null && overdue > 0`,
   o sea el bug exacto que #44 arregló— sobrevivía a `tsc`, `eslint` y a la suite
   entera. El `null` estaba probado en el MAPA, no en la VISTA.

   Estas tres historias cierran ese hueco, y son tres a propósito: lo que hay que
   fijar no es que el "no sé" aparezca, sino que los tres casos se vean DISTINTOS
   entre sí. Un cero verificado y un desconocido pintados igual es el bug. */

export const VencidoDesconocido: Story = {
  args: { overdue: null },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("vencido: no se sabe")).toBeInTheDocument();
    /* Y NO se inventa un monto vencido. La regex ancla el ARRANQUE en el "$", no el
       final: el `<p>` real dice "$0 vencido · hace 5 días", así que un `/vencido$/`
       no casa nunca y el assert pasaba sin probar nada. Lo verificó el pase §6
       inyectando un "$0 vencido" al lado del "no se sabe": las cuatro stories
       seguían en verde.

       El `[−-]?` opcional del arranque NO es adorno: `formatClp` de un negativo rinde
       el menos tipográfico U+2212 **antes** del "$" ("−$120.000"), así que sin él la
       story del vencido negativo quedaba hueca por la misma razón — y el segundo pase
       §6 la cazó igual que a la primera. */
    await expect(c.queryByText(/^[−-]?\$.*vencido/)).not.toBeInTheDocument();
  },
};

export const VencidoCeroVerificado: Story = {
  args: { overdue: 0 },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    /* Un cero VERIFICADO no es un "no sé": el cliente está al día y la fila no debe
       decir lo contrario. Tampoco pinta la línea roja de vencido. */
    await expect(c.queryByText("vencido: no se sabe")).not.toBeInTheDocument();
    await expect(c.queryByText(/^[−-]?\$.*vencido/)).not.toBeInTheDocument();
  },
};

export const VencidoConocido: Story = {
  args: { overdue: 3_500_000 },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("vencido: no se sabe")).not.toBeInTheDocument();
    await expect(c.getByText(/^[−-]?\$.*vencido/)).toBeInTheDocument();
  },
};

/* Un vencido NEGATIVO (nota de crédito mayor que la deuda) también deja la fila muda,
   porque la rama es `overdue > 0`. No es un "no sé" ni un "al día": es un saldo a favor
   del cliente. Esta story FIJA el comportamiento actual —callar— en vez de dejarlo sin
   contrato; si algún día se decide mostrarlo, este test es el que hay que cambiar a
   propósito. Lo señaló el pase §6. */
export const VencidoNegativo: Story = {
  args: { overdue: -120_000 },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("vencido: no se sabe")).not.toBeInTheDocument();
    await expect(c.queryByText(/^[−-]?\$.*vencido/)).not.toBeInTheDocument();
  },
};
