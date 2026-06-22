import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { SignupView } from "./signup-view";

/* Paso 1 del onboarding — Crear cuenta. RHF + zod, `useRouter` (auto-mock de
   @storybook/nextjs-vite vía appDirectory). FE-first: `POST /api/auth/signup`
   aún no existe; el snapshot captura el form vacío. */

const OK = http.post("*/api/auth/signup", () =>
  HttpResponse.json(
    { status: "pending_verification", message: "Te enviamos un correo de verificación." },
    { status: 200 },
  ),
);
const CONFLICT = http.post("*/api/auth/signup", () =>
  HttpResponse.json({ code: "conflict", detail: "Ese email ya está registrado." }, { status: 409 }),
);

const meta = {
  title: "Capa 2 / Onboarding / SignupView",
  component: SignupView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof SignupView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Formulario" };
export const ErrorDuplicado: Story = {
  name: "Error (email duplicado)",
  parameters: { msw: { handlers: [CONFLICT] } },
};
