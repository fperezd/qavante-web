"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Link2, LoaderCircle, Lock, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  completeFintocWidget,
  openOfficialFintocWidget,
  type FintocCompletionResult,
} from "@/lib/banco/open-fintoc-widget";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";
import { QavanteButton } from "@/components/qavante";
import { useCompanyScope } from "@/components/shell/company-scope";
import { type LegalEntity } from "@/lib/api/legal-entities";
import { normalizeRut } from "@/lib/validators/rut";
import { fintocConnectionKeys } from "@/lib/api/fintoc-connections";

export function notifyFintocCompletion(
  result: FintocCompletionResult,
  onConnected?: () => void,
): void {
  const options = {
    id: "fintoc-connection-result",
    duration: Infinity,
    ...(onConnected ? { action: { label: "Continuar", onClick: onConnected } } : {}),
  };
  if (result.status === "partial") {
    toast.warning("Banco conectado, pero la primera actualización falló.", {
      ...options,
      description: result.per_account.find((item) => item.sync_error)?.sync_error?.message,
    });
    return;
  }
  toast.success(
    `Banco conectado: ${result.accounts} cuentas, ${result.imported} movimientos`,
    options,
  );
}

const DEFAULT_TRIGGER = "rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white";

export function QavanteBankConnectWidget({
  variant = "button",
  onConnected,
  buttonLabel = "Conectar banco",
  triggerClassName,
  withLinkIcon = false,
}: {
  variant?: "button" | "embedded";
  onConnected?: () => void;
  buttonLabel?: string;
  triggerClassName?: string;
  withLinkIcon?: boolean;
} = {}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [opening, setOpening] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const widgetSucceeded = useRef(false);
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const accept = useAcceptSourceConsent(BANK_SOURCE_CODE);
  const { activeCompany, selectCompany } = useCompanyScope();
  const [holderMismatch, setHolderMismatch] = useState<{
    holder: { name: string; rut: string };
    company: { id: string; name: string };
  } | null>(null);
  const [unregisteredHolder, setUnregisteredHolder] = useState<{
    name: string;
    rut: string;
  } | null>(null);
  const [resolvingMismatch, setResolvingMismatch] = useState(false);
  const companyRut = activeCompany?.identifiers.find(
    (identifier) => identifier.jurisdiction_code === "CL" && identifier.identifier_scheme === "rut",
  );

  const close = () => {
    if (opening) return;
    setOpen(false);
    setAcceptedTerms(false);
  };

  const afterConnected = async (companyId?: string) => {
    if (companyId && companyId !== activeCompany?.id) {
      selectCompany(companyId);
    }
    // The bank is already persisted when this runs. A failed UI refetch must
    // not turn a successful connection into a misleading "save failed" toast.
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: sourcesStatusKeys.all }),
      qc.invalidateQueries({ queryKey: onboardingStatusKeys.status }),
      qc.invalidateQueries({ queryKey: treasuryKeys.all }),
      qc.invalidateQueries({ queryKey: fintocConnectionKeys.all }),
    ]);
    await qc.refetchQueries({ queryKey: onboardingStatusKeys.status }).catch(() => undefined);
  };

  const continueToFintoc = async () => {
    if (!companyRut) {
      toast.error("Falta el RUT de la empresa que será titular de las cuentas");
      return;
    }
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
      await conectarComo();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? apiErrorToUserMessage(err)
          : err instanceof Error
            ? err.message
            : "No se pudo registrar el consentimiento",
      );
    } finally {
      setOpening(false);
    }
  };

  const conectarComo = async () => {
    const legalEntityId = activeCompany?.id;
    if (!acceptedTerms || !companyRut || !legalEntityId) return;
    setOpening(true);
    widgetSucceeded.current = false;
    try {
      setOpen(false);
      await openOfficialFintocWidget({
        legalEntityId,
        onSuccess: (payload) => {
          widgetSucceeded.current = true;
          setSyncing(true);
          void (async () => {
            try {
              const result = await completeFintocWidget(payload, legalEntityId);
              await afterConnected();
              notifyFintocCompletion(result, onConnected);
            } catch (err) {
              const mismatch = mismatchFromError(err);
              if (mismatch) {
                setHolderMismatch(mismatch);
                return;
              }
              const missing = holderFromError(err, "fintoc_holder_not_registered");
              if (missing) {
                setUnregisteredHolder(missing);
                return;
              }
              toast.error(
                err instanceof ApiError
                  ? apiErrorToUserMessage(err)
                  : err instanceof Error
                    ? err.message
                    : "No se pudo guardar el banco",
              );
            } finally {
              setSyncing(false);
            }
          })();
        },
        onExit: () => {
          if (!widgetSucceeded.current) toast.message("Cerraste la conexión bancaria");
        },
      });
      setAcceptedTerms(false);
    } catch (err) {
      setOpen(true);
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

  const content = (
    <IntroStep
      accepted={acceptedTerms}
      opening={opening}
      companyName={activeCompany?.legal_name ?? null}
      companyRut={companyRut?.normalized_value ?? null}
      onAcceptedChange={setAcceptedTerms}
      onContinue={() => void continueToFintoc()}
    />
  );

  const importForCompany = async (companyId: string) => {
    setResolvingMismatch(true);
    setSyncing(true);
    try {
      // El servidor conserva el link canjeado para este segundo paso. El
      // exchange_token del callback no se puede canjear por segunda vez.
      const result = await completeFintocWidget(null, companyId);
      setHolderMismatch(null);
      await afterConnected(companyId);
      notifyFintocCompletion(result, onConnected);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? apiErrorToUserMessage(err)
          : err instanceof Error
            ? err.message
            : "No se pudo importar el banco para esa sociedad",
      );
    } finally {
      setResolvingMismatch(false);
      setSyncing(false);
    }
  };

  return (
    <>
      <Script src="https://js.fintoc.com/v1/" strategy="afterInteractive" />
      {syncing ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-deep/25 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-7 text-center shadow-2xl">
            <LoaderCircle
              className="mx-auto h-9 w-9 animate-spin text-brand-primary"
              aria-hidden="true"
            />
            <p className="mt-4 text-lg font-semibold text-neutral-dark">Guardando la conexión</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-mid">
              Estamos importando las cuentas y movimientos del banco. Esto puede tardar unos
              instantes; no cierres la página.
            </p>
          </div>
        </div>
      ) : null}
      {holderMismatch ? (
        <ExistingCompanyFromHolder
          holder={holderMismatch.holder}
          company={holderMismatch.company}
          pending={resolvingMismatch}
          onCancel={() => setHolderMismatch(null)}
          onUseExisting={importForCompany}
        />
      ) : null}
      {unregisteredHolder ? (
        <UnregisteredHolderDialog
          holder={unregisteredHolder}
          onClose={() => setUnregisteredHolder(null)}
        />
      ) : null}
      {variant === "embedded" ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-light/80 bg-white shadow-sm">
          <header className="bg-brand-deep px-5 py-4 text-white">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">
              Qavante
            </p>
            <h2 className="mt-1 text-lg font-semibold">Conectar un banco</h2>
          </header>
          {content}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              DEFAULT_TRIGGER,
              withLinkIcon && "inline-flex items-center gap-2",
              triggerClassName,
            )}
          >
            {withLinkIcon ? <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {buttonLabel}
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
                {content}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

export function companiesForHolder(companies: LegalEntity[], holderRut: string): LegalEntity[] {
  const normalizedHolderRut = normalizeRut(holderRut);
  return companies.filter((company) =>
    company.identifiers.some(
      (identifier) =>
        identifier.jurisdiction_code === "CL" &&
        identifier.identifier_scheme === "rut" &&
        normalizeRut(identifier.normalized_value) === normalizedHolderRut,
    ),
  );
}

function holderFromError(error: unknown, code: string): { name: string; rut: string } | null {
  if (!(error instanceof ApiError) || error.code !== code) return null;
  const detail = error.detail;
  if (!detail || typeof detail !== "object") return null;
  const nested = (detail as { detail?: unknown }).detail;
  if (!nested || typeof nested !== "object") return null;
  const holder = (nested as { holder?: unknown }).holder;
  if (!holder || typeof holder !== "object") return null;
  const { name, rut } = holder as { name?: unknown; rut?: unknown };
  return typeof rut === "string" && rut
    ? { rut, name: typeof name === "string" && name ? name : "Titular informado por Fintoc" }
    : null;
}

function mismatchFromError(
  error: unknown,
): { holder: { name: string; rut: string }; company: { id: string; name: string } } | null {
  const holder = holderFromError(error, "fintoc_holder_mismatch");
  if (!holder || !(error instanceof ApiError)) return null;
  const nested = (error.detail as { detail?: { company?: { id?: unknown; name?: unknown } } })
    ?.detail;
  const company = nested?.company;
  return typeof company?.id === "string" && typeof company.name === "string"
    ? { holder, company: { id: company.id, name: company.name } }
    : null;
}

function ExistingCompanyFromHolder({
  holder,
  company,
  pending,
  onCancel,
  onUseExisting,
}: {
  holder: { name: string; rut: string };
  company: { id: string; name: string };
  pending: boolean;
  onCancel: () => void;
  onUseExisting: (companyId: string) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-deep/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-neutral-dark">
          Las cuentas pertenecen a otro RUT
        </h2>
        <p className="mt-2 text-sm text-neutral-mid">
          Fintoc informó el RUT {holder.rut}. Las cuentas no se importarán bajo la empresa actual.
        </p>
        <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-50 p-3">
          <p className="text-sm font-medium text-neutral-dark">
            Ya existe una sociedad con este RUT
          </p>
          <p className="mt-1 text-sm text-neutral-mid">{company.name}</p>
          <p className="mt-1 text-xs text-neutral-mid">
            Importaremos las cuentas sólo bajo esa sociedad.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <QavanteButton size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </QavanteButton>
          <QavanteButton size="sm" onClick={() => void onUseExisting(company.id)} loading={pending}>
            Usar {company.name}
          </QavanteButton>
        </div>
      </div>
    </div>
  );
}

function UnregisteredHolderDialog({
  holder,
  onClose,
}: {
  holder: { name: string; rut: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-deep/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unregistered-holder-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="unregistered-holder-title" className="text-lg font-semibold text-neutral-dark">
          Sociedad no registrada
        </h2>
        <p className="mt-2 text-sm text-neutral-mid">
          Fintoc informó el RUT {holder.rut}, que no figura en Empresas. Eliminamos el enlace recién
          creado en Fintoc y no importamos cuentas ni movimientos.
        </p>
        <p className="mt-3 text-sm text-neutral-mid">
          Agrega esa sociedad y declara su RUT en Empresas; después vuelve a conectar el banco.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <QavanteButton size="sm" variant="ghost" onClick={onClose}>
            Cerrar
          </QavanteButton>
          <Link
            href="/administracion/empresas"
            onClick={onClose}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Ir a Empresas
          </Link>
        </div>
      </div>
    </div>
  );
}

function IntroStep({
  accepted,
  opening,
  companyName,
  companyRut,
  onAcceptedChange,
  onContinue,
}: {
  accepted: boolean;
  opening: boolean;
  companyName: string | null;
  companyRut: string | null;
  onAcceptedChange: (value: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto px-5 py-5">
        {companyRut ? (
          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-50 px-4 py-3 text-sm text-neutral-dark">
            Conectarás las cuentas de <strong>{companyName}</strong> ({companyRut}). Fintoc puede
            pedir tu RUT personal para validar el acceso. Antes de importar, comprobaremos el RUT
            titular de cada cuenta y, si es distinto, te pediremos elegir al titular correcto.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Antes de conectar, declara el RUT de la empresa titular.</p>
            <p className="mt-1 text-amber-900">
              Esto evita asociar los movimientos a una sociedad equivocada.
            </p>
            <Link
              href="/administracion/empresas"
              className="mt-2 inline-block font-medium text-brand-primary hover:underline"
            >
              Ir a Empresas
            </Link>
          </div>
        )}
        <div>
          <h3 className="text-xl font-semibold text-neutral-dark">
            Lee tus cuentas bancarias, sin mover dinero
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
          disabled={!accepted || opening || !companyRut}
          loading={opening}
        >
          {companyRut ? "Continuar con Fintoc" : "Declara el RUT para continuar"}
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
