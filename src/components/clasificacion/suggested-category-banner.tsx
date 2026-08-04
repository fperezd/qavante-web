"use client";

import { Sparkles } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { useSuggestedCategory } from "@/lib/api/classification-rules";

/* Banner de sugerencia de CUENTA para el drawer "Clasificar movimiento" (#794-4). Reemplaza al viejo
   banner de "crear una regla de glosa" — pedido de Fernando: "esas reglas ya no se sugerirían, debería
   sugerir la clasificación a algo YA creado".

   El backend aplica sus reglas activas y devuelve la cuenta de gestión que correspondería (read-only).
   Si hay match: "Sugerido: <cuenta> · Clasificar" — un clic clasifica el movimiento a esa cuenta (el
   contenedor resuelve el código→id y corre el mismo `classify` que el guardar del drawer). Si NINGUNA
   regla matchea (`suggestion=null`), no muestra nada: el usuario clasifica a mano con los selectores del
   drawer (no inventamos, no volvemos al banner de regla-de-glosa). GENÉRICO (cualquier empresa). */

export interface SuggestedCategoryBannerProps {
  movementId: string;
  /** Aplica la sugerencia — el contenedor mapea `accountCode`→id de cuenta de gestión y corre el
   *  mismo `classify` que el guardar del drawer. `canonicalCategory` viaja tal cual (puede ser null). */
  onApply: (accountCode: string, canonicalCategory: string | null) => void;
  /** El `classify` del contenedor está corriendo → botón en loading + deshabilitado. */
  applying?: boolean;
}

export function SuggestedCategoryBanner({
  movementId,
  onApply,
  applying = false,
}: SuggestedCategoryBannerProps) {
  const query = useSuggestedCategory(movementId);
  const suggestion = query.data?.suggestion;
  const accountCode = suggestion?.account_code;

  // Sin sugerencia (cargando, error, sin match, o sin cuenta resoluble) → nada. El drawer ya trae los
  // selectores para clasificar a mano; el banner es un atajo opcional, NO bloquea.
  if (!suggestion || !accountCode) return null;

  const nombre = suggestion.account_name || accountCode;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
      <Sparkles className="h-4 w-4 flex-shrink-0 text-brand-primary" aria-hidden="true" />
      <p className="flex-1 text-neutral-dark">
        Sugerido: <span className="font-semibold">{nombre}</span>
        <span className="ml-1 text-xs text-neutral-mid">según tus reglas activas</span>
      </p>
      <QavanteButton
        size="sm"
        onClick={() => onApply(accountCode, suggestion.canonical_category ?? null)}
        disabled={applying}
        loading={applying}
      >
        {applying ? "Clasificando…" : "Clasificar"}
      </QavanteButton>
    </div>
  );
}
