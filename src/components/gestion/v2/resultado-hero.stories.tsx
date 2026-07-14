import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { ResultadoHero } from "./resultado-hero";

/* La "respuesta de dueño" de Gestión v2: ¿le fue bien o mal al negocio este mes? */

const meta = {
  title: "Propuestas / Gestión / ResultadoHero",
  component: ResultadoHero,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 380, border: "1px solid var(--color-border)", borderRadius: 12 }}><Story /></div>],
} satisfies Meta<typeof ResultadoHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gano: Story = {
  args: {
    titulo: "El negocio ganó este mes",
    resultado: 4_500_000,
    respuesta: (
      <>
        Ganó <b>12,5% más</b> que el mes pasado.
      </>
    ),
    respuestaTono: "ok",
    subtitulo: "Resultado operacional de julio · devengado",
    infoHint: "Lo facturado menos los costos y gastos del mes. Es devengado (no es lo cobrado ni la caja).",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("El negocio ganó este mes")).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText("$4.500.000")).toBeInTheDocument(), { timeout: 3000 });
    await expect(canvas.getByText(/más/)).toBeInTheDocument();
  },
};

/** Mes con pérdida: número en rojo + tono malo. */
export const Perdio: Story = {
  args: {
    titulo: "El negocio perdió este mes",
    resultado: -3_000_000,
    respuesta: (
      <>
        Perdió <b>$3.000.000</b> · peor que el mes pasado.
      </>
    ),
    respuestaTono: "bad",
    subtitulo: "Resultado operacional de julio · devengado",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("−$3.000.000")).toBeInTheDocument(), { timeout: 3000 });
    await expect(canvas.getByText("El negocio perdió este mes")).toBeInTheDocument();
  },
};
