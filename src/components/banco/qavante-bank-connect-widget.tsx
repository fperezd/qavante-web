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
import {
  completeFintocWidget,
  openOfficialFintocWidget,
  type FintocCompletionResult,
  type FintocHolderType,
} from "@/lib/banco/open-fintoc-widget";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";
import { QavanteButton } from "@/components/qavante";
import { useCompanyScope } from "@/components/shell/company-scope";
import {
  legalEntityKeys,
  type LegalEntity,
  useCreateLegalEntity,
  useDeclareLegalEntityIdentifier,
} from "@/lib/api/legal-entities";
import { normalizeRut } from "@/lib/validators/rut";

export function QavanteBankConnectWidget({
  variant = "button",
  onConnected,
  buttonLabel = "Conectar banco",
}: {
  variant?: "button" | "embedded";
  onConnected?: () => void;
  buttonLabel?: string;
} = {}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "holder-type">("intro");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [opening, setOpening] = useState(false);
  const consent = useSourceConsent(BANK_SOURCE_CODE);
  const accept = useAcceptSourceConsent(BANK_SOURCE_CODE);
  const { activeCompany, companies, selectCompany } = useCompanyScope();
  const createCompany = useCreateLegalEntity();
  const declareIdentifier = useDeclareLegalEntityIdentifier();
  const [holderToCreate, setHolderToCreate] = useState<{ name: string; rut: string } | null>(null);
  const [resolvingMismatch, setResolvingMismatch] = useState(false);
  const companyRut = activeCompany?.identifiers.find(
    (identifier) => identifier.jurisdiction_code === "CL" && identifier.identifier_scheme === "rut",
  );

  const close = () => {
    if (opening) return;
    setOpen(false);
    setAcceptedTerms(false);
    setStep("intro");
  };

  const afterConnected = async (companyId?: string) => {
    if (companyId && companyId !== activeCompany?.id) {
      selectCompany(companyId);
    }
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

  const showCompletionResult = (result: FintocCompletionResult) => {
    if (result.status === "partial") {
      toast.warning("Banco conectado, pero la primera actualización falló.", {
        description: result.per_account.find((item) => item.sync_error)?.sync_error?.message,
      });
      return;
    }
    toast.success(`Banco conectado: ${result.accounts} cuentas, ${result.imported} movimientos`);
  };

  const continueToHolderType = async () => {
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
      setStep("holder-type");
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

  const conectarComo = async (holderType: FintocHolderType) => {
    const legalEntityId = activeCompany?.id;
    if (!acceptedTerms || !companyRut || !legalEntityId) return;
    setOpening(true);
    try {
      setOpen(false);
      await openOfficialFintocWidget({
        holderType,
        legalEntityId,
        onSuccess: (payload) => {
          void (async () => {
            try {
              const result = await completeFintocWidget(payload, legalEntityId);
              showCompletionResult(result);
              await afterConnected();
            } catch (err) {
              const holder = holderFromMismatch(err);
              if (holder) {
                setHolderToCreate(holder);
                return;
              }
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
      setStep("intro");
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

  const content =
    step === "intro" ? (
      <IntroStep
        accepted={acceptedTerms}
        opening={opening}
        companyName={activeCompany?.legal_name ?? null}
        companyRut={companyRut?.normalized_value ?? null}
        onAcceptedChange={setAcceptedTerms}
        onContinue={() => void continueToHolderType()}
      />
    ) : (
      <ChooseHolderTypeStep
        opening={opening}
        onBack={() => setStep("intro")}
        onSelect={(holderType) => void conectarComo(holderType)}
      />
    );

  const importForCompany = async (companyId: string) => {
    setResolvingMismatch(true);
    try {
      // El servidor conserva el link canjeado para este segundo paso. El
      // exchange_token del callback no se puede canjear por segunda vez.
      const result = await completeFintocWidget(null, companyId);
      setHolderToCreate(null);
      showCompletionResult(result);
      await afterConnected(companyId);
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
    }
  };

  return (
    <>
      <Script src="https://js.fintoc.com/v1/" strategy="afterInteractive" />
      {holderToCreate ? (
        <CreateCompanyFromHolder
          holder={holderToCreate}
          matchingCompanies={companiesForHolder(companies, holderToCreate.rut)}
          pending={createCompany.isPending || declareIdentifier.isPending || resolvingMismatch}
          onCancel={() => setHolderToCreate(null)}
          onUseExisting={importForCompany}
          onConfirm={async (legalName) => {
            const company = await createCompany.mutateAsync({ legal_name: legalName });
            await declareIdentifier.mutateAsync({
              id: company.id,
              jurisdiction_code: "CL",
              identifier_scheme: "rut",
              value: holderToCreate.rut,
            });
            await qc.refetchQueries({ queryKey: legalEntityKeys.all });
            await importForCompany(company.id);
          }}
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
            className="rounded-full bg-neutral-dark px-4 py-2 text-sm font-semibold text-white"
          >
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

function holderFromMismatch(error: unknown): { name: string; rut: string } | null {
  if (!(error instanceof ApiError) || error.code !== "fintoc_holder_mismatch") return null;
  const detail = error.detail;
  if (!detail || typeof detail !== "object") return null;
  const nested = (detail as { detail?: unknown }).detail;
  if (!nested || typeof nested !== "object") return null;
  const holder = (nested as { holder?: unknown }).holder;
  if (!holder || typeof holder !== "object") return null;
  const { name, rut } = holder as { name?: unknown; rut?: unknown };
  return typeof rut === "string" && rut
    ? { rut, name: typeof name === "string" && name ? name : "Nueva empresa" }
    : null;
}

function CreateCompanyFromHolder({
  holder,
  matchingCompanies,
  pending,
  onCancel,
  onUseExisting,
  onConfirm,
}: {
  holder: { name: string; rut: string };
  matchingCompanies: LegalEntity[];
  pending: boolean;
  onCancel: () => void;
  onUseExisting: (companyId: string) => Promise<void>;
  onConfirm: (legalName: string) => Promise<void>;
}) {
  const [name, setName] = useState(holder.name);
  const existingCompany = matchingCompanies[0];
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
          FinToc informó el RUT {holder.rut}. Las cuentas no se importarán bajo la empresa actual.
        </p>
        {existingCompany ? (
          <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-50 p-3">
            <p className="text-sm font-medium text-neutral-dark">
              Ya existe un titular con este RUT
            </p>
            <p className="mt-1 text-sm text-neutral-mid">{existingCompany.legal_name}</p>
            <p className="mt-1 text-xs text-neutral-mid">
              Importaremos las cuentas sólo bajo ese titular.
            </p>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-sm font-medium text-neutral-dark">
              Nombre del titular
              <input
                className="mt-1 w-full rounded-md border border-neutral-light px-3 py-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-neutral-mid">
              Al confirmar, registrarás al titular con ese RUT y reintentaremos la importación.
            </p>
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <QavanteButton size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </QavanteButton>
          {existingCompany ? (
            <QavanteButton
              size="sm"
              onClick={() => {
                void onUseExisting(existingCompany.id).catch((error: unknown) => {
                  toast.error(
                    error instanceof ApiError
                      ? apiErrorToUserMessage(error)
                      : "No pudimos importar las cuentas. Intenta nuevamente.",
                  );
                });
              }}
              loading={pending}
            >
              Usar {existingCompany.legal_name}
            </QavanteButton>
          ) : (
            <QavanteButton
              size="sm"
              onClick={() => {
                void onConfirm(name.trim()).catch((error: unknown) => {
                  toast.error(
                    error instanceof ApiError
                      ? apiErrorToUserMessage(error)
                      : "No pudimos crear la empresa. Intenta nuevamente.",
                  );
                });
              }}
              loading={pending}
              disabled={name.trim().length < 2}
            >
              Registrar titular e importar
            </QavanteButton>
          )}
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
            Conectarás las cuentas de <strong>{companyName}</strong> ({companyRut}). FinToc puede
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

function ChooseHolderTypeStep({
  opening,
  onBack,
  onSelect,
}: {
  opening: boolean;
  onBack: () => void;
  onSelect: (holderType: FintocHolderType) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 overflow-y-auto px-5 py-5">
        <div>
          <h3 className="text-xl font-semibold text-neutral-dark">
            ¿A nombre de quién está la cuenta?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-mid">
            Elige el tipo de titular para abrir el flujo correspondiente en Fintoc. Después
            verificaremos el RUT real de la cuenta antes de guardarla.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect("individual")}
            disabled={opening}
            className="rounded-xl border border-brand-primary/25 bg-brand-primary-50 p-4 text-left hover:border-brand-primary disabled:opacity-60"
          >
            <span className="block font-semibold text-neutral-dark">Individual</span>
            <span className="mt-1 block text-sm text-neutral-mid">
              Cuenta bancaria de una persona.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelect("business")}
            disabled={opening}
            className="rounded-xl border border-brand-primary/25 bg-brand-primary-50 p-4 text-left hover:border-brand-primary disabled:opacity-60"
          >
            <span className="block font-semibold text-neutral-dark">Business</span>
            <span className="mt-1 block text-sm text-neutral-mid">
              Cuenta bancaria de una empresa.
            </span>
          </button>
        </div>
        <p className="text-xs text-neutral-mid">
          En sandbox, Fintoc puede mostrar permisos pendientes para algunas cuentas Business.
        </p>
      </div>
      <footer className="border-t border-neutral-light/80 px-5 py-4">
        <QavanteButton type="button" variant="ghost" onClick={onBack} disabled={opening}>
          Volver
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
