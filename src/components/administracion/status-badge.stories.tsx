import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";

const meta = {
  title: "Capa 2 / Administración / StatusBadge",
  component: StatusBadge,
  parameters: {
    docs: {
      description: {
        component:
          "Badge de estado del usuario (active/suspended/invited) mapeado a copys es-CL del Anexo C.4. Usa `QavanteBadge` con la variant correspondiente.",
      },
    },
  },
  argTypes: {
    status: {
      control: "select",
      options: ["active", "suspended", "invited"],
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { status: "active" },
};

export const Suspended: Story = {
  args: { status: "suspended" },
};

export const Invited: Story = {
  args: { status: "invited" },
};
