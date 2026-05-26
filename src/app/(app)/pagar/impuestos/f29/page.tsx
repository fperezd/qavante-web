import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { F29View } from "@/components/impuestos/f29-view";

/* Gateado — Sprint C1, ruta `/pagar/impuestos/f29`. Server Component:
   resuelve el flag `siiQueries` (default OFF — ADR-0008). Sin `export
   const runtime` (regla 4). Flag OFF → FeatureUnavailableState; en prod
   queda OFF hasta que `/api/management/config` exponga el flag desde
   backend (bloqueante comunicado a CC-API). En dev: `NEXT_PUBLIC_FF_SII_QUERIES=true`.

   Decisión de ubicación (vs `/impuestos` top-level): ver ADR-0011 +
   discusión 2026-05-23. El modelo mental del PYME es "qué tengo que
   pagar" — el F29 vence el 12 de cada mes y se paga al SII. Vive bajo
   Pagar para evitar inflar el sidebar (Hick's Law) y mantener los 6
   módulos top-level estables. */
export default function PagarImpuestosF29Page() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">F29 — Declaración mensual</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Consulta tu Certificado Solemne del SII por folio. Vas a ver los montos declarados (IVA
          débito y crédito, PPM, total a pagar) y puedes descargar el PDF original.
        </p>
      </header>

      {siiQueries ? <F29View /> : <FeatureUnavailableState />}
    </div>
  );
}
