import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DimensionValuesTree } from "./dimension-values-tree";
import type { DimensionValueTreeRow } from "./types";

/* Árbol editable de valores de una dimensión (presentacional). Acciones por
   nodo: editar, agregar sub-valor, mover, activar/desactivar. */

function row(p: Partial<DimensionValueTreeRow> & { id: string }): DimensionValueTreeRow {
  return {
    name: p.id,
    code: "",
    description: "",
    level: 0,
    parentId: null,
    active: true,
    ...p,
  };
}

const ROWS: DimensionValueTreeRow[] = [
  row({ id: "n", name: "Zona Norte", code: "N", level: 0 }),
  row({ id: "n1", name: "Obra Antofagasta", code: "N-01", level: 1, parentId: "n" }),
  row({ id: "n2", name: "Obra Calama (inactiva)", level: 1, parentId: "n", active: false }),
  row({ id: "s", name: "Zona Sur", code: "S", level: 0 }),
  row({ id: "s1", name: "Obra Temuco", code: "S-01", level: 1, parentId: "s" }),
];

const meta = {
  title: "Capa 2 / Clasificación / DimensionValuesTree",
  component: DimensionValuesTree,
  parameters: { layout: "padded" },
  args: {
    rows: ROWS,
    onCreateChild: fn(),
    onEdit: fn(),
    onMove: fn(),
    onToggleActive: fn(),
  },
} satisfies Meta<typeof DimensionValuesTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Arbol: Story = { name: "Árbol (raíces + sub-valores + inactivo)" };
export const ConPendiente: Story = {
  name: "Acción en curso (pendingId)",
  args: { pendingId: "s1" },
};
export const Vacio: Story = { name: "Sin resultados", args: { rows: [] } };
