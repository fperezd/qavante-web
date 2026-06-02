import Link from "next/link";
import { ArrowUpFromLine, Briefcase, FileInput, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PagarView } from "@/components/pagar/pagar-view";

/* Pagar (Sprint C4). Server Component: resuelve los flags. `accountsPayable`
   ON → la pantalla completa (resumen + 7/14/30 + relación contra caja + pagos/
   obligaciones, contrato FE-first). La sección "Desde el SII" (Impuestos /
   Compras / Honorarios) se mantiene si `siiQueries`. Flag OFF → comportamiento
   previo (SII + placeholder C4). Sin `export const runtime` (regla 4). */
export default function PagarPage() {
  const { siiQueries, accountsPayable } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué debo pagar y qué pagos son críticos?</p>
      </header>

      {accountsPayable && <PagarView />}

      {siiQueries ? (
        <section aria-labelledby="sii-section" className="space-y-3">
          <h2 id="sii-section" className="text-base font-semibold text-neutral-dark">
            Desde el SII
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SiiSubCard
              href="/pagar/impuestos"
              icon={Receipt}
              title="Impuestos"
              description="Consulta tu F29 mensual por folio y descarga el PDF del Certificado Solemne."
              badge="F29 disponible"
            />
            <SiiSubCard
              href="/pagar/facturas-recibidas"
              icon={FileInput}
              title="Libro de Compras"
              description="Documentos de compra del SII: facturas, notas y boletas que te emitieron tus proveedores."
              badge="SII"
            />
            <SiiSubCard
              href="/pagar/honorarios-recibidos"
              icon={Briefcase}
              title="Honorarios recibidos"
              description="Boletas de Honorarios Electrónicas (BHE) emitidas por profesionales con su retención del 13,75%."
              badge="SII"
            />
          </div>
        </section>
      ) : (
        !accountsPayable && <FeatureUnavailableState />
      )}

      {!accountsPayable && (
        <QavanteEmpty
          icon={ArrowUpFromLine}
          title="Pagos a proveedores — construcción en Sprint C4"
          description="Acá vas a ver tus pagos pendientes priorizados, pagos críticos por vencer, recordatorios y proveedores frecuentes. Disponible al cerrar Sprint C4."
        />
      )}
    </div>
  );
}

interface SiiSubCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
}

function SiiSubCard({ href, icon: Icon, title, description, badge }: SiiSubCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <QavanteCard
        variant="bordered"
        className="h-full transition-colors hover:border-brand-primary/40"
        header={
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span className="font-medium">{title}</span>
          </div>
        }
      >
        <div className="space-y-2">
          <QavanteBadge variant="success">{badge}</QavanteBadge>
          <p className="text-sm text-neutral-mid">{description}</p>
        </div>
      </QavanteCard>
    </Link>
  );
}
