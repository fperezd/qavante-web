import { FeatureUnavailableState } from "@/components/qavante";
import { SimuladorV14Live } from "@/components/simular/v14/simulador-v14-live";
import { resolveFeatureFlags } from "@/lib/feature-flags";

export const runtime = "edge";

export default function SimularPage() {
  const { simuladorV14 } = resolveFeatureFlags();

  return simuladorV14 ? (
    <SimuladorV14Live />
  ) : (
    <FeatureUnavailableState
      title="Simulador · todavía no disponible"
      description="Estamos conectando la evaluación segura de hipótesis. Se activará después del despliegue y smoke del contrato financiero; no mostramos resultados de ejemplo como si fueran reales."
    />
  );
}
