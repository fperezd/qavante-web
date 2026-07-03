"use client";

import * as React from "react";
import { Users, UserX, Search, Inbox } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
  QavanteInlineError,
  QavanteInput,
} from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { EmployeesListResponse } from "@/lib/api/buk";
import { filterEmployees, normalizeEmployee, type EmployeeSlim } from "./buk-format";

/* Dotación — lista de empleados del BUK (sección Remuneraciones). Presentacional:
   recibe la query por prop (el page invoca useBukEmployees). Filtro por texto es
   local (client-side) sobre la página descargada. Clic en fila → onSelect (abre
   el detalle). Estados canónicos: loading / error / vacío / con datos. */

export interface DotacionViewProps {
  /** Query de TanStack invocada por el page (useBukEmployees). */
  query: UseQueryResult<EmployeesListResponse, unknown>;
  /** Callback al seleccionar un empleado (abre detalle). Opcional. */
  onSelect?: (employee: EmployeeSlim) => void;
}

export function DotacionView({ query, onSelect }: DotacionViewProps) {
  const [search, setSearch] = React.useState("");

  const employees = React.useMemo<EmployeeSlim[]>(
    () => (query.data?.employees ?? []).map((e) => normalizeEmployee(e as Record<string, unknown>)),
    [query.data],
  );
  const filtered = React.useMemo(() => filterEmployees(employees, search), [employees, search]);

  if (query.isLoading) {
    return (
      <div
        className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando dotación"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="la dotación de empleados" />;
  }

  if (employees.length === 0) {
    return (
      <QavanteEmpty
        icon={Users}
        title="Sin empleados en la dotación"
        description="No hay empleados registrados en el conector de Remuneraciones (BUK) para esta empresa, o todavía no se sincronizó. Verifica la conexión en Credenciales."
      />
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Dotación</span>
          <QavanteBadge variant="info">
            {filtered.length} {filtered.length === 1 ? "empleado" : "empleados"}
            {search && employees.length !== filtered.length && (
              <span className="ml-1 text-xs opacity-80">de {employees.length}</span>
            )}
          </QavanteBadge>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-mid"
            aria-hidden="true"
          />
          <QavanteInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por nombre, RUT, cargo o email"
            autoComplete="off"
            aria-label="Buscar empleado"
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <QavanteEmpty
            icon={Inbox}
            title="Sin resultados"
            description="Ningún empleado coincide con la búsqueda. Prueba con otro término."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Nombre
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    RUT
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Cargo
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const clickable = Boolean(onSelect);
                  return (
                    <tr
                      key={e.id || `${e.fullName}-${i}`}
                      onClick={clickable ? () => onSelect?.(e) : undefined}
                      onKeyDown={
                        clickable
                          ? (ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                onSelect?.(e);
                              }
                            }
                          : undefined
                      }
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? "button" : undefined}
                      className={cn(
                        "border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted",
                        clickable &&
                          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                      )}
                    >
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-2 text-neutral-dark">
                          {e.fullName}
                          {e.active === false && (
                            <QavanteBadge variant="default">
                              <UserX className="mr-1 inline h-3 w-3" aria-hidden="true" />
                              Inactivo
                            </QavanteBadge>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">
                        {e.rut ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-neutral-dark">{e.role ?? "—"}</td>
                      <td className="py-2 text-neutral-mid">{e.email ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-neutral-mid">
          Datos del conector de Remuneraciones (BUK). La búsqueda se aplica sobre los empleados
          descargados.
        </p>
      </div>
    </QavanteCard>
  );
}
