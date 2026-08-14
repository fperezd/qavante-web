import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ConnectSiiView } from "./connect-sii-view";

/* Paso 3 — Conectar SII (RUT + clave tributaria). Reusa
   `/api/admin/sources/sii_rcv/credential`. `useRouter` auto-mock (appDirectory). */

const OK = http.post("*/api/admin/sources/sii_rcv/credential", () =>
  HttpResponse.json({ is_active: true }, { status: 200 }),
);
const ERROR = http.post("*/api/admin/sources/sii_rcv/credential", () =>
  HttpResponse.json({ code: "invalid_credentials", detail: "Clave inválida." }, { status: 422 }),
);

const statusHandler = (sii: boolean) =>
  http.get("*/api/onboarding/status", () =>
    HttpResponse.json(
      {
        completed: false,
        completed_at: null,
        steps: { sii_connected: sii, bank_connected: false },
      },
      { status: 200 },
    ),
  );

const meta = {
  title: "Capa 2 / Onboarding / ConnectSiiView",
  component: ConnectSiiView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK, statusHandler(false)] },
  },
} satisfies Meta<typeof ConnectSiiView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Formulario (con 'Conectar después')" };
export const ErrorCredencial: Story = {
  name: "Error (clave inválida)",
  parameters: { msw: { handlers: [ERROR, statusHandler(false)] } },
};
export const YaConectado: Story = {
  name: "SII ya conectado",
  parameters: { msw: { handlers: [OK, statusHandler(true)] } },
};
