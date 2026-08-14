import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ConnectionsView } from "./connections-view";

/* Hub de conexiones — punto de retorno de "conectar después". `useRouter`
   auto-mock (appDirectory). Estados honestos: mientras no se sabe el estado real
   NO se listan fuentes; si el status falla se dice, no se pinta "sin conectar". */

const statusHandler = (sii: boolean, bank: boolean, completed = true) =>
  http.get("*/api/onboarding/status", () =>
    HttpResponse.json(
      {
        completed,
        completed_at: completed ? "2026-08-14T12:00:00Z" : null,
        steps: { sii_connected: sii, bank_connected: bank },
      },
      { status: 200 },
    ),
  );

/* Cuentas BICE: solo se consulta con el banco conectado. */
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
        {
          external_id: "12-34567-9",
          name: "Cta Cte USD",
          currency: "USD",
          linked_bank_account_id: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
        },
      ],
    },
    { status: 200 },
  ),
);

const STATUS_SLOW = http.get("*/api/onboarding/status", async () => {
  await delay("infinite");
  return HttpResponse.json({}, { status: 200 });
});

const STATUS_ERR = http.get("*/api/onboarding/status", () =>
  HttpResponse.json({ code: "server_error", detail: "x" }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Onboarding / ConnectionsView",
  component: ConnectionsView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [statusHandler(false, false), BICE_ACCOUNTS] },
  },
} satisfies Meta<typeof ConnectionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NadaConectado: Story = { name: "Ninguna fuente conectada" };

export const BancoConectado: Story = {
  name: "Banco conectado (cuentas por vincular)",
  parameters: { msw: { handlers: [statusHandler(false, true), BICE_ACCOUNTS] } },
};

export const TodoConectado: Story = {
  name: "Todo conectado",
  parameters: { msw: { handlers: [statusHandler(true, true), BICE_ACCOUNTS] } },
};

export const Cargando: Story = {
  name: "Cargando (no afirma estados)",
  parameters: { msw: { handlers: [STATUS_SLOW] } },
};

export const ErrorDeEstado: Story = {
  name: "El estado no se pudo leer",
  parameters: { msw: { handlers: [STATUS_ERR] } },
};
