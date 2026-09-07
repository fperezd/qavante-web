import type { BankMovement } from "@/lib/api/treasury";
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
      allocations: [],
      source: null,
      confidence:
        typeof movement.match_score === "number"
          ? `${Math.round(movement.match_score * 100)}%`
          : null,
    },
    classification: {
      status: estadoClasificacionDe(movement),
      canonicalType: canonicalLabel,
      allocations: [],
      source: movement.classified_by ?? null,
      confidence:
        typeof movement.confidence === "number"
          ? `${Math.round(movement.confidence * 100)}%`
          : null,
      actor: movement.classified_by ?? null,
      classifiedAt: movement.classified_at ?? null,
    },
  };
}
