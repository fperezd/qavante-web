import Link from "next/link";
import {
  ArrowUpFromLine,
  Banknote,
  Briefcase,
  Building2,
  FileText,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FeatureUnavailableState, QavanteCard, QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PagarView } from "@/components/pagar/pagar-view";
import { PagarV2ViewLive } from "@/components/pagar/v2/pagar-v2-view-live";

/* Pagar (Sprint C4). Server Component: resuelve los flags. La IA se ordena por
   "a quién le pago" en LENGUAJE DE DUEÑO (pedido de Fernando 2026-07-28): arriba
   un acceso a "Ver facturas" (lo que antes era el "Libro de Compras", jerga de
   contador), el hero de prioridad, y una LISTA PLANA de buckets con nombre —
   Proveedores, Honorarios, Remuneraciones, Previred, Impuestos y TGR, Préstamos —
   sin grupos abstractos ni tarjetas duplicadas. Previred (vista propia) y TGR
   quedan para fases 2/3. Sin `export const runtime` (regla 4). */
export default function PagarPage() {
  const { siiQueries, accountsPayable, obligations, remuneraciones, pagarV2 } =
    resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            ¿A quién le pago y qué pagos son críticos?
          </p>
        </div>
        {/* "Ver facturas" arriba y a mano (antes "Libro de Compras (SII)" al fondo). */}
        {siiQueries && (
          <QuickLink href="/pagar/facturas-recibidas" icon={FileText} label="Ver facturas" />
        )}
      </header>

      {/* `pagarV2` (rediseño 2026-07-14) tiene prioridad: respuesta de dueño + brecha de caja.
         Requiere `accountsPayable` (misma fuente). Con OFF, el Pagar clásico intacto. */}
      {pagarV2 && accountsPayable ? <PagarV2ViewLive /> : accountsPayable && <PagarView />}

      {/* Lista PLANA de buckets, en el orden de Fernando. Cada uno gateado por su fuente. */}
      <section aria-labelledby="buckets-pagar" className="space-y-3">
        <h2 id="buckets-pagar" className="sr-only">
          Qué pagar, por tipo
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {siiQueries && (
            <BucketCard
              href="/pagar/proveedores"
              icon={Building2}
              title="Proveedores"
              description="Tus proveedores del año y el vencimiento de cada compra (término editable)."
            />
          )}
          {siiQueries && (
            <BucketCard
              href="/pagar/honorarios"
              icon={Briefcase}
              title="Honorarios"
              description="Los profesionales que te emiten boletas y cuándo les toca cobrar."
            />
          )}
          {remuneraciones && (
            <BucketCard
              href="/remuneraciones"
              icon={Users}
              title="Remuneraciones"
              description="Los sueldos líquidos de tu equipo y su conciliación con el banco."
            />
          )}
          {remuneraciones && (
            <BucketCard
              href="/remuneraciones"
              icon={ShieldCheck}
              title="Previred"
              description="Las imposiciones del mes — AFP, salud y cesantía — y su vencimiento."
            />
          )}
          {siiQueries && (
            <BucketCard
              href="/pagar/impuestos"
              icon={Landmark}
              title="Impuestos y TGR"
              description="Tus impuestos mensuales (IVA, PPM) y tus deudas con la Tesorería (TGR)."
            />
          )}
          {obligations && (
            <BucketCard
              href="/pagar/obligaciones"
              icon={Banknote}
              title="Préstamos"
              description="Tus préstamos y cuotas, conciliados contra los débitos de tu banco."
            />
          )}
        </div>
      </section>

      {!accountsPayable && !siiQueries && <FeatureUnavailableState />}

      {!accountsPayable && (
        <QavanteEmpty
          icon={ArrowUpFromLine}
          title="Pagos a proveedores"
          description="Aquí vas a ver tus pagos pendientes priorizados, los pagos críticos por vencer, recordatorios y proveedores frecuentes. Muy pronto disponible."
        />
      )}
    </div>
  );
}

/** Acceso secundario arriba (pill): "Ver facturas", "Clientes", etc. */
function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-neutral-dark transition-colors hover:border-brand-primary/50 hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
      {label}
    </Link>
  );
}

interface BucketCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Tarjeta de bucket ("a quién le pago"): mismo peso visual para todas, sin badges
    de fuente ("SII") que suenen a contabilidad. */
function BucketCard({ href, icon: Icon, title, description }: BucketCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <QavanteCard
        variant="bordered"
        className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-md"
        header={
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span className="font-medium">{title}</span>
          </div>
        }
      >
        <p className="text-sm text-neutral-mid">{description}</p>
      </QavanteCard>
    </Link>
  );
}
