"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import {
  SiiCredentialCard,
  SiiPersonCredentialCard,
  CertificateListView,
  BankCredentialCard,
  CardStatementUpload,
  SourceConsentCard,
  SiiSyncCard,
  BukCredentialCard,
} from "@/components/credenciales";
import { LinkBankAccountsCard } from "@/components/treasury/link-bank-accounts-card";
import { useSiiCredential, useSiiCredentials } from "@/lib/api/credentials";

/* Pantalla Administración → Credenciales y conexiones. SII (Opción A, decisión
   Fernando 2026-05-18: UNA credencial por tenant `source_code=sii_rcv` + lista
   multi-holder de certificados; SIN `persons[]`, regla 16) + conexión bancaria
   BICE (RUT + clave, solo lectura). Cada bloque carga independiente: si el SII
   falla, el banco igual se puede configurar. Contrato SII vivo en
   docs/contracts/sii-credentials-contract.md (qavante-api). */
export default function CredencialesPage() {
  const { data, isLoading, isError, error } = useSiiCredential();
  // Personas (representantes) registradas → para mostrar el RUT persistido en el
  // card de la clave del representante. Query independiente: si falla, el card cae
  // a su estado "sin configurar" (no tumba la pantalla).
  const siiPersons = useSiiCredentials();

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
        {/* Igual que el SII: la credencial sola no alcanza — leer el portal BICE
            en nombre del tenant requiere un consentimiento legal explícito. Sin
            él, el sync devuelve "Consent missing para bank_bice". */}
        <SourceConsentCard sourceCode="bank_bice" label="Autorización de acceso al banco" />
        {/* Cuentas que BICE trae sin vincular → un clic las mapea a una cuenta
            Qavante y habilita el sync de sus movimientos (handoff CC-API). */}
        <LinkBankAccountsCard />
        <CardStatementUpload />
      </section>

      <section aria-labelledby="buk-consent-heading" className="space-y-2">
        <h2 id="buk-consent-heading" className="text-base font-semibold text-neutral-dark">
          Remuneraciones (BUK)
        </h2>
        {/* Dos pasos (ADR-0056): (1) el token de BUK por empresa habilita el
            registro de la planilla en Pagar (sin él, el sync da "El tenant no
            tiene credencial BUK configurada"); (2) el consentimiento habilita la
            lectura de la dotación/planilla (sin él, 403 "Consent missing"). */}
        <BukCredentialCard />
        <SourceConsentCard sourceCode="buk" label="Autorización de acceso a Remuneraciones (BUK)" />
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
            {/* Clave del representante (persona autorizada) — la que baja el DTE
                por clave (facturas emitidas/recibidas como PDF, #553). Antes solo
                se cargaba en el onboarding; acá se puede (re)ingresar/rotar cuando
                la sesión del SII caduca (era el gap del dte_not_found = 0 docs). */}
            <SiiPersonCredentialCard persons={siiPersons.data?.persons} />
            {/* La credencial sola no alcanza: el acceso al SII requiere un
                consentimiento legal explícito (sin él, las consultas dan 403). */}
            <SourceConsentCard sourceCode="sii_rcv" label="Autorización de acceso al SII" />
            <SiiSyncCard />
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
