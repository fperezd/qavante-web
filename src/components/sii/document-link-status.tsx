import { QavanteBadge } from "@/components/qavante";
import {
  DOCUMENT_LINK_NOT_OBSERVED_LABEL,
  DOCUMENT_LINK_STATUS_LABELS,
  DOCUMENT_LINK_UNAVAILABLE_LABEL,
  type DocumentLinkResolution,
  type DocumentLinkStatus,
} from "@/lib/api/document-links";

const STATUS_VARIANT: Record<DocumentLinkStatus, "danger" | "info" | "warning" | "default"> = {
  annulled_confirmed: "danger",
  amount_corrected: "warning",
  text_corrected: "info",
  linked_effect_unknown: "warning",
  possible_association: "warning",
  ambiguous: "warning",
  unresolved: "default",
};

export interface DocumentLinkPresentation {
  label: string;
  variant: "danger" | "info" | "warning" | "default";
  title: string;
}

export function documentLinkPresentation(
  resolution: DocumentLinkResolution | undefined,
  loading = false,
): DocumentLinkPresentation {
  if (!resolution) {
    return loading
      ? {
          label: "Consultando evidencia fiscal…",
          variant: "default",
          title: "La evidencia documental se está consultando.",
        }
      : {
          label: DOCUMENT_LINK_UNAVAILABLE_LABEL,
          variant: "default",
          title: "No fue posible consultar la evidencia documental; no se infiere ningún efecto.",
        };
  }
  if (resolution.availability === "unavailable") {
    return {
      label: DOCUMENT_LINK_UNAVAILABLE_LABEL,
      variant: "default",
      title: "No fue posible consultar la evidencia documental; no se infiere ningún efecto.",
    };
  }
  if (resolution.availability === "not_observed") {
    return {
      label: DOCUMENT_LINK_NOT_OBSERVED_LABEL,
      variant: "default",
      title:
        "La consulta respondió y este documento no tiene una referencia observada. No se infiere una anulación.",
    };
  }

  const { link } = resolution;
  /* D07 — sólo el servidor decide si la evidencia sustenta el efecto: `automatic_allowed` es
     true únicamente con referencia exacta, fuente SII validada, identidad consistente y CodRef
     compatible. Sin eso, la pantalla NO puede decir "anulado" ni "corregido": degrada a la
     asociación observada. Y si no hay referencia observada, se dice que no hay evidencia. */
  if (link.reference_evidence.observation_kind === "no_references") {
    return {
      label: DOCUMENT_LINK_NOT_OBSERVED_LABEL,
      variant: "default",
      title:
        "El documento no declara referencias. No se infiere una anulación ni una corrección de monto.",
    };
  }
  const efectoAcreditado = link.monetary_effect.automatic_allowed;
  const status: DocumentLinkStatus = efectoAcreditado ? link.link_status : "possible_association";
  return {
    label: DOCUMENT_LINK_STATUS_LABELS[status],
    variant: STATUS_VARIANT[status],
    title: efectoAcreditado
      ? "La evidencia fiscal autoriza el efecto indicado, pero no demuestra que ya haya sido aplicado."
      : "Referencia observada sin evidencia que acredite el efecto; no modifica monto, saldo, estado ni vencimiento.",
  };
}

export function DocumentLinkStatusBadge({
  resolution,
  loading = false,
}: {
  resolution: DocumentLinkResolution | undefined;
  loading?: boolean;
}) {
  const presentation = documentLinkPresentation(resolution, loading);
  return (
    <QavanteBadge variant={presentation.variant} title={presentation.title}>
      {presentation.label}
    </QavanteBadge>
  );
}
