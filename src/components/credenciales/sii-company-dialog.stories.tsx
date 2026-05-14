import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SiiCompanyDialog } from "./sii-company-dialog";

const meta = {
  title: "Capa 2 / Credenciales / SiiCompanyDialog",
  component: SiiCompanyDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Dialog para configurar (primera vez) o rotar (subsiguientes) la clave SII de la empresa. RUT validado con `isValidRut` (módulo 11). Maneja `rut_mismatch` del backend cuando no coincide con el RUT del tenant.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SiiCompanyDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstTimeSetup: Story = {
  args: {
    company: { configured: false },
  },
  parameters: {
    docs: {
      description: {
        story: "Primera configuración — RUT editable, copy CTA 'Configurar'.",
      },
    },
  },
};

export const RotatePassword: Story = {
  args: {
    company: {
      configured: true,
      rut: "76.123.456-7",
      last_rotated_at: "2026-04-20T10:00:00Z",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Rotación — RUT read-only (no cambia), solo se ingresa la nueva clave.",
      },
    },
  },
};
