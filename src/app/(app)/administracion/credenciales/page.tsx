"use client";

import { Loader2 } from "lucide-react";
import { QavanteInlineError } from "@/components/qavante";
import {
  SiiCredentialCard,
  SiiPersonCredentialCard,
  CertificateListView,
  BankCredentialCard,
  CardStatementUpload,
  SourceConsentCard,
  SiiSyncCard,
  BukCredentialCard,
  PreviredCredentialCard,
  PreviredEstadoConexion,
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

      <section aria-labelledby="previred-heading" className="space-y-2">
        <h2 id="previred-heading" className="text-base font-semibold text-neutral-dark">
          Cotizaciones (Previred)
        </h2>
        {/* Dos pasos, como BUK: sin consent el sync NO corre. `previred` no está en la lista de
            fuentes públicas de `_consent_required` (backend), así que `canonical_sync` levanta
            ConsentMissingError y deja connection_status="consent_missing" — la credencial se
            vería "Configurado" y las cotizaciones no llegarían nunca.

            Cada card muestra su propio badge verde, así que con uno de los dos pasos hecho la
            sección se leía como "listo" (reporte de Fernando 16-07-2026: autorizó y el formulario
            quedó vacío). El resumen de arriba deriva UN estado de los dos. */}
        <PreviredEstadoConexion />
        <PreviredCredentialCard />
        <SourceConsentCard sourceCode="previred" label="Autorización de acceso a Previred" />
      </section>

      {/* La sección SII se renderea SIEMPRE. Antes todo (incluidos los certificados y la clave del
          representante) colgaba de que el GET de la credencial SII resolviera: si ese GET fallaba,
          desaparecían también los certificados, que no dependen de él. Ahora solo la tarjeta de la
          credencial gatea por ese query; las demás sub-tarjetas tienen su propio fetch. */}
      <section aria-labelledby="sii-credential-heading" className="space-y-2">
        <h2 id="sii-credential-heading" className="text-base font-semibold text-neutral-dark">
          Servicio de Impuestos Internos (SII)
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-mid">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando la credencial del SII…
          </div>
        ) : isError ? (
          <QavanteInlineError error={error} what="la credencial del SII" />
        ) : data ? (
          <SiiCredentialCard credential={data} />
        ) : null}
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

      {/* Certificados: fetch propio (useCertificatesList), independiente de la credencial SII. */}
      <section aria-labelledby="certificates-heading" className="space-y-2">
        <h2 id="certificates-heading" className="text-base font-semibold text-neutral-dark">
          Certificados digitales
        </h2>
        <CertificateListView />
      </section>
    </div>
  );
}
