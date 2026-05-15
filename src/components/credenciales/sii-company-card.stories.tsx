import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SiiCompanyCard } from "./sii-company-card";

const meta = {
  title: "Capa 2 / Credenciales / SiiCompanyCard",
  component: SiiCompanyCard,
  parameters: {
    docs: {
      description: {
        component:
          "Card de credenciales SII empresa. Muestra estado configurado (con RUT + rotación + acción 'Cambiar clave') o no configurado (con CTA 'Configurar'). El dialog asociado es `SiiCompanyDialog` lazy.",
      },
    },
    layout: "padded",
  },
} satisfies Meta<typeof SiiCompanyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConfigured: Story = {
  args: {
    company: { configured: false },
  },
};

export const Configured: Story = {
  args: {
    company: {
      configured: true,
      rut: "76.123.456-7",
      last_rotated_at: "2026-04-20T10:00:00Z",
    },
  },
};

export const ConfiguredNeverRotated: Story = {
  args: {
    company: {
      configured: true,
      rut: "76.123.456-7",
    },
  },
};
