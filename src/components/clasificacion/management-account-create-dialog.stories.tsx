import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ManagementAccountCreateDialog } from "./management-account-create-dialog";

/* Dialog de creación de cuenta de gestión (presentacional + mutación propia).
   open=true para verlo montado en el canvas. */

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountCreateDialog",
  component: ManagementAccountCreateDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Crear cuenta de gestión (POST owner/admin). Código + nombre + tipo + destino (de los dominios del árbol) + descripción + afecta-Pulso. 409/422/403 se muestran vía apiErrorToUserMessage.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    typeOptions: ["income", "operating_expense", "direct_cost", "other_income"],
    destinationOptions: ["operating", "non_operating"],
  },
} satisfies Meta<typeof ManagementAccountCreateDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuentaRaiz: Story = {
  name: "Cuenta raíz (sin padre)",
  args: { parent: null },
};

export const SubCuenta: Story = {
  name: "Sub-cuenta (con padre)",
  args: { parent: { id: "1", name: "Ingresos" } },
};
