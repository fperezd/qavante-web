import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { LibroVentasV2 } from "./libro-ventas-v2";
import { VentasHero } from "./ventas-hero";
import { ConcentracionClientes, type ConcentracionItem } from "./concentracion-clientes";

/* Prototipo ENSAMBLADO del rediseño del Libro de Ventas (aprobado 2026-07-13):
   respuesta de dueño arriba (hero con 3 comparativos + sparkline), la tabla densa
   SUBE justo debajo, y la concentración top 10 al costado como apoyo. Sin toggle
   "Agrupar N/C". La tabla acá es un mock estático para mostrar el layout; en vivo
   es la GroupedTable real. */

const meta = {
  title: "Propuestas / Libro de Ventas / Pantalla completa",
  component: LibroVentasV2,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Composición del Libro de Ventas v2: VentasHero + tabla (que sube) + ConcentracionClientes (rail). Datos mock reales de la captura de Fernando (Tooxs Digital SpA · feb–jul 2026).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1120px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibroVentasV2>;

export default meta;
type Story = StoryObj<typeof meta>;

const CONCENTRACION: ConcentracionItem[] = [
  { nombre: "COMERCIAL KAUFMANN S.A.", rut: "96.572.360-9", monto: 12980000, pct: 22 },
  { nombre: "CIA INDUSTRIAL EL VOLCAN", rut: "90.209.000-2", monto: 8420000, pct: 14 },
  { nombre: "DIVEIMPORT S.A.", rut: "55.555.555-5", monto: 6250000, pct: 11 },
  { nombre: "PUERTO COLUMBO S.A.", rut: "76.008.959-1", monto: 5640000, pct: 9 },
  { nombre: "EMPRESA DE CORREOS DE CHILE", rut: "60.503.000-9", monto: 3150000, pct: 5 },
  { nombre: "COMERCIAL MANQUEHUE LTDA", rut: "86.887.200-4", monto: 2310000, pct: 4 },
  { nombre: "GPS7000 SPA", rut: "76.106.531-9", monto: 1890000, pct: 3 },
  { nombre: "SERVICIOS AUSTRAL SPA", rut: "77.101.202-3", monto: 1540000, pct: 3 },
  { nombre: "INGENIERÍA DEL SUR LTDA", rut: "77.404.505-6", monto: 1180000, pct: 2 },
  { nombre: "COMERCIAL ANDINA S.A.", rut: "96.808.909-1", monto: 980000, pct: 2 },
];

/** Mock estático de la tabla densa (en vivo = GroupedTable). Muestra el estilo:
    NC en rojo con −$, anulada tachada con "ver detalle", exenta marcada. */
function TablaMock() {
  const td = "px-3 py-2 text-[13px] border-b border-border";
  const th =
    "px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-neutral-mid border-b border-border";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] tabular-nums">
        <thead>
          <tr>
            <th className={th}>Tipo</th>
            <th className={th}>Folio</th>
            <th className={th}>Fecha</th>
            <th className={th}>Cliente</th>
            <th className={`${th} text-right`}>Neto</th>
            <th className={`${th} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>FAC-EL</td>
            <td className={`${td} text-neutral-mid`}>377</td>
            <td className={td}>26/02/26</td>
            <td className={td}>CIA INDUSTRIAL EL VOLCAN S A</td>
            <td className={`${td} text-right`}>$8.420.000</td>
            <td className={`${td} text-right font-bold`}>$10.019.800</td>
          </tr>
          <tr>
            <td className={td}>FAC-EL</td>
            <td className={`${td} text-neutral-mid`}>374</td>
            <td className={td}>12/02/26</td>
            <td className={td}>PUERTO COLUMBO S.A.</td>
            <td className={`${td} text-right`}>$5.640.000</td>
            <td className={`${td} text-right font-bold`}>$6.711.600</td>
          </tr>
          <tr className="text-danger-500">
            <td className={td}>NC-EL</td>
            <td className={`${td}`}>61</td>
            <td className={td}>11/02/26</td>
            <td className={td}>MANQUEHUE · Nota de crédito → 373</td>
            <td className={`${td} text-right`}>−$900.000</td>
            <td className={`${td} text-right font-bold`}>−$1.071.000</td>
          </tr>
          <tr className="text-neutral-light">
            <td className={td}>FAC-EL</td>
            <td className={`${td} line-through`}>371</td>
            <td className={td}>09/02/26</td>
            <td className={td}>
              <span className="line-through">COMERCIAL KAUFMANN S.A.</span>{" "}
              <button type="button" className="rounded border border-border-strong px-1.5 text-[10.5px] font-bold hover:text-brand-primary">
                Anulada · 1 N/C ⌄
              </button>
            </td>
            <td className={`${td} text-right line-through`}>$1.240.000</td>
            <td className={`${td} text-right line-through`}>$1.475.600</td>
          </tr>
          <tr>
            <td className={td}>FAC-EXP</td>
            <td className={`${td} text-neutral-mid`}>101</td>
            <td className={td}>19/02/26</td>
            <td className={td}>DIVEIMPORT S.A. · exportación exenta</td>
            <td className={`${td} text-right`}>$6.250.000</td>
            <td className={`${td} text-right font-bold`}>$6.250.000</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const Completa: Story = {
  args: {
    docCount: 69,
    anuladasCount: 7,
    onFiltros: () => {},
    periodFilter: (
      <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-semibold">
        feb 2026 – jul 2026 ⌄
      </span>
    ),
    stamp: <span className="text-[12px] text-neutral-light">Actualizado hace 2 h · SII</span>,
    hero: (
      <VentasHero
        titulo="La empresa vendió"
        montoNeto={126376400}
        subtitulo="Neto del período · 58 facturas emitidas"
        infoHint="Neto = bruto − notas de crédito. El dato oficial sigue siendo el F29."
        comparativos={[
          { pct: 8, label: "este mes vs. misma fecha del mes anterior" },
          { pct: 12, label: "julio (mes anterior) sobre el promedio mensual del año" },
          { pct: 15, label: "vs. el mismo período del año anterior" },
        ]}
        serie={[18.2, 21.5, 19.8, 23.1, 20.4, 23.4]}
        serieCaption="pico jul $23,4M"
        serieMeses={["feb", "mar", "abr", "may", "jun", "jul"]}
        secundarios={[
          { label: "IVA débito", valor: "$22.418.900", tono: "brand" },
          { label: "Documentos emitidos", valor: "58" },
          { label: "Notas de crédito (11)", valor: "−$20.935.507", tono: "neg" },
          { label: "Anuladas", valor: "7" },
        ]}
      />
    ),
    tabla: <TablaMock />,
    concentracion: <ConcentracionClientes titulo="Concentración por cliente" items={CONCENTRACION} onExport={() => {}} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La respuesta arriba + un comparativo.
    await expect(canvas.getByText("La empresa vendió")).toBeInTheDocument();
    await expect(canvas.getByText("+15%")).toBeInTheDocument();
    // El detalle: badge de conteo + una fila de la tabla + la concentración al lado.
    await expect(canvas.getByText("69 documentos")).toBeInTheDocument();
    await expect(canvas.getByText("7 anuladas")).toBeInTheDocument();
    // Fila de la tabla (texto único, no colisiona con la concentración).
    await expect(canvas.getByText(/exportación exenta/)).toBeInTheDocument();
    // Cliente #10 de la concentración (solo aparece en el rail).
    await expect(canvas.getByText("COMERCIAL ANDINA S.A.")).toBeInTheDocument();
    // Sin toggle "Agrupar N/C" (baranda del rediseño).
    await expect(canvas.queryByText(/Agrupar N\/C/)).not.toBeInTheDocument();
    // Anulada con acceso al detalle.
    await expect(canvas.getByRole("button", { name: /Anulada · 1 N\/C/ })).toBeInTheDocument();
  },
};
