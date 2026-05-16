import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DimensionValuePicker } from "./dimension-value-picker";
import { DIMENSION_VALUES_FIXTURE } from "./fixtures";

const meta = {
  title: "Capa 2 / Clasificación / DimensionValuePicker",
  component: DimensionValuePicker,
  parameters: {
    docs: {
      description: {
        component:
          "Selector de valores de una vista de gestión (addendum §20). Respeta `allowsMultiple` (addendum §15.5/§26.1): false ⇒ radios (a lo sumo 1), true ⇒ checkboxes. Presentacional puro.",
      },
    },
  },
} satisfies Meta<typeof DimensionValuePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({ allowsMultiple }: { allowsMultiple: boolean }) {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <div className="max-w-md">
      <DimensionValuePicker
        dimensionName="Proyecto"
        values={DIMENSION_VALUES_FIXTURE}
        selected={selected}
        onChange={setSelected}
        allowsMultiple={allowsMultiple}
      />
    </div>
  );
}

const baseArgs = {
  dimensionName: "Proyecto",
  values: DIMENSION_VALUES_FIXTURE,
  selected: [],
  onChange: () => {},
};

export const SingleValue: Story = {
  args: baseArgs,
  render: () => <Interactive allowsMultiple={false} />,
};

export const MultipleValues: Story = {
  args: baseArgs,
  render: () => <Interactive allowsMultiple />,
};

export const Empty: Story = {
  args: {
    dimensionName: "Proyecto",
    values: [],
    selected: [],
    onChange: () => {},
  },
};
