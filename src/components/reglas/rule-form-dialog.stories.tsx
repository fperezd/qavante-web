import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { RuleFormDialog } from "./rule-form-dialog";
import type { ClassificationRule, SuggestRuleResponse } from "@/lib/api/classification-rules";

/* Fixture determinística replicando una regla típica del seed MSW
   (`Sueldo Fernando` con prioridad 10, activa). */
const SEED_RULE: ClassificationRule = {
  id: "rule-1",
  name: "Sueldo Fernando",
  source_type: "bank_movement",
  condition_field: "description",
  operator: "contains",
  condition_value: "SUELDO FERNANDO",
  canonical_category: "payroll_payment",
  management_account_id: null,
  dimension_assignments: [],
  priority: 10,
  confidence: "0.95",
  active: true,
  created_by: "u_owner_01",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: null,
};

const SEED_SUGGESTION: SuggestRuleResponse = {
  name: "Movistar",
  source_type: "bank_movement",
  condition_field: "counterparty_name",
  operator: "contains",
  condition_value: "MOVISTAR",
};

const meta = {
  title: "Capa 2 / Reglas / RuleFormDialog",
  component: RuleFormDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Editor único reusable para crear/editar reglas de clasificación (Addendum §17). Dialog Base UI + react-hook-form + zod. El select de Categoría canónica se puebla con `useCanonicalCategories` (en storybook sin MSW, queda con la opción 'Sin categoría' única). Schema + transforms en `./rule-form-schema` (testeables en vitest unit).",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof RuleFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NuevaRegla: Story = {
  args: { rule: null },
  parameters: {
    docs: {
      description: {
        story:
          "Modo create con defaults v1: campo=Glosa, operador=contiene, prioridad=100, confianza=80%. El user completa name + valor + categoría.",
      },
    },
  },
};

export const EditarRegla: Story = {
  args: { rule: SEED_RULE },
  parameters: {
    docs: {
      description: {
        story:
          "Modo edit: el form se prellena con los campos editables vía PATCH (sin `source_type` ni `management_account_id`, que no son mutables por contrato).",
      },
    },
  },
};

export const ConSugerencia: Story = {
  args: { rule: null, suggestion: SEED_SUGGESTION },
  parameters: {
    docs: {
      description: {
        story:
          "Modo create con sugerencia §18.7 pre-poblada (read-only del backend). Solo `name + condition_field + operator + condition_value` se aplican; `priority/confidence/category` quedan con defaults v1 para que el user los ajuste.",
      },
    },
  },
};

export const Closed: Story = {
  args: { open: false, rule: null },
  parameters: {
    docs: {
      description: {
        story: "Estado cerrado — el Portal no monta el popup. Story sólo para verificar no-break.",
      },
    },
  },
};
