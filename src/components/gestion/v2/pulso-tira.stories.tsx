import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { PulsoTira } from "./pulso-tira";

/* El Pulso del negocio como tira delgada: el mismo del header, compacto, solo por el insight. */

const meta = {
  title: "Propuestas / Gestión / PulsoTira",
  component: PulsoTira,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820 }}>
        <Story />
      </div>
    ),
  ],
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
        Ganas en resultado, pero tu Pulso está débil:{" "}
        <b className="text-warning-700">la caja está en rojo</b>. El resultado es <b>devengado</b> —
        lo facturado, no lo cobrado.
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

/* Cuando la API se abstiene (qavante-api#162). El pase §6 midio que este publicador quedo sin
   una sola asercion: mutar el tono a "ok" pintaba el chip y el numero en VERDE DE EXITO sobre el
   texto "sin datos suficientes", con los 1607+657 tests en verde. */
export const SinDatos: Story = {
  args: {
    score: null,
    estado: "Pulso sin datos suficientes para calcularlo",
    tono: "neutral",
    insight: "Falta el saldo de apertura para poder calcular el Pulso.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("—")).toBeInTheDocument();
    await expect(canvas.queryByText("0")).not.toBeInTheDocument();
    // NADA en verde de exito: ni el chip ni el numero. Es el defecto que este PR cierra, en la
    // superficie que no dice la palabra pero si el color.
    await expect(canvasElement.querySelectorAll('[class*="success"]').length).toBe(0);
    await expect(canvasElement.querySelectorAll('[class*="neutral-mid"]').length).toBeGreaterThan(
      0,
    );
  },
};

/** EL CONTRAPESO, con el MISMO selector: con estado real la tira SI usa su color semantico. */
export const SinDatosContrapeso: Story = {
  name: "Con estado real (contrapeso)",
  args: {
    score: 78,
    estado: "Pulso fuerte",
    tono: "ok",
    insight: "El negocio viene solido.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("78")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[class*="success"]').length).toBeGreaterThan(0);
  },
};
