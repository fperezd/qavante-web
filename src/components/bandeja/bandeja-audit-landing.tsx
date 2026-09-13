import Link from "next/link";

const AUDIT_AREAS = [
  {
    href: "/caja/por-clasificar",
    title: "Movimientos pendientes",
    description: "Revisa movimientos que aún no tienen una categoría registrada.",
  },
  {
    href: "/caja/clasificados",
    title: "Movimientos clasificados",
    description: "Consulta o corrige la categoría que ya quedó registrada.",
  },
  {
    href: "/caja/conciliacion",
    title: "Conciliación",
    description: "Audita los movimientos vinculados con sus documentos.",
  },
] as const;

/**
 * Entrada de auditoría, no una cola de trabajo que compita con la decisión financiera.
 * Los flujos manuales siguen disponibles en sus rutas, pero Inicio y Caja ya muestran las
 * decisiones con las fuentes disponibles antes de sugerir esta revisión opcional.
 */
export function BandejaAuditLanding() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Bandeja</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-mid">
          Aquí puedes auditar el detalle de tus movimientos. La lectura de caja y las decisiones
          financieras se muestran primero en Inicio y Caja.
        </p>
        <Link
          className="mt-3 inline-flex rounded font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          href="/caja"
        >
          Ver estado de caja
        </Link>
      </header>

      <section
        aria-labelledby="auditoria-heading"
        className="rounded-xl border border-border bg-white p-5"
      >
        <div>
          <h2 id="auditoria-heading" className="text-base font-semibold text-neutral-dark">
            Calidad y auditoría de movimientos
          </h2>
          <p className="mt-1 text-sm text-neutral-mid">
            Estas revisiones mejoran el detalle y la trazabilidad de la información.
          </p>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {AUDIT_AREAS.map((area) => (
            <li
              key={area.href}
              className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2 py-4 first:pt-0 last:pb-0"
            >
              <div>
                <h3 className="font-semibold text-neutral-dark">{area.title}</h3>
                <p className="mt-1 text-sm text-neutral-mid">{area.description}</p>
              </div>
              <Link
                href={area.href}
                className="shrink-0 rounded font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Ver detalle
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
