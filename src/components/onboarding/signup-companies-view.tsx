"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { useSignup, useSignupContribuyente } from "@/lib/api/onboarding";
import { isValidRut, normalizeRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { Turnstile } from "./turnstile";
import {
  clearSignupAccountDraft,
  readSignupAccountDraft,
  saveExtraSignupTenants,
  type SignupAccountDraft,
} from "./signup-draft";
import { signupCompanyEntrySchema, type SignupCompanyEntryValues } from "./signup-form-schema";
import {
  SignupErrorAlert,
  SignupField,
  SiiRazonSocialInputAssist,
  siiRazonSocialInputPadding,
} from "./signup-form-ui";

const TURNSTILE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

type CompanyRow = SignupCompanyEntryValues & { id: string };

function newCompanyRow(): CompanyRow {
  return { id: crypto.randomUUID(), companyRut: "", companyName: "" };
}

function CompanyRutField({
  row,
  errorRut,
  errorName,
  onChange,
  onRemove,
  canRemove,
}: {
  row: CompanyRow;
  errorRut?: string;
  errorName?: string;
  onChange: (next: SignupCompanyEntryValues) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [lookup, setLookup] = React.useState("");
  const [autoName, setAutoName] = React.useState(false);
  const sii = useSignupContribuyente(lookup, lookup.length > 0);

  React.useEffect(() => {
    if (sii.data?.status === "ok" && sii.data.razon_social && row.companyName.trim() === "") {
      onChange({ companyRut: row.companyRut, companyName: sii.data.razon_social });
      setAutoName(true);
    }
  }, [sii.data?.status, sii.data?.razon_social, row.companyRut, row.companyName, onChange]);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-dark">Empresa</p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs text-neutral-mid hover:text-danger-500"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Quitar
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <SignupField id={`co-rut-${row.id}`} label="RUT de la empresa" error={errorRut}>
          <QavanteInput
            id={`co-rut-${row.id}`}
            variant="rut"
            placeholder="76.123.456-0"
            value={row.companyRut}
            onValueChange={(v) => {
              setLookup("");
              onChange({
                companyRut: v,
                companyName: autoName ? "" : row.companyName,
              });
              if (autoName) setAutoName(false);
            }}
            onBlur={() => {
              if (isValidRut(row.companyRut)) setLookup(normalizeRut(row.companyRut));
            }}
            invalid={Boolean(errorRut)}
          />
        </SignupField>

        <SignupField id={`co-name-${row.id}`} label="Razón social" error={errorName}>
          <SiiRazonSocialInputAssist
            fetching={sii.isFetching}
            filled={sii.data?.status === "ok" && Boolean(sii.data.razon_social)}
            notFound={lookup.length > 0 && sii.data?.status === "not_found"}
            error={lookup.length > 0 && (sii.isError || sii.data?.status === "error")}
            tooltipText="Al ingresarlo traemos la razón social del SII."
          >
            <QavanteInput
              id={`co-name-${row.id}`}
              placeholder="Empresa SpA"
              value={row.companyName}
              onValueChange={(v) => {
                onChange({ ...row, companyName: v });
                setAutoName(false);
              }}
              invalid={Boolean(errorName)}
              autoComplete="organization"
              className={siiRazonSocialInputPadding(
                sii.isFetching || (sii.data?.status === "ok" && Boolean(sii.data.razon_social)),
              )}
            />
          </SiiRazonSocialInputAssist>
        </SignupField>
      </div>
    </div>
  );
}

export function SignupCompaniesView() {
  const router = useRouter();
  const signup = useSignup();
  const [draft, setDraft] = React.useState<SignupAccountDraft | null>(null);
  const [companies, setCompanies] = React.useState<CompanyRow[]>(() => [newCompanyRow()]);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, { rut?: string; name?: string }>
  >({});
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0);

  React.useEffect(() => {
    const saved = readSignupAccountDraft();
    if (!saved) {
      router.replace("/registro");
      return;
    }
    setDraft(saved);
  }, [router]);

  React.useEffect(() => {
    if (signup.isError) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    }
  }, [signup.isError]);

  const captchaOk = !TURNSTILE_CONFIGURED || Boolean(captchaToken);

  const updateCompany = React.useCallback((index: number, values: SignupCompanyEntryValues) => {
    setCompanies((rows) => rows.map((r, i) => (i === index ? { ...r, ...values } : r)));
  }, []);

  function validateCompanies(): SignupCompanyEntryValues[] | null {
    const nextErrors: Record<string, { rut?: string; name?: string }> = {};
    const parsed: SignupCompanyEntryValues[] = [];
    const rutsSeen = new Set<string>();

    companies.forEach((row) => {
      const result = signupCompanyEntrySchema.safeParse({
        companyRut: row.companyRut,
        companyName: row.companyName,
      });
      if (!result.success) {
        const flat = result.error.flatten().fieldErrors;
        nextErrors[row.id] = {
          rut: flat.companyRut?.[0],
          name: flat.companyName?.[0],
        };
        return;
      }
      const rutKey = normalizeRut(result.data.companyRut);
      if (rutsSeen.has(rutKey)) {
        nextErrors[row.id] = { rut: "Este RUT ya está en la lista." };
        return;
      }
      rutsSeen.add(rutKey);
      parsed.push(result.data);
    });

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    return parsed;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;

    const validated = validateCompanies();
    if (!validated) return;

    const [primary, ...extra] = validated;
    if (!primary) return;

    saveExtraSignupTenants(
      extra.map((c) => ({
        legal_name: c.companyName.trim(),
        rut: normalizeRut(c.companyRut),
      })),
    );

    signup.mutate(
      {
        company_name: primary.companyName.trim(),
        company_rut: normalizeRut(primary.companyRut),
        owner_full_name: draft.ownerFullName,
        owner_rut: draft.ownerRut,
        email: draft.email,
        password: draft.password,
        captcha_token: captchaToken || "local-dev",
      },
      {
        onSuccess: () => {
          clearSignupAccountDraft();
          router.push(`/verificar?email=${encodeURIComponent(draft.email)}`);
        },
      },
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <OnboardingShell
      step="register-companies"
      description="Agrega una o más empresas que vas a gestionar en Qavante."
    >
      <form onSubmit={onSubmit} noValidate className="w-full max-w-2xl space-y-4">
        {companies.map((row, index) => (
          <CompanyRutField
            key={row.id}
            row={row}
            errorRut={fieldErrors[row.id]?.rut}
            errorName={fieldErrors[row.id]?.name}
            onChange={(values) => updateCompany(index, values)}
            onRemove={() => setCompanies((rows) => rows.filter((_, i) => i !== index))}
            canRemove={companies.length > 1}
          />
        ))}

        <QavanteButton
          type="button"
          variant="ghost"
          size="sm"
          className="w-full border border-dashed border-border-strong"
          onClick={() => setCompanies((rows) => [...rows, newCompanyRow()])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar otra empresa
        </QavanteButton>

        <Turnstile
          key={captchaKey}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />

        {signup.isError && (
          <SignupErrorAlert
            message={
              signup.error instanceof ApiError
                ? apiErrorToUserMessage(signup.error)
                : "No pudimos crear tu cuenta. Intenta nuevamente."
            }
          />
        )}

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Crear cuenta"
          continueLoading={signup.isPending}
          continueDisabled={!captchaOk}
          onBack={() => router.push("/registro")}
        />
      </form>
    </OnboardingShell>
  );
}
