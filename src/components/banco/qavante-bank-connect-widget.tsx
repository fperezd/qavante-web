"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Lock, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { onboardingStatusKeys } from "@/lib/api/onboarding-status";
import {
  useAcceptSourceConsent,
  useSourceConsent,
  type ConsentMissingResponse,
} from "@/lib/api/source-consent";
import { sourcesStatusKeys } from "@/lib/api/sources-status";
import { treasuryKeys } from "@/lib/api/treasury";
import { completeFintocWidget, openOfficialFintocWidget } from "@/lib/banco/open-fintoc-widget";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";
import { QavanteButton } from "@/components/qavante";

export function QavanteBankConnectWidget({
  variant = "button",
  onConnected,
}: {
  variant?: "button" | "embedded";
  onConnected?: () => void;
} = {}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [opening, setOpening] = useState(false);
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const accept = useAcceptSourceConsent(BANK_SOURCE_CODE);

  const close = () => {
    if (opening) return;
    setOpen(false);
    setAcceptedTerms(false);
  };

  const afterConnected = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: sourcesStatusKeys.all }),
      qc.invalidateQueries({ queryKey: onboardingStatusKeys.status }),
      qc.invalidateQueries({ queryKey: treasuryKeys.all }),
    ]);
    await qc.refetchQueries({ queryKey: onboardingStatusKeys.status });
    if (onConnected) {
      onConnected();
      return;
    }
    window.location.reload();
  };

  const continuarConFintoc = async () => {
    if (!acceptedTerms) {
      toast.error("Marca la casilla para aceptar las condiciones");
      return;
    }
    setOpening(true);
    try {
      if (consent.data?.is_valid !== true) {
        const missing = consent.data as ConsentMissingResponse | undefined;
        await accept.mutateAsync(
          missing?.consent_text_offered
            ? {
                consent_text: missing.consent_text_offered,
                consent_version: missing.consent_version_offered,
              }
            : undefined,
        );
      }
      setOpen(false);
      setAcceptedTerms(false);
      await openOfficialFintocWidget({
        onSuccess: (payload) => {
          void (async () => {
            try {
              const result = await completeFintocWidget(payload);
              toast.success(
                `Banco conectado: ${result.accounts} cuentas, ${result.imported} movimientos`,
              );
              await afterConnected();
            } catch (err) {
              toast.error(
                err instanceof ApiError
                  ? apiErrorToUserMessage(err)
                  : err instanceof Error
                    ? err.message
                    : "No se pudo guardar el banco",
              );
            }
          })();
        },
        onExit: () => {
          toast.message("Cerraste la conexión bancaria");
        },
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? apiErrorToUserMessage(err)
          : err instanceof Error
            ? err.message
            : "No se pudo abrir el widget de Fintoc",
      );
    } finally {
      setOpening(false);
    }
  };

  const intro = (
    <IntroStep
      accepted={acceptedTerms}
      opening={opening}
      onAcceptedChange={setAcceptedTerms}
      onContinue={() => void continuarConFintoc()}
    />
  );

  return (
    <>
      <Script src="https://js.fintoc.com/v1/" strategy="afterInteractive" />
      {variant === "embedded" ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-light/80 bg-white shadow-sm">
          <header className="bg-brand-deep px-5 py-4 text-white">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">
              Qavante
            </p>
            <h2 className="mt-1 text-lg font-semibold">Conectar un banco</h2>
          </header>
          {intro}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white"
          >
            Conectar banco
          </button>
          {open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/50 p-4 backdrop-blur-[2px]">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="qavante-bank-widget-title"
                className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              >
                <header className="bg-brand-deep px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">
                        Qavante
                      </p>
                      <h2 id="qavante-bank-widget-title" className="mt-1 text-lg font-semibold">
                        Conectar un banco
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      disabled={opening}
                      className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 disabled:opacity-50"
                      aria-label="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </header>
                {intro}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function IntroStep({
  accepted,
  opening,
  onAcceptedChange,
  onContinue,
}: {
  accepted: boolean;
  opening: boolean;
  onAcceptedChange: (value: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <h3 className="text-xl font-semibold text-neutral-dark">
            Lee las cuentas de tu empresa, sin mover dinero
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-mid">
            Después de autorizar acá, el banco se elige y se ingresa en el widget oficial de Fintoc.
            Qavante no pide ni guarda la clave del banco.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          <InfoTile
            icon={Shield}
            title="Cifrado"
            body="Tránsito con TLS 1.3 entre Qavante, Fintoc y el banco."
          />
          <InfoTile
            icon={Lock}
            title="Clave privada"
            body="La clave de acceso se ingresa solo en Fintoc, no en Qavante."
          />
          <InfoTile
            icon={Eye}
            title="Solo lectura"
            body="No iniciamos transferencias ni pagos desde acá."
          />
        </ul>
      </div>
      <footer className="space-y-3 border-t border-neutral-light/80 px-5 py-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-light/80 bg-[#F5F7FA] px-3 py-3 text-sm text-neutral-dark">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
          />
          <span>
            Acepto las{" "}
            <Link
              href="/legal/conexion-bancaria#condiciones"
              target="_blank"
              className="font-medium text-brand-primary hover:underline"
            >
              condiciones
            </Link>{" "}
            y la{" "}
            <Link
              href="/legal/conexion-bancaria#privacidad"
              target="_blank"
              className="font-medium text-brand-primary hover:underline"
            >
              privacidad
            </Link>{" "}
            de la conexión bancaria.
          </span>
        </label>
        <QavanteButton
          className="w-full"
          size="lg"
          onClick={onContinue}
          disabled={!accepted || opening}
          loading={opening}
        >
          Continuar con Fintoc
        </QavanteButton>
      </footer>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Shield;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-neutral-light/80 bg-[#F5F7FA] px-3.5 py-3">
      <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-neutral-dark">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-mid">{body}</p>
    </li>
  );
}
