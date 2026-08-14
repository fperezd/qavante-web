import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { PendingConnectionsBanner } from "./pending-connections-banner";

/* Entrada visible para retomar una conexión diferida. Solo aparece con el
   onboarding completado y alguna fuente sin conectar. */

const statusHandler = (sii: boolean, bank: boolean, completed: boolean) =>
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

const meta = {
  title: "Capa 2 / Onboarding / PendingConnectionsBanner",
  component: PendingConnectionsBanner,
  parameters: {
    nextjs: { appDirectory: true },
    msw: { handlers: [statusHandler(false, false, true)] },
  },
} satisfies Meta<typeof PendingConnectionsBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DosPendientes: Story = { name: "Faltan SII y banco" };

export const UnaPendiente: Story = {
  name: "Falta solo el banco",
  parameters: { msw: { handlers: [statusHandler(true, false, true)] } },
};

export const Oculto: Story = {
  name: "Todo conectado (no se muestra)",
  parameters: { msw: { handlers: [statusHandler(true, true, true)] } },
};

export const OcultoSinCompletar: Story = {
  name: "Onboarding sin completar (lo maneja el guard)",
  parameters: { msw: { handlers: [statusHandler(false, false, false)] } },
};
