import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { SortBar } from "./sort-bar";

/* Barra "Ordenar por" para listas curadas (Cobrar/Pagar). */

const meta = {
  title: "Filtros / SortBar",
  component: SortBar,
  parameters: { layout: "padded" },
  args: {
    options: [
      { key: "prioridad", label: "Prioridad" },
      { key: "vencido", label: "Vencido" },
      { key: "monto", label: "Monto" },
    ],
    dir: "desc",
    onSelect: fn(),
  },
} satisfies Meta<typeof SortBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Curado: Story = {
  args: { activeKey: "prioridad" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // El chip curado arranca activo (aria-pressed).
    await expect(canvas.getByRole("button", { name: "Prioridad" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Clic en otro criterio lo notifica al contenedor.
    await userEvent.click(canvas.getByRole("button", { name: /Vencido/ }));
    await expect(args.onSelect).toHaveBeenCalledWith("vencido");
  },
};

export const OrdenadoPorVencido: Story = {
  args: { activeKey: "vencido" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Con un criterio real activo, el chip curado deja de estar presionado.
    await expect(canvas.getByRole("button", { name: "Prioridad" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(canvas.getByRole("button", { name: /Vencido/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
