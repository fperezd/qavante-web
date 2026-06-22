import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { IndustryView } from "./industry-view";

/* Paso 5 — Elegir rubro. Grid de plantillas de industria (real:
   `/api/management/industry-templates`); al continuar aplica `add_missing`.
   `useRouter` auto-mock (appDirectory). */

const TEMPLATES = {
  items: [
    {
      id: "1",
      code: "retail",
      name: "Retail / Comercio",
      description: "Tiendas y venta al detalle.",
    },
    {
      id: "2",
      code: "servicios",
      name: "Servicios profesionales",
      description: "Consultoras, estudios, agencias.",
    },
    { id: "3", code: "construccion", name: "Construcción", description: "Obras y proyectos." },
    {
      id: "4",
      code: "gastronomia",
      name: "Gastronomía",
      description: "Restaurantes y cafeterías.",
    },
  ],
};

const LIST = http.get("*/api/management/industry-templates", () =>
  HttpResponse.json(TEMPLATES, { status: 200 }),
);
const APPLY = http.post("*/api/management/industry-templates/*/apply", () =>
  HttpResponse.json({ mode: "add_missing", summary: {} }, { status: 200 }),
);
const EMPTY = http.get("*/api/management/industry-templates", () =>
  HttpResponse.json({ items: [] }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Onboarding / IndustryView",
  component: IndustryView,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: [LIST, APPLY] },
  },
} satisfies Meta<typeof IndustryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Grid de rubros" };
export const Vacio: Story = {
  name: "Sin rubros",
  parameters: { msw: { handlers: [EMPTY] } },
};
