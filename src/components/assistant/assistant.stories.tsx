import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { Assistant } from "./assistant";

/* Asistente Qavante (Sprint C9, Anexo G). Botón flotante → drawer con chat
   read-only. Contrato FE-first (endpoint aún no existe). Wire format ADR-0004:
   el FE renderiza SOLO content + tools_used + sources; ignora `reasoning`. El
   drawer arranca cerrado: en la story, hacé click en "Preguntar a Qavante". */

const PATH = "*/api/assistant/chat";

const OK = http.post(PATH, () =>
  HttpResponse.json(
    {
      content:
        "Tu caja proyectada para los próximos 14 días es de $5,4M y cubre las obligaciones críticas. Lo que más mueve tu Pulso ahora es la cobranza vencida ($7,9M).",
      reasoning: "internal trace omitted from client response",
      tools_used: ["caja", "cobranza", "pulso"],
      sources: [
        { type: "screen", url: "/caja/proyeccion", label: "Caja proyectada" },
        { type: "screen", url: "/cobrar", label: "Cobranza" },
      ],
    },
    { status: 200 },
  ),
);
const SLOW = http.post(PATH, async () => {
  await delay(1500);
  return HttpResponse.json({ content: "Listo.", tools_used: [], sources: [] }, { status: 200 });
});
const ERROR = http.post(PATH, () =>
  HttpResponse.json({ code: "internal_error", detail: "Falló." }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Asistente / Assistant",
  component: Assistant,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Asistente Qavante (C9, Anexo G): chat read-only. Renderiza solo content + tools_used (chips) + sources (links), ignora reasoning (ADR-0004). Hacé click en el botón flotante para abrir.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof Assistant>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { parameters: { msw: { handlers: [OK] } } };
export const Lento: Story = {
  name: "Respuesta lenta (pensando…)",
  parameters: { msw: { handlers: [SLOW] } },
};
export const Error500: Story = { name: "Error (500)", parameters: { msw: { handlers: [ERROR] } } };
