"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { SiiCredentialCard, CertificateListView } from "@/components/credenciales";
import { useSiiCredential } from "@/lib/api/credentials";

/* Pantalla Administración → Credenciales SII. Modelo Opción A (decisión
   Fernando 2026-05-18): UNA credencial SII por tenant (`source_code=sii_rcv`)
   + lista multi-holder de certificados digitales. SIN `persons[]` (fuera de
   scope, regla 16). Contrato vivo en docs/contracts/sii-credentials-contract.md
   (qavante-api); el viejo c1-sii-credentials.md quedó SUPERSEDED. */
export default function CredencialesPage() {
  const { data, isLoading, isError, error } = useSiiCredential();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Credenciales SII</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          La clave del portal SII y los certificados digitales que Qavante usa para acceder al SII
          en nombre de tu empresa.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-neutral-mid">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando credenciales…
        </div>
      )}

      {isError && (
        <QavanteEmpty
          icon={AlertCircle}
          title="No pudimos cargar las credenciales"
          description={
            error instanceof Error
              ? `${error.message}. Probá refrescar la página.`
              : "Probá refrescar la página. Si persiste, contactá a soporte."
          }
        />
      )}

      {data && (
        <div className="space-y-6">
          <section aria-labelledby="sii-credential-heading">
            <h2 id="sii-credential-heading" className="sr-only">
              Credencial SII
            </h2>
            <SiiCredentialCard credential={data} />
          </section>

          <section aria-labelledby="certificates-heading" className="space-y-2">
            <h2 id="certificates-heading" className="text-base font-semibold text-neutral-dark">
              Certificados digitales
            </h2>
            <CertificateListView />
          </section>
        </div>
      )}
    </div>
  );
}
