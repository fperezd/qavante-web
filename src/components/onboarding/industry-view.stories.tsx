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
      name: "Retail",
      description: "Tiendas y venta al detalle.",
      business_family: "commerce",
      sort_order: 140,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "2",
      code: "professional_services",
      name: "Servicios profesionales",
      description: "Consultoras, estudios, agencias.",
      business_family: "professional",
      sort_order: 30,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "3",
      code: "construction",
      name: "Construcción",
      description: "Obras y proyectos.",
      business_family: "construction_projects",
      sort_order: 60,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "4",
      code: "gastronomy",
      name: "Gastronomía",
      description: "Restaurantes y cafeterías.",
      business_family: "hospitality",
      sort_order: 110,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
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
