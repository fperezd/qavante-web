"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { ComportamientoPago } from "./comportamiento-pago-model";

/* Widget "Comportamiento de pago" del Inicio: cuántos días, en promedio, pagan tus clientes respecto del
   vencimiento (el diferenciador de Qavante). Presentacional: recibe el dato ya derivado. Lleva a /cobrar. */

export interface ComportamientoPagoWidgetProps {
  data: ComportamientoPago;
  href?: string;
  cta?: string;
}

export function ComportamientoPagoWidget({
  data,
  href = "/cobrar",
  cta = "Ver cobranza",
}: ComportamientoPagoWidgetProps) {
  const { shiftDays, docsComportamiento, docsVencimiento } = data;

  let titular: React.ReactNode;
  let tono: "neg" | "pos" | "neutral" = "neutral";
  if (shiftDays == null) {
    titular = (
      <p className="text-sm text-neutral-mid">
        Todavía no tenemos historial suficiente para estimar cuándo te pagan de verdad.
      </p>
    );
  } else if (shiftDays > 0) {
    tono = "neg";
    titular = (
      <p className="text-sm text-neutral-strong">
        Tus clientes pagan en promedio{" "}
        <span className="font-bold text-danger-500 tabular-nums">{shiftDays} días después</span> del
        vencimiento.
      </p>
    );
  } else if (shiftDays < 0) {
    tono = "pos";
    titular = (
      <p className="text-sm text-neutral-strong">
        Tus clientes pagan en promedio{" "}
        <span className="font-bold text-success-700 tabular-nums">
          {Math.abs(shiftDays)} días antes
        </span>{" "}
        del vencimiento.
      </p>
    );
  } else {
    titular = (
      <p className="text-sm text-neutral-strong">Tus clientes pagan justo al vencimiento.</p>
    );
  }

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Comportamiento de pago</span>}
    >
      {shiftDays != null && (
        <p
          className={cn(
            "text-3xl font-extrabold tabular-nums tracking-tight",
            tono === "neg" && "text-danger-500",
            tono === "pos" && "text-success-700",
            tono === "neutral" && "text-neutral-strong",
          )}
        >
          {shiftDays > 0 ? "+" : shiftDays < 0 ? "−" : ""}
          {Math.abs(shiftDays)} días
        </p>
      )}
      <div className="mt-1">{titular}</div>

      <p className="mt-2 text-xs text-neutral-mid tabular-nums">
        {docsComportamiento} facturas fechadas por su comportamiento real
        {docsVencimiento > 0 && `, ${docsVencimiento} por vencimiento (sin historial)`}.
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
