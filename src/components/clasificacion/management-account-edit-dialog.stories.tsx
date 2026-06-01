import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ManagementAccountEditDialog } from "./management-account-edit-dialog";
import type { ManagementAccountTreeRow } from "./types";

/* Dialog de edición de cuenta de gestión (PATCH owner/admin). open=true para
   verlo montado; pre-poblado desde la fila del árbol. */

const ACCOUNT: ManagementAccountTreeRow = {
  id: "1.1",
  code: "1.1",
  name: "Ventas",
  level: 1,
  type: "income",
  parentId: "1",
  active: true,
  isVisible: true,
  description: "Ingresos por venta de productos y servicios",
  affectsPulso: true,
};

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountEditDialog",
  component: ManagementAccountEditDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Editar cuenta (PATCH owner/admin). Solo nombre, glosa y afecta-Pulso. 404/403 vía apiErrorToUserMessage. Pre-poblado desde la fila del árbol.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    account: ACCOUNT,
  },
} satisfies Meta<typeof ManagementAccountEditDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editar: Story = {
  name: "Editar cuenta (pre-poblado)",
};

export const SinGlosa: Story = {
  name: "Cuenta sin glosa + no afecta Pulso",
  args: { account: { ...ACCOUNT, description: "", affectsPulso: false } },
};
