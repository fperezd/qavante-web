"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, ListChecks, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton, QavanteEmpty } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import {
  useClassificationRules,
  useToggleClassificationRuleActive,
  type ClassificationRule,
} from "@/lib/api/classification-rules";

/* Vista de Reglas — Addendum §17.5/§17.6/§18.1. Patrón "página = contenedor":
   el screen resuelve el flag `classificationRules` (ADR-0008) y monta esta
   vista (client). Funcionalidades:

   - Listado ordenado por priority ASC (orden de evaluación §17.6).
   - Toggle active/inactive (§17.5: las reglas NO se borran, se desactivan).
   - Crear/editar via dialog (POST/PATCH §17.5; PATCH no toca source_type ni
     management_account_id — esos viven en el drawer §17 al clasificar).

   §18.7 (suggest-rule desde drawer §17) NO va acá; el banner de sugerencia
   pertenece al drawer cuando se incorpora. El gating fino owner/admin lo
   hace el backend (403 → Anexo C.3). */

/* Lazy: separa Base UI Dialog + react-hook-form + zod del First Load JS de
   `/administracion/reglas-clasificacion`. Solo se descarga al abrir el
   editor. ssr:false porque el dialog es interactivo client-only. */
const RuleFormDialog = dynamic(
  () =>
    import("./rule-form-dialog").then((m) => ({
      default: m.RuleFormDialog,
    })),
  { ssr: false },
);

function LoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-md bg-neutral-light/30" />
      ))}
    </div>
  );
}

function ErrorState({ error, what }: { error: unknown; what: string }) {
  const message =
    error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

/* Map del operator técnico a label humano (Addendum §18.2 tabla). El backend
   manda lowercase; el FE lo presenta con la forma natural en español. */
const OPERATOR_LABEL: Record<string, string> = {
  equals: "es igual a",
  contains: "contiene",
  starts_with: "empieza con",
  ends_with: "termina con",
  regex: "matchea regex",
  greater_than: "mayor a",
  less_than: "menor a",
};

const FIELD_LABEL: Record<string, string> = {
  description: "Glosa",
  counterparty_name: "Contraparte",
  reference: "Referencia",
  amount: "Monto",
  currency_code: "Moneda",
  bank_account_id: "Cuenta bancaria",
};

function RuleRow({
  rule,
  onToggle,
  onEdit,
  isToggling,
}: {
  rule: ClassificationRule;
  onToggle: (id: string) => void;
  onEdit: (rule: ClassificationRule) => void;
  isToggling: boolean;
}) {
  return (
    <QavanteCard variant="bordered">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-brand-primary-50 p-2 text-brand-primary">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-dark">{rule.name}</p>
            {rule.active ? (
              <QavanteBadge variant="success">Activa</QavanteBadge>
            ) : (
              <QavanteBadge variant="default">Desactivada</QavanteBadge>
            )}
            <QavanteBadge variant="info">Prioridad {rule.priority}</QavanteBadge>
          </div>
          <p className="text-sm text-neutral-mid">
            Si la{" "}
            <span className="font-medium text-neutral-dark">
              {FIELD_LABEL[rule.condition_field] ?? rule.condition_field}
            </span>{" "}
            <span className="font-medium text-neutral-dark">
              {OPERATOR_LABEL[rule.operator] ?? rule.operator}
            </span>{" "}
            <code className="rounded bg-neutral-light/40 px-1 py-0.5 text-xs">
              {rule.condition_value}
            </code>
            {rule.canonical_category && (
              <>
                {" "}
                → clasificar como{" "}
                <span className="font-medium text-neutral-dark">{rule.canonical_category}</span>
              </>
            )}
          </p>
          <p className="text-xs text-neutral-mid">
            Confianza: {(Number(rule.confidence) * 100).toFixed(0)}% · Creada:{" "}
            {new Date(rule.created_at).toLocaleDateString("es-CL")}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={() => onEdit(rule)}
            aria-label={`Editar regla ${rule.name}`}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Editar
          </QavanteButton>
          <QavanteButton
            size="sm"
            variant="ghost"
            onClick={() => onToggle(rule.id)}
            disabled={isToggling}
            aria-label={
              rule.active ? `Desactivar regla ${rule.name}` : `Activar regla ${rule.name}`
            }
          >
            {rule.active ? (
              <>
                <PowerOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Desactivar
              </>
            ) : (
              <>
                <Power className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Activar
              </>
            )}
          </QavanteButton>
        </div>
      </div>
    </QavanteCard>
  );
}

export function RulesListView() {
  const rulesQuery = useClassificationRules();
  const toggle = useToggleClassificationRuleActive();

  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ClassificationRule | null>(null);

  if (rulesQuery.isLoading) return <LoadingSkeleton />;
  if (rulesQuery.isError) return <ErrorState error={rulesQuery.error} what="las reglas" />;

  const rules = rulesQuery.data?.items ?? [];

  function openCreate() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function openEdit(rule: ClassificationRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function handleToggle(id: string) {
    setTogglingId(id);
    toggle.mutate(id, {
      onSettled: () => setTogglingId(null),
    });
  }

  if (rules.length === 0) {
    return (
      <>
        <QavanteEmpty
          icon={ListChecks}
          title="Aún no hay reglas"
          description="Creá tu primera regla, o clasificá un movimiento con la opción «Guardar y crear regla» para que Qavante aprenda."
          cta={
            <QavanteButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Crear primera regla
            </QavanteButton>
          }
        />
        <RuleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={null} />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-neutral-mid">
          Las reglas se evalúan en orden de prioridad (de menor a mayor). Las desactivadas no
          afectan la clasificación pero las podés reactivar cuando quieras — Qavante nunca borra
          reglas.
        </p>
        <QavanteButton onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva regla
        </QavanteButton>
      </div>
      <ul className="space-y-2">
        {rules.map((rule) => (
          <li key={rule.id}>
            <RuleRow
              rule={rule}
              onToggle={handleToggle}
              onEdit={openEdit}
              isToggling={toggle.isPending && togglingId === rule.id}
            />
          </li>
        ))}
      </ul>
      {toggle.isError && <ErrorState error={toggle.error} what="al cambiar el estado" />}

      <RuleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editingRule} />
    </div>
  );
}
