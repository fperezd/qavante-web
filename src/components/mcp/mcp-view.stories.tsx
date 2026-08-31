import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { within, expect } from "storybook/test";
import { McpView } from "./mcp-view";

/* Administración → MCP (`/administracion/mcp`), flag `mcp` (ADR-0092) — ON en prod hoy
 * (`wrangler.toml: NEXT_PUBLIC_FF_MCP = "true"`), corroborado por
 * `tests/e2e/mcp.flow.spec.ts` ("flag `mcp`, ON en e2e"). Lo que se fija acá: la frase FIJA de la
 * spec (ESPECIFICACION §V12, 12C Estructura · MCP — QA §5.10, "textos legales/fijos ... presentes
 * literalmente") se pinta SIEMPRE, sin depender de `conn.data.docs` (hallazgo de revisión PR #95:
 * este componente no tenía ni un test antes).
 *
 * El texto esperado va HARDCODEADO acá (copiado de `ESPECIFICACION.md:165`), NO importado desde
 * `MCP_FRASE_SOLO_LECTURA` de `mcp-view.tsx` — importar la MISMA constante que el componente pinta
 * volvería el assert tautológico (un mutante que cambia la frase en la fuente cambiaría el string
 * esperado exactamente igual, y el test nunca podría ponerse rojo). */
const FRASE_ESPERADA_SPEC = "el asistente solo lee — nunca clasifica, concilia ni mueve plata";

const CONNECTION_OK = http.get("*/api/mcp/connection", () =>
  HttpResponse.json(
    {
      server_url: "https://mcp.qavante.com",
      auth_header: "X-Api-Key",
      auth_bearer: "Bearer <API-key>",
      writes_enabled: false,
      oauth_enabled: false,
      has_api_key: true,
      docs: {
        resumen: "Conecta las finanzas de tu empresa a un asistente (Claude, ChatGPT) por MCP.",
        pasos: ["Copia o crea la API-key de tu empresa acá."],
        clientes: [
          { nombre: "Claude / ChatGPT vía API", soportado: true, nota: "Header X-Api-Key." },
        ],
      },
    },
    { status: 200 },
  ),
);

const CONNECTION_ERROR = http.get("*/api/mcp/connection", () =>
  HttpResponse.json({ code: "internal_error", detail: "no disponible" }, { status: 500 }),
);

const KEYS_VACIO = http.get("*/api/admin/api-keys", () =>
  HttpResponse.json({ items: [] }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / MCP / McpView",
  component: McpView,
  parameters: {
    layout: "padded",
    msw: { handlers: [CONNECTION_OK, KEYS_VACIO] },
  },
} satisfies Meta<typeof McpView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal — /api/mcp/connection responde",
  parameters: { msw: { handlers: [CONNECTION_OK, KEYS_VACIO] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La frase se pinta LITERAL — carácter por carácter con ESPECIFICACION.md, no parafraseada.
    await expect(await canvas.findByText(FRASE_ESPERADA_SPEC)).toBeInTheDocument();
  },
};

export const SinRespuestaDelBackend: Story = {
  name: "/api/mcp/connection cae (500) — la frase NO depende del backend",
  parameters: { msw: { handlers: [CONNECTION_ERROR, KEYS_VACIO] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Aunque `conn.data` nunca llega (fallback estático de URL/Header), la garantía de "solo
    // lee" es del producto, no un dato del contrato — sigue presente.
    await expect(await canvas.findByText(FRASE_ESPERADA_SPEC)).toBeInTheDocument();
  },
};
