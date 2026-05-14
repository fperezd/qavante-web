import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { RoleSelect } from "./role-select";

const meta = {
  title: "Capa 2 / Administración / RoleSelect",
  component: RoleSelect,
  parameters: {
    docs: {
      description: {
        component:
          "Native `<select>` con styling Qavante. Muestra los 6 roles asignables (Anexo C.4) — `technical_admin` queda fuera porque es rol Tooxs.",
      },
    },
  },
  args: {
    value: "",
    onChange: fn(),
  },
  argTypes: {
    value: {
      control: "select",
      options: [
        "",
        "owner",
        "admin",
        "finance_manager",
        "accountant",
        "viewer",
        "external_advisor",
      ],
    },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
    excludeOwnerWhenNotOwner: { control: "boolean" },
  },
} satisfies Meta<typeof RoleSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { value: "" },
};

export const SelectedAccountant: Story = {
  args: { value: "accountant" },
};

export const Disabled: Story = {
  args: { value: "admin", disabled: true },
};

export const Invalid: Story = {
  args: { value: "", invalid: true },
};

export const OwnerExcluded: Story = {
  args: {
    value: "",
    excludeOwnerWhenNotOwner: true,
    currentUserRole: "admin",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Cuando el invitador NO es owner, no puede asignar role=owner — se filtra del listado.",
      },
    },
  },
};
