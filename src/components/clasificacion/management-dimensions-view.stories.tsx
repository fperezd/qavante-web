import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ManagementDimensionsView } from "./management-dimensions-view";
import type { ManagementDimension } from "@/lib/api/management";

/* ManagementDimensionsView — container de `/administracion/vistas-gestion`.
   Usa `useManagementDimensions` para loading/error/empty/grid; el editor de
   valores jerárquicos es por interacción. Handler MSW para
   `GET /api/management/dimensions`.

   NOTA: este endpoint sigue api-key-only en prod (ADR-0027 NO lo cubrió) →
   la pantalla todavía NO es activable; la story es cobertura visual igual. */

const base = {
  description: null,
  is_system: false,
  is_required: false,
  is_visible: true,
  allows_hierarchy: false,
  allows_multiple_values: false,
  sort_order: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const DIMENSIONS: ManagementDimension[] = [
  {
    ...base,
    id: "dim-1",
    code: "centro_costo",
    name: "Centro de costo",
    data_type: "reference",
    allows_hierarchy: true,
    sort_order: 1,
  },
  {
    ...base,
    id: "dim-2",
    code: "proyecto",
    name: "Proyecto",
    data_type: "text",
    sort_order: 2,
  },
  {
    ...base,
    id: "dim-3",
    code: "margen",
    name: "Margen objetivo",
    data_type: "percentage",
    sort_order: 3,
  },
];

const PATH = "*/api/management/dimensions*";

const OK = http.get(PATH, () => HttpResponse.json({ items: DIMENSIONS }, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: DIMENSIONS }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar las vistas de gestión." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Clasificación / ManagementDimensionsView",
  component: ManagementDimensionsView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Vistas/dimensiones de gestión (`/administracion/vistas-gestion`). El container resuelve loading/error/empty/grid desde `GET /api/management/dimensions`. El editor de valores jerárquicos es por interacción. (Endpoint aún api-key-only — pantalla no activable hasta que el backend extienda ADR-0027.)",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof ManagementDimensionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {
  name: "Grid (3 dimensiones)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin dimensiones)",
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
