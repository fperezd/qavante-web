import { BandejaV07Live } from "@/components/bandeja/v07/bandeja-v07-live";
import { BandejaAuditLanding } from "@/components/bandeja/bandeja-audit-landing";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/**
 * Inicio y Caja son la entrada a la lectura financiera; Bandeja conserva la cola viva de auditoría
 * cuando V07 está habilitada. Con el flag apagado, la landing no inventa conteos ni estados.
 */
export default function BandejaPage() {
  const { bandejaV07 } = resolveFeatureFlags();

  if (bandejaV07) {
    return (
      <div className="space-y-6">
        <BandejaV07Live />
      </div>
    );
  }

  return <BandejaAuditLanding />;
}
