import Link from "next/link";
import {
  ArrowUpFromLine,
  Briefcase,
  Building2,
  FileInput,
  Landmark,
  Receipt,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PagarView } from "@/components/pagar/pagar-view";
import { PagarV2ViewLive } from "@/components/pagar/v2/pagar-v2-view-live";

/* Pagar (Sprint C4). Server Component: resuelve los flags. `accountsPayable`
   ON → la pantalla completa (resumen + 7/14/30 + relación contra caja + pagos/
   obligaciones, contrato FE-first). La sección "Desde el SII" (Impuestos /
   Compras / Honorarios) se mantiene si `siiQueries`. Flag OFF → comportamiento
   previo (SII + placeholder C4). Sin `export const runtime` (regla 4). */
export default function PagarPage() {
  const { siiQueries, accountsPayable, obligations, remuneraciones, pagarV2 } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué debo pagar y qué pagos son críticos?</p>
      </header>

      {/* `pagarV2` (rediseño 2026-07-14) tiene prioridad: respuesta de dueño + brecha de caja.
         Requiere `accountsPayable` (misma fuente). Con OFF, el Pagar clásico intacto. */}
      {pagarV2 && accountsPayable ? <PagarV2ViewLive /> : accountsPayable && <PagarView />}

      {/* Submenú: Proveedores + Honorarios — TODOS los del año (no solo lo pendiente),
          con el vencimiento derivado (emisión + término editable). Fuente: SII. */}
      {siiQueries && (
        <section aria-labelledby="contrapartes-section" className="space-y-3">
          <h2 id="contrapartes-section" className="text-base font-semibold text-neutral-dark">
            Proveedores y honorarios
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SiiSubCard
              href="/pagar/proveedores"
              icon={Building2}
              title="Proveedores"
              description="Todos tus proveedores del año y el vencimiento de cada compra (término editable). No solo lo pendiente por pagar."
              badge="Todo 2026"
            />
            <SiiSubCard
              href="/pagar/honorarios"
              icon={Briefcase}
              title="Honorarios"
              description="Todos los profesionales que te emitieron BHE este año y su vencimiento (término 5 días, editable)."
              badge="Todo 2026"
            />
          </div>
        </section>
      )}

      {(obligations || remuneraciones) && (
        <section aria-labelledby="obligations-section" className="space-y-3">
          <h2 id="obligations-section" className="text-base font-semibold text-neutral-dark">
            Préstamos y obligaciones
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {obligations && (
              <SiiSubCard
                href="/pagar/obligaciones"
                icon={Landmark}
                title="Préstamos y obligaciones"
                description="Registra tus préstamos (con amortización automática) y concilia las cuotas contra los débitos de tu banco."
                badge="Tesorería"
              />
            )}
            {remuneraciones && (
              <SiiSubCard
                href="/remuneraciones"
                icon={Users}
                title="Remuneraciones"
                description="Tu dotación y la planilla de sueldos. Regístrala en Pagar como obligación y concilia el líquido contra el banco."
                badge="Equipo"
              />
            )}
          </div>
        </section>
      )}

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
          title="Pagos a proveedores"
          description="Aquí vas a ver tus pagos pendientes priorizados, los pagos críticos por vencer, recordatorios y proveedores frecuentes. Muy pronto disponible."
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
