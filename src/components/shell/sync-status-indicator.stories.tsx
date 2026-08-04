import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { SyncStatusIndicator } from "./sync-status-indicator";

/* Indicador de sincronización del header. `GET /api/sources/status`. */

/** `bankState` = estado del banco (lo que varía por story); `tgrState` = estado de TGR (por defecto
 *  "error", como en prod: requiere el helper local). TGR se OCULTA del indicador (pedido de Fernando),
 *  así que su estado NO debe afectar el header. */
const sources = (bankState: string, tgrState = "error") =>
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
            state: bankState,
            last_sync: "2026-06-27T13:05:00Z",
            reason: bankState !== "ok" ? "Revisar la conexión del banco." : undefined,
          },
          {
            source: "tgr",
            display_name: "Tesorería (TGR)",
            category: "tax",
            state: tgrState,
            last_sync: "2026-06-20T09:00:00Z",
            reason: "session_expired: no hay sesión TGR cacheada.",
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

/* Warning del BANCO (no de TGR, que está oculto): banco desactualizado → header "Desactualizado". */
export const Desactualizado: Story = {
  name: "Desactualizado (warning)",
  parameters: { msw: { handlers: [sources("stale")] } },
};
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
/* TGR OCULTO (pedido de Fernando 2026-08-04): aunque TGR esté en error (session_expired), como el resto
   está OK el header queda "Actualizado" — TGR no ensucia el indicador ni aparece en el detalle. La
   lógica (filtrar TGR + agregar) se testea en `sources-status.test.ts` (el runner de Storybook NO corre
   MSW, así que acá va sin `play` — smoke visual en la UI de Storybook con el addon MSW). */
export const TgrOcultoNoEnsucia: Story = {
  name: "TGR en error → oculto, header limpio",
  parameters: { msw: { handlers: [sources("ok", "error")] } },
};
