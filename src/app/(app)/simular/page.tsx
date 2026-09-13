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
      description="El simulador aún no está disponible. Cuando esté habilitado, las simulaciones no ejecutarán operaciones ni representarán una aprobación crediticia."
    />
  );
}
