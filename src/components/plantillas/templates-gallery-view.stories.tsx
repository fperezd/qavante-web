import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { TemplatesGalleryView } from "./templates-gallery-view";
import type { IndustryTemplate } from "@/lib/api/industry-templates";

/* TemplatesGalleryView — container de `/administracion/plantillas`. Usa un
   solo query (`useIndustryTemplates`) para los estados loading/error/empty/
   galería; el preview/aplicar de cada card es por interacción (no afecta el
   snapshot). Las stories activan handlers MSW para `GET /api/management/
   industry-templates`. */

const BASE = {
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TEMPLATES: IndustryTemplate[] = [
  {
    ...BASE,
    id: "tpl_services",
    code: "services_basic",
    name: "Servicios profesionales",
    business_family: "professional",
    description: "Plan de cuentas base para consultoras, estudios y agencias.",
    is_active: true,
    sort_order: 1,
  },
  {
    ...BASE,
    id: "tpl_commerce",
    code: "commerce_retail",
    name: "Comercio minorista",
    business_family: "commerce",
    description: "Cuentas y vistas para retail con inventario.",
    is_active: true,
    sort_order: 2,
  },
  {
    ...BASE,
    id: "tpl_construction",
    code: "construction_projects",
    name: "Construcción por proyectos",
    business_family: "construction_projects",
    description: "Seguimiento por obra/proyecto.",
    is_active: false,
    sort_order: 3,
  },
];

const PATH = "*/api/management/industry-templates";

const OK = http.get(PATH, () => HttpResponse.json({ items: TEMPLATES }, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: TEMPLATES }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar las plantillas." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Plantillas / TemplatesGalleryView",
  component: TemplatesGalleryView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Galería de plantillas por rubro (§13/§14). El container resuelve loading/error/empty/galería desde `GET /api/management/industry-templates`. El preview (suggest_only) y aplicar (add_missing) de cada card son por interacción — nunca destructivos.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof TemplatesGalleryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Galeria: Story = {
  name: "Galería (con plantillas)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin plantillas)",
  parameters: { msw: { handlers: [EMPTY] } },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  parameters: { msw: { handlers: [LOADING] } },
};

export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR] } },
};
