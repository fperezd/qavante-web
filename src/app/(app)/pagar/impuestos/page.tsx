import Link from "next/link";
import { FileText, Landmark, Lock } from "lucide-react";
import { FeatureUnavailableState, QavanteBadge, QavanteCard } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Hub `/pagar/impuestos` — landing de la sección Impuestos dentro del
   módulo Pagar. Listará los impuestos disponibles para consultar y/o
   pagar (F29 mensual hoy; F22 anual diferido a Fase 2 — backend devuelve
   `state='unavailable'`). Gateado por `siiQueries` (ADR-0008).

   Decisión de ubicación: ver `f29/page.tsx` para el rationale. */
export default function PagarImpuestosPage() {
  const { siiQueries } = resolveFeatureFlags();

  if (!siiQueries) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Impuestos</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            Consulta y descarga los documentos tributarios del SII desde Qavante.
          </p>
        </header>
        <FeatureUnavailableState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Impuestos</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Consulta y descarga los documentos tributarios del SII desde Qavante.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/pagar/impuestos/f29"
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="h-full transition-colors hover:border-brand-primary/40"
            header={
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">Impuestos Mensuales</span>
              </div>
            }
          >
            <div className="space-y-2">
              <QavanteBadge variant="success">Disponible</QavanteBadge>
              <p className="text-sm text-neutral-mid">
                Consulta tu Certificado Solemne por folio: IVA débito y crédito, PPM y total a
                pagar. Descarga el PDF original timbrado por el SII.
              </p>
            </div>
          </QavanteCard>
        </Link>

        <QavanteCard
          variant="bordered"
          className="opacity-75"
          header={
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
              <span className="font-medium text-neutral-mid">Impuestos Anuales</span>
            </div>
          }
        >
          <div className="space-y-2">
            <QavanteBadge variant="default">Próximamente — Fase 2</QavanteBadge>
            <p className="text-sm text-neutral-mid">
              Renta anual con simulador de impuestos y descargas del Formulario 22. Llega en una
              próxima entrega.
            </p>
          </div>
        </QavanteCard>

        <Link
          href="/pagar/impuestos/tgr"
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="h-full transition-colors hover:border-brand-primary/40"
            header={
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">Deudas TGR</span>
              </div>
            }
          >
            <p className="text-sm text-neutral-mid">
              Tus deudas con la Tesorería (TGR): giros, multas, PPM e IVA impago, con su saldo y
              vencimiento, y el certificado de deudas en PDF.
            </p>
          </QavanteCard>
        </Link>
      </div>
    </div>
  );
}
