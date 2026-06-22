import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ConnectBankView } from "./connect-bank-view";

/* Paso 4 — Conectar banco (BICE: RUT + clave de acceso). Usa
   `PUT /api/credentials/bice`. Paso opcional. `useRouter` auto-mock (appDirectory). */

const OK = http.put("*/api/credentials/bice", () => new HttpResponse(null, { status: 200 }));
const ERROR = http.put("*/api/credentials/bice", () =>
  HttpResponse.json({ code: "invalid_credentials", detail: "Clave inválida." }, { status: 422 }),
);

const meta = {
  title: "Capa 2 / Onboarding / ConnectBankView",
  component: ConnectBankView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof ConnectBankView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Formulario" };
export const ErrorCredencial: Story = {
  name: "Error (clave inválida)",
  parameters: { msw: { handlers: [ERROR] } },
};
