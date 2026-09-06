import { FeatureUnavailableState } from "@/components/qavante";
import { BandejaV07Live } from "@/components/bandeja/v07/bandeja-v07-live";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ColaConciliacionLive } from "@/components/caja/conciliacion/cola-conciliacion-live";
import { AliasesAprendidosLive } from "@/components/caja/conciliacion/aliases-aprendidos-live";

/* Cola de conciliación (ADR-0036/0042). Server Component: resuelve el flag `reconciliationReview`
   (default OFF — ADR-0008). Sin `export const runtime` (regla 4). El motor auto-aplica los matches
   con score >=90 y deja los 60-90 acá, de a 1 clic. Flag OFF → FeatureUnavailableState. */
export default function ConciliacionPage() {
  const { reconciliationReview, bandejaV07 } = resolveFeatureFlags();

  /* Igual que /caja/por-clasificar: los enlaces y marcadores históricos entran a la experiencia
     nueva sin perder su intención de conciliar. Apagar Bandeja conserva el rollback clásico. */
  if (bandejaV07) {
    return <BandejaV07Live tabInicial="conciliar" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Conciliación</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Movimientos del banco que calzan con un documento, pero que Qavante no quiso dar por
          conciliados sin que los mires. Confirma los que estén bien.
        </p>
      </header>

      {reconciliationReview ? (
        <>
          <ColaConciliacionLive />
          <AliasesAprendidosLive />
        </>
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
