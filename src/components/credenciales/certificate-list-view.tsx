"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, FileBadge2, Trash2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton, QavanteEmpty } from "@/components/qavante";
import {
  useCertificatesList,
  useDeleteCertificateById,
  type CertificateMetadataResponse,
} from "@/lib/api/credentials";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatDateEsCL } from "./format";
import { getBanner } from "./expiration-banner";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

/* Vista de certificados digitales (Opción A: colección multi-holder).
   Compone useCertificatesList + Upload + Delete. Dialog de upload lazy
   (file picker + FileReader + form solo se cargan al abrir). */
const CertificateUploadDialogV2 = dynamic(
  () =>
    import("./certificate-upload-dialog-v2").then((m) => ({
      default: m.CertificateUploadDialogV2,
    })),
  { ssr: false },
);

const BANNER_LABEL: Record<"ok" | "warn" | "urgent" | "expired", string> = {
  ok: "Vigente",
  warn: "Vence pronto",
  urgent: "Vence pronto",
  expired: "Vencido",
};
const BANNER_VARIANT: Record<
  "ok" | "warn" | "urgent" | "expired",
  "success" | "warning" | "danger"
> = {
  ok: "success",
  warn: "warning",
  urgent: "danger",
  expired: "danger",
};

function CertificateRow({
  cert,
  onDelete,
}: {
  cert: CertificateMetadataResponse;
  onDelete: (cert: CertificateMetadataResponse) => void;
}) {
  const banner = getBanner(cert.expires_at);
  const label =
    banner.tone === "warn" || banner.tone === "urgent"
      ? `Vence en ${banner.daysLeft} días`
      : BANNER_LABEL[banner.tone];
  return (
    <QavanteCard variant="bordered">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-brand-primary-50 p-2 text-brand-primary">
          <FileBadge2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-dark">
              {cert.holder_name || cert.rut_holder}
            </p>
            <QavanteBadge variant={BANNER_VARIANT[banner.tone]}>{label}</QavanteBadge>
          </div>
          <p className="text-xs text-neutral-mid">RUT titular: {cert.rut_holder}</p>
          <p className="text-xs text-neutral-mid">Vence: {formatDateEsCL(cert.expires_at)}</p>
          {cert.password_hint && (
            <p className="text-xs text-neutral-mid">Pista: {cert.password_hint}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={`Eliminar certificado de ${cert.holder_name || cert.rut_holder}`}
          onClick={() => onDelete(cert)}
          className="rounded-md p-1.5 text-neutral-mid hover:bg-danger-500/10 hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </QavanteCard>
  );
}

export function CertificateListView() {
  const list = useCertificatesList();
  const del = useDeleteCertificateById();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CertificateMetadataResponse | null>(null);

  if (list.isLoading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-neutral-light/30" />
        ))}
      </div>
    );
  }

  if (list.isError) {
    const message =
      list.error instanceof ApiError
        ? apiErrorToUserMessage(list.error)
        : "No pudimos cargar los certificados. Intenta nuevamente.";
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>{message}</p>
      </div>
    );
  }

  const certificates = list.data?.certificates ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-mid">
          Carga un certificado digital (.pfx) por cada titular. El certificado se usa para firmar
          los requests al SII; la clave del .pfx no se almacena.
        </p>
        <QavanteButton size="sm" onClick={() => setUploadOpen(true)}>
          Subir certificado
        </QavanteButton>
      </div>

      {certificates.length === 0 ? (
        <QavanteEmpty
          title="Todavía no hay certificados"
          description="Subí el primer .pfx del titular correspondiente para empezar."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {certificates.map((c) => (
            <li key={c.id}>
              <CertificateRow cert={c} onDelete={setDeleting} />
            </li>
          ))}
        </ul>
      )}

      <CertificateUploadDialogV2 open={uploadOpen} onOpenChange={setUploadOpen} />

      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title="Eliminar certificado"
        description={
          deleting
            ? `¿Eliminar el certificado de ${deleting.holder_name || deleting.rut_holder}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={del.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
