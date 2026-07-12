import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { CalidadDato } from "./calidad-dato";

const meta = {
  title: "Inicio v2 / CalidadDato",
  component: CalidadDato,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Clasificar movimientos baja del top de acciones a un bloque de calidad, pero cuantificado (cuánto puede cambiar la caja/resultado).",
      },
    },
  },
} satisfies Meta<typeof CalidadDato>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    texto: (
      <>
        Hay <b>195 movimientos</b> sin clasificar por <b>hasta $3,4M</b> — pueden cambiar la
        caja y el resultado estimado.
      </>
    ),
    ctaLabel: "Clasificar →",
  },
};

export const Interaccion: Story = {
  name: "Cuantificado + CTA",
  args: { ...Default.args! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/195 movimientos/)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Clasificar/ })).toBeInTheDocument();
  },
};
