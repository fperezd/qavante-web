import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteBadge } from "./qavante-badge";

const meta = {
  title: "Capa 1 / QavanteBadge",
  component: QavanteBadge,
  parameters: {
    docs: {
      description: {
        component:
          "Badge canónico para estados, tags y semáforos. 5 variants alineadas a los semánticos del Design System (success/warning/danger/info + default neutral). Anexo B.2 del Doc Maestro.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "danger", "info"],
    },
  },
  args: { children: "Activo" },
} satisfies Meta<typeof QavanteBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default", children: "Borrador" },
};

export const Success: Story = {
  args: { variant: "success", children: "Configurado" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Vence en 12 días" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Expirado" },
};

export const Info: Story = {
  args: { variant: "info", children: "Nuevo" },
};
