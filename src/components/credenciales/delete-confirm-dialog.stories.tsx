import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

const meta = {
  title: "Capa 2 / Credenciales / DeleteConfirmDialog",
  component: DeleteConfirmDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Confirm dialog destructivo reutilizable. Convenios Anexo F: icono warning en title, botón Cancelar (ghost) + Confirm (danger), descripción explícita del efecto. Soporta loading + error message inline.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: "Eliminar credenciales SII",
    description:
      "¿Eliminar las credenciales SII de Marta Soto? Qavante no va a poder acceder al portal SII en su nombre hasta que las vuelvas a cargar.",
  },
} satisfies Meta<typeof DeleteConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true },
};

export const WithError: Story = {
  args: {
    error: "La operación falló: no se encontró la persona. Prueba refrescar la página.",
  },
};

export const CustomConfirmLabel: Story = {
  args: {
    title: "Eliminar certificado digital",
    description:
      "¿Eliminar el certificado actual? Qavante no va a poder firmar documentos ante el SII hasta que cargues uno nuevo.",
    confirmLabel: "Eliminar certificado",
  },
};
