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
          'Selector de valores de una vista de gestión (addendum §20). Respeta `allowsMultiple` (addendum §15.5/§26.1): false ⇒ radios (a lo sumo 1) + opción "Sin asignar" para deseleccionar, true ⇒ checkboxes. Presentacional puro.',
      },
    },
  },
} satisfies Meta<typeof DimensionValuePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({
  allowsMultiple,
  initial = [],
}: {
  allowsMultiple: boolean;
  initial?: string[];
}) {
  const [selected, setSelected] = React.useState<string[]>(initial);
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

/* #9: en single, "Sin asignar" permite volver a vacío (un radio ya checked no
   dispara onChange al re-clickearlo). Arranca con un valor preseleccionado. */
export const SinglePreseleccionado: Story = {
  name: "Single con valor (deseleccionar con 'Sin asignar')",
  args: baseArgs,
  render: () => <Interactive allowsMultiple={false} initial={[DIMENSION_VALUES_FIXTURE[0]!.id]} />,
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
