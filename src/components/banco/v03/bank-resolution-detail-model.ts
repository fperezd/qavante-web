import type { BankMovement, MovementResolutionDetailResponse } from "@/lib/api/treasury";
import { formatMoney } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import type { EstadoClasificacionV03, EstadoConciliacionV03 } from "./banco-v03-model";
import { estadoClasificacionDe, estadoConciliacionDe } from "./banco-v03-model";

/** Read model local para la UI de Banco. El adapter de OpenAPI puede reemplazarlo sin hacer que
 * la vista dependa de los tipos generados ni calcular semántica financiera en el cliente. */
export interface ResolutionOriginLink {
  label: string;
  href: string;
}

export interface ResolutionAllocation {
  id: string;
  label: string;
  kind: "bank_movement" | "document" | "classification";
  amountFormatted: string;
  percentage?: string | null;
  origin?: ResolutionOriginLink | null;
  dimensions?: Array<{ name: string; value: string }>;
}

export interface ResolutionHistoryEntry {
  id: string;
  label: string;
  occurredAt: string;
  actor?: string | null;
}

export interface BankMovementResolutionDetail {
  movementId: string;
  reconciliation: {
    status: EstadoConciliacionV03;
    /** Sólo true cuando el backend expone una conciliación documental que el endpoint
     * genérico de reversión realmente sabe deshacer. Los vínculos especializados se
     * muestran, pero no ofrecen una acción que podría informar éxito sin revertirlos. */
    canUnreconcile: boolean;
    topology?: "1:1" | "1:N" | "N:1" | "N:N" | null;
    allocations: ResolutionAllocation[];
    balanceFormatted?: string | null;
    source?: string | null;
    confidence?: string | null;
    evidence?: string[];
    history?: ResolutionHistoryEntry[];
  };
  classification: {
    status: EstadoClasificacionV03;
    canonicalType?: string | null;
    allocations: ResolutionAllocation[];
    source?: string | null;
    confidence?: string | null;
    actor?: string | null;
    classifiedAt?: string | null;
    history?: ResolutionHistoryEntry[];
  };
}

/** Fallback honesto mientras #428 no publique el detalle canónico. Sólo adapta campos presentes;
 * no infiere montos aplicados, topologías, dimensiones, cuentas ni rutas de origen. */
export function resolutionDetailFromMovement(
  movement: BankMovement,
  canonicalLabel: string | null,
): BankMovementResolutionDetail {
  return {
    movementId: movement.id,
    reconciliation: {
      status: estadoConciliacionDe(movement),
      canUnreconcile: false,
      allocations: [],
      source: null,
      confidence:
        typeof movement.match_score === "number" ? formatPct(movement.match_score * 100) : null,
    },
    classification: {
      status: estadoClasificacionDe(movement),
      canonicalType: canonicalLabel,
      allocations: [],
      source: movement.classified_by ?? null,
      confidence:
        typeof movement.confidence === "number" ? formatPct(movement.confidence * 100) : null,
      actor: movement.classified_by ?? null,
      classifiedAt: movement.classified_at ?? null,
    },
  };
}

function reconciliationStatus(status: string): EstadoConciliacionV03 {
  const value = status.toLowerCase();
  if (value === "matched") return "conciliado";
  if (value === "partial" || value === "partially_matched") return "parcial";
  if (value === "excluded") return "excluido";
  if (value === "prepago" || value === "processor_batch" || value === "not_required") {
    return "no_requerido";
  }
  return "pendiente";
}

function topology(value?: string | null): "1:1" | "1:N" | "N:1" | "N:N" | null {
  return value === "1:1" || value === "1:N" || value === "N:1" || value === "N:N" ? value : null;
}

/** Adapter único desde el contrato OpenAPI. La UI no deriva matches ni recalcula montos. */
export function resolutionDetailFromApi(
  detail: MovementResolutionDetailResponse,
): BankMovementResolutionDetail {
  const current = detail.reconciliation.current_case;
  const caseAllocations: ResolutionAllocation[] = (current?.allocations ?? [])
    .filter((item) => item.node_kind !== "bank_movement")
    .map((item, index) => ({
      id: `${item.node_kind}:${item.node_id}:${index}`,
      kind: "document",
      label: item.source_label ?? `${item.node_kind} ${item.node_id}`,
      amountFormatted: formatMoney(Number(item.signed_amount), item.currency_code),
      origin: item.source_path ? { label: "Ir al origen", href: item.source_path } : null,
    }));
  const legacyAllocations: ResolutionAllocation[] = detail.reconciliation.legacy_documents.map(
    (item) => ({
      id: item.id,
      kind: "document",
      label:
        item.document_ref ?? item.counterparty_name ?? `${item.document_kind} ${item.document_id}`,
      amountFormatted: formatMoney(Number(item.amount_applied), item.currency_code),
      origin: item.source_path ? { label: "Ir al origen", href: item.source_path } : null,
    }),
  );
  return {
    movementId: detail.movement.id,
    reconciliation: {
      status: reconciliationStatus(detail.reconciliation.effective_status),
      canUnreconcile: legacyAllocations.length > 0,
      topology: topology(current?.topology),
      allocations: caseAllocations.length > 0 ? caseAllocations : legacyAllocations,
      evidence: current?.evidence.map((item) => `${item.code}: ${item.result}`) ?? [],
      source: current?.engine_version ?? null,
      confidence: current?.score ? formatPct(Number(current.score) * 100) : null,
      history: detail.reconciliation.history.map((item) => ({
        id: item.id,
        label: `${item.decision} · ${item.status}`,
        occurredAt: item.confirmed_at ?? item.reverted_at ?? item.created_at,
        actor: item.created_by,
      })),
    },
    classification: {
      status: detail.classification.status === "classified" ? "clasificado" : "por_clasificar",
      canonicalType:
        detail.classification.financial_event_type ?? detail.classification.canonical_category,
      allocations: detail.classification.allocations.map((item, index) => ({
        id: item.id ?? `${item.management_account_id}:${index}`,
        kind: "classification",
        label:
          item.management_account_name ??
          item.management_account_code ??
          item.label ??
          item.management_account_id,
        amountFormatted: formatMoney(
          Number(item.amount),
          item.currency_code ?? detail.movement.currency_code,
        ),
        percentage: item.percentage ? formatPct(Number(item.percentage)) : null,
        dimensions: item.dimensions.map((dimension) => ({
          name: dimension.dimension_name ?? dimension.dimension_id ?? "Dimensión",
          value: dimension.value_name ?? dimension.dimension_value_id ?? "Sin valor",
        })),
      })),
      source: detail.classification.source,
      confidence: detail.classification.confidence
        ? formatPct(Number(detail.classification.confidence) * 100)
        : null,
      actor: detail.classification.classified_by,
      classifiedAt: detail.classification.classified_at,
      history: detail.classification.history.map((item) => ({
        id: item.id,
        label: item.action,
        occurredAt: item.created_at,
        actor: item.actor_user_id,
      })),
    },
  };
}
