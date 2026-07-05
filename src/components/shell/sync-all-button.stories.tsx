import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { SyncAllButton } from "./sync-all-button";

/* Botón "Actualizar" global (SII + banco). Dispara POST /api/onboarding/sync y
   gira mientras corre. */

const OK = http.post("*/api/onboarding/sync", async () => {
  await delay(1500);
  return HttpResponse.json({ sources: { sii: { status: "ok" }, bank: { status: "ok" } } });
});
const PARCIAL = http.post("*/api/onboarding/sync", async () => {
  await delay(1500);
  return HttpResponse.json({ sources: { sii: { status: "ok" }, bank: { status: "failed" } } });
});

const meta = {
  title: "Capa 2 / Shell / SyncAllButton",
  component: SyncAllButton,
  parameters: { layout: "centered", msw: { handlers: [OK] } },
} satisfies Meta<typeof SyncAllButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Actualizar (todo ok)" };
export const Parcial: Story = {
  name: "Con una fuente que falla",
  parameters: { msw: { handlers: [PARCIAL] } },
};
