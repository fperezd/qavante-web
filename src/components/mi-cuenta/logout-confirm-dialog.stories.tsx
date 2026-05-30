import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { LogoutConfirmDialog } from "./logout-confirm-dialog";

const meta = {
  title: "Mi cuenta / LogoutConfirmDialog",
  component: LogoutConfirmDialog,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Confirmación de cierre de sesión. A diferencia de DeleteConfirmDialog, logout no es destructivo: icono neutro + botón primary (sin triángulo de warning ni danger). Evita el logout accidental. Soporta loading + error inline.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof LogoutConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  name: "Cerrando sesión (loading)",
  args: { loading: true },
};

export const WithError: Story = {
  name: "Con error",
  args: {
    error: "No pudimos cerrar tu sesión. Vuelve a intentar en unos segundos.",
  },
};
