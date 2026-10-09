"use client";

import { Landmark } from "lucide-react";

/** Encabezado de /banco (V03), alineado con la maqueta de referencia. */
export function BancoV03PageHeader() {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Landmark className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Banco</h1>
        <p className="text-sm text-neutral-mid">Tus saldos y movimientos, en un solo lugar</p>
      </div>
    </header>
  );
}
