import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { InviteUserDialog } from "./invite-user-dialog";

const meta = {
  title: "Capa 2 / Administración / InviteUserDialog",
  component: InviteUserDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Modal de invitar usuario. Form con react-hook-form + zod: email (required + valid), nombre (opcional), rol (required). Anexo C.3 mapea `email_already_exists` y `invitation_already_pending` a copys es-CL.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof InviteUserDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { canAssignOwner: true },
};

export const OpenAsAdmin: Story = {
  args: { canAssignOwner: false },
  parameters: {
    docs: {
      description: {
        story:
          "Invocado por un admin (no owner). El selector de rol esconde la opción `owner` (no puede crear nuevos dueños).",
      },
    },
  },
};

export const Closed: Story = {
  args: { open: false, canAssignOwner: true },
  parameters: {
    docs: {
      description: {
        story: "Estado cerrado — render null. Story sólo para verificar que no rompe.",
      },
    },
  },
};
