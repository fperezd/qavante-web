import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { VentasHero } from "./ventas-hero";

/* Prototipo del rediseño del Libro de Ventas (aprobado 2026-07-13). El hero pone
   arriba la respuesta de dueño: cuánto vendió la empresa (neto) + tres lecturas
   honestas del ritmo (mes / año / año-contra-año) + tendencia mensual. Degrada
   solo: comparativos o serie ausentes se omiten. */

const meta = {
  title: "Propuestas / Libro de Ventas / VentasHero",
  component: VentasHero,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "La 'respuesta de dueño' del Libro de Ventas v2: número de oro (neto), hasta 3 comparativos (misma-fecha mes anterior · mes vs promedio anual · vs año anterior), sparkline mes a mes y cifras secundarias. Reusable para Compras.",
      },
    },
  },
} satisfies Meta<typeof VentasHero>;

export default meta;
type Story = StoryObj<typeof meta>;

const SECUNDARIOS = [
  { label: "IVA débito", valor: "$22.418.900", tono: "brand" as const },
  { label: "Documentos emitidos", valor: "58" },
  { label: "Notas de crédito (11)", valor: "−$20.935.507", tono: "neg" as const },
  { label: "Anuladas", valor: "7" },
];

export const Semestre: Story = {
  args: {
    titulo: "La empresa vendió",
    montoNeto: 126376400,
    subtitulo: "Neto del período · 58 facturas emitidas",
    infoHint: "Neto = bruto facturado − notas de crédito. El dato oficial de impuestos sigue siendo el F29.",
    comparativos: [
      { pct: 8, label: "este mes vs. misma fecha del mes anterior" },
      { pct: 12, label: "julio (mes anterior) sobre el promedio mensual del año" },
      { pct: 15, label: "vs. el mismo período del año anterior" },
    ],
    serie: [18.2, 21.5, 19.8, 23.1, 20.4, 23.4],
    serieCaption: "pico jul $23,4M",
    serieMeses: ["feb", "mar", "abr", "may", "jun", "jul"],
    secundarios: SECUNDARIOS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La pregunta de dueño en 3ª persona + el número de oro (tras el count-up).
    await expect(canvas.getByText("La empresa vendió")).toBeInTheDocument();
    // El monto "cuenta" desde 0 (~1.1s); esperamos a que asiente en el valor final.
    await waitFor(() => expect(canvas.getByText("$126.376.400")).toBeInTheDocument(), { timeout: 3000 });
    // Los tres comparativos, cada uno con su signo.
    await expect(canvas.getByText("+8%")).toBeInTheDocument();
    await expect(canvas.getByText("+12%")).toBeInTheDocument();
    await expect(canvas.getByText("+15%")).toBeInTheDocument();
    // La tendencia y las cifras secundarias.
    await expect(canvas.getByText("Mes a mes")).toBeInTheDocument();
    await expect(canvas.getByText("IVA débito")).toBeInTheDocument();
    await expect(canvas.getByText("−$20.935.507")).toBeInTheDocument();
  },
};

/** Un mes en baja: el comparativo cae → % en rojo con signo menos. */
export const MesEnBaja: Story = {
  args: {
    ...Semestre.args,
    comparativos: [
      { pct: -12, label: "este mes vs. misma fecha del mes anterior" },
      { pct: -5, label: "julio (mes anterior) bajo el promedio mensual del año" },
      { pct: 3, label: "vs. el mismo período del año anterior" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Menos tipográfico (U+2212), no guion ASCII.
    await expect(canvas.getByText("−12%")).toBeInTheDocument();
    await expect(canvas.getByText("−5%")).toBeInTheDocument();
    await expect(canvas.getByText("+3%")).toBeInTheDocument();
  },
};

/** Degradado honesto: sin comparativos ni serie → se omiten, no se inventan. */
export const SinComparativosNiSerie: Story = {
  args: {
    titulo: "La empresa vendió",
    montoNeto: 8420000,
    subtitulo: "Neto del mes · 6 facturas emitidas",
    secundarios: [
      { label: "IVA débito", valor: "$1.599.800", tono: "brand" as const },
      { label: "Documentos emitidos", valor: "6" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("$8.420.000")).toBeInTheDocument(), { timeout: 3000 });
    // Sin tendencia (no hay serie) ni comparativos.
    await expect(canvas.queryByText("Mes a mes")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/vs\. el mismo período/)).not.toBeInTheDocument();
  },
};
