import { FeatureUnavailableState } from "@/components/qavante";
import { FinanciamientoV13Live } from "@/components/financiamiento/v13/financiamiento-v13-live";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import Link from "next/link";

export default function FinanciamientoPage() {
  const { financiamientoV13 } = resolveFeatureFlags();

  return financiamientoV13 ? (
    <FinanciamientoV13Live />
  ) : (
    <FeatureUnavailableState
      title="Financiamiento · todavía no disponible"
      description={
        <>
          Estamos conectando la lectura verificable de deuda, costo y capacidad. Mientras tanto,
          revisa tus préstamos y cuotas en{" "}
          <Link className="font-semibold text-brand-primary underline" href="/pagar/obligaciones">
            Pagar
          </Link>
          .
        </>
      }
    />
  );
}
