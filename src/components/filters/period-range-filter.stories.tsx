import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PeriodRangeFilter } from "./period-range-filter";
import type { PeriodRange } from "@/lib/period/period-range";

/* PeriodRangeFilter — filtro de rango (presets + fecha inicial/final). */

function Wrapper(args: { initial: PeriodRange }) {
  const [range, setRange] = React.useState<PeriodRange>(args.initial);
  return (
    <div className="p-8">
      <PeriodRangeFilter value={range} onChange={setRange} now={new Date(Date.UTC(2026, 6, 15))} />
      <p className="mt-4 text-sm text-neutral-mid">
        Seleccionado: {range.desde} a {range.hasta}
      </p>
    </div>
  );
}

const meta = {
  title: "Capa 2 / Filtros / PeriodRangeFilter",
  component: PeriodRangeFilter,
  parameters: { layout: "fullscreen" },
  args: { value: { desde: "2026-02", hasta: "2026-07" }, onChange: () => {} },
} satisfies Meta<typeof PeriodRangeFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeisMeses: Story = {
  render: () => <Wrapper initial={{ desde: "2026-02", hasta: "2026-07" }} />,
};

export const UnMes: Story = {
  render: () => <Wrapper initial={{ desde: "2026-06", hasta: "2026-06" }} />,
};
