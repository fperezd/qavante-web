import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PulsoTira } from "./pulso-tira";

/* El Pulso del negocio como tira delgada: el mismo del header, compacto, solo por el insight. */

const meta = {
  title: "Propuestas / Gestión / PulsoTira",
  component: PulsoTira,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ maxWidth: 820 }}><Story /></div>],
} satisfies Meta<typeof PulsoTira>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Debil: Story = {
  args: {
    score: 27,
    estado: "Pulso débil",
    tono: "bad",
    insight: (
      <>
        Ganas en resultado, pero tu Pulso está débil: <b className="text-warning-700">la caja está en rojo</b>. El
        resultado es <b>devengado</b> — lo facturado, no lo cobrado.
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("27")).toBeInTheDocument();
    await expect(canvas.getByText("Pulso débil")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Ver por qué/ })).toBeInTheDocument();
  },
};

export const Fuerte: Story = {
  args: {
    score: 78,
    estado: "Pulso fuerte",
    tono: "ok",
    insight: "El negocio viene sólido: resultado positivo y la caja cubre lo crítico.",
  },
};
