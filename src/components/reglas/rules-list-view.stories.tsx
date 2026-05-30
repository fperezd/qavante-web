import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { RulesListView } from "./rules-list-view";
import type { ClassificationRule } from "@/lib/api/classification-rules";

/* RulesListView — container de `/administracion/reglas-clasificacion`. Usa
   `useClassificationRules` para loading/error/empty/lista (el toggle activo
   y el form son por interacción). Handlers MSW para `GET /api/treasury/
   classification-rules` (respuesta `{ items }`, orden por priority ASC). */

const RULES: ClassificationRule[] = [
  {
    id: "rule-1",
    name: "Sueldo Fernando",
    source_type: "bank_movement",
    condition_field: "description",
    operator: "contains",
    condition_value: "REMUN FERNANDO",
    canonical_category: "payroll",
    management_account_id: "acc-9",
    dimension_assignments: [],
    priority: 10,
    confidence: "0.95",
    active: true,
    created_by: "u_owner_01",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: null,
  },
  {
    id: "rule-2",
    name: "Proveedor Movistar",
    source_type: "bank_movement",
    condition_field: "counterparty_name",
    operator: "equals",
    condition_value: "TELEFONICA CHILE S.A.",
    canonical_category: "supplier_payment",
    management_account_id: "acc-12",
    dimension_assignments: [],
    priority: 50,
    confidence: "0.90",
    active: true,
    created_by: "u_owner_01",
    created_at: "2026-05-03T10:00:00Z",
    updated_at: null,
  },
  {
    id: "rule-3",
    name: "Transferencia banco — desactivada",
    source_type: "bank_movement",
    condition_field: "description",
    operator: "starts_with",
    condition_value: "TRANSF",
    canonical_category: "internal_transfer",
    management_account_id: null,
    dimension_assignments: [],
    priority: 90,
    confidence: "0.70",
    active: false,
    created_by: "u_admin_01",
    created_at: "2026-04-20T10:00:00Z",
    updated_at: "2026-05-10T15:00:00Z",
  },
];

const PATH = "*/api/treasury/classification-rules";

const OK = http.get(PATH, () => HttpResponse.json({ items: RULES }, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: RULES }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar las reglas." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Reglas / RulesListView",
  component: RulesListView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Lista de reglas de clasificación (orden por prioridad ASC). El container resuelve loading/error/empty/lista desde `GET /api/treasury/classification-rules`. Toggle activo y form de regla son por interacción. Qavante nunca borra reglas — las desactivadas se muestran apagadas pero reactivables.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof RulesListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lista: Story = {
  name: "Lista (activas + desactivada)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin reglas)",
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
