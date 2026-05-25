import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { ClasificadosView } from "./clasificados-view";

/* ClasificadosView — vista `/caja/clasificados` (Sprint C2, PR #174 + #176).
   Contenedor con hooks (`useBankMovements`, `useCanonicalCategories`,
   `useClassifyBankMovement`, `useManagementAccountsTree`). Stories activan
   MSW handlers inline. Fixtures minimalistas — cubren los casos visuales
   sin replicar el seed de tests. */

const CANONICAL_CATEGORIES = http.get("*/api/treasury/canonical-categories", () =>
  HttpResponse.json(
    {
      items: [
        {
          code: "client_collection",
          label: "Cobro de cliente",
          description: "Entrada de caja de cliente o deudor comercial.",
          expected_direction: "credit",
          cashflow_group: "cash_in",
          default_financial_model: "cash",
          default_impact_type: "operational",
          default_management_root: "ingresos",
          requires_review: false,
          affects_operational_result_by_default: true,
          is_internal_movement: false,
          allowed_for_bank_movement: true,
          sort_order: 10,
        },
        {
          code: "supplier_payment",
          label: "Pago a proveedor",
          description: "Pago comercial u operacional a proveedor.",
          expected_direction: "debit",
          cashflow_group: "cash_out",
          default_financial_model: "cash",
          default_impact_type: "operational",
          default_management_root: "costos",
          requires_review: false,
          affects_operational_result_by_default: true,
          is_internal_movement: false,
          allowed_for_bank_movement: true,
          sort_order: 40,
        },
        {
          code: "payroll_payment",
          label: "Sueldos",
          description: "Pago de remuneraciones.",
          expected_direction: "debit",
          cashflow_group: "cash_out",
          default_financial_model: "cash",
          default_impact_type: "operational",
          default_management_root: "costos",
          requires_review: false,
          affects_operational_result_by_default: true,
          is_internal_movement: false,
          allowed_for_bank_movement: true,
          sort_order: 50,
        },
        {
          code: "tax_payment",
          label: "Pago de impuestos",
          description: "Pago al fisco (F29, F22, etc).",
          expected_direction: "any",
          cashflow_group: "cash_out",
          default_financial_model: "cash",
          default_impact_type: "operational",
          default_management_root: "impuestos",
          requires_review: false,
          affects_operational_result_by_default: true,
          is_internal_movement: false,
          allowed_for_bank_movement: true,
          sort_order: 60,
        },
      ],
    },
    { status: 200 },
  ),
);

const ACCOUNTS_TREE_BASIC = http.get("*/api/management/accounts/tree", () =>
  HttpResponse.json(
    [
      {
        id: "acc-ingresos",
        code: "ingresos",
        name: "Ingresos",
        type: "income",
        parent_id: null,
        destination: "operational_income_statement",
        display_name: "Ingresos",
        description: null,
        level: 0,
        path: "ingresos",
        sort_order: 10,
        is_system: true,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [
          {
            id: "acc-ventas",
            code: "ingresos.ventas",
            name: "Ventas",
            type: "income",
            parent_id: "acc-ingresos",
            destination: "operational_income_statement",
            display_name: "Ventas",
            description: null,
            level: 1,
            path: "ingresos/ventas",
            sort_order: 10,
            is_system: false,
            is_visible: true,
            affects_pulso: true,
            active: true,
            created_at: "2026-01-01T00:00:00Z",
            children: [],
          },
        ],
      },
      {
        id: "acc-costos",
        code: "costos",
        name: "Costos",
        type: "expense",
        parent_id: null,
        destination: "operational_income_statement",
        display_name: "Costos",
        description: null,
        level: 0,
        path: "costos",
        sort_order: 20,
        is_system: true,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [
          {
            id: "acc-sueldos",
            code: "costos.sueldos",
            name: "Sueldos",
            type: "expense",
            parent_id: "acc-costos",
            destination: "operational_income_statement",
            display_name: "Sueldos",
            description: null,
            level: 1,
            path: "costos/sueldos",
            sort_order: 10,
            is_system: false,
            is_visible: true,
            affects_pulso: true,
            active: true,
            created_at: "2026-01-01T00:00:00Z",
            children: [],
          },
          {
            id: "acc-servicios",
            code: "costos.servicios",
            name: "Servicios",
            type: "expense",
            parent_id: "acc-costos",
            destination: "operational_income_statement",
            display_name: "Servicios",
            description: null,
            level: 1,
            path: "costos/servicios",
            sort_order: 20,
            is_system: false,
            is_visible: true,
            affects_pulso: true,
            active: true,
            created_at: "2026-01-01T00:00:00Z",
            children: [],
          },
        ],
      },
    ],
    { status: 200 },
  ),
);

const CLASSIFIED_MOVEMENTS = http.get("*/api/bank-movements", () =>
  HttpResponse.json(
    {
      items: [
        {
          id: "mov-1",
          bank_account_id: "acct-1",
          external_id: "ext-1",
          description: "SUELDO FERNANDO PEREZ MAYO",
          amount: "-2500000.00",
          date: "2026-05-30",
          direction: "debit",
          canonical_category: "payroll_payment",
          management_account_id: "acc-sueldos",
        },
        {
          id: "mov-2",
          bank_account_id: "acct-1",
          external_id: "ext-2",
          description: "PAGO MOVISTAR FACTURA 87654321",
          amount: "-42500.00",
          date: "2026-05-15",
          direction: "debit",
          canonical_category: "supplier_payment",
          management_account_id: "acc-servicios",
        },
        {
          id: "mov-3",
          bank_account_id: "acct-1",
          external_id: "ext-3",
          description: "ABONO CLIENTE X CAPITAL SPA - FACTURA 217576",
          amount: "96990.00",
          date: "2026-05-15",
          direction: "credit",
          canonical_category: "client_collection",
          management_account_id: "acc-ventas",
        },
        {
          id: "mov-4",
          bank_account_id: "acct-1",
          external_id: "ext-4",
          description: "PAGO F29 ABRIL 2026",
          amount: "-2150000.00",
          date: "2026-05-12",
          direction: "debit",
          canonical_category: "tax_payment",
          management_account_id: "acc-impuestos",
        },
      ],
      total: 4,
    },
    { status: 200 },
  ),
);

const EMPTY_MOVEMENTS = http.get("*/api/bank-movements", () =>
  HttpResponse.json({ items: [], total: 0 }, { status: 200 }),
);

const meta = {
  title: "Capa 2 / Clasificación / ClasificadosView",
  component: ClasificadosView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Vista `/caja/clasificados` — auditoría de movimientos clasificados (Sprint C2). Filtros locales (categoría / dirección / período / glosa) + paginación + totales (ingresos/egresos/neto). Botón 'Reclasificar' por fila abre el ClassificationDrawer prepoblado (PR-Mov2 #176).",
      },
    },
    msw: {
      handlers: [CANONICAL_CATEGORIES, ACCOUNTS_TREE_BASIC, CLASSIFIED_MOVEMENTS],
    },
  },
} satisfies Meta<typeof ClasificadosView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConMovimientos: Story = {
  name: "Con movimientos clasificados",
  parameters: {
    docs: {
      description: {
        story:
          "Estado típico — 4 movimientos clasificados con cobros, sueldos, servicios y pago F29. Tabla con totales al pie + botón Reclasificar por fila.",
      },
    },
  },
};

export const SinMovimientos: Story = {
  name: "Sin movimientos en el período",
  parameters: {
    docs: {
      description: {
        story:
          "Empty state — el período seleccionado no tiene movimientos clasificados. Mensaje invitando a probar otro período.",
      },
    },
    msw: {
      handlers: [CANONICAL_CATEGORIES, ACCOUNTS_TREE_BASIC, EMPTY_MOVEMENTS],
    },
  },
};
