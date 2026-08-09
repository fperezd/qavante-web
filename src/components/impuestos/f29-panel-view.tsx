"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteInlineError } from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useSiiF29EstadoMulti,
  useSyncF29,
  useSiiContribuyente,
  siiKeys,
  type F29EstadoMes,
  type F29EstadoMesEstado,
} from "@/lib/api/sii";
import { useMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { normalizeRut } from "@/lib/validators/rut";
import { formatDateLike } from "@/lib/formatters/date";
import { formatClp, formatClpCompact } from "@/lib/formatters/clp";
import { f29SyncFailureToast } from "./f29-sync-message";
import { F29MonthDetail } from "./f29-month-detail";

/* Describe el error de un sync fallido con el dato real del backend (status +
   code + motivo) en vez de un genérico — permite diagnosticar sin logs. */
function describeReqError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return "No pudimos conectar con el servidor. Revisa tu conexión.";
    if (err.status === 504 || err.status === 408) {
      return "El SII tardó demasiado y la conexión se cortó (timeout). Intenta de nuevo en un rato.";
    }
    const code = err.code ? ` · ${err.code}` : "";
    return `El servidor respondió ${err.status}${code}. ${err.message}`;
  }
  return "El SII no respondió. Intenta de nuevo en un rato.";
}

/* Panel F29 (handoff CC-API 2026-07-05) — grilla estilo "Consulta Estado F29"
   del SII: meses en filas, años en columnas, semáforo por celda. Al clickear un
   mes con período, abre el detalle (con/sin IVA). Datos: `GET /f29/estado?anio=`
   por cada año (acepta cookie). */

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Años hacia atrás (además del actual) cuando no hay inicio de actividades. */
const YEARS_BACK = 5;
/** Tope de columnas para no dibujar una grilla enorme (empresas muy antiguas). */
const MAX_YEARS = 10;

const ESTADO_LABEL: Record<F29EstadoMesEstado, string> = {
  declarado: "Declarado",
  sin_dato: "Sin dato (sincroniza)",
  no_declarado_vencido: "No declarado (vencido)",
  por_declarar: "Por declarar",
  en_curso: "En curso",
  sin_periodo: "Sin período",
};

interface SelectedCell {
  anio: number;
  mes: number;
}

export function F29PanelView({ now = new Date() }: { now?: Date }) {
  const currentYear = now.getFullYear();

  /* Acotar la grilla por inicio de actividades (CC-API #2): company_rut → SII
     `/contribuyente` → `inicio_actividades`. Sin ese dato usamos el fallback de
     `YEARS_BACK` años. Cap de MAX_YEARS para no dibujar una grilla enorme si la
     empresa es muy antigua. */
  const me = useMe();
  const companyRut = me.data?.user.company_rut ?? "";
  const contribuyente = useSiiContribuyente(
    companyRut ? normalizeRut(companyRut) : "",
    Boolean(companyRut),
  );
  const startYear = React.useMemo(() => {
    const iso = contribuyente.data?.status === "ok" ? contribuyente.data.inicio_actividades : null;
    const y = iso ? Number(String(iso).slice(0, 4)) : NaN;
    const fromInicio =
      Number.isInteger(y) && y >= 2000 && y <= currentYear ? y : currentYear - YEARS_BACK;
    return Math.max(fromInicio, currentYear - MAX_YEARS + 1);
  }, [contribuyente.data, currentYear]);
  const years = React.useMemo(
    () => Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i),
    [currentYear, startYear],
  );

  const results = useSiiF29EstadoMulti(years);
  const [selected, setSelected] = React.useState<SelectedCell | null>(null);

  /* El (i) de "IVA postergado" en la grilla sale SOLO de `cell.postergado_iva` (backend, `/f29/estado`).
     La postergación es dato del F29 declarado (código 755) → es trabajo del backend derivarla y persistirla,
     NO del FE raspar la Consulta de Giros en vivo. Escalado con evidencia: hoy el estado devuelve un FALSO
     NEGATIVO (dice `False` donde el SII dice `True`) — qavante-api #708/#714/#715. Hasta que el backend lo
     arregle, el (i) NO se muestra en la grilla, y eso es CORRECTO: dejamos el síntoma visible en vez de
     taparlo con un scrape lento (~2min) y flaky. El detalle del mes sí muestra la postergación (una consulta
     al abrir, on-demand). */

  /* "Actualizar F29": sincroniza los años visibles (secuencial — el SII permite
     un sync por tenant a la vez). Llena `/f29/estado` (los sin_dato pasan a real). */
  const qc = useQueryClient();
  const syncF29 = useSyncF29();
  const [syncYear, setSyncYear] = React.useState<number | null>(null);
  const syncing = syncYear !== null;

  async function actualizar() {
    if (syncing) return;
    let ok = 0;
    let requestErrored = 0; // años cuya request falló (red / 5xx del server)
    let inProgress = false;
    // Números reales que reporta el backend (ADR-0063): no afirmar "actualizado"
    // sin evidencia. Un sync puede volver status:ok con 0 folios encontrados.
    let found = 0;
    let neu = 0;
    let already = 0;
    let siiErrors = 0; // folios que el SII no dejó bajar/parsear (best-effort)
    let firstDetail: { error: string; detail: string } | null = null;
    let firstReqError: unknown = null; // primer error de request (5xx/red) para diagnóstico
    for (const y of years) {
      setSyncYear(y);
      try {
        const res = await syncF29.mutateAsync(y);
        if (res.status === "in_progress") {
          inProgress = true;
          break;
        }
        ok += 1;
        found += res.folios_encontrados ?? 0;
        neu += res.persistidos_nuevos ?? 0;
        already += res.ya_persistidos ?? 0;
        siiErrors += res.errores ?? 0;
        const det = res.errores_detalle?.[0];
        if (det && !firstDetail) firstDetail = { error: det.error, detail: det.detail };
      } catch (e) {
        requestErrored += 1; // 5xx/red → seguimos con el resto de los años
        if (!firstReqError) firstReqError = e;
      }
    }
    setSyncYear(null);
    // Una sola invalidación al final (evita el refetch-storm de la grilla).
    // También si quedó un sync corriendo (in_progress): puede estar poblando
    // /f29/estado en segundo plano.
    if (ok > 0 || inProgress) qc.invalidateQueries({ queryKey: siiKeys.all });

    // Nota de fallos de request (5xx/red) — se reportan SIEMPRE, aun cuando otros
    // años hayan tenido éxito (no ocultar que algún año no respondió).
    const reqNote =
      requestErrored > 0
        ? ` (${requestErrored} ${requestErrored === 1 ? "año no respondió" : "años no respondieron"})`
        : "";

    // Toast HONESTO: refleja qué pasó de verdad, en orden de severidad.
    if (ok === 0 && requestErrored > 0) {
      toast.error("No pudimos actualizar", { description: describeReqError(firstReqError) });
    } else if (neu > 0) {
      // Se bajó y persistió al menos un F29 nuevo → éxito real.
      const failed =
        siiErrors > 0
          ? `${siiErrors} ${siiErrors === 1 ? "folio falló" : "folios fallaron"} al bajar. `
          : "";
      toast.success(`Bajamos ${neu} F29 ${neu === 1 ? "nuevo" : "nuevos"} del SII`, {
        description: `${failed}Tu estado de F29 se actualizó${reqNote}.`,
      });
    } else if (siiErrors > 0) {
      // No entró nada nuevo y hubo folios que fallaron → motivo real, accionable.
      // Para el patrón "el SII devolvió HTML en vez de PDF" (sesión SII caída) el
      // helper da un mensaje en lenguaje de dueño + acción, sin ocultar el hecho.
      const { title, description } = f29SyncFailureToast(siiErrors, firstDetail, reqNote);
      toast.warning(title, { description });
    } else if (inProgress) {
      // Antes de "found === 0": un sync en curso deja los contadores en 0.
      toast.info("Actualización en curso", {
        description: "Ya hay una sincronización de F29 corriendo. Espera unos minutos.",
      });
    } else if (found === 0) {
      // El SII no reporta ningún F29 declarado en el rango → esto explica la
      // grilla vacía. No es un "éxito": lo decimos claro.
      toast.warning("El SII no reporta F29 en este rango", {
        description:
          requestErrored > 0
            ? `Algunos años no respondieron${reqNote}. Revisa tu conexión al SII e intenta de nuevo.`
            : "No encontramos F29 declarados para estos años. Verifica que tu clave del SII esté conectada en Administración → Credenciales.",
      });
    } else if (already > 0) {
      // found > 0 y todo ya estaba persistido → ya al día.
      toast.success("Tus F29 ya estaban al día", {
        description: `${already} ${already === 1 ? "F29 ya estaba sincronizado" : "F29 ya estaban sincronizados"}${reqNote}.`,
      });
    } else {
      // found > 0 pero sin nuevos/ya-persistidos (backend viejo sin contadores).
      toast.success("Sin F29 nuevos", {
        description: `No hay F29 nuevos para bajar en el rango${reqNote}.`,
      });
    }
  }

  /* year → (mes → F29EstadoMes). El contrato tipa `meses[]` laxo; lo afinamos. */
  const byYear = React.useMemo(() => {
    const map = new Map<number, Map<number, F29EstadoMes>>();
    years.forEach((anio, i) => {
      const meses = (results[i]?.data?.meses ?? []) as unknown as F29EstadoMes[];
      const inner = new Map<number, F29EstadoMes>();
      for (const m of meses) if (typeof m?.mes === "number") inner.set(m.mes, m);
      map.set(anio, inner);
    });
    return map;
  }, [results, years]);

  const anyLoading = results.some((r) => r.isLoading);
  const allError = results.length > 0 && results.every((r) => r.isError);
  const firstError = results.find((r) => r.isError)?.error;

  if (allError) {
    return <QavanteInlineError error={firstError} what="el estado del F29" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-mid">
          Si ves &quot;sin dato&quot;, sincroniza para traer tus F29 del SII.
        </p>
        <QavanteButton size="sm" onClick={actualizar} loading={syncing} disabled={syncing}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {syncing ? `Actualizando ${syncYear ?? ""}…` : "Actualizar F29"}
        </QavanteButton>
      </div>

      <QavanteCard variant="bordered" aria-label="Estado del F29 por período" role="region">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                >
                  Mes
                </th>
                {years.map((y) => (
                  <th
                    key={y}
                    scope="col"
                    className="px-2 py-2 text-center text-xs font-semibold text-neutral-dark tabular-nums"
                  >
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES.map((label, idx) => {
                const mes = idx + 1;
                return (
                  <tr key={mes} className="border-t border-border/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-sm font-medium text-neutral-dark"
                    >
                      {label}
                    </th>
                    {years.map((y) => {
                      const cell = byYear.get(y)?.get(mes);
                      const loading = anyLoading && !cell;
                      const isSelected = selected?.anio === y && selected?.mes === mes;
                      return (
                        <td key={y} className="px-2 py-1.5 text-center">
                          <StatusCell
                            cell={cell}
                            loading={loading}
                            selected={isSelected}
                            onSelect={() => setSelected({ anio: y, mes })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Legend />
      </QavanteCard>

      {selected && (
        <F29MonthDetail
          key={`${selected.anio}-${selected.mes}`}
          anio={selected.anio}
          mes={selected.mes}
          mesLabel={MESES[selected.mes - 1] ?? String(selected.mes)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Celda de estado (semáforo) ─────────────────────────────────────────── */

function StatusCell({
  cell,
  loading,
  selected,
  onSelect,
}: {
  cell?: F29EstadoMes;
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  if (loading) {
    return <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-neutral-light/60" />;
  }

  const estado = cell?.estado ?? "sin_periodo";
  // Sin período (futuro / sin declaración esperada): no clickeable.
  if (!cell || estado === "sin_periodo") {
    return (
      <span className="text-neutral-light" aria-label="Sin período">
        –
      </span>
    );
  }
  /* Sin dato (o estado fuera de contrato): vencido pero sin F29 sincronizado, o un
     `estado` que no reconocemos (el contrato tipa `meses[]` laxo). NO lo pintamos
     rojo ni rendeamos un botón roto "undefined" — marca neutra, no clickeable. */
  const CLICKABLE = ["declarado", "no_declarado_vencido", "por_declarar", "en_curso"];
  if (estado === "sin_dato" || !CLICKABLE.includes(estado)) {
    return (
      <span
        className="inline-block h-3 w-3 rounded-full border border-neutral-mid/50"
        title="Sin dato, sincroniza tus F29 para ver el estado real"
        aria-label="Sin dato, sincroniza"
      />
    );
  }

  const ringSel = selected ? "ring-2 ring-brand-primary ring-offset-1" : "";
  // Declarado con el IVA postergado: sigue verde (declaró) + un (i) que lo explica y da el vencimiento
  // diferido. El dato es del backend (`/f29/estado.postergado_iva`, código 755 del F29 declarado). El FE
  // NO lo deriva raspando Giros — si el estado no lo trae, no se muestra (síntoma visible, no parche).
  const postergado = estado === "declarado" && cell.postergado_iva === true;
  const vencPostRaw = cell.vencimiento_postergado ?? null;
  const vencePost = postergado && vencPostRaw ? `, vence el ${formatDateLike(vencPostRaw)}` : "";
  /* Total a pagar del F29 (viene en la celda de `/f29/estado` como `saldo`; null = declarado sin monto
     conocido, NO $0). En la grilla se muestra COMPACTO ($1,2M) para no romper el semáforo; el EXACTO va
     acá en el tooltip y completo en el detalle. */
  const saldoExacto =
    estado === "declarado" && cell.saldo != null ? ` · Total a pagar ${formatClp(cell.saldo)}` : "";
  const title =
    (postergado
      ? `Declarado · IVA postergado${vencePost}`
      : `${ESTADO_LABEL[estado]}${cell.folio ? ` · folio ${cell.folio}` : ""}`) + saldoExacto;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      aria-label={
        (postergado ? `Declarado con IVA postergado${vencePost}` : ESTADO_LABEL[estado]) +
        saldoExacto +
        ", ver detalle"
      }
      className={cn(
        "inline-flex min-h-7 min-w-7 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-0.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        ringSel,
      )}
    >
      {estado === "declarado" && (
        <>
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-surface">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {postergado && (
              <span
                className="absolute -right-1.5 -top-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-warning-500 text-[8px] font-bold leading-none text-surface ring-1 ring-surface"
                aria-hidden="true"
              >
                i
              </span>
            )}
          </span>
          {cell.saldo != null && (
            <span
              className="text-[10px] leading-none tabular-nums text-neutral-mid"
              aria-hidden="true"
            >
              {formatClpCompact(cell.saldo)}
            </span>
          )}
        </>
      )}
      {estado === "no_declarado_vencido" && (
        <span className="text-[11px] font-bold text-danger-500">ND</span>
      )}
      {estado === "por_declarar" && (
        <span className="inline-block h-3 w-3 rounded-full bg-warning-500" aria-hidden="true" />
      )}
      {estado === "en_curso" && <span className="text-xs text-neutral-mid">•••</span>}
    </button>
  );
}

/* ── Leyenda ────────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <LegendItem>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-500 text-surface">
          <Check className="h-2.5 w-2.5" />
        </span>
        Declarado
      </LegendItem>
      <LegendItem>
        <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-500 text-surface">
          <Check className="h-2.5 w-2.5" />
          <span
            className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-warning-500 text-[7px] font-bold leading-none text-surface ring-1 ring-surface"
            aria-hidden="true"
          >
            i
          </span>
        </span>
        Declarado · IVA postergado
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-3 rounded-full border border-neutral-mid/50" />
        Sin dato (sincroniza)
      </LegendItem>
      <LegendItem>
        <span className="text-[11px] font-bold text-danger-500">ND</span>
        No declarado (vencido)
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-3 rounded-full bg-warning-500" />
        Por declarar
      </LegendItem>
      <LegendItem>
        <span className="text-neutral-mid">•••</span>
        En curso
      </LegendItem>
      <LegendItem>
        <span className="text-neutral-light">–</span>
        Sin período
      </LegendItem>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}
