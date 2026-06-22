import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { MiCuentaView } from "./mi-cuenta-view";
import type { MeResponse } from "@/lib/api/users";

/* MiCuentaView — contenedor con hooks (`useMe`, `useLogout`). Para
   story-earlo necesitamos MSW handlers que reproduzcan los 3 estados del
   wrapper sobre `/api/me`:
   - cargando (handler colgado → skeleton),
   - error (500 → QavanteInlineError),
   - éxito (200 con MeResponse → render del perfil + logout).

   El éxito presentacional ya se cubre exhaustivamente en
   `mi-cuenta-view.stories.tsx` (MiCuentaContent con args por rol). Acá el
   foco son los estados loading/error del contenedor, que esas stories no
   ejercitan. */

const ME_OK: MeResponse = {
  user: {
    id: "6c25a9b0-d100-4881-a372-a91748fecd9a",
    email: "fperez@tooxs.com",
    role: "owner",
    tenant_id: "a1d8143e-a1f7-410b-ac60-e7f15708488c",
    onboarding_completed: true,
    name: "Fernando Perez",
    last_login_at: "2026-05-28T15:40:13.929323Z",
    permissions: [],
  },
};

const ME_LOADING = http.get("*/api/me", async () => {
  /* Cuelga la request indefinidamente → el snapshot captura el skeleton. */
  await delay("infinite");
  return HttpResponse.json(ME_OK, { status: 200 });
});

const ME_ERROR = http.get("*/api/me", () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar tu cuenta." },
    { status: 500 },
  ),
);

const ME_SUCCESS = http.get("*/api/me", () => HttpResponse.json(ME_OK, { status: 200 }));

const meta = {
  title: "Mi cuenta / MiCuentaView (estados)",
  component: MiCuentaView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Contenedor de la pantalla Mi cuenta. Envuelve `MiCuentaContent` con `useMe()` y maneja los estados loading (skeleton) y error (inline). Las stories activan MSW handlers para reproducir cada estado del fetch a `/api/me`.",
      },
    },
    msw: { handlers: [ME_SUCCESS] },
  },
} satisfies Meta<typeof MiCuentaView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  parameters: {
    docs: {
      description: {
        story: "`/api/me` colgado → skeleton animado mientras llega la respuesta.",
      },
    },
    msw: { handlers: [ME_LOADING] },
  },
};

export const Error500: Story = {
  name: "Error (500)",
  parameters: {
    docs: {
      description: {
        story: "`/api/me` devuelve 500 → QavanteInlineError con copy 'tu cuenta'.",
      },
    },
    msw: { handlers: [ME_ERROR] },
  },
};

export const Exitoso: Story = {
  name: "Éxito (perfil + logout)",
  parameters: {
    docs: {
      description: {
        story: "`/api/me` 200 → perfil completo (owner) + botón Cerrar sesión.",
      },
    },
    msw: { handlers: [ME_SUCCESS] },
  },
};
