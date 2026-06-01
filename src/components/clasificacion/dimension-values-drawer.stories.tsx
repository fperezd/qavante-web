import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { DimensionValuesDrawer } from "./dimension-values-drawer";
import type { ManagementDimensionValue } from "@/lib/api/management";

/* Drawer del editor de valores de una dimensión. Usa `useDimensionValues`
   (GET /api/management/dimensions/{id}/values). MSW reproduce los estados. */

const base = {
  dimension_id: "dim-1",
  parent_id: null as string | null,
  code: null as string | null,
  description: null as string | null,
  path: null as string | null,
  sort_order: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const VALUES: ManagementDimensionValue[] = [
  { ...base, id: "n", name: "Zona Norte", code: "N", sort_order: 0 },
  { ...base, id: "n1", name: "Obra Antofagasta", code: "N-01", parent_id: "n", sort_order: 0 },
  { ...base, id: "n2", name: "Obra Calama", parent_id: "n", sort_order: 1, active: false },
  { ...base, id: "s", name: "Zona Sur", code: "S", sort_order: 1 },
];

const PATH = "*/api/management/dimensions/*/values";
const OK = http.get(PATH, () => HttpResponse.json({ items: VALUES }, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: VALUES }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json({ code: "internal_error", detail: "No se pudo." }, { status: 500 }),
);

const meta = {
  title: "Capa 2 / Clasificación / DimensionValuesDrawer",
  component: DimensionValuesDrawer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Editor del árbol de valores de una dimensión (drawer). Crear/editar/mover/activar valores. (Endpoint aún api-key-only — pantalla no activable hasta que el backend extienda ADR-0027.)",
      },
    },
    msw: { handlers: [OK] },
  },
  args: {
    open: true,
    onOpenChange: () => {},
    dimension: { id: "dim-1", name: "Centro de costo" },
  },
} satisfies Meta<typeof DimensionValuesDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConValores: Story = {
  name: "Con valores (árbol)",
  parameters: { msw: { handlers: [OK] } },
};
export const Vacio: Story = {
  name: "Sin valores",
  parameters: { msw: { handlers: [EMPTY] } },
};
export const Cargando: Story = {
  parameters: { msw: { handlers: [LOADING] } },
};
export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [ERROR] } },
};
