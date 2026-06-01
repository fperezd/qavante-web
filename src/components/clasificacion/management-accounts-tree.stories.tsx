import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ManagementAccountsTree } from "./management-accounts-tree";
import type { ManagementAccountTreeRow } from "./types";

/* Árbol editable de estructura de gestión (presentacional). Acciones por
   nodo: editar, agregar sub-cuenta, activar/desactivar y mostrar/ocultar. */

function row(p: Partial<ManagementAccountTreeRow> & { id: string }): ManagementAccountTreeRow {
  return {
    code: p.id,
    name: p.id,
    level: 0,
    type: "income",
    parentId: null,
    active: true,
    isVisible: true,
    description: "",
    affectsPulso: true,
    ...p,
  };
}

const ROWS: ManagementAccountTreeRow[] = [
  row({ id: "1", code: "1", name: "Ingresos", level: 0, type: "income" }),
  row({ id: "1.1", code: "1.1", name: "Ventas", level: 1, type: "income", parentId: "1" }),
  row({
    id: "1.2",
    code: "1.2",
    name: "Otros ingresos (oculta)",
    level: 1,
    type: "income",
    parentId: "1",
    isVisible: false,
  }),
  row({ id: "2", code: "2", name: "Gastos operativos", level: 0, type: "operating_expense" }),
  row({
    id: "2.1",
    code: "2.1",
    name: "Arriendo",
    level: 1,
    type: "operating_expense",
    parentId: "2",
  }),
  row({
    id: "2.2",
    code: "2.2",
    name: "Sueldos (inactiva)",
    level: 1,
    type: "operating_expense",
    parentId: "2",
    active: false,
  }),
];

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountsTree",
  component: ManagementAccountsTree,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Árbol editable de la estructura de gestión (presentacional). Indenta por `level`, muestra badges Inactiva/Oculta y expone editar, agregar sub-cuenta, activar/desactivar + mostrar/ocultar por nodo. Search por nombre/código.",
      },
    },
  },
  args: {
    rows: ROWS,
    onToggleActive: fn(),
    onToggleVisible: fn(),
    onCreateChild: fn(),
    onEdit: fn(),
    onMove: fn(),
  },
} satisfies Meta<typeof ManagementAccountsTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Arbol: Story = {
  name: "Árbol (activas + oculta + inactiva)",
};

export const ConPendiente: Story = {
  name: "Con una acción en curso (pendingId)",
  args: { pendingId: "2.1" },
};

export const SoloLectura: Story = {
  name: "Sin acciones de crear/editar/mover (solo toggles)",
  args: { onCreateChild: undefined, onEdit: undefined, onMove: undefined },
};

export const Vacio: Story = {
  name: "Sin resultados (lista vacía)",
  args: { rows: [] },
};
