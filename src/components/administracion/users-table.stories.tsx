import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { UsersTable } from "./users-table";
import type { User } from "@/lib/api/users";

const OWNER: User = {
  id: "u-1",
  email: "fernando@tooxs.com",
  name: "Fernando Pérez",
  role: "owner",
  status: "active",
  last_login_at: "2026-05-13T14:32:00Z",
  invited_at: null,
  created_at: "2026-01-15T09:00:00Z",
};
const ACCOUNTANT: User = {
  id: "u-2",
  email: "contadora@empresa.cl",
  name: "Marta Soto",
  role: "accountant",
  status: "active",
  last_login_at: "2026-05-12T08:15:00Z",
  invited_at: null,
  created_at: "2026-02-20T11:00:00Z",
};
const INVITED_VIEWER: User = {
  id: "u-3",
  email: "asistente@empresa.cl",
  name: null,
  role: "viewer",
  status: "invited",
  last_login_at: null,
  invited_at: "2026-05-10T16:00:00Z",
  created_at: "2026-05-10T16:00:00Z",
};
const SUSPENDED: User = {
  id: "u-4",
  email: "exsuspendido@empresa.cl",
  name: "Juan Soto",
  role: "finance_manager",
  status: "suspended",
  last_login_at: "2026-03-01T10:00:00Z",
  invited_at: null,
  created_at: "2026-01-30T10:00:00Z",
};

const SEED_USERS: User[] = [OWNER, ACCOUNTANT, INVITED_VIEWER, SUSPENDED];

const meta = {
  title: "Capa 2 / Administración / UsersTable",
  component: UsersTable,
  parameters: {
    docs: {
      description: {
        component:
          "Tabla TanStack con 5 cols (nombre, email, rol inline-editable, estado, último login) + columna de acciones (suspender/reactivar/cancelar invitación). Anexo C.4 + Anexo F.",
      },
    },
    layout: "padded",
  },
  args: {
    onSuspendClick: fn(),
    canAssignOwner: true,
  },
} satisfies Meta<typeof UsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { users: SEED_USERS },
};

export const Empty: Story = {
  args: { users: [] },
  parameters: {
    docs: {
      description: {
        story:
          "Sin usuarios. La página (`/administracion/usuarios`) muestra un `QavanteEmpty` arriba; este story muestra cómo se ve la tabla en sí cuando se renderea sin datos.",
      },
    },
  },
};

export const SingleOwner: Story = {
  args: { users: [OWNER] },
};

export const InvitedOnly: Story = {
  args: { users: [INVITED_VIEWER] },
};

export const SuspendedOnly: Story = {
  args: { users: [SUSPENDED] },
};

export const AsAdminNotOwner: Story = {
  args: { users: SEED_USERS, canAssignOwner: false },
  parameters: {
    docs: {
      description: {
        story:
          "Cuando el usuario logueado es `admin` (no `owner`), el inline-edit de rol oculta la opción `owner` (no puede promover a alguien a owner).",
      },
    },
  },
};
