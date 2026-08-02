import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { SyncStatusIndicator } from "./sync-status-indicator";

/* Indicador de sincronización del header. `GET /api/sources/status`. */

const sources = (state: string) =>
  http.get("*/api/sources/status", () =>
    HttpResponse.json(
      {
        sources: [
          {
            source: "sii_rcv",
            display_name: "SII",
            category: "tax",
            state: "ok",
            last_sync: "2026-06-27T12:30:00Z",
          },
          {
            source: "bice",
            display_name: "Banco BICE",
            category: "bank",
            state,
            last_sync: "2026-06-27T13:05:00Z",
            reason: state !== "ok" ? "Revisar la conexión del banco." : undefined,
          },
          {
            source: "tgr",
            display_name: "Tesorería (TGR)",
            category: "tax",
            state: "stale",
            last_sync: "2026-06-20T09:00:00Z",
            reason: "Hace más de 5 días.",
          },
        ],
        count: 3,
      },
      { status: 200 },
    ),
  );

const meta = {
  title: "Capa 2 / Shell / SyncStatusIndicator",
  component: SyncStatusIndicator,
  parameters: {
    layout: "centered",
    msw: { handlers: [sources("ok")] },
  },
} satisfies Meta<typeof SyncStatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desactualizado: Story = { name: "Desactualizado (warning)" };
export const ConErrores: Story = {
  name: "Con errores",
  parameters: { msw: { handlers: [sources("error")] } },
};
/* Banco caído: `unavailable` que YA sincronizó (tiene last_sync) → "Con fuentes caídas",
   distinto de "Con errores". Antes esta fuente desaparecía del header. */
export const Caida: Story = {
  name: "Con fuentes caídas (banco no disponible)",
  parameters: { msw: { handlers: [sources("unavailable")] } },
};
