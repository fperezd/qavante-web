import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { AgingDesconocido, AgingBarraDesconocida } from "./aging-desconocido";
import { ResumenCobranza } from "./v2/cobrar-v2-view";
import { explicarVencidoSinDato } from "./cobranza-format";

/* Hallazgo H6 — el "no se sabe" del vencido de Cobrar.
 *
 * Piezas PRESENTACIONALES (ADR-0018): reciben todo por props, sin red. El
 * container `CobrarView` afirma su propio camino MSW en `cobrar-view.stories.tsx`;
 * estas stories mantienen aislada la semántica del "sin dato". */

const meta = {
  title: "Capa 2 / Cobrar / Vencido sin dato (H6)",
  component: AgingDesconocido,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Cuando la API no puede computar la mora devuelve `null` (qavante-api#123). La pantalla lo dice con el porqué (`undated_amount`) y el qué hacer, en vez de mostrar $0 y una barra 100% «Vigente».",
      },
    },
  },
} satisfies Meta<typeof AgingDesconocido>;

export default meta;
type Story = StoryObj<typeof meta>;

const SIN_DATO = explicarVencidoSinDato({
  undated_amount: "7900000",
  missing_sources: ["Términos de pago sin definir"],
});

export const Explicacion: Story = {
  name: "Explicación accionable del null",
  args: { sinDato: SIN_DATO },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // QUÉ pasa.
    await expect(canvas.getByText(/No podemos calcular cuánto está vencido/i)).toBeInTheDocument();
    // POR QUÉ: el monto sin fecha de vencimiento es lo que lo explica.
    await expect(canvas.getByText(/7\.900\.000/)).toBeInTheDocument();
    await expect(canvas.getByText(/no tiene fecha de vencimiento/i)).toBeInTheDocument();
    // Lo que reporta el backend.
    await expect(canvas.getByText(/Términos de pago sin definir/i)).toBeInTheDocument();
    // QUÉ hacer.
    await expect(canvas.getByText(/término de pago/i)).toBeInTheDocument();
  },
};

export const SinMontoConocido: Story = {
  name: "Ni siquiera se sabe el monto sin fecha",
  args: { sinDato: explicarVencidoSinDato({ undated_amount: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Sigue explicando, pero NO inventa una cifra.
    await expect(canvas.getByText(/No podemos calcular cuánto está vencido/i)).toBeInTheDocument();
    await expect(canvas.queryByText(/\$/)).not.toBeInTheDocument();
  },
};

/* La franja que REEMPLAZA a la barra apilada. Antes, con los cuatro tramos en null,
   la barra quedaba 100% "Vigente": "todo al día" justo cuando no se sabía nada. */
export const BarraDesconocida: Story = {
  name: "Barra de antigüedad · desconocida",
  args: { sinDato: SIN_DATO },
  render: () => (
    <div className="max-w-md space-y-3">
      <AgingBarraDesconocida />
      <AgingDesconocido sinDato={SIN_DATO} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Se rotula como no disponible: ningún tramo reclama porcentaje.
    await expect(canvas.getByRole("img", { name: /no disponible/i })).toBeInTheDocument();
    await expect(canvas.queryByText(/Vigente/)).not.toBeInTheDocument();
  },
};

/* ── Resumen de Cobrar v2: los TRES estados, uno al lado del otro ─────────────── */

export const ResumenSinDato: Story = {
  name: "Resumen · vencido sin dato",
  args: { sinDato: SIN_DATO },
  render: () => (
    <ResumenCobranza total={24800000} overdue={null} overduePct={null} sinDato={SIN_DATO} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Vencido: sin dato/i)).toBeInTheDocument();
    await expect(canvas.getByText(/No podemos calcular cuánto está vencido/i)).toBeInTheDocument();
    /* Lo que NUNCA puede aparecer: los tiles numéricos de mora. Sin dato no hay
       "Vencido $X" ni "% vencido" que mostrar — ése era el $0 mentiroso de H6.
       (No se afirma sobre el texto "$0" porque `AmountCountUp` anima desde cero.) */
    await expect(canvas.queryByText("% vencido")).not.toBeInTheDocument();
  },
};

/* H6-C: esta combinación es EXACTAMENTE la que produce el contenedor cuando el
   vencido agregado se conoce y da cero (vía RCV, que lo deriva localmente). Antes
   el resumen la escondía detrás de una nota inventada sobre el SII. */
export const ResumenAlDia: Story = {
  name: "Resumen · cero VERIFICADO (estás al día)",
  args: { sinDato: SIN_DATO },
  render: () => <ResumenCobranza total={24800000} overdue={0} overduePct={0} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El cero verificado NO se degrada a "sin dato": es el mensaje más valioso.
    await expect(canvas.getByText(/Estás al día/i)).toBeInTheDocument();
    await expect(canvas.queryByText(/sin dato/i)).not.toBeInTheDocument();
  },
};

export const ResumenConMora: Story = {
  name: "Resumen · vencido real",
  args: { sinDato: SIN_DATO },
  render: () => <ResumenCobranza total={24800000} overdue={7900000} overduePct={31.9} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/31,9%/)).toBeInTheDocument();
    await expect(canvas.queryByText(/sin dato/i)).not.toBeInTheDocument();
  },
};
