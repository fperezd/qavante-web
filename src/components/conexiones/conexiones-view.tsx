"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";
import { QavanteBadge, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useSourcesStatus, visibleSources, type SourceStatus } from "@/lib/api/sources-status";
import { cn } from "@/lib/utils";
import { sourceToConnectionCopy, sourceToImpactLine, type ConnectionTone } from "./conexiones-copy";

/* Pantalla Conexiones (V11). Las piezas de presentación se exportan sueltas —
   `ConexionesCargando`, `ConexionesVacio`, `ConexionesTabla`— para que las stories puedan
   renderear cada estado sin depender de la red: el runner de Storybook NO levanta MSW, así que
   un componente que sólo se arma desde `useQuery` queda sin cobertura de vacío ni de carga. */

/** Sólo el COLOR sale del tono; la etiqueta la manda `copy.statusLabel`. Al revés (que era lo
 *  que hacía la vista) `syncing`, `stale` y `unavailable` se pintaban todos "Al día ✓". */
const TONE_VARIANT: Record<ConnectionTone, "success" | "warning" | "danger" | "info" | "default"> =
  {
    ok: "success",
    syncing: "info",
    info: "info",
    action: "warning",
    missing: "default",
    unknown: "default",
  };

export function ConexionesCargando() {
  return (
    <div className="space-y-3">
      {/* Ley 8: el estado de carga habla y tiene estimación. Antes eran 4 barras `aria-hidden`
          sin texto — un lector de pantalla no recibía absolutamente nada. */}
      <p role="status" aria-live="polite" className="text-sm text-neutral-mid">
        Revisando el estado de tus conexiones…
      </p>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}

export function ConexionesVacio() {
  return (
    <QavanteEmpty
      icon={PlugZap}
      title="No hay ninguna fuente que mostrar"
      description="Qavante respondió sin fuentes visibles para esta empresa: o todavía no se le asignó ninguna, o las que hay están ocultas del indicador. Mientras tanto no estamos leyendo documentos ni movimientos de ningún lado."
      cta={
        <Link
          href="/administracion/credenciales"
          className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Conectar una fuente
        </Link>
      }
    />
  );
}

/** Banner de resumen. Distingue lo que el dueño puede resolver de lo que no: decir "todas al
 *  día" con una fuente caída sería la misma mentira que arreglamos en las filas. */
function ConexionesResumen({ sources }: { sources: SourceStatus[] }) {
  const copies = sources.map(sourceToConnectionCopy);
  const conAccion = copies.filter((c) => c.requiresOwnerAction).length;
  const sinAccion = copies.filter(
    (c) => !c.requiresOwnerAction && (c.tone === "info" || c.tone === "unknown"),
  ).length;

  const ajenas =
    sinAccion > 0
      ? ` ${sinAccion} ${sinAccion === 1 ? "está" : "están"} con problemas que no dependen de ti.`
      : "";

  const texto =
    conAccion > 0
      ? `${conAccion} ${conAccion === 1 ? "requiere" : "requieren"} tu acción.${ajenas}`
      : sinAccion > 0
        ? `Ninguna requiere tu acción.${ajenas}`
        : "Todas las conexiones están al día.";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        conAccion > 0
          ? "border-warning-500/40 bg-warning-50 text-warning-700"
          : sinAccion > 0
            ? "border-info-500/40 bg-info-50 text-info-700"
            : "border-success-500/30 bg-success-50 text-success-700",
      )}
    >
      {texto}
    </div>
  );
}

export function ConexionesTabla({ sources }: { sources: SourceStatus[] }) {
  return (
    <div className="space-y-4">
      <ConexionesResumen sources={sources} />

      {/* `overflow-x-auto` (no `overflow-hidden`): a 360px la tercera columna —la ACCIÓN,
          que es lo único que la fila existe para ofrecer— quedaba amputada ("Revisa",
          "Conec", "ACCIÓ") sin ninguna forma de llegar a ella. Un dato primario recortado
          es peor que un scroll: el scroll se ve y se resuelve. `min-w-[36rem]` mantiene las
          tres columnas legibles y deja que el contenedor scrollee, sin que la PÁGINA
          scrollee horizontalmente. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-light/20 text-xs uppercase tracking-wider text-neutral-mid">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Fuente</th>
              <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
              <th className="px-4 py-2.5 text-left font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const copy = sourceToConnectionCopy(source);
              return (
                <tr key={source.source} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-dark">
                      {source.display_name || source.source}
                    </p>
                    <p className="text-xs text-neutral-mid">{sourceToImpactLine(source)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <QavanteBadge variant={TONE_VARIANT[copy.tone]}>
                        {copy.statusLabel}
                      </QavanteBadge>
                      <p className="text-xs text-neutral-mid">{copy.message}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* Sin acción posible no se ofrece un enlace decorativo. */}
                    {copy.cta && copy.href ? (
                      <Link
                        href={copy.href}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
                      >
                        {copy.cta}
                      </Link>
                    ) : copy.requiresOwnerAction ? (
                      /* Hay acción y es del dueño, pero no vive en Qavante (MFA del banco).
                         Poner "Nada que hacer" acá contradiría el mensaje de al lado. */
                      <p className="text-sm text-neutral-mid">Se resuelve fuera de Qavante.</p>
                    ) : (
                      <p className="text-sm text-neutral-mid">Nada que hacer por ahora.</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConexionesView() {
  const query = useSourcesStatus();
  if (query.isLoading) return <ConexionesCargando />;
  if (query.isError) {
    return <QavanteInlineError error={query.error} what="el estado de las conexiones" />;
  }

  const sources = visibleSources(query.data?.sources ?? []);
  if (sources.length === 0) return <ConexionesVacio />;

  return <ConexionesTabla sources={sources} />;
}
