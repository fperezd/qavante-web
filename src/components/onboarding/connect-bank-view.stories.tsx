import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ConnectBankView } from "./connect-bank-view";

/* Paso 4 — Conectar banco (BICE: RUT + clave de acceso). Usa
   `PUT /api/credentials/bice`. Paso DIFERIBLE ("Conectar después").
   `useRouter` auto-mock (appDirectory). */

const OK = http.put("*/api/credentials/bice", () => new HttpResponse(null, { status: 200 }));
const ERROR = http.put("*/api/credentials/bice", () =>
  HttpResponse.json({ code: "invalid_credentials", detail: "Clave inválida." }, { status: 422 }),
);

const statusHandler = (bank: boolean) =>
  http.get("*/api/onboarding/status", () =>
    HttpResponse.json(
      {
        completed: false,
        completed_at: null,
        steps: { sii_connected: false, bank_connected: bank },
      },
      { status: 200 },
    ),
  );

const BICE_ACCOUNTS = http.get("*/api/bank-movements/bice/accounts", () =>
  HttpResponse.json(
    {
      accounts: [
        {
          external_id: "12-34567-8",
          name: "Cta Cte CLP",
          currency: "CLP",
          linked_bank_account_id: null,
        },
      ],
    },
    { status: 200 },
  ),
);

const meta = {
  title: "Capa 2 / Onboarding / ConnectBankView",
  component: ConnectBankView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK, statusHandler(false)] },
  },
} satisfies Meta<typeof ConnectBankView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Formulario (con 'Conectar después')" };
export const ErrorCredencial: Story = {
  name: "Error (clave inválida)",
  parameters: { msw: { handlers: [ERROR, statusHandler(false)] } },
};
export const YaConectado: Story = {
  name: "Banco conectado → cuentas por vincular",
  parameters: { msw: { handlers: [OK, statusHandler(true), BICE_ACCOUNTS] } },
};
