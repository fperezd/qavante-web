"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ListChecks, Pencil, Plus, Power, PowerOff } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteButton,
  QavanteEmpty,
  QavanteInlineError,
} from "@/components/qavante";
import {
  useClassificationRules,
  useClassificationRuleUsages,
  useToggleClassificationRuleActive,
  type ClassificationRule,
  type ClassificationRuleUsage,
} from "@/lib/api/classification-rules";
import { concordar, formatCount } from "@/lib/formatters/count";
import { formatDateLong } from "@/lib/formatters/date";
import { useCanonicalCategories } from "@/lib/api/treasury";

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
    <div className="space-y-2" role="status" aria-live="polite">
      <span className="sr-only">Cargando reglas…</span>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
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

export type RuleFilter =
  | "all"
  | "learned_from_usage"
  | "created_by_user"
  | "qavante_base"
  | "unknown"
  | "inactive";

const FILTERS: ReadonlyArray<{ id: RuleFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "learned_from_usage", label: "Aprendidas del uso" },
  { id: "created_by_user", label: "Creadas por ti" },
  { id: "qavante_base", label: "Base Qavante" },
  { id: "unknown", label: "Origen no disponible" },
  { id: "inactive", label: "Desactivadas" },
];

const ORIGIN_LABEL: Record<ClassificationRule["origin"], string> = {
  learned_from_usage: "Aprendida del uso",
  created_by_user: "Creada por ti",
  qavante_base: "Base Qavante",
  unknown: "Origen no disponible",
};

export function filterRules(rules: ClassificationRule[], filter: RuleFilter) {
  if (filter === "all") return rules;
  if (filter === "inactive") return rules.filter((rule) => !rule.active);
  return rules.filter((rule) => rule.active && rule.origin === filter);
}

function UsageCopy({
  usage,
  loading,
  error,
}: {
  usage: ClassificationRuleUsage | undefined;
  loading: boolean;
  error: boolean;
}) {
  if (error) return <span>No se pudo medir el uso</span>;
  if (loading || !usage) return <span>Midiendo uso…</span>;
  if (
    usage.coverage === "unknown" ||
    usage.application_count == null ||
    usage.correction_count == null
  ) {
    return <span>Uso sin dato · esta fuente aún no registra atribución</span>;
  }
  const applications = usage.application_count;
  const corrections = usage.correction_count;
  return (
    <span>
      {formatCount(applications)} {concordar(applications, "aplicación", "aplicaciones")} ·{" "}
      {formatCount(corrections)} {concordar(corrections, "corrección", "correcciones")} · medido
      desde {formatDateLong(usage.tracking_started_at)}
    </span>
  );
}

function RuleRow({
  rule,
  onToggle,
  onEdit,
  isToggling,
  canonicalLabel,
  usage,
  usageLoading,
  usageError,
}: {
  rule: ClassificationRule;
  onToggle: (id: string) => void;
  onEdit: (rule: ClassificationRule) => void;
  isToggling: boolean;
  canonicalLabel: string | null;
  usage: ClassificationRuleUsage | undefined;
  usageLoading: boolean;
  usageError: boolean;
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
            <QavanteBadge variant="default">{ORIGIN_LABEL[rule.origin]}</QavanteBadge>
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
            {canonicalLabel && (
              <>
                {" "}
                → clasificar como{" "}
                <span className="font-medium text-neutral-dark">{canonicalLabel}</span>
              </>
            )}
          </p>
          <p className="text-xs text-neutral-mid">
            <UsageCopy usage={usage} loading={usageLoading} error={usageError} /> · Creada{" "}
            {formatDateLong(rule.created_at)}
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
  const categoriesQuery = useCanonicalCategories();
  const toggle = useToggleClassificationRuleActive();
  const rules = rulesQuery.data?.items ?? [];
  const usageQueries = useClassificationRuleUsages(rules.map((rule) => rule.id));

  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<RuleFilter>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ClassificationRule | null>(null);
  const categoryByCode = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categoriesQuery.data?.items ?? []) map[c.code] = c.label;
    return map;
  }, [categoriesQuery.data]);

  if (rulesQuery.isLoading) return <LoadingSkeleton />;
  if (rulesQuery.isError) return <QavanteInlineError error={rulesQuery.error} what="las reglas" />;

  const visibleRules = filterRules(rules, filter);

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
          description="Crea tu primera regla, o clasifica un movimiento con la opción «Guardar y crear regla» para que Qavante aprenda."
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
          afectan la clasificación pero las puedes reactivar cuando quieras, Qavante nunca borra
          reglas.
        </p>
        <QavanteButton onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva regla
        </QavanteButton>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar reglas por origen o estado">
        {FILTERS.map((option) => {
          const count = filterRules(rules, option.id).length;
          return (
            <QavanteButton
              key={option.id}
              size="sm"
              variant={filter === option.id ? "secondary" : "ghost"}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label} · {formatCount(count)}
            </QavanteButton>
          );
        })}
      </div>
      <ul className="space-y-2">
        {visibleRules.map((rule) => {
          const index = rules.findIndex((candidate) => candidate.id === rule.id);
          const usage = usageQueries[index];
          return (
            <li key={rule.id}>
              <RuleRow
                rule={rule}
                onToggle={handleToggle}
                onEdit={openEdit}
                isToggling={toggle.isPending && togglingId === rule.id}
                canonicalLabel={
                  rule.canonical_category
                    ? (categoryByCode[rule.canonical_category] ?? rule.canonical_category)
                    : null
                }
                usage={usage?.data}
                usageLoading={usage?.isLoading ?? true}
                usageError={usage?.isError ?? false}
              />
            </li>
          );
        })}
      </ul>
      {visibleRules.length === 0 && (
        <p className="rounded-xl border border-neutral-light bg-surface p-4 text-sm text-neutral-mid">
          No hay reglas en este filtro.
        </p>
      )}
      {toggle.isError && <QavanteInlineError error={toggle.error} what="al cambiar el estado" />}

      <RuleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editingRule} />
    </div>
  );
}
