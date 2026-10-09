"use client";

import { useMe } from "@/lib/api/users";
import { formatDateHeading } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";

export function InicioHoyPageHeader({ className }: { className?: string }) {
  const me = useMe();
  const empresa = me.data?.user?.tenant_name?.trim() || "Tu empresa";
  const fecha = formatDateHeading(new Date());

  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-dark">Inicio</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Una lectura rápida de cómo está tu empresa y qué necesita atención.
        </p>
      </div>
      <div className="text-left text-sm text-neutral-mid sm:text-right">
        <p className="font-medium text-neutral-dark">{empresa}</p>
        <p>{fecha} · Chile</p>
      </div>
    </header>
  );
}
