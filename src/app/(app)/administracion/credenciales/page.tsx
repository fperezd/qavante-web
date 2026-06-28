"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import {
  SiiCredentialCard,
  CertificateListView,
  BankCredentialCard,
  CardStatementUpload,
  SourceConsentCard,
} from "@/components/credenciales";
import { useSiiCredential } from "@/lib/api/credentials";

/* Pantalla Administración → Credenciales y conexiones. SII (Opción A, decisión
   Fernando 2026-05-18: UNA credencial por tenant `source_code=sii_rcv` + lista
   multi-holder de certificados; SIN `persons[]`, regla 16) + conexión bancaria
   BICE (RUT + clave, solo lectura). Cada bloque carga independiente: si el SII
   falla, el banco igual se puede configurar. Contrato SII vivo en
   docs/contracts/sii-credentials-contract.md (qavante-api). */
export default function CredencialesPage() {
  const { data, isLoading, isError, error } = useSiiCredential();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Credenciales y conexiones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Las claves que Qavante usa para traer tus datos del SII y de tu banco en nombre de tu
          empresa. Se cifran antes de guardarse.
        </p>
      </header>

      <section aria-labelledby="bank-credential-heading" className="space-y-2">
        <h2 id="bank-credential-heading" className="text-base font-semibold text-neutral-dark">
          Conexión bancaria
        </h2>
        <BankCredentialCard />
        <CardStatementUpload />
      </section>

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
              ? `${error.message}. Prueba refrescar la página.`
              : "Prueba refrescar la página. Si persiste, contacta a soporte."
          }
        />
      )}

      {data && (
        <div className="space-y-6">
          <section aria-labelledby="sii-credential-heading" className="space-y-2">
            <h2 id="sii-credential-heading" className="text-base font-semibold text-neutral-dark">
              Servicio de Impuestos Internos (SII)
            </h2>
            <SiiCredentialCard credential={data} />
            {/* La credencial sola no alcanza: el acceso al SII requiere un
                consentimiento legal explícito (sin él, las consultas dan 403). */}
            <SourceConsentCard sourceCode="sii_rcv" label="Autorización de acceso al SII" />
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
