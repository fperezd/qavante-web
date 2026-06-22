import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { VerifyEmailView } from "./verify-email-view";

/* Paso 2 del onboarding — Verificar email. Sin `?token` (recién venís del
   signup) muestra el estado "te enviamos un correo" + reenviar. Los estados con
   token (verificando / éxito / error) corren por el link del correo en runtime;
   acá el snapshot cubre el estado de espera. */

const RESEND = http.post("*/api/auth/resend-verification", () =>
  HttpResponse.json(null, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Onboarding / VerifyEmailView",
  component: VerifyEmailView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [RESEND] },
  },
} satisfies Meta<typeof VerifyEmailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinToken: Story = { name: "Esperando verificación (revisá tu correo)" };
