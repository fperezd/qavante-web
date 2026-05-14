"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ShieldCheck, AlertCircle, AlertTriangle, Trash2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteButton } from "@/components/qavante";
import { useDeleteCertificate, type CertificateStatus } from "@/lib/api/credentials";
import { formatDateEsCL, daysUntil } from "./format";

const CertificateUploadDialog = dynamic(
  () => import("./certificate-upload-dialog").then((m) => ({ default: m.CertificateUploadDialog })),
  { ssr: false },
);
const DeleteConfirmDialog = dynamic(
  () => import("./delete-confirm-dialog").then((m) => ({ default: m.DeleteConfirmDialog })),
  { ssr: false },
);

interface Props {
  certificate: CertificateStatus;
}

type ExpirationBanner =
  | { tone: "ok" }
  | { tone: "warn" | "urgent"; daysLeft: number }
  | { tone: "expired" };

function getBanner(expiresAt?: string): ExpirationBanner {
  if (!expiresAt) return { tone: "ok" };
  const days = daysUntil(expiresAt);
  if (days <= 0) return { tone: "expired" };
  if (days <= 30) return { tone: "urgent", daysLeft: days };
  if (days <= 60) return { tone: "warn", daysLeft: days };
  return { tone: "ok" };
}

export function CertificateCard({ certificate }: Props) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const del = useDeleteCertificate();

  const banner = certificate.configured
    ? getBanner(certificate.expires_at)
    : { tone: "ok" as const };

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await del.mutateAsync();
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  return (
    <>
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span>Certificado digital</span>
          </div>
        }
      >
        {certificate.configured ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-neutral-mid">Titular</p>
                <p className="font-medium text-neutral-dark">{certificate.subject_rut}</p>
              </div>
              <QavanteBadge variant="success">Cargado</QavanteBadge>
            </div>

            {certificate.expires_at && (
              <p className="text-xs text-neutral-mid">
                Vence: {formatDateEsCL(certificate.expires_at)}
              </p>
            )}

            {banner.tone === "warn" && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-warning-500/40 bg-warning-500/10 p-3 text-sm text-warning-600"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Tu certificado vence en {banner.daysLeft} días. Renovalo pronto para evitar
                  interrupciones de servicio.
                </span>
              </div>
            )}
            {banner.tone === "urgent" && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  ¡Urgente! Tu certificado vence en {banner.daysLeft} días. Renovalo ahora.
                </span>
              </div>
            )}
            {banner.tone === "expired" && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-danger-500 bg-danger-500/15 p-3 text-sm font-medium text-danger-500"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Tu certificado expiró. Cargá uno nuevo para que Qavante pueda firmar documentos
                  ante el SII.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <QavanteButton
                size="sm"
                variant="ghost"
                onClick={() => setDeleteOpen(true)}
                aria-label="Eliminar certificado"
              >
                <Trash2 className="h-4 w-4 text-danger-500" aria-hidden="true" />
              </QavanteButton>
              <QavanteButton size="sm" variant="ghost" onClick={() => setUploadOpen(true)}>
                Reemplazar
              </QavanteButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-mid">
              Necesario para emitir documentos electrónicos firmados (factura, F29, etc.). Subí el
              archivo .pfx o .p12 que te entregó tu entidad certificadora.
            </p>
            <div className="flex justify-end pt-2">
              <QavanteButton size="sm" onClick={() => setUploadOpen(true)}>
                Cargar certificado
              </QavanteButton>
            </div>
          </div>
        )}
      </QavanteCard>

      <CertificateUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isReplacement={certificate.configured}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteOpen(false);
            setDeleteError(null);
          }
        }}
        title="Eliminar certificado digital"
        description={
          <>
            ¿Eliminar el certificado actual? Qavante no va a poder firmar documentos ante el SII
            hasta que cargues uno nuevo.
          </>
        }
        error={deleteError}
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
