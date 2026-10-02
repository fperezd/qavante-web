import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CashFlowView } from "@/components/caja/cash-flow-view";

/* `/flujo-de-caja` — lo que YA entró y salió de la caja, por período.
 *
 * Es la mitad que Proyecciones no cubre: `/caja/proyeccion` responde "¿me va a alcanzar?"
 * sobre los vencimientos que vienen; esta pantalla responde "¿qué pasó de verdad?" sobre
 * los movimientos ya clasificados de la capa comprometida. Separarlas evita la confusión
 * más cara de una pantalla de caja: mirar una curva proyectada creyendo que es historia.
 *
 * Lee el MISMO contrato que ya alimenta Proyecciones (`/api/treasury/reports/cash-flow`,
 * `financial_layer=committed`): cero datos de ejemplo, cero campos inventados. Gated por
 * `flujoDeCaja`, HOY APAGADO (no está en `wrangler.toml` → default `false` en producción).
 * Con el flag apagado la ruta existe y declara que todavía no está habilitada; nunca sirve
 * una maqueta en su lugar. */
export default function FlujoDeCajaPage() {
  const { flujoDeCaja, cashFlowReport } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Flujo de caja</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Qué entró y qué salió de mi caja?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Enlace href="/caja/proyeccion" label="Ir a Proyecciones" />
          <Enlace href="/inicio" label="Volver al Inicio" />
        </div>
      </header>

      {/* Requiere las DOS: el flag de la pantalla y el del reporte que la alimenta. Encender
          sólo la pantalla mostraría un marco vacío sobre una fuente apagada. */}
      {flujoDeCaja && cashFlowReport ? (
        <CashFlowView rango="historico" />
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}

function Enlace({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-neutral-dark transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
