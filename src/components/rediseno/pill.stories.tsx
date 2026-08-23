import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { Pill } from "./pill";

/* Pill — ESPECIFICACION.md §1.3. Las 5 variantes son el único vocabulario de
   estado del rediseño: no crear una sexta sin antes actualizar el spec. */

const meta = {
  title: "Rediseño / Pill",
  component: Pill,
  parameters: { layout: "centered" },
  args: { children: "Conciliado" },
} satisfies Meta<typeof Pill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  args: { variant: "ok", children: "Conciliado ✓" },
};

export const Warn: Story = {
  args: { variant: "warn", children: "Por clasificar" },
};

export const Bad: Story = {
  args: { variant: "bad", children: "Revisar" },
};

export const Mut: Story = {
  args: { variant: "mut", children: "Inactiva" },
};

export const Blue: Story = {
  args: { variant: "blue", children: "Crédito" },
};

export const TodasLasVariantes: Story = {
  render: () => (
    <div className="flex gap-2 p-4">
      <Pill variant="ok">Conciliado</Pill>
      <Pill variant="warn">Por clasificar</Pill>
      <Pill variant="bad">Revisar</Pill>
      <Pill variant="mut">Inactiva</Pill>
      <Pill variant="blue">Crédito</Pill>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Conciliado")).toBeVisible();
    await expect(canvas.getByText("Por clasificar")).toBeVisible();
    await expect(canvas.getByText("Revisar")).toBeVisible();
    await expect(canvas.getByText("Inactiva")).toBeVisible();
    await expect(canvas.getByText("Crédito")).toBeVisible();
  },
};
