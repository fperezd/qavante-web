import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { GestionV2RangoView } from "./gestion-v2-rango-view";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";

/* Vista de RANGO de Gestión v2 ensamblada: respuesta de dueño del período + márgenes bruto/neto
   ($ y %) + margen operacional en el tiempo (protagonista) + la matriz P&L mes a mes (Chipax). */

const meta = {
  title: "Propuestas / Gestión / Rango (varios meses)",
  component: GestionV2RangoView,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [(Story) => <div className="mx-auto max-w-[1120px] p-6"><Story /></div>],
} satisfies Meta<typeof GestionV2RangoView>;

export default meta;
type Story = StoryObj<typeof meta>;

const BD: OperationalResultBreakdown = {
  generated_at: "2026-07-15T12:00:00Z",
  period_from: "2026-05",
  period_to: "2026-07",
  mode: "por_cuenta",
  months: ["2026-05", "2026-06", "2026-07"],
  proforma_month: "2026-07",
  rows: [
    {
      kind: "section", key: "income", label: "Total Ingresos", by_month: ["15200000", "16800000", "18500000"], total: "50500000",
      children: [{ kind: "account", key: "proyectos", label: "Proyectos", by_month: ["11000000", "12000000", "13000000"], total: "36000000" }],
    },
    { kind: "section", key: "costs", label: "Total Costos", by_month: ["-6100000", "-6700000", "-7400000"], total: "-20200000" },
    { kind: "subtotal", key: "gross_margin", label: "Margen Bruto", by_month: ["9100000", "10100000", "11100000"], total: "30300000", pct_total: "60.0", pct_by_month: ["59.9", "60.1", "60.0"] },
    { kind: "subtotal", key: "operational_result", label: "Resultado Operacional", by_month: ["3100000", "3900000", "4500000"], total: "11500000", pct_total: "22.8", pct_by_month: ["20.4", "23.2", "24.3"] },
  ] as OperationalResultBreakdown["rows"],
};

export const Trimestre: Story = {
  args: { data: BD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Respuesta de dueño del período + márgenes bruto/neto.
    await expect(canvas.getByText("El negocio ganó en el período")).toBeInTheDocument();
    await expect(canvas.getByText("Margen neto")).toBeInTheDocument();
    // La pieza central (margen en el tiempo) + la matriz P&L debajo.
    await expect(canvas.getByText("Margen operacional en el tiempo")).toBeInTheDocument();
    await expect(canvas.getByText("Total Ingresos")).toBeInTheDocument();
  },
};

/** Datos implausibles (mismo bug de costos que el mes): resultado > ingresos → honesto. */
export const DatosIncompletos: Story = {
  args: {
    data: {
      ...BD,
      rows: [
        BD.rows[0],
        { kind: "subtotal", key: "operational_result", label: "Resultado Operacional", by_month: ["1"], total: "60000000" },
      ] as OperationalResultBreakdown["rows"],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No podemos mostrar el resultado del período con confianza/)).toBeInTheDocument();
  },
};
