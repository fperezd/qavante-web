import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Building2 } from "lucide-react";
import { QavanteCard } from "./qavante-card";

const meta = {
  title: "Capa 1 / QavanteCard",
  component: QavanteCard,
  parameters: {
    docs: {
      description: {
        component:
          "Card canónica con 3 variants (default sombra suave / elevated sombra fuerte / bordered solo borde) + slots opcionales `header` y `footer`. Anexo B.2 del Doc Maestro.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["default", "elevated", "bordered"] },
  },
  args: {
    children: (
      <p className="text-sm text-neutral-mid">
        Contenido del card. La mayoría de los datos del dashboard viven dentro de uno de estos.
      </p>
    ),
  },
} satisfies Meta<typeof QavanteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default" },
};

export const Elevated: Story = {
  args: { variant: "elevated" },
};

export const Bordered: Story = {
  args: { variant: "bordered" },
};

export const WithHeader: Story = {
  args: {
    variant: "bordered",
    header: (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand-primary" aria-hidden="true" />
        <span>Credenciales SII — Empresa</span>
      </div>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    variant: "bordered",
    footer: <span className="text-xs">Actualizado hace 5 min</span>,
  },
};
