import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DimensionValueFormDialog } from "./dimension-value-form-dialog";
import type { DimensionValueTreeRow } from "./types";

/* Dialog crear/editar valor de dimensión. open=true para verlo montado. */

const VALUE: DimensionValueTreeRow = {
  id: "1",
  name: "Obra Antofagasta",
  code: "N-01",
  description: "Proyecto minero zona norte",
  level: 1,
  parentId: "n",
  active: true,
};

const meta = {
  title: "Capa 2 / Clasificación / DimensionValueFormDialog",
  component: DimensionValueFormDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: fn(),
    dimensionId: "dim-1",
    value: null,
    parent: null,
  },
} satisfies Meta<typeof DimensionValueFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CrearRaiz: Story = { name: "Crear valor raíz", args: { value: null, parent: null } };
export const CrearSubValor: Story = {
  name: "Crear sub-valor (con padre)",
  args: { value: null, parent: { id: "n", name: "Zona Norte" } },
};
export const Editar: Story = { name: "Editar valor (pre-poblado)", args: { value: VALUE } };
