import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteLogo } from "./qavante-logo";

/* Logo Qavante — wordmark + ola + tagline. Dos variants:
   - hero: 96px alto, para auth screens (login, recuperar-clave, etc.).
   - header: 32px alto, para el topbar dentro de la app. */

const meta = {
  title: "Capa 1 / QavanteLogo",
  component: QavanteLogo,
  parameters: {
    docs: {
      description: {
        component:
          "Logo oficial Qavante (asset en `public/qavante-logo.png`). Servido con `next/image` para auto-optimización. Aspect ratio 1.776:1.",
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
        story: "Variant hero (96px) — para `/login`, `/recuperar-clave`, `/aceptar-invitacion`.",
      },
    },
  },
};

export const Header: Story = {
  args: { variant: "header" },
  parameters: {
    docs: {
      description: {
        story: "Variant header (32px) — compacto, para el topbar dentro de la app autenticada.",
      },
    },
  },
};
