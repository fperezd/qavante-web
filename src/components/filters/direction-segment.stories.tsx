import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { DirectionSegment, type DirectionValue } from "./direction-segment";

/* DirectionSegment — filtro segmentado Todos / Cobrar / Pagar.
   Vocabulario de negocio: credit = Cobrar, debit = Pagar. */

function Wrapper(args: { initial: DirectionValue }) {
  const [value, setValue] = React.useState<DirectionValue>(args.initial);
  return (
    <div className="p-8">
      <DirectionSegment value={value} onChange={setValue} />
      <p className="mt-4 text-sm text-neutral-mid">Seleccionado: {value}</p>
    </div>
  );
}

const meta = {
  title: "Capa 2 / Filtros / DirectionSegment",
  component: DirectionSegment,
  parameters: { layout: "fullscreen" },
  args: { value: "todos", onChange: () => {} },
} satisfies Meta<typeof DirectionSegment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Todos: Story = {
  render: () => <Wrapper initial="todos" />,
};

export const Cobrar: Story = {
  render: () => <Wrapper initial="credit" />,
};

export const Pagar: Story = {
  render: () => <Wrapper initial="debit" />,
};

/** Test de interacción (browser real): el radiogroup se opera por teclado —
 *  las flechas mueven la selección (con wrap) y enfocan el nuevo radio. */
export const TecladoFlechas: Story = {
  render: () => <Wrapper initial="todos" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todos = canvas.getByRole("radio", { name: /Todos/ });
    const cobrar = canvas.getByRole("radio", { name: /Cobrar/ });
    const pagar = canvas.getByRole("radio", { name: /Pagar/ });

    todos.focus();
    await expect(todos).toHaveAttribute("aria-checked", "true");

    // → avanza a Cobrar y lo enfoca.
    await userEvent.keyboard("{ArrowRight}");
    await expect(cobrar).toHaveAttribute("aria-checked", "true");
    await expect(cobrar).toHaveFocus();

    // ← retrocede a Todos.
    await userEvent.keyboard("{ArrowLeft}");
    await expect(todos).toHaveAttribute("aria-checked", "true");

    // ← desde el primero hace wrap al último (Pagar).
    await userEvent.keyboard("{ArrowLeft}");
    await expect(pagar).toHaveAttribute("aria-checked", "true");
  },
};
