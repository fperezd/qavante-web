import { HeartPulse, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { QavanteBadge, QavanteEmpty } from "@/components/qavante";

/* Salud (PULSO + Health Score, ADR-0064). **Server Component**.

   Regla de honestidad de datos (qavante-api#936, HYGIENE_SWEEP V7): dato
   faltante ≠ dato demo. Esta pantalla NO muestra números hasta que exista el
   motor v2 del backend (qavante-api #492 PULSO / #495 QHS) y el cableado a
   datos reales (qavante-web #487): siempre renderiza el estado "En
   construcción", sin datos de ejemplo, en TODOS los ambientes.

   El prototipo visual sigue vivo para diseño en Storybook (`SaludView` +
   `salud-fixtures`), fuera de la app. Cuando llegue el dato real, #487
   reintroduce acá la vista gateada por `saludScreen` (patrón ADR-0008),
   consumiendo el endpoint real — nunca fixtures. */
export default function SaludPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-neutral-dark">Salud de tu empresa</h1>
          <QavanteBadge variant="warning">En construcción</QavanteBadge>
        </div>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Te alcanza la plata este mes y hacia dónde va tu empresa?
        </p>
      </header>
      <QavanteEmpty
        icon={HeartPulse}
        title="Salud de tu empresa"
        description="Aquí vas a ver tus dos lecturas en una sola pantalla: el Pulso (cómo viene la caja de este mes) y el Health Score (hacia dónde va tu empresa), con las causas y qué decisiones puedes tomar. Muy pronto disponible."
      />
    </div>
  );
}
