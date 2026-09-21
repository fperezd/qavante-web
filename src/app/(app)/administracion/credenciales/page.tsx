"use client";

import { Loader2 } from "lucide-react";
import { QavanteInlineError } from "@/components/qavante";
import {
  SiiCredentialCard,
  SiiPersonCredentialCard,
  CertificateListView,
  CardStatementUpload,
  SourceConsentCard,
  SiiSyncCard,
  BukCredentialCard,
  PreviredCredentialCard,
  PreviredEstadoConexion,
} from "@/components/credenciales";
import { BancosConectadosPanel } from "@/components/banco/bancos-conectados-panel";
import { FintocBankActions } from "@/components/banco/fintoc-bank-actions";
import { QavanteBankConnectWidget } from "@/components/banco/qavante-bank-connect-widget";
import { useSiiCredential, useSiiCredentials } from "@/lib/api/credentials";

/* Pantalla Administración → Credenciales y conexiones. SII (Opción A, decisión
   Fernando 2026-05-18: UNA credencial por tenant `source_code=sii_rcv` + lista
   multi-holder de certificados; SIN `persons[]`, regla 16) + bancos vía Fintoc.
   Cada bloque carga independiente: si el SII falla, el banco igual se puede
   configurar. Contrato SII vivo en docs/contracts/sii-credentials-contract.md
   (qavante-api). */

export default function CredencialesPage() {
  const { data, isLoading, isError, error } = useSiiCredential();
  const siiPersons = useSiiCredentials();

  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-light/70 pb-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-mid uppercase">
          Administración
        </p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-dark">Credenciales y conexiones</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-mid">
          Autorizaciones y claves que Qavante usa para leer, en nombre de tu empresa, bancos, SII y
          otras fuentes. El acceso bancario es de solo lectura: no movemos dinero. Las claves se
          cifran antes de guardarse.
        </p>
      </header>

      <section aria-labelledby="bank-credential-heading" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="bank-credential-heading" className="text-base font-semibold text-neutral-dark">
              Bancos de la empresa
            </h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-mid">
              Conecta una o más instituciones a través de Fintoc. Desde aquí administras el enlace y
              actualizas saldos y cartola.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QavanteBankConnectWidget />
            <FintocBankActions />
          </div>
        </div>
        <BancosConectadosPanel />
        {/* El código interno de consentimiento sigue siendo `bank_bice` (fuente canónica
            del API). El copy ya no nombra un banco específico: Fintoc cubre varios. */}
        <SourceConsentCard
          sourceCode="bank_bice"
          label="Autorización para leer cuentas y movimientos"
        />
        <CardStatementUpload />
      </section>

      <section aria-labelledby="buk-consent-heading" className="space-y-2">
        <h2 id="buk-consent-heading" className="text-base font-semibold text-neutral-dark">
          Remuneraciones (BUK)
        </h2>
        <BukCredentialCard />
        <SourceConsentCard sourceCode="buk" label="Autorización de acceso a Remuneraciones (BUK)" />
      </section>

      <section aria-labelledby="previred-heading" className="space-y-2">
        <h2 id="previred-heading" className="text-base font-semibold text-neutral-dark">
          Cotizaciones (Previred)
        </h2>
        <PreviredEstadoConexion />
        <PreviredCredentialCard />
        <SourceConsentCard sourceCode="previred" label="Autorización de acceso a Previred" />
      </section>

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
        <SiiPersonCredentialCard persons={siiPersons.data?.persons} />
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
  );
}
