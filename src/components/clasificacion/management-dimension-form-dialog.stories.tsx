import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ManagementDimensionFormDialog } from "./management-dimension-form-dialog";
import type { ManagementDimensionRow } from "./types";

/* Dialog crear/editar vista de gestión (dimensión). open=true para verlo
   montado. dimension=null → crear; con fila → editar (code read-only). */

const DIMENSION: ManagementDimensionRow = {
  id: "1",
  code: "proyecto",
  name: "Proyecto",
  description: "Mira el negocio por proyecto u obra",
  dataType: "reference",
  isRequired: true,
  isVisible: true,
  allowsHierarchy: true,
  allowsMultiple: false,
  active: true,
  isSystem: false,
};

const meta = {
  title: "Capa 2 / Clasificación / ManagementDimensionFormDialog",
  component: ManagementDimensionFormDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Crear/editar una vista de gestión (POST/PATCH owner/admin). Código (read-only al editar), nombre, tipo de dato, descripción y opciones (obligatoria/visible/jerárquica/multi). 409/403 vía apiErrorToUserMessage.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    dimension: null,
  },
} satisfies Meta<typeof ManagementDimensionFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crear: Story = {
  name: "Crear (defaults)",
  args: { dimension: null },
};

export const Editar: Story = {
  name: "Editar (code read-only, pre-poblado)",
  args: { dimension: DIMENSION },
};
