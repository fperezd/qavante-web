import { QavanteBadge } from "@/components/qavante";
import type { DocumentRowStatus } from "@/lib/api/reconciliation";

export function DocumentRowStatusBadges({ status }: { status?: DocumentRowStatus }) {
  if (!status) return <span className="text-xs text-neutral-mid">Estado no disponible</span>;
  const reconciled = status.reconciliation_status === "reconciled";
  const partial = status.reconciliation_status === "partial";
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      <QavanteBadge variant={status.classification_status === "classified" ? "success" : "warning"}>
        {status.classification_status === "classified" ? "Clasificado" : "Por clasificar"}
      </QavanteBadge>
      <QavanteBadge variant={reconciled ? "success" : partial ? "info" : "warning"}>
        {reconciled ? "Conciliado" : partial ? "Pago parcial" : "Por conciliar"}
      </QavanteBadge>
    </span>
  );
}
