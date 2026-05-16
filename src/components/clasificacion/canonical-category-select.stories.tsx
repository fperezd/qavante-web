import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CanonicalCategorySelect } from "./canonical-category-select";
import { CANONICAL_CATEGORIES_FIXTURE } from "./fixtures";

const meta = {
  title: "Capa 2 / Clasificación / CanonicalCategorySelect",
  component: CanonicalCategorySelect,
  parameters: {
    docs: {
      description: {
        component:
          "Selector de tipo de movimiento (addendum §17.2/§20). Presentacional puro: labels/descripciones vienen del backend (`CanonicalCategoryMeta`, contrato vivo §11/26 — reconciliation P4-4), nunca hardcodeados. Búsqueda sin librería combobox (input + lista de botones accesible).",
      },
    },
  },
} satisfies Meta<typeof CanonicalCategorySelect>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive() {
  const [value, setValue] = React.useState<string>();
  return (
    <div className="max-w-md">
      <CanonicalCategorySelect
        items={CANONICAL_CATEGORIES_FIXTURE}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

export const Default: Story = {
  args: { items: CANONICAL_CATEGORIES_FIXTURE, onChange: () => {} },
  render: () => <Interactive />,
};

export const WithSelection: Story = {
  args: {
    items: CANONICAL_CATEGORIES_FIXTURE,
    value: "supplier_payment",
    onChange: () => {},
  },
};

export const Empty: Story = {
  args: {
    items: [],
    onChange: () => {},
  },
};
