"use client";

import * as React from "react";
import { X, Mail, IdCard, Briefcase, UserRound } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { genderLabel, type EmployeeSlim } from "./buk-format";

/* Detalle de empleado — panel modal con los datos slim del BUK (nombre, RUT,
   cargo, email, género, estado). Se abre desde la Dotación (onSelect).

   MVP: muestra solo el slim que ya trae la lista (sin fetch extra). El detalle
   rico del BUK (contrato, fecha de ingreso, AFP/salud, sueldo base) tiene 200+
   campos y datos sensibles — se agrega cuando CC-API cure un contrato de detalle
   seguro (no adivinamos nombres de campo). */

export interface EmpleadoDetalleProps {
  /** Empleado seleccionado (null = cerrado). */
  employee: EmployeeSlim | null;
  onClose: () => void;
}

export function EmpleadoDetalle({ employee, onClose }: EmpleadoDetalleProps) {
  React.useEffect(() => {
    if (!employee) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [employee, onClose]);

  if (!employee) return null;

  const gender = genderLabel(employee.gender);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${employee.fullName}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 bg-brand-primary px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-surface">{employee.fullName}</h2>
            {employee.active !== null && (
              <span className="mt-1 inline-block">
                <QavanteBadge variant={employee.active ? "success" : "default"}>
                  {employee.active ? "Activo" : "Inactivo"}
                </QavanteBadge>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-surface/80 hover:bg-surface/10 hover:text-surface"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="divide-y divide-border/60 p-5">
          <Field icon={IdCard} label="RUT" value={employee.rut} mono />
          <Field icon={Briefcase} label="Cargo" value={employee.role} />
          <Field icon={Mail} label="Email" value={employee.email} />
          <Field icon={UserRound} label="Género" value={gender} />
        </dl>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-neutral-dark hover:bg-surface-muted"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
      <dt className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
        {label}
      </dt>
      <dd className={"text-sm text-neutral-dark" + (mono ? " font-mono" : "")}>
        {value ?? <span className="text-neutral-mid">—</span>}
      </dd>
    </div>
  );
}
