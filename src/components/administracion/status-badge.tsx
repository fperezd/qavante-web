import { QavanteBadge } from "@/components/qavante";
import { STATUS_LABELS, type Status } from "./role-labels";

const VARIANT_BY_STATUS: Record<Status, "success" | "warning" | "info"> = {
  active: "success",
  suspended: "warning",
  invited: "info",
};

export function StatusBadge({ status }: { status: Status }) {
  return <QavanteBadge variant={VARIANT_BY_STATUS[status]}>{STATUS_LABELS[status]}</QavanteBadge>;
}
