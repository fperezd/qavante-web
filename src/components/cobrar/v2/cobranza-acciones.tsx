"use client";

import * as React from "react";
import { Copy, Check, MessageCircle, Mail, CircleCheck, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* CobranzaAcciones — la fila de acciones REALES de cobranza de Cobrar v2. Es lo que
   convierte la pantalla en herramienta: copiar un recordatorio listo, compartirlo por
   WhatsApp/mail (sin destinatario: no tenemos contacto, el gerente lo elige — regla
   "dato automático, no CRM") y marcar al cliente como gestionado. Presentacional: el
   texto/hrefs y los handlers llegan armados desde el contenedor; el "copiado" también
   lo maneja el contenedor (feedback consistente). Reusable en el hero (grande) y en
   cada fila de deudor (chica). */

export interface CobranzaAccionesProps {
  /** Copia el recordatorio al portapapeles (lo hace el contenedor: navigator.clipboard). */
  onCopiar: () => void;
  /** El recordatorio se copió hace un instante → feedback "Copiado". */
  copiado: boolean;
  /** Link WhatsApp con el texto prellenado (sin número). */
  waHref: string;
  /** `mailto:` con asunto+cuerpo (sin destinatario). */
  mailtoHref: string;
  /** Fecha ISO en que se marcó gestionado, o `null` si está pendiente. */
  gestionado: string | null;
  /** Alterna gestionado (marca/desmarca) — persiste en prefs vía el contenedor. */
  onToggleGestionado: () => void;
  /** La mutación de prefs está en vuelo. */
  gestionadoPending?: boolean;
  /** "sm" para las filas de deudor; "md" (default) para el hero. */
  size?: "sm" | "md";
  /** "primary" (default, hero): "Copiar recordatorio" relleno azul. "quiet" (filas): todo outline,
   *  para que el primario NO se repita 14 veces y la lista tenga UN solo foco (el hero). */
  tone?: "primary" | "quiet";
  className?: string;
}

export function CobranzaAcciones({
  onCopiar,
  copiado,
  waHref,
  mailtoHref,
  gestionado,
  onToggleGestionado,
  gestionadoPending = false,
  size = "md",
  tone = "primary",
  className,
}: CobranzaAccionesProps) {
  const sm = size === "sm";
  const quiet = tone === "quiet";
  const btn = cn(
    "inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
    sm ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
  );
  const iconSz = sm ? "size-3.5" : "size-4";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={onCopiar}
        aria-live="polite"
        className={cn(
          btn,
          copiado
            ? "border-success-500/40 bg-success-500/10 text-success-700"
            : quiet
              ? "border-border bg-surface text-brand-primary hover:bg-brand-primary-50"
              : "border-brand-primary bg-brand-primary text-surface hover:bg-brand-primary-600",
        )}
      >
        {copiado ? (
          <Check className={iconSz} aria-hidden="true" />
        ) : (
          <Copy className={iconSz} aria-hidden="true" />
        )}
        {copiado ? "Copiado" : "Copiar recordatorio"}
      </button>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(btn, "border-border bg-surface text-neutral-dark hover:bg-surface-muted")}
      >
        <MessageCircle className={iconSz} aria-hidden="true" />
        WhatsApp
      </a>

      <a
        href={mailtoHref}
        className={cn(btn, "border-border bg-surface text-neutral-dark hover:bg-surface-muted")}
      >
        <Mail className={iconSz} aria-hidden="true" />
        Correo
      </a>

      <button
        type="button"
        onClick={onToggleGestionado}
        disabled={gestionadoPending}
        aria-pressed={gestionado != null}
        className={cn(
          btn,
          "disabled:opacity-50",
          gestionado != null
            ? "border-border bg-surface text-neutral-mid hover:bg-surface-muted"
            : "border-success-500/40 bg-success-500/10 text-success-700 hover:bg-success-500/15",
        )}
      >
        {gestionado != null ? (
          <>
            <Undo2 className={iconSz} aria-hidden="true" />
            Reabrir
          </>
        ) : (
          <>
            <CircleCheck className={iconSz} aria-hidden="true" />
            Marcar gestionado
          </>
        )}
      </button>
    </div>
  );
}
