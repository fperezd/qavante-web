import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { SortHeader } from "./sort-header";

/* Cabecera de columna ordenable: etiqueta + flecha (↑/↓ activa, ↕ inactiva). */

const meta = {
  title: "Qavante / SortHeader",
  component: SortHeader,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SortHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActivaDescendente: Story = {
  args: { label: "Fecha", active: true, dir: "desc", onClick: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole("button", { name: /Ordenar por Fecha \(descendente\)/ });
    await expect(btn).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(btn);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const ActivaAscendente: Story = {
  args: { label: "Monto", active: true, dir: "asc", align: "right", onClick: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /Ordenar por Monto \(ascendente\)/ }),
    ).toHaveAttribute("aria-sort", "ascending");
  },
};

export const Inactiva: Story = {
  args: { label: "Movimiento", active: false, dir: "desc", onClick: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Inactiva: sin dirección de orden anunciada.
    await expect(canvas.getByRole("button", { name: /Ordenar por Movimiento/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
  },
};
