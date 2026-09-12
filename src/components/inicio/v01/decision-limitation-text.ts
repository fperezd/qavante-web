import { normalizeVisibleText } from "@/lib/formatters/visible-text";

// Presentación de un motivo conocido. No se eliminan límites desconocidos ni se
// modifican el plan, su elegibilidad o sus datos originales.
const MISSING_POLICY_REASON =
  "No existe una PolicyConstraint versionada, vigente y no ambigua para este plan, ni un mínimo de caja CLP declarado por la empresa; la propuesta usa sólo evidencia concreta y queda con confianza baja, sin asumir un mínimo de caja de $0.";

export function decisionLimitationText(reason: string): string {
  if (reason === MISSING_POLICY_REASON) {
    return "No hay una política vigente y validada para este plan ni un mínimo de caja en CLP definido por la empresa. La propuesta se basa en los antecedentes disponibles; no supone un mínimo de caja de $0.";
  }
  return normalizeVisibleText(reason);
}
