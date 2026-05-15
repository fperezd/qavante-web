import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SuspendUserDialog } from "./suspend-user-dialog";
import type { User } from "@/lib/api/users";

const ACTIVE_USER: User = {
  id: "u-2",
  email: "contadora@empresa.cl",
  name: "Marta Soto",
  role: "accountant",
  status: "active",
  last_login_at: "2026-05-12T08:15:00Z",
  invited_at: null,
  created_at: "2026-02-20T11:00:00Z",
};

const SUSPENDED_USER: User = {
  ...ACTIVE_USER,
  id: "u-4",
  email: "exsuspendido@empresa.cl",
  status: "suspended",
};

const meta = {
  title: "Capa 2 / Administración / SuspendUserDialog",
  component: SuspendUserDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Confirm dialog reutilizado para 2 acciones: suspender un usuario activo y reactivar uno suspendido. El botón cambia copy + variant según el estado actual (`user.status`). Maneja `last_owner_protection` (409 del backend) con copy específico.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SuspendUserDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuspendActiveUser: Story = {
  args: { user: ACTIVE_USER },
};

export const ReactivateSuspendedUser: Story = {
  args: { user: SUSPENDED_USER },
};

export const NullUser: Story = {
  args: { user: null },
  parameters: {
    docs: {
      description: {
        story:
          "Cuando user es null el componente devuelve null (no renderea nada). Story sólo para verificar el guard.",
      },
    },
  },
};
