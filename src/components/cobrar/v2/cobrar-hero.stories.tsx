import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { CobrarHero } from "./cobrar-hero";
import { CobranzaAcciones } from "./cobranza-acciones";
import { explicarVencidoSinDato } from "../cobranza-format";

/* La "respuesta de dueño" de Cobrar v2: a quién le cobras primero + acciones. */

const meta = {
  title: "Propuestas / Cobrar / CobrarHero",
  component: CobrarHero,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520, border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CobrarHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/* El motivo del "no sé" sale del dato de la API, no de una frase hardcodeada. */
const SIN_DATO = explicarVencidoSinDato({
  undated_amount: "162799064",
  missing_sources: ["Términos de pago sin definir"],
});

const acciones = (
  <CobranzaAcciones
    onCopiar={() => {}}
    copiado={false}
    waHref="#"
    mailtoHref="#"
    gestionado={null}
    onToggleGestionado={() => {}}
  />
);

/* Priorización por TAMAÑO cuando no se conoce la mora. El motivo ya NO lo inventa
   la pantalla ("el SII no entregó los vencimientos"): lo arma
   `explicarVencidoSinDato` con lo que informa la API (`undated_amount` +
   `missing_sources`), que es la misma fuente que usa el resumen. Así el hero y el
   resumen no pueden contradecirse (H6-F). */
export const Concentracion: Story = {
  args: {
    antetitulo: "Tu mayor cobranza",
    cliente: "COMERCIAL KAUFMANN S.A.",
    rut: "96572360-9",
    monto: 89_204_419,
    montoLabel: "por cobrar",
    montoTono: "neutral",
    bajada: (
      <>
        55% de tus $162.799.064 por cobrar. Aún no sabemos qué está vencido, así que priorizamos por
        tamaño. {SIN_DATO.motivo}
      </>
    ),
    infoHint: SIN_DATO.accion,
    acciones,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tu mayor cobranza")).toBeInTheDocument();
    await expect(canvas.getByText("COMERCIAL KAUFMANN S.A.")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$89.204.419")).toBeInTheDocument(), {
      timeout: 3000,
    });
    await expect(canvas.getByRole("button", { name: /Copiar recordatorio/ })).toBeInTheDocument();
    // El motivo es el que informa la API, no una causa inventada por el front.
    await expect(canvas.getByText(/no tiene fecha de vencimiento/i)).toBeInTheDocument();
    await expect(canvas.queryByText(/el SII no entregó/i)).not.toBeInTheDocument();
  },
};

/* Modo urgencia: cuando el SII ya entregó vencimientos, prioriza al más vencido. */
export const Urgencia: Story = {
  args: {
    antetitulo: "Cóbrale primero a",
    cliente: "DIVEIMPORT S.A.",
    rut: "55555555-5",
    monto: 12_400_000,
    montoLabel: "vencido",
    montoTono: "danger",
    bajada: <>De $30.182.477 que te debe. Es tu cobranza vencida más grande · pártele por acá.</>,
    infoHint: "Priorizamos por mora: primero el que más te debe vencido.",
    acciones,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cóbrale primero a")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$12.400.000")).toBeInTheDocument(), {
      timeout: 3000,
    });
    await expect(canvas.getByText("vencido")).toBeInTheDocument();
  },
};
