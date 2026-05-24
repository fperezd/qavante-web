import Link from "next/link";
import { Banknote, CheckCircle2, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Landing del módulo Caja. El módulo completo (caja proyectada 13
   semanas, brecha vs caja mínima, columnas obligatorias, acciones
   recomendadas) llega en Sprint C3. Mientras tanto, este screen muestra
   las sub-secciones ya disponibles del Sprint C2: clasificación de
   movimientos bancarios — antes del empty state del módulo. */
export default function CajaPage() {
  const { bankMovementClassification } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Me alcanza la caja y qué puedo hacer?</p>
      </header>

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
              description="Movimientos pendientes de clasificación. Asigná categoría canónica y cuenta de gestión."
              badge="Acción pendiente"
              badgeVariant="warning"
            />
            <CajaSubCard
              href="/caja/clasificados"
              icon={CheckCircle2}
              title="Clasificados"
              description="Auditoría de los ya clasificados. Filtrá por categoría, dirección o período."
              badge="Auditoría"
              badgeVariant="success"
            />
          </div>
        </section>
      ) : (
        <FeatureUnavailableState />
      )}

      <QavanteEmpty
        icon={Banknote}
        title="Caja proyectada — construcción en Sprint C3"
        description="Acá vas a ver tu flujo de caja a 13 semanas, brecha vs caja mínima, columnas obligatorias (cobros, pagos, sueldos, impuestos, deuda) y acciones recomendadas. Disponible al cerrar Sprint C3."
      />
    </div>
  );
}

interface CajaSubCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
  badgeVariant: "success" | "warning";
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
