import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { BankMovement } from "@/lib/api/treasury";
import { ClasificadosStats } from "./clasificados-stats";
import {
  buildAccountsLookup,
  buildCategoriesLookup,
  type AccountLookupItem,
  type CategoryLookupItem,
} from "./build-clasificados-stats";
import type { ManagementAccountNode } from "@/lib/api/management";

/* ClasificadosStats — bloque "Resumen de movimientos clasificados" arriba
   de la tabla de /caja/clasificados. Componente presentational puro
   (no fetches): recibe items + lookups y deriva métricas vía
   `buildClasificadosStats`. Convención del repo: cobertura visual de
   componentes vía Storybook + MSW; tests unitarios para helpers. */

const CATEGORIES: CategoryLookupItem[] = [
  { code: "client_collection", label: "Cobro de cliente" },
  { code: "supplier_payment", label: "Pago a proveedor" },
  { code: "payroll_payment", label: "Sueldos" },
  { code: "tax_payment", label: "Pago de impuestos" },
  { code: "internal_bank_transfer", label: "Transferencia entre cuentas propias" },
];

const ACCOUNTS_TREE: ManagementAccountNode[] = [
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
        id: "acc-servicios",
        code: "costos.servicios",
        name: "Servicios",
        type: "expense",
        parent_id: "acc-costos",
        destination: "operational_income_statement",
        display_name: "Software y tecnología",
        description: null,
        level: 1,
        path: "costos/servicios",
        sort_order: 10,
        is_system: false,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [],
      },
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
] as unknown as ManagementAccountNode[];

const ACCOUNTS_LOOKUP: Map<string, AccountLookupItem> = buildAccountsLookup(ACCOUNTS_TREE);
const CATEGORIES_LOOKUP = buildCategoriesLookup(CATEGORIES);

function mov(
  partial: Partial<BankMovement> & Pick<BankMovement, "id" | "direction" | "amount">,
): BankMovement {
  return {
    bank_account_id: "acct-1",
    external_id: `ext-${partial.id}`,
    date: "2026-05-15",
    description: "Movimiento",
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unmatched",
    data_status: "available",
    imported_at: "2026-05-15T10:00:00Z",
    classification_status: "classified",
    ...partial,
  } as BankMovement;
}

const ITEMS_COMPLETOS: BankMovement[] = [
  mov({
    id: "1",
    direction: "credit",
    amount: "1190000",
    canonical_category: "client_collection",
    management_account_id: "acc-ventas",
    classified_at: "2026-05-15T14:10:00Z",
    description: "ABONO CLIENTE FACTURA 1042",
  }),
  mov({
    id: "2",
    direction: "credit",
    amount: "850000",
    canonical_category: "client_collection",
    management_account_id: "acc-ventas",
    classified_at: "2026-05-18T09:30:00Z",
    description: "ABONO TGR PPM ABRIL",
  }),
  mov({
    id: "3",
    direction: "debit",
    amount: "-2500000",
    canonical_category: "payroll_payment",
    management_account_id: "acc-sueldos",
    classified_at: "2026-05-30T11:00:00Z",
    description: "SUELDO MAYO",
  }),
  mov({
    id: "4",
    direction: "debit",
    amount: "-42500",
    canonical_category: "supplier_payment",
    management_account_id: "acc-servicios",
    classified_at: "2026-05-15T16:00:00Z",
    description: "PAGO MOVISTAR",
  }),
  mov({
    id: "5",
    direction: "debit",
    amount: "-250000",
    canonical_category: "supplier_payment",
    management_account_id: "acc-servicios",
    classified_at: "2026-05-22T12:00:00Z",
    description: "PAGO AWS",
  }),
  mov({
    id: "6",
    direction: "debit",
    amount: "-180000",
    canonical_category: "supplier_payment",
    management_account_id: "acc-servicios",
    classified_at: "2026-05-25T08:45:00Z",
    description: "PAGO GITHUB",
  }),
];

const meta = {
  title: "Capa 2 / Clasificación / ClasificadosStats",
  component: ClasificadosStats,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Bloque 'Resumen de movimientos clasificados' que vive arriba de la tabla en /caja/clasificados. Recibe los mismos items que la tabla + lookups; deriva todas las métricas con `buildClasificadosStats` (helper puro, testeado en `build-clasificados-stats.test.ts`). Cards accionables: ingresos / egresos / tipo más frecuente filtran la tabla.",
      },
    },
  },
  args: {
    categoriesById: CATEGORIES_LOOKUP,
    accountsById: ACCOUNTS_LOOKUP,
  },
} satisfies Meta<typeof ClasificadosStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConDatosCompletos: Story = {
  name: "Con datos completos (estado típico)",
  args: {
    items: ITEMS_COMPLETOS,
    isPartial: false,
    onApplyDirectionFilter: () => {},
    onApplyCanonicalCategoryFilter: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          "Estado típico — 6 movimientos clasificados con mix ingresos/egresos. Cards accionables tienen hover/focus visible. Neto positivo (verde): ingresos > egresos.",
      },
    },
  },
};

export const NetoNegativo: Story = {
  name: "Neto negativo (warning)",
  args: {
    items: [
      mov({
        id: "1",
        direction: "credit",
        amount: "300000",
        canonical_category: "client_collection",
        management_account_id: "acc-ventas",
        classified_at: "2026-05-15T14:10:00Z",
      }),
      mov({
        id: "2",
        direction: "debit",
        amount: "-2500000",
        canonical_category: "payroll_payment",
        management_account_id: "acc-sueldos",
        classified_at: "2026-05-30T11:00:00Z",
      }),
    ],
    isPartial: false,
    onApplyDirectionFilter: () => {},
    onApplyCanonicalCategoryFilter: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          "Net negativo — egresos exceden ingresos. La card 'Neto clasificado' adopta tono warning (rojo).",
      },
    },
  },
};

export const SinDatos: Story = {
  name: "Sin movimientos (empty)",
  args: {
    items: [],
    isPartial: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Empty state — no hay movimientos clasificados que cumplan los filtros actuales. Mensaje neutro en card bordered.",
      },
    },
  },
};

export const Loading: Story = {
  name: "Cargando (skeleton)",
  args: {
    items: [],
    isPartial: false,
    isLoading: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Loading inicial — 8 cards en skeleton pulse mientras llega la respuesta. Sin texto 'Cargando...'; `aria-busy` para SR.",
      },
    },
  },
};

export const AlcanceParcial: Story = {
  name: "Alcance parcial (partial)",
  args: {
    items: ITEMS_COMPLETOS,
    isPartial: true,
    onApplyDirectionFilter: () => {},
    onApplyCanonicalCategoryFilter: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          "Aviso de alcance parcial — el backend reporta 800 movimientos en el filtro pero solo se descargaron los visibles. Las stats se calculan sobre lo descargado, con banner warning.",
      },
    },
  },
};

export const NeedsReview: Story = {
  name: "Con movimientos que requieren revisión",
  args: {
    items: [
      mov({
        id: "1",
        direction: "credit",
        amount: "100000",
        canonical_category: "client_collection",
        management_account_id: "acc-ventas",
        classified_at: "2026-05-15T14:10:00Z",
        confidence: "0.95",
      }),
      mov({
        id: "2",
        direction: "debit",
        amount: "-200000",
        canonical_category: "supplier_payment",
        management_account_id: "acc-servicios",
        classified_at: "2026-05-20T09:00:00Z",
        classification_status: "needs_review",
        confidence: "0.45",
      }),
      mov({
        id: "3",
        direction: "debit",
        amount: "-150000",
        canonical_category: "supplier_payment",
        management_account_id: "acc-servicios",
        classified_at: "2026-05-21T10:00:00Z",
        confidence: "0.40",
      }),
      mov({
        id: "4",
        direction: "debit",
        amount: "-90000",
        canonical_category: "supplier_payment",
        management_account_id: "acc-servicios",
        classified_at: "2026-05-22T11:00:00Z",
        data_status: "stale",
      }),
    ],
    isPartial: false,
    onApplyDirectionFilter: () => {},
    onApplyCanonicalCategoryFilter: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          "3 de 4 movimientos requieren revisión (confianza baja, status needs_review o data_status stale). Card 'Requieren revisión' tono warning + sublabel 'Confianza baja o estado pendiente'.",
      },
    },
  },
};
