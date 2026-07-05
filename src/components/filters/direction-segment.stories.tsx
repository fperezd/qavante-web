import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
