import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ImportView } from "./import-view";

/* Paso 7 (final) — Traer datos. Dispara sync al montar; al finalizar completa el
   onboarding y va al panel. `useRouter` auto-mock (appDirectory). */

const SYNC_OK = http.post("*/api/onboarding/sync", () =>
  HttpResponse.json({ started: true }, { status: 200 }),
);
const SYNC_SLOW = http.post("*/api/onboarding/sync", async () => {
  await delay("infinite");
  return HttpResponse.json({ started: true }, { status: 200 });
});
const SYNC_ERR = http.post("*/api/onboarding/sync", () =>
  HttpResponse.json({ code: "error", detail: "x" }, { status: 500 }),
);
const COMPLETE = http.post("*/api/onboarding/complete", () =>
  HttpResponse.json({ completed: true }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Onboarding / ImportView",
  component: ImportView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [SYNC_OK, COMPLETE] },
  },
} satisfies Meta<typeof ImportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Listo: Story = { name: "Datos listos" };
export const Trayendo: Story = {
  name: "Trayendo (sync en curso)",
  parameters: { msw: { handlers: [SYNC_SLOW, COMPLETE] } },
};
export const SyncFalla: Story = {
  name: "Sync falla (segundo plano)",
  parameters: { msw: { handlers: [SYNC_ERR, COMPLETE] } },
};
