"use client";

import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { QavanteEmpty } from "@/components/qavante";
import { SiiCompanyCard, SiiPersonsList, CertificateCard } from "@/components/credenciales";
import { useSiiCredentialsStatus } from "@/lib/api/credentials";

export default function CredencialesPage() {
  const { data, isLoading, isError, error } = useSiiCredentialsStatus();

  return (
    <div className="space-y-6">
      <header>
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-mid">
          <Link href="/administracion" className="hover:text-brand-primary">
            Administración
          </Link>
          <span className="px-2" aria-hidden="true">
            ›
          </span>
          <span className="text-neutral-dark">Credenciales SII</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold text-neutral-dark">Credenciales SII</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Las claves y el certificado que Qavante usa para acceder al portal SII en nombre de tu
          empresa.
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <SiiCompanyCard company={data.company} />
          </div>
          <div className="md:col-span-2">
            <SiiPersonsList persons={data.persons} />
          </div>
          <div className="md:col-span-2">
            <CertificateCard certificate={data.certificate} />
          </div>
        </div>
      )}
    </div>
  );
}
