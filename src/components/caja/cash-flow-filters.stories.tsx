import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CashFlowFilters } from "./cash-flow-filters";
import type { CashFlowReportParams } from "@/lib/api/treasury-reports";

const meta = {
  title: "Caja / CashFlowFilters",
  component: CashFlowFilters,
  parameters: {
    docs: {
      description: {
        component:
          "Controles de periodo (YYYY-MM from/to), granularidad (month/week/day) y financial_layer (6 capas). Validación cliente de formato + rango. El botón Aplicar emite onChange solo cuando rangeValid && dirty.",
      },
    },
  },
} satisfies Meta<typeof CashFlowFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

function Wrapper(props: { initial: CashFlowReportParams }) {
  const [value, setValue] = React.useState(props.initial);
  return <CashFlowFilters value={value} onChange={setValue} />;
}

const NOOP = () => {};

export const Default: Story = {
  args: {
    value: {
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "week",
      financial_layer: "committed",
    },
    onChange: NOOP,
  },
  render: (args) => <Wrapper initial={args.value} />,
};

export const Mensual: Story = {
  args: {
    value: {
      period_from: "2026-01",
      period_to: "2026-06",
      granularity: "month",
      financial_layer: "committed",
    },
    onChange: NOOP,
  },
  render: (args) => <Wrapper initial={args.value} />,
};

export const ForecastLayer: Story = {
  args: {
    value: {
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "week",
      financial_layer: "forecast",
    },
    onChange: NOOP,
  },
  render: (args) => <Wrapper initial={args.value} />,
};

export const Loading: Story = {
  args: {
    value: {
      period_from: "2026-05",
      period_to: "2026-08",
      granularity: "week",
      financial_layer: "committed",
    },
    onChange: () => {},
    loading: true,
  },
};
