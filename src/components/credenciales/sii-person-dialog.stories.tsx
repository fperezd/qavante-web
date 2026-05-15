import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SiiPersonDialog } from "./sii-person-dialog";

const meta = {
  title: "Capa 2 / Credenciales / SiiPersonDialog",
  component: SiiPersonDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Dialog para agregar nueva persona autorizada o rotar la clave de una existente. RUT validado con `isValidRut`. Si `person` viene definido, es flujo de rotación y el RUT queda read-only.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SiiPersonDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddNewPerson: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Agregar nueva — RUT + nombre + clave editables.",
      },
    },
  },
};

export const RotateExistingPerson: Story = {
  args: {
    person: {
      rut: "12.345.678-9",
      name: "Marta Soto (contadora)",
      configured: true,
      last_rotated_at: "2026-04-15T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Rotar clave de persona existente — RUT read-only, solo se cambia la clave.",
      },
    },
  },
};
