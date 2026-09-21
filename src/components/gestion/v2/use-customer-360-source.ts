"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvComprasResponse, type RcvVentasResponse } from "@/lib/api/sii";
import { currentPeriodSantiago, shiftPeriod } from "../gestion-format";
import {
  deduplicateCustomer360Documents,
  filterCustomer360FocusDocs,
  customer360DocumentDate,
  type Customer360Document,
  type Customer360Scope,
} from "./contraparte-360-model";

export type Customer360Kind = "ventas" | "compras";

export type Customer360PeriodState = "loading" | "error" | "absent" | "observed" | "observed_zero";

export interface Customer360PeriodCoverage {
  period: string;
  state: Customer360PeriodState;
  count: number | null;
  lastSyncedAt: string | null;
  stale: boolean | null;
  reason:
    | "query_error"
    | "missing_response"
    | "invalid_response"
    | "response_period_mismatch"
    | "document_period_mismatch"
    | null;
}

export interface Customer360MonthInput {
  period: string;
  state: "loading" | "error" | "success" | "absent";
  response?: RcvVentasResponse | RcvComprasResponse;
}

export interface Customer360SourceState {
  scope: Customer360Scope;
  periods: string[];
  coverage: Customer360PeriodCoverage[];
  focusDocs: Customer360Document[];
  canAggregatePeriods: boolean;
  /** Todos los meses de la ventana respondieron con evidencia válida. */
  isCoverageComplete: boolean;
  isInitialLoading: boolean;
  stalePeriods: string[];
  invalidDateDocuments: number;
  ambiguousDocumentIdentities: number;
}

const PERIOD_COUNT = 12;

function santiagoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Scope único del 360: doce meses inclusivos, con el mes actual cortado por el mismo `asOf`. */
export function customer360Scope(asOf: Date): Customer360Scope {
  const periodTo = currentPeriodSantiago(asOf);
  return {
    periodFrom: shiftPeriod(periodTo, -(PERIOD_COUNT - 1)),
    periodTo,
    asOf: asOf.toISOString(),
    asOfDate: santiagoDate(asOf),
    timeZone: "America/Santiago",
  };
}

/** Lista exacta del scope. No usa el cap global de `expandPeriodRange`. */
export function customer360Periods(scope: Customer360Scope): string[] {
  return Array.from({ length: PERIOD_COUNT }, (_, index) => shiftPeriod(scope.periodFrom, index));
}

function endpoint(kind: Customer360Kind, period: string): string {
  return `/api/sii/rcv/${kind}?periodo=${encodeURIComponent(period)}`;
}

function queryKey(kind: Customer360Kind, period: string) {
  const params = { periodo: period };
  return kind === "ventas" ? siiKeys.rcvVentas(params) : siiKeys.rcvCompras(params);
}

function finiteAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
  if (typeof value !== "string" || !/^[+-]?\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function folio(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

/** Adaptador local fail-closed: monto ausente o inválido permanece `null`, nunca `$0`. */
export function adaptCustomer360Document(
  raw: unknown,
  sourcePeriod: string,
  sourceIndex: number,
): Customer360Document {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    sourcePeriod,
    sourceIndex,
    rut: typeof value.rut_contraparte === "string" ? value.rut_contraparte : "",
    name: typeof value.razon_social === "string" ? value.razon_social : "",
    fecha: typeof value.fecha === "string" ? value.fecha : "",
    monto: finiteAmount(value.monto_total),
    folio: folio(value.folio),
    tipoDoc: integer(value.tipo_doc),
    refFolio: integer(value.ref_folio),
    refTipoDoc: integer(value.ref_tipo_doc),
    reclamado: value.reclamado === true,
  };
}

function responseDocs(
  kind: Customer360Kind,
  response: RcvVentasResponse | RcvComprasResponse,
): unknown[] | null {
  const key = kind === "ventas" ? "ventas" : "compras";
  const value = response[key];
  return Array.isArray(value) ? value : null;
}

/** Compone cobertura + población sin esconder meses fallidos. Exportado para pruebas contractuales. */
export function composeCustomer360Source(
  kind: Customer360Kind,
  scope: Customer360Scope,
  inputs: Customer360MonthInput[],
): Customer360SourceState {
  const periods = customer360Periods(scope);
  const byPeriod = new Map(inputs.map((input) => [input.period, input]));
  const docs: Customer360Document[] = [];
  let invalidDateDocuments = 0;
  const coverage = periods.map((period): Customer360PeriodCoverage => {
    const input = byPeriod.get(period);
    if (!input || input.state === "absent") {
      return {
        period,
        state: "absent",
        count: null,
        lastSyncedAt: null,
        stale: null,
        reason: "missing_response",
      };
    }
    if (input.state === "loading") {
      return {
        period,
        state: "loading",
        count: null,
        lastSyncedAt: null,
        stale: null,
        reason: null,
      };
    }
    if (input.state === "error") {
      return {
        period,
        state: "error",
        count: null,
        lastSyncedAt: null,
        stale: null,
        reason: "query_error",
      };
    }

    const response = input.response;
    if (!response || response.status !== "ok") {
      return {
        period,
        state: "absent",
        count: null,
        lastSyncedAt: response?.last_synced_at ?? null,
        stale: response?.stale ?? null,
        reason: "invalid_response",
      };
    }
    if (response.periodo !== period) {
      return {
        period,
        state: "absent",
        count: Number.isSafeInteger(response.count) ? response.count : null,
        lastSyncedAt: response.last_synced_at ?? null,
        stale: response.stale,
        reason: "response_period_mismatch",
      };
    }
    const rawDocs = responseDocs(kind, response);
    if (rawDocs === null || response.count !== rawDocs.length) {
      return {
        period,
        state: "absent",
        count: Number.isSafeInteger(response.count) ? response.count : null,
        lastSyncedAt: response.last_synced_at ?? null,
        stale: response.stale,
        reason: "invalid_response",
      };
    }
    const monthDocs = rawDocs.map((raw, index) => adaptCustomer360Document(raw, period, index));
    const invalidDates = monthDocs.filter((doc) => customer360DocumentDate(doc.fecha) === null);
    invalidDateDocuments += invalidDates.length;
    if (invalidDates.length > 0) {
      return {
        period,
        state: "absent",
        count: rawDocs.length,
        lastSyncedAt: response.last_synced_at ?? null,
        stale: response.stale,
        reason: "invalid_response",
      };
    }
    if (monthDocs.some((doc) => customer360DocumentDate(doc.fecha)?.slice(0, 7) !== period)) {
      return {
        period,
        state: "absent",
        count: rawDocs.length,
        lastSyncedAt: response.last_synced_at ?? null,
        stale: response.stale,
        reason: "document_period_mismatch",
      };
    }
    docs.push(...monthDocs);
    return {
      period,
      state: rawDocs.length === 0 ? "observed_zero" : "observed",
      count: rawDocs.length,
      lastSyncedAt: response.last_synced_at ?? null,
      stale: response.stale,
      reason: null,
    };
  });
  const deduplicated = deduplicateCustomer360Documents(docs);

  return {
    scope,
    periods,
    coverage,
    focusDocs: filterCustomer360FocusDocs(deduplicated.docs, scope),
    // Un 360 puede ser útil desde el primer mes observado. La cobertura incompleta se conserva
    // separada para rotular el universo y no convertir meses ausentes en $0.
    canAggregatePeriods: coverage.some(
      (month) => month.state === "observed" || month.state === "observed_zero",
    ),
    isCoverageComplete: coverage.every(
      (month) => month.state === "observed" || month.state === "observed_zero",
    ),
    isInitialLoading: coverage.some((month) => month.state === "loading") && docs.length === 0,
    stalePeriods: coverage.filter((month) => month.stale === true).map((month) => month.period),
    invalidDateDocuments,
    ambiguousDocumentIdentities: deduplicated.ambiguousIdentities,
  };
}

export function useCustomer360Source(
  kind: Customer360Kind,
  enabled = true,
): Customer360SourceState {
  const [capturedAsOf] = React.useState(() => new Date());
  const scope = React.useMemo(() => customer360Scope(capturedAsOf), [capturedAsOf]);
  const periods = React.useMemo(() => customer360Periods(scope), [scope]);
  const results = useQueries({
    queries: periods.map((period) => ({
      queryKey: queryKey(kind, period),
      queryFn: () => api.get<RcvVentasResponse | RcvComprasResponse>(endpoint(kind, period)),
      staleTime: 10 * 60 * 1000,
      retry: false,
      enabled,
    })),
  });

  const inputs = periods.map((period, index): Customer360MonthInput => {
    const result = results[index];
    if (!enabled || !result) return { period, state: "absent" };
    if (result.isError) return { period, state: "error" };
    if (result.isPending || (result.isFetching && result.data === undefined)) {
      return { period, state: "loading" };
    }
    if (result.data === undefined) return { period, state: "absent" };
    return { period, state: "success", response: result.data };
  });

  return composeCustomer360Source(kind, scope, inputs);
}
