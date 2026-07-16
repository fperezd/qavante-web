import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
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

/* Los dos plays de abajo blindan la regla "solo un owner asigna owner". Son posibles porque
   RoleSelect es presentacional (recibe props, no hace fetch): no dependen de MSW, que el runner
   de Storybook no intercepta. */

/** El invitador NO es owner → "Dueño" no está entre las opciones. */
export const OwnerExcluidoPlay: Story = {
  name: "Owner excluido (admin invitando)",
  args: { value: "", excludeOwnerWhenNotOwner: true, currentUserRole: "admin" },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox");
    const opciones = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).not.toContain("Dueño");
    expect(opciones).toContain("Administrador");
  },
};

/** El invitador SÍ es owner → puede asignar "Dueño" (transferir propiedad).
 *  Esta rama estaba MUERTA en prod: /administracion/usuarios nunca pasaba `currentUserRole`,
 *  así que llegaba undefined y ni el dueño podía. */
export const OwnerPuedeAsignarOwner: Story = {
  name: "Owner sí puede asignar owner",
  args: { value: "", excludeOwnerWhenNotOwner: true, currentUserRole: "owner" },
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox");
    const opciones = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toContain("Dueño");
  },
};
