import type { FinancialPosition } from "@/lib/api/financial-decisions";
import { parseAmountOrNull } from "@/lib/formatters/amount";

export function positionPresentation(
  position: FinancialPosition,
): "abstained" | "partial" | "ready" {
  if (position.status === "abstained") return "abstained";
  return position.status === "partial" ? "partial" : "ready";
}

export function visiblePositionAmounts(position: FinancialPosition) {
  if (!position.currency) return [];
  return [
    ["Caja actual", position.current_cash],
    ["Mínimo proyectado", position.minimum_projected_cash],
    ["Caja segura", position.safe_cash],
    ["Excedente estable", position.stable_surplus],
  ].flatMap(([label, raw]) => {
    const value = parseAmountOrNull(raw);
    return value == null ? [] : [{ label, value }];
  });
}
