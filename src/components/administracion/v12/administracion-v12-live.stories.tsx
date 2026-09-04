import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { within, expect } from "storybook/test";
import { AdministracionV12Live } from "./administracion-v12-live";

/* V12 · Administración — el hub CABLEADO (`AdministracionV12Live`), no sólo la vista pura.
 *
 * Hallazgo de revisión (PR #95): mientras `/api/sources/status`, `/api/me/tenants` y
 * `/api/users` están en vuelo, las TRES filas que sí calculan estado (Credenciales, Empresas,
 * Usuarios) se veían IDÉNTICAS a las 6 filas con hueco declarado (celda en blanco) — Ley 8 lo
 * prohíbe: "Cargando…' infinito prohibido" es sobre el TEXTO que falta, no sobre confundir "está
 * en camino" con "esto nunca va a tener dato". Estas tres stories fijan que cada uno de los tres
 * estados (cargando/error/listo) pinta algo DISTINTO — y que una fuente caída no tumba a las
 * otras dos (mismo criterio que el docstring de `AdministracionV12Live`). */

const SOURCES_PATH = "*/api/sources/status";
const TENANTS_PATH = "*/api/me/tenants";
const USERS_PATH = "*/api/users";

const SOURCES_OK = http.get(SOURCES_PATH, () =>
  HttpResponse.json({ sources: [], count: 0 }, { status: 200 }),
);
const SOURCES_CARGANDO = http.get(SOURCES_PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ sources: [], count: 0 }, { status: 200 });
});
const SOURCES_ERROR = http.get(SOURCES_PATH, () =>
  HttpResponse.json({ code: "internal_error", detail: "no disponible" }, { status: 500 }),
);

const TENANTS_OK = http.get(TENANTS_PATH, () =>
  HttpResponse.json(
    {
      tenants: [
        {
          id: "t1",
          slug: "tooxs",
          legal_name: "Tooxs Digital SpA",
          role: "owner",
          is_active: true,
        },
        {
          id: "t2",
          slug: "otra",
          legal_name: "Otra Empresa Ltda",
          role: "admin",
          is_active: false,
        },
      ],
    },
    { status: 200 },
  ),
);
const TENANTS_CARGANDO = http.get(TENANTS_PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ tenants: [] }, { status: 200 });
});

const USERS_OK = http.get(USERS_PATH, () =>
  HttpResponse.json({ items: [], total: 5, page: 1, page_size: 20 }, { status: 200 }),
);
const USERS_CARGANDO = http.get(USERS_PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }, { status: 200 });
});

const meta = {
  title: "Rediseño F2 / V12 Administración (cableado)",
  component: AdministracionV12Live,
  parameters: { layout: "padded" },
  args: { mcp: false },
} satisfies Meta<typeof AdministracionV12Live>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Las tres fuentes responden",
  parameters: { msw: { handlers: [SOURCES_OK, TENANTS_OK, USERS_OK] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("2 empresas")).toBeInTheDocument();
    await expect(await canvas.findByText("5 usuarios")).toBeInTheDocument();
    await expect(await canvas.findByText("Al día")).toBeInTheDocument();
    // Sin "Cargando…" colgado y sin pill de error una vez que las tres respondieron.
    await expect(canvas.queryByText(/^Cargando /)).not.toBeInTheDocument();
    await expect(canvas.queryByText("No se pudo cargar")).not.toBeInTheDocument();
  },
};

export const Cargando: Story = {
  name: "Las tres en vuelo · NO se ven como las filas sin hueco (hueco ≠ cargando)",
  parameters: { msw: { handlers: [SOURCES_CARGANDO, TENANTS_CARGANDO, USERS_CARGANDO] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Las 3 filas con fuente muestran "Cargando <qué>…" (§5.4 — nunca la palabra sola) — nunca
    // una celda en blanco indistinguible del hueco declarado (Estructura de gestión, Monedas,
    // etc., que SÍ quedan en blanco a propósito).
    await expect(await canvas.findByText("Cargando credenciales…")).toBeInTheDocument();
    await expect(await canvas.findByText("Cargando empresas…")).toBeInTheDocument();
    await expect(await canvas.findByText("Cargando usuarios…")).toBeInTheDocument();
    const cargando = await canvas.findAllByText(/^Cargando /);
    await expect(cargando).toHaveLength(3);
    // Control positivo del punto anterior: las filas CON hueco declarado siguen sin pill.
    await expect(canvas.getByText("Monedas")).toBeInTheDocument();
    await expect(canvas.queryByText("2 empresas")).not.toBeInTheDocument();
  },
};

export const UnaFuenteCaida: Story = {
  name: "Fuentes cae (500) · Empresas y Usuarios NO se tumban con ella",
  parameters: { msw: { handlers: [SOURCES_ERROR, TENANTS_OK, USERS_OK] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La fuente caída lo DICE — nunca se pinta como "sin dato" (blanco).
    await expect(await canvas.findByText("No se pudo cargar")).toBeInTheDocument();
    // Las otras dos igual muestran su estado real: una consulta caída no tumba a las demás.
    await expect(await canvas.findByText("2 empresas")).toBeInTheDocument();
    await expect(await canvas.findByText("5 usuarios")).toBeInTheDocument();
  },
};
