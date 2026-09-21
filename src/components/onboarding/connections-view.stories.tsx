import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ConnectionsView } from "./connections-view";

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

const FINTOC_CONNECTIONS = http.get("*/api/fintoc/connections", () =>
  HttpResponse.json(
    [
      {
        institution_id: "cl_banco_de_chile",
        institution_name: "Banco de Chile",
        holder_id: null,
        holder_rut: null,
        holder_name: null,
        holder_type: "business",
        status: "connected",
        mode: "live",
        data_source: "fintoc",
      },
    ],
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
    msw: { handlers: [statusHandler(false, false), FINTOC_CONNECTIONS] },
  },
} satisfies Meta<typeof ConnectionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NadaConectado: Story = { name: "Ninguna fuente conectada" };

export const BancoConectado: Story = {
  name: "Banco conectado",
  parameters: { msw: { handlers: [statusHandler(false, true), FINTOC_CONNECTIONS] } },
};

export const TodoConectado: Story = {
  name: "Todo conectado",
  parameters: { msw: { handlers: [statusHandler(true, true), FINTOC_CONNECTIONS] } },
};

export const Cargando: Story = {
  name: "Cargando (no afirma estados)",
  parameters: { msw: { handlers: [STATUS_SLOW] } },
};

export const ErrorStatus: Story = {
  name: "Error al leer el estado",
  parameters: { msw: { handlers: [STATUS_ERR] } },
};
