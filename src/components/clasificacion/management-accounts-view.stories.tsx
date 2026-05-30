import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { ManagementAccountsView } from "./management-accounts-view";
import type { ManagementAccountTreeResponse } from "@/lib/api/management";

/* ManagementAccountsView — container de `/administracion/estructura-gestion`.
   Usa `useManagementAccountsTree` para loading/error/empty/árbol; crear/editar/
   mover es por interacción. Handler MSW para `GET /api/management/accounts/tree`.
   Endpoint desbloqueado por ADR-0027 — pantalla activable en prod. */

type Node = ManagementAccountTreeResponse["items"][number];

const base = {
  destination: "cash_flow",
  level: 0,
  sort_order: 0,
  is_system: false,
  is_visible: true,
  affects_pulso: true,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const TREE: Node[] = [
  {
    ...base,
    id: "ma-1",
    code: "1",
    name: "Ingresos",
    type: "income",
    children: [
      {
        ...base,
        id: "ma-1-1",
        code: "1.1",
        name: "Ventas",
        type: "income",
        level: 1,
        parent_id: "ma-1",
      },
      {
        ...base,
        id: "ma-1-2",
        code: "1.2",
        name: "Otros ingresos",
        type: "income",
        level: 1,
        parent_id: "ma-1",
      },
    ],
  },
  {
    ...base,
    id: "ma-2",
    code: "2",
    name: "Gastos operativos",
    type: "operating_expense",
    children: [
      {
        ...base,
        id: "ma-2-1",
        code: "2.1",
        name: "Arriendo",
        type: "operating_expense",
        level: 1,
        parent_id: "ma-2",
      },
      {
        ...base,
        id: "ma-2-2",
        code: "2.2",
        name: "Sueldos",
        type: "operating_expense",
        level: 1,
        parent_id: "ma-2",
      },
    ],
  },
];

const PATH = "*/api/management/accounts/tree*";

const OK = http.get(PATH, () => HttpResponse.json({ items: TREE }, { status: 200 }));
const EMPTY = http.get(PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const LOADING = http.get(PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: TREE }, { status: 200 });
});
const ERROR = http.get(PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar la estructura de gestión." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Clasificación / ManagementAccountsView",
  component: ManagementAccountsView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Árbol de cuentas de gestión (`/administracion/estructura-gestion`). El container resuelve loading/error/empty/árbol desde `GET /api/management/accounts/tree`. Crear/editar/mover por interacción. Endpoint desbloqueado por ADR-0027.",
      },
    },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof ManagementAccountsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Arbol: Story = {
  name: "Árbol (ingresos + gastos)",
  parameters: { msw: { handlers: [OK] } },
};

export const Vacio: Story = {
  name: "Vacío (sin estructura)",
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
