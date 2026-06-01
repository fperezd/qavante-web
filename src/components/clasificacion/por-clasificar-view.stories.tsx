import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse, delay } from "msw";
import { PorClasificarView } from "./por-clasificar-view";
import type { BankMovement } from "@/lib/api/treasury";

/* PorClasificarView — container de `/caja/por-clasificar`. Usa 3 queries:
   `useBankMovements({status:'unclassified'})` (gate loading/error/empty),
   `useCanonicalCategories` + `useManagementAccountsTree` (opciones del
   clasificador, no bloquean el render). Handlers MSW para los 3 endpoints;
   canonical/accounts van vacíos (las opciones del dropdown no afectan el
   snapshot de la lista). Endpoint bank-movements desbloqueado por ADR-0027. */

const MOVEMENTS: BankMovement[] = [
  {
    id: "bm-1",
    bank_account_id: "acc-bice-1",
    external_id: "ext-001",
    date: "2026-05-15",
    description: "TRANSFERENCIA RECIBIDA JUAN PEREZ",
    amount: "1250000",
    direction: "credit",
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unmatched",
    classification_status: "unclassified",
    data_status: "available",
    imported_at: "2026-05-15T09:00:00Z",
  },
  {
    id: "bm-2",
    bank_account_id: "acc-bice-1",
    external_id: "ext-002",
    date: "2026-05-16",
    description: "PAGO PROVEEDOR TELEFONICA",
    amount: "89900",
    direction: "debit",
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unmatched",
    classification_status: "unclassified",
    data_status: "available",
    imported_at: "2026-05-16T09:00:00Z",
  },
];

const MOV_PATH = "*/api/bank-movements*";
const CANON_PATH = "*/api/treasury/canonical-categories";
const ACCT_PATH = "*/api/management/accounts/tree";

/* Opciones del clasificador vacías — no afectan el snapshot de la lista. */
const CANON_EMPTY = http.get(CANON_PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));
const ACCT_EMPTY = http.get(ACCT_PATH, () => HttpResponse.json({ items: [] }, { status: 200 }));

const MOV_OK = http.get(MOV_PATH, () =>
  HttpResponse.json({ items: MOVEMENTS, total: MOVEMENTS.length }, { status: 200 }),
);
const MOV_EMPTY = http.get(MOV_PATH, () =>
  HttpResponse.json({ items: [], total: 0 }, { status: 200 }),
);
const MOV_LOADING = http.get(MOV_PATH, async () => {
  await delay("infinite");
  return HttpResponse.json({ items: MOVEMENTS, total: MOVEMENTS.length }, { status: 200 });
});
const MOV_ERROR = http.get(MOV_PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar los movimientos." },
    { status: 500 },
  ),
);
/* Cuentas de gestión en 500: el bug de la raíz real (accounts/tree 500). */
const ACCT_ERROR = http.get(ACCT_PATH, () =>
  HttpResponse.json(
    { code: "internal_error", detail: "No pudimos cargar las cuentas de gestión." },
    { status: 500 },
  ),
);

const meta = {
  title: "Capa 2 / Clasificación / PorClasificarView",
  component: PorClasificarView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Bandeja de movimientos bancarios sin clasificar (`/caja/por-clasificar`). El container resuelve loading/error/empty/lista desde `GET /api/bank-movements?status=unclassified`. Clasificar es por interacción. Endpoint desbloqueado por ADR-0027.",
      },
    },
    msw: { handlers: [MOV_OK, CANON_EMPTY, ACCT_EMPTY] },
  },
} satisfies Meta<typeof PorClasificarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConMovimientos: Story = {
  name: "Con movimientos (sin clasificar)",
  parameters: { msw: { handlers: [MOV_OK, CANON_EMPTY, ACCT_EMPTY] } },
};

export const Vacio: Story = {
  name: "Vacío (todo clasificado)",
  parameters: { msw: { handlers: [MOV_EMPTY, CANON_EMPTY, ACCT_EMPTY] } },
};

export const Cargando: Story = {
  name: "Cargando (skeleton)",
  parameters: { msw: { handlers: [MOV_LOADING, CANON_EMPTY, ACCT_EMPTY] } },
};

export const Error500: Story = {
  name: "Error (500)",
  parameters: { msw: { handlers: [MOV_ERROR, CANON_EMPTY, ACCT_EMPTY] } },
};

/* rounds 1/2 #5: hay movimientos pero las cuentas de gestión fallan → banner
   explicativo + "Clasificar" deshabilitado (en vez de tragar el error). */
export const CuentasConError: Story = {
  name: "Movimientos OK pero cuentas en error (no se puede clasificar)",
  parameters: { msw: { handlers: [MOV_OK, CANON_EMPTY, ACCT_ERROR] } },
};
