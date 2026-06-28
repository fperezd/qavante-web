import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CreateLoanForm } from "@/components/pagar/create-loan-form";

/* `/pagar/obligaciones/nuevo` — alta de préstamo. Segmento estático: tiene
   precedencia sobre `[id]` en el App Router. Gateado por `obligations`. Server
   Component (regla 4: sin export const runtime). */
export default function PagarObligacionNuevaPage() {
  const { obligations } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <Link
        href="/pagar/obligaciones"
        className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a obligaciones
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Registrar préstamo</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Carga el capital, la tasa mensual y las cuotas. Qavante deriva el calendario de pago y
          concilia las cuotas contra los débitos de tu banco.
        </p>
      </header>

      {obligations ? <CreateLoanForm /> : <FeatureUnavailableState />}
    </div>
  );
}
