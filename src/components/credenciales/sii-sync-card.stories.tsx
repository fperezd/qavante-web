import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { SiiSyncCard } from "./sii-sync-card";

/* Sincronizar SII (RCV). `POST /api/sii/sync-rcv?periodo`. Última sync vía
   /api/sources/status. */

const STATUS = http.get("*/api/sources/status", () =>
  HttpResponse.json(
    {
      sources: [
        { source: "sii_rcv", display_name: "SII", state: "ok", last_sync: "2026-06-27T10:15:30Z" },
      ],
    },
    { status: 200 },
  ),
);
const SYNC = http.post("*/api/sii/sync-rcv", () =>
  HttpResponse.json({ status: "ok" }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Credenciales / SiiSyncCard",
  component: SiiSyncCard,
  parameters: { layout: "centered", msw: { handlers: [STATUS, SYNC] } },
} satisfies Meta<typeof SiiSyncCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sincronizar: Story = {};
