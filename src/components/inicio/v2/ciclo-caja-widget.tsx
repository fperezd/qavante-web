"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { CicloCaja } from "./ciclo-caja-model";

/* Widget "Ciclo de caja" del Inicio: cobras en X días, pagas en Y, y tu plata queda atrapada Z días.
   Presentacional: recibe el ciclo ya derivado. Lleva a /gestion (regla "todo dato lleva a su detalle"). */

export interface CicloCajaWidgetProps {
  data: CicloCaja;
  href?: string;
  cta?: string;
}

function dias(v: number | null): string {
  return v != null ? `${v}` : "s/d";
}

export function CicloCajaWidget({ data, href = "/gestion", cta = "Ver gestión" }: CicloCajaWidgetProps) {
  const { dso, dpo, ccc } = data;
  // Frase en lenguaje de dueño según el signo del ciclo.
  let frase: string;
  let tono: "neg" | "pos" | "neutral";
  if (ccc == null) {
    frase = "Cuando tengamos cobros y pagos con fecha, calculamos cuántos días queda tu plata atrapada.";
    tono = "neutral";
  } else if (ccc > 0) {
    frase = `Tu plata queda ~${ccc} días atrapada entre que pagas y cobras: financias ese tramo tú.`;
    tono = "neg";
  } else if (ccc < 0) {
    frase = `Cobras antes de pagar: tienes ~${Math.abs(ccc)} días de aire (tus proveedores te financian).`;
    tono = "pos";
  } else {
    frase = "Cobras y pagas casi al mismo ritmo.";
    tono = "neutral";
  }

  const stats: { label: string; valor: string; sufijo?: string }[] = [
    { label: "Cobras en", valor: dias(dso), sufijo: "días" },
    { label: "Pagas en", valor: dias(dpo), sufijo: "días" },
    { label: "Ciclo", valor: dias(ccc), sufijo: "días" },
  ];

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Ciclo de caja</span>}
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-neutral-light/30 py-2">
            <p className="text-[11px] text-neutral-mid">{s.label}</p>
            <p className="text-xl font-bold tabular-nums text-neutral-strong">{s.valor}</p>
            {s.sufijo && <p className="text-[11px] text-neutral-mid">{s.sufijo}</p>}
          </div>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 text-sm",
          tono === "neg" && "text-danger-500",
          tono === "pos" && "text-success-700",
          tono === "neutral" && "text-neutral-mid",
        )}
      >
        {frase}
      </p>

      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </QavanteCard>
  );
}
