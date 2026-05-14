import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { QavanteButton } from "./qavante-button";

const meta = {
  title: "Capa 1 / QavanteButton",
  component: QavanteButton,
  parameters: {
    docs: {
      description: {
        component:
          "Botón canónico Qavante. 5 variants × 3 sizes + estado loading. Anexo B.2 del Doc Maestro.",
      },
    },
  },
  args: {
    children: "Continuar",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger", "link"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof QavanteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Eliminar credenciales" },
};

export const Link: Story = {
  args: { variant: "link", children: "¿Olvidaste tu clave?" },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm" },
};

export const Large: Story = {
  args: { variant: "primary", size: "lg" },
};

export const Loading: Story = {
  args: { variant: "primary", loading: true, children: "Guardando…" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true },
};

export const WithIcon: Story = {
  args: {
    variant: "primary",
    children: (
      <>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Invitar usuario
      </>
    ),
  },
};
