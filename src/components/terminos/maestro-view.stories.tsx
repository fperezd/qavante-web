import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent } from "storybook/test";
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
  pagado: false,
  tipoDoc: 33,
  esNotaCredito: false,
  refFolio: null,
  anulacion: null,
  neto: null,
  ...over,
});

const kaufmann: ContraparteMaestro = {
  key: "96572360-9",
  rut: "96572360-9",
  rutDocumental: "96572360-9",
  name: "COMERCIAL KAUFMANN S.A.",
  docCount: 2,
  total: 8_000_000,
  vencido: 5_000_000,
  porVencer: 0,
  vigente: 3_000_000,
  pagado: 0,
  declaradoSinEvidencia: 0,
  docsDeclarados: 0,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: new Date(2026, 6, 31),
  docs: [
    doc({ folio: 1 }),
    doc({
      folio: 2,
      fecha: "01/07/2026",
      fechaEmision: new Date(2026, 6, 1),
      monto: 3_000_000,
      vencimiento: new Date(2026, 6, 31),
      estado: "vigente",
      diasParaVencer: 11,
    }),
  ],
};

/* DIVEIMPORT llega bajo el centinela `55.555.555-5` en el RCV de ventas de Tooxs. La fila no
   reclama ese RUT (`rut: null`): se agrupa y se identifica por su razón social, y el plazo que
   se le aplica es el del tipo de documento, porque un override indexado por el centinela
   regiría sobre todas las contrapartes extranjeras a la vez. */
const diveimport: ContraparteMaestro = {
  key: "sin-rut:DIVEIMPORT S.A.",
  rut: null,
  rutDocumental: "55555555-5",
  name: "DIVEIMPORT S.A.",
  docCount: 1,
  total: 1_000_000,
  vencido: 0,
  porVencer: 0,
  vigente: 1_000_000,
  pagado: 0,
  declaradoSinEvidencia: 1_000_000,
  docsDeclarados: 1,
  termino: 30,
  terminoCustom: false,
  proximoVencimiento: new Date(2026, 7, 1),
  docs: [
    doc({
      folio: 3,
      monto: 1_000_000,
      vencimiento: new Date(2026, 7, 1),
      estado: "vigente",
      diasParaVencer: 12,
      declaradoPagadoEl: "2026-07-20",
    }),
  ],
};

const meta = {
  title: "Propuestas / Términos / MaestroContrapartes",
  component: MaestroContrapartes,
  parameters: { layout: "padded" },
  args: {
    kind: "ventas",
    contrapartePlural: "clientes",
    cps: [kaufmann, diveimport],
    totals: {
      total: 9_000_000,
      vencido: 5_000_000,
      porVencer: 0,
      pagado: 0,
      declaradoSinEvidencia: 1_000_000,
      docsDeclarados: 1,
      contrapartes: 2,
      docs: 3,
    },
    defaultTerm: 30,
    onSetTerm: () => {},
    onResetTerm: () => {},
    onSetDefault: () => {},
    periodosLabel: "ene–jul 2026",
    titulo: "Clientes",
    subtitulo:
      "Todos los clientes con ventas registradas este año · no solo lo pendiente por cobrar.",
  },
} satisfies Meta<typeof MaestroContrapartes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clientes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Clientes")).toBeInTheDocument();
    await expect(canvas.getByText("COMERCIAL KAUFMANN S.A.")).toBeInTheDocument();
    // El vencido derivado se muestra (aparece en el resumen y en la fila → getAllByText).
    await expect(canvas.getAllByText("$5.000.000").length).toBeGreaterThan(0);
    // Input de término editable por contraparte.
    await expect(canvas.getByLabelText(/Término de pago de COMERCIAL KAUFMANN/)).toHaveValue(30);
  },
};

/** El botón "Marcar conciliado" se fue: cada documento lleva a donde se concilia de verdad,
 *  y una declaración vieja se muestra como lo que es (no como "Conciliado"). */
export const SinBotonDeMarcarConciliado: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /DIVEIMPORT/ }));
    await expect(canvas.queryByRole("button", { name: /Marcar conciliado/ })).toBeNull();
    const enlace = canvas.getByRole("link", {
      name: /Conciliar el folio 3 contra un movimiento bancario/,
    });
    await expect(enlace).toHaveAttribute("href", "/cobrar/facturas-emitidas");
    await expect(canvas.getByText(/sin movimiento bancario asociado/)).toBeInTheDocument();
  },
};

/** Grilla ordenable: por defecto saldo desc; las cabeceras cambian el orden. */
export const OrdenColumnas: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primeraContraparte = () =>
      canvas.getAllByText(/KAUFMANN|DIVEIMPORT/)[0]?.textContent ?? "";
    // Por defecto: saldo desc → Kaufmann ($8M) antes que Diveimport ($1M).
    await expect(primeraContraparte()).toMatch(/KAUFMANN/);
    // Clic en "Contraparte" (asc, A→Z): "COMERCIAL…" (C) sigue antes que "DIVEIMPORT" (D).
    await userEvent.click(canvas.getByRole("button", { name: /Ordenar por Contraparte/ }));
    await expect(primeraContraparte()).toMatch(/KAUFMANN/);
    // Segundo clic → desc (Z→A): Diveimport primero.
    await userEvent.click(canvas.getByRole("button", { name: /Ordenar por Contraparte/ }));
    await expect(primeraContraparte()).toMatch(/DIVEIMPORT/);
  },
};
