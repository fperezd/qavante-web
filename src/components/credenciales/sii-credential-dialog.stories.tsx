import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SiiCredentialDialog } from "./sii-credential-dialog";

const meta = {
  title: "Capa 2 / Credenciales / SiiCredentialDialog",
  component: SiiCredentialDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Dialog para configurar/rotar la credencial SII (Opción A: UNA credencial por tenant, `source_code=sii_rcv`). Form rut+password validado con `isValidRut`. La clave no se almacena en el FE (regla 6).",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SiiCredentialDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstTimeSetup: Story = {
  args: { active: false },
  parameters: {
    docs: {
      description: { story: "Primera configuración — copy CTA 'Configurar clave SII'." },
    },
  },
};

export const RotatePassword: Story = {
  args: { active: true },
  parameters: {
    docs: { description: { story: "Rotación — copy CTA 'Cambiar clave SII'." } },
  },
};
