import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ManagementAccountMoveDialog } from "./management-account-move-dialog";
import type { ManagementAccountTreeRow } from "./types";

/* Dialog de mover cuenta (POST /move owner/admin). Sin drag-and-drop
   (ADR-0009): selector "Mover a…". open=true para verlo montado. */

function row(p: Partial<ManagementAccountTreeRow> & { id: string }): ManagementAccountTreeRow {
  return {
    code: p.id,
    name: p.id,
    rawName: p.id,
    displayName: "",
    level: 0,
    type: "income",
    destination: "operating",
    parentId: null,
    active: true,
    isVisible: true,
    description: "",
    affectsPulso: true,
    ...p,
  };
}

const ACCOUNT = row({
  id: "2.1",
  code: "2.1",
  name: "Arriendo",
  level: 1,
  type: "operating_expense",
  parentId: "2",
});

const TARGETS: ManagementAccountTreeRow[] = [
  row({ id: "1", code: "1", name: "Ingresos", level: 0 }),
  row({ id: "1.1", code: "1.1", name: "Ventas", level: 1, parentId: "1" }),
  row({ id: "2", code: "2", name: "Gastos operativos", level: 0, type: "operating_expense" }),
];

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountMoveDialog",
  component: ManagementAccountMoveDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Mover cuenta a otro padre (sin drag-and-drop, ADR-0009). El selector ya excluye la propia cuenta y sus descendientes; un 422 del backend (ciclo) muestra copy específico.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    account: ACCOUNT,
    targets: TARGETS,
  },
} satisfies Meta<typeof ManagementAccountMoveDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mover: Story = {
  name: "Mover (padre actual pre-seleccionado)",
};

export const SinDestinos: Story = {
  name: "Solo raíz disponible (sin otros destinos)",
  args: { targets: [] },
};
