import Link from "next/link";
import { ArrowLeftRight, Banknote, CheckCircle2, Globe, Inbox, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BankBalances } from "@/components/treasury/bank-balances/bank-balances";
import { CajaV2ResumenLive } from "@/components/caja/v2/caja-v2-resumen-live";

/* Landing del módulo Caja. Sprint C3 MVP cableó `/caja/proyeccion` con el
   reporte agregado de `/api/treasury/reports/cash-flow` — si el flag
   cashFlowReport está ON, mostramos un CTA card hacia esa pantalla. Si
   no, mantenemos el empty informativo "construcción en Sprint C3". Brecha
   vs caja mínima + acciones recomendadas quedan para wave 2 cuando el
   backend exponga los contratos. */
export default function CajaPage() {
  const { bankMovementClassification, cashFlowReport, bankBalances, reconciliationReview, cajaV2 } =
    resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Me alcanza la caja y qué puedo hacer?</p>
      </header>

      {/* Caja v2 (rediseño 2026-07-14): la respuesta de dueño + la curva de saldo encabezan la
          página (contestan el "¿me alcanza?" del título); las cards de abajo quedan como
          herramientas. Con `cajaV2` OFF o sin reporte de caja, la landing cae al menú clásico. */}
      {cajaV2 && cashFlowReport && <CajaV2ResumenLive />}

      {bankBalances && (
        <section aria-labelledby="saldos-section" className="space-y-3">
          <h2 id="saldos-section" className="text-base font-semibold text-neutral-dark">
            Saldos en banco
          </h2>
          <BankBalances />
        </section>
      )}

      {bankMovementClassification ? (
        <section aria-labelledby="movimientos-section" className="space-y-3">
          <h2 id="movimientos-section" className="text-base font-semibold text-neutral-dark">
            Movimientos bancarios
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CajaSubCard
              href="/caja/por-clasificar"
              icon={Inbox}
              title="Por clasificar"
              description="Movimientos pendientes de clasificación. Asigna categoría canónica y cuenta de gestión."
              badge="Acción pendiente"
              badgeVariant="warning"
            />
            <CajaSubCard
              href="/caja/clasificados"
              icon={CheckCircle2}
              title="Clasificados"
              description="Auditoría de los ya clasificados. Filtra por categoría, dirección o período."
              badge="Auditoría"
              badgeVariant="success"
            />
            <CajaSubCard
              href="/caja/compras-extranjero"
              icon={Globe}
              title="Compras al extranjero"
              description="Compras en moneda extranjera de tus cartolas de tarjeta. Asigna concepto y categoría."
              badge="Tarjeta"
              badgeVariant="info"
            />
            {reconciliationReview && (
              <CajaSubCard
                href="/caja/conciliacion"
                icon={ArrowLeftRight}
                title="Conciliación"
                description="Movimientos que calzan con un documento pero sin certeza. Confirmalos de a un clic."
                badge="Acción pendiente"
                badgeVariant="warning"
              />
            )}
          </div>
        </section>
      ) : (
        <FeatureUnavailableState />
      )}

      {/* "Caja proyectada" como card sólo cuando el v2 NO encabeza (fallback): con el v2 arriba
          apunta a lo mismo (redundante), así que se omite. */}
      {!(cajaV2 && cashFlowReport) &&
        (cashFlowReport ? (
        <section aria-labelledby="proyeccion-section" className="space-y-3">
          <h2 id="proyeccion-section" className="text-base font-semibold text-neutral-dark">
            Caja proyectada
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CajaSubCard
              href="/caja/proyeccion"
              icon={TrendingUp}
              title="Reporte de caja"
              description="Entradas y salidas agregadas por período. Default ≈13 semanas con granularidad semanal sobre la capa comprometida."
              badge="Proyección"
              badgeVariant="info"
            />
          </div>
        </section>
      ) : (
        <QavanteEmpty
          icon={Banknote}
          title="Caja proyectada"
          description="Aquí vas a ver tu flujo de caja, la brecha frente a tu caja mínima, las columnas de cobros, pagos, sueldos, impuestos y deuda, y acciones recomendadas. Muy pronto disponible."
        />
        ))}
    </div>
  );
}

interface CajaSubCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
  badgeVariant: "success" | "warning" | "info";
}

function CajaSubCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant,
}: CajaSubCardProps) {
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
          <QavanteBadge variant={badgeVariant}>{badge}</QavanteBadge>
          <p className="text-sm text-neutral-mid">{description}</p>
        </div>
      </QavanteCard>
    </Link>
  );
}
