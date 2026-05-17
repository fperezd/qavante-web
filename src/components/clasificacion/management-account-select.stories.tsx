import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ManagementAccountSelect } from "./management-account-select";
import { MANAGEMENT_ACCOUNTS_FIXTURE } from "./fixtures";

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountSelect",
  component: ManagementAccountSelect,
  parameters: {
    docs: {
      description: {
        component:
          "Selector de categoría de gestión con árbol (indentado por `level`) + búsqueda (addendum §20). Presentacional puro. Nodos inactivos se muestran pero no son seleccionables (addendum §14.4).",
      },
    },
  },
} satisfies Meta<typeof ManagementAccountSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive() {
  const [value, setValue] = React.useState<string>();
  return (
    <div className="max-w-md">
      <ManagementAccountSelect
        items={MANAGEMENT_ACCOUNTS_FIXTURE}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

export const Default: Story = {
  args: { items: MANAGEMENT_ACCOUNTS_FIXTURE, onChange: () => {} },
  render: () => <Interactive />,
};

export const WithSelection: Story = {
  args: {
    items: MANAGEMENT_ACCOUNTS_FIXTURE,
    value: "3.1",
    onChange: () => {},
  },
};
