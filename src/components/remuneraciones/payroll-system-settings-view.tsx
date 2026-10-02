"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import { useLegalEntities } from "@/lib/api/legal-entities";
import { useMe } from "@/lib/api/users";
import { useDeclarePayrollSystem, usePayrollSystem } from "@/lib/api/payroll-system";
import { PayrollSystemCardView } from "./payroll-system-card";
import {
  formToRequest,
  isPayrollSystemId,
  periodOf,
  periodToMonthInput,
} from "./payroll-system-form";

/* Cableado del selector de sistema de remuneraciones (CC-API ADR-0122).

   Resuelve tres cosas que la vista no debe resolver sola:

   1. **Falta de empresa activa.** La API responde 409 `missing_scope:legal_entity`
      porque el setting es de la empresa y no existe una respuesta a nivel cuenta.
      Eso NO es un error que haya que reintentar: es "elige una empresa", y se
      distingue de un 409 cualquiera por su `code`.
   2. **Default del formulario.** Lo declarado si existe; si no, el mes en curso y
      ninguna opción preseleccionada — preseleccionar BUK sería volver a suponer.
   3. **Permiso.** Sólo owner/admin cambian el sistema; el resto ve el estado. El
      backend igual lo exige (403), esto evita ofrecer un botón que iba a fallar. */

const WRITE_ROLES = new Set(["owner", "admin"]);

const MISSING_SCOPE_CODES = new Set(["missing_scope:legal_entity", "missing_scope:tenant"]);

function isMissingCompanyScope(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  /* `client.ts` ya desanida el `code` de `{detail:{code,…}}`; el fallback cubre un
     cuerpo que no pasó por ese camino. */
  const nested = (error.detail as { detail?: { code?: unknown } } | undefined)?.detail?.code;
  return (
    (typeof error.code === "string" && MISSING_SCOPE_CODES.has(error.code)) ||
    (typeof nested === "string" && MISSING_SCOPE_CODES.has(nested))
  );
}

export function PayrollSystemSettingsView() {
  const query = usePayrollSystem();
  const declare = useDeclarePayrollSystem();
  const me = useMe();
  const companies = useLegalEntities();

  const data = query.data;
  const declaredSystem = isPayrollSystemId(data?.payroll_system) ? data.payroll_system : "";
  const declaredMonth = data?.effective_from_period
    ? periodToMonthInput(data.effective_from_period)
    : "";

  const [selected, setSelected] = React.useState("");
  const [monthInput, setMonthInput] = React.useState("");
  /* Qué estado de servidor alimentó el formulario. Mientras no cambie, lo que el
     usuario escribió manda; cuando cambia (carga inicial o un guardado ajeno) el
     formulario se vuelve a sembrar en vez de mostrar una selección vieja. */
  const [seededFrom, setSeededFrom] = React.useState<string | null>(null);

  const serverKey = data ? `${declaredSystem}|${declaredMonth}` : null;
  if (serverKey !== null && serverKey !== seededFrom) {
    setSeededFrom(serverKey);
    setSelected(declaredSystem);
    setMonthInput(declaredMonth || periodToMonthInput(periodOf(new Date())));
  }

  const entities = companies.data?.entities ?? [];
  const activeCompany = entities.find((entity) => entity.id === data?.legal_entity_id);
  const role = me.data?.user.role ?? null;
  /* Sin rol legible NO se bloquea la edición: el backend es el que autoriza, y
     esconder el botón por un `/api/me` que falló sería inventar un permiso. */
  const readOnly = role !== null && !WRITE_ROLES.has(role);

  const request = formToRequest({ payrollSystem: selected, monthInput });
  const unchanged =
    request !== null && request.payroll_system === declaredSystem && monthInput === declaredMonth;

  return (
    <PayrollSystemCardView
      companyName={activeCompany?.legal_name ?? null}
      multipleCompanies={entities.length > 1}
      declared={data?.declared ?? false}
      payrollSystem={data?.payroll_system ?? null}
      adapterState={data?.adapter_state ?? null}
      effectiveFromPeriod={data?.effective_from_period ?? null}
      history={data?.history ?? []}
      selected={selected}
      onSelect={setSelected}
      monthInput={monthInput}
      onMonthInputChange={setMonthInput}
      onSave={() => {
        if (request) declare.mutate(request);
      }}
      canSave={request !== null && !unchanged}
      saving={declare.isPending}
      loading={query.isLoading}
      error={isMissingCompanyScope(query.error) ? undefined : query.error}
      scopeMissing={isMissingCompanyScope(query.error)}
      saveError={declare.error}
      saved={declare.isSuccess}
      readOnly={readOnly}
      onRetry={() => void query.refetch()}
    />
  );
}
