import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteLogo } from "./qavante-logo";

const meta = {
  title: "Capa 1 / QavanteLogo",
  component: QavanteLogo,
  parameters: {
    docs: {
      description: {
        component:
          "Logo oficial Qavante. Hero incluye el lema Anticipa. Decide. Avanza.; header usa el wordmark para conservar legibilidad.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["hero", "header"] },
  },
} satisfies Meta<typeof QavanteLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hero: Story = {
  args: { variant: "hero" },
  parameters: {
    docs: {
      description: {
        story: "Variant hero (96px) para login, recuperar clave y aceptar invitacion.",
      },
    },
  },
};

export const Header: Story = {
  args: { variant: "header" },
  parameters: {
    docs: {
      description: {
        story: "Variant header (32px), compacto, para el topbar dentro de la app autenticada.",
      },
    },
  },
};
