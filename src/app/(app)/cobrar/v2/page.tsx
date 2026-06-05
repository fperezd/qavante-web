import { ArrowDownToLine } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CobrarV2View } from "@/components/cobrar/cobrar-v2-view";

/* Cobrar v2 (rediseño lente Xero) — ruta de staging `/cobrar/v2`. Server
   Component: resuelve los flags. El v2 usa el MISMO endpoint y data layer que el
   v1 (`GET /api/treasury/accounts-receivable`), por eso reusa su flag
   `accountsReceivable` — no necesita uno propio. Flag ON → el rediseño (lo
   vencido al frente + a quién cobrarle primero + documentos vencidos que
   reflowean a cards en mobile); el link al Libro de Ventas SII va dentro (si
   `siiQueries`). Default OFF → QavanteEmpty. Vive en una ruta aparte para no
   tocar el `/cobrar` LIVE; el swap a la ruta principal es un cambio de una línea
   cuando se apruebe. Sin `export const runtime` (regla 4). */
export default function CobrarV2Page() {
  const { siiQueries, accountsReceivable } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
      </header>

      {accountsReceivable ? (
        <CobrarV2View siiEnabled={siiQueries} />
      ) : (
        <QavanteEmpty
          icon={ArrowDownToLine}
          title="Cobrar v2 — rediseño en preview"
          description="Esta es la versión rediseñada de Cobrar: lo vencido al frente (lo accionable), a quién cobrarle primero como cards y los documentos vencidos que reflowean a cards en mobile. Se activa con el flag accountsReceivable."
        />
      )}
    </div>
  );
}
