"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountsReceivableResponse } from "@/lib/api/cobranza";
import { formatClp } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { Banner } from "@/components/rediseno/banner";
import { DataState } from "@/components/rediseno/data-state";
import { FilterChips } from "@/components/rediseno/filter-chip";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import type { GestionadoMap } from "../v2/cobrar-v2-map";
import {
  FILTROS_V04,
  LOTE_SEGUNDOS,
  clientesV04,
  concentracion,
  contarClientes,
  crumbGestion,
  csvClientes,
  explicacionBruto,
  explicacionVencido,
  filtrarClientes,
  loteRecordatorios,
  motivoSinVencido,
  recordatorioDe,
  tarjetasAging,
  textoCountdown,
  totalBruto,
  type ClienteV04,
  type ConcentracionV04,
  type ExplicacionV04,
  type FiltroV04,
  type RecordatorioV04,
} from "./cobrar-v04-model";

/* V04 · Cobrar — "¿quién me debe?" (rediseño Fase 2, issue #69).
 *
 * PRESENTACIONAL: entra la respuesta de `accounts-receivable` + el mapa de gestiones, sale una
 * pantalla. Sin hooks de datos — el cableado vive en `cobrar-v04-live.tsx`. Así la vista entera se
 * renderea en un test (`react-dom/server`) y en una story sin MSW. El único estado propio es de UI:
 * filtro, búsqueda, el panel del lote y su cuenta regresiva.
 *
 * LEY 1 — "Vencido · bruto" y "por cobrar (bruto)" son `overdue` y `total` del contrato tal cual: la
 * misma función del backend que alimenta "Te deben" en V01. La vista no suma tramos ni saldos de la
 * tabla para fabricar un total (`cobrar-v04-view.test.tsx` lo fija con un contrato "en desacuerdo").
 *
 * LEY 2 — máximo UN rojo por pantalla: la pill de antigüedad del cliente MÁS grave (+60 días), y
 * sólo la suya. Las tarjetas +61 y Vencido van en tinta, no en rojo (el HTML de referencia las pinta
 * rojas; la spec manda en lógica). El resto es ámbar o gris. Las stories y el test CUENTAN
 * `rediseno-rojo` + `danger-` sobre el DOM.
 *
 * "NO SÉ" explícito — con `overdue: null` (el caso VIVO de producción hoy) la tarjeta dice "sin dato"
 * con el motivo del backend, el % no existe, la pill es gris y la fila dice "vencido: no se sabe".
 * Nunca "$0", nunca "0% vencido".
 *
 * LO QUE FALTA, dicho acá y no sólo en el PR: no hay envío en lote en la API ni contacto del
 * cliente. "Enviar a los 3" prepara las plantillas ACTUALES de Cobrar v2 y, tras la ventana de
 * arrepentimiento (Ley 4, visible y cancelable), marca a los clientes como gestionados; cada
 * WhatsApp o correo lo abre el dueño. El hueco queda escrito bajo la tabla con su issue sucesor. */

export interface CobrarV04ViewProps {
  /** `GET /api/treasury/accounts-receivable`. `null` = no llegó. */
  ar: AccountsReceivableResponse | null;
  /** Por qué no llegó, en lenguaje de dueño (cuando `ar` es null). */
  arMotivo?: string | null;
  /** `cobranza_gestionado` de las prefs (rut normalizado → ISO). */
  gestionado?: GestionadoMap;
  /** Las prefs cargaron: se puede registrar gestión. Con `false` el primario igual responde
   *  (Ley 6): dice qué falta. */
  gestionDisponible?: boolean;
  /** Marca/desmarca a UN cliente (persistido por el contenedor). */
  onToggleGestionado?: (cliente: ClienteV04) => void;
  /** Marca al lote como gestionado al terminar la cuenta. Devuelve `false` si no pudo. */
  onMarcarLote?: (clientes: ClienteV04[]) => boolean;
  /** Copia el recordatorio (lo hace el contenedor: `navigator.clipboard`). `true` si copió. */
  onCopiar?: (texto: string) => Promise<boolean> | boolean;
  onReintentar?: () => void;
  /** Ventana de arrepentimiento del lote, en segundos (mínimo 1). */
  loteSegundos?: number;
  /** Issue sucesor del hueco "envío en lote real". */
  issueLote?: string;
  /** Referencia de "hoy". Explícita para tests y stories deterministas. */
  hoy?: Date;
}

const LINK =
  "font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";
const PILL_OSCURA =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";
const BOTON_QUIETO =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-rediseno-hairline bg-rediseno-superficie px-4 py-2 text-[12.5px] font-semibold text-rediseno-tinta-2 hover:bg-rediseno-porcelana focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";
const EYEBROW =
  "font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3";

export function CobrarV04View({
  ar,
  arMotivo,
  gestionado = {},
  gestionDisponible = true,
  onToggleGestionado,
  onMarcarLote,
  onCopiar,
  onReintentar,
  loteSegundos = LOTE_SEGUNDOS,
  issueLote,
  hoy = new Date(),
}: CobrarV04ViewProps) {
  const [filtro, setFiltro] = React.useState<FiltroV04>("prioridad");
  const [consulta, setConsulta] = React.useState("");
  const [loteAbierto, setLoteAbierto] = React.useState(false);
  const [copiadoKey, setCopiadoKey] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copyTimer.current), []);

  const clientes = React.useMemo(() => clientesV04(ar, gestionado), [ar, gestionado]);
  const crumb = crumbGestion(clientes, hoy);
  const tarjetas = tarjetasAging(ar);
  const sinVencido = motivoSinVencido(ar);
  const conc = concentracion(clientes, ar);
  const conteos = contarClientes(clientes, consulta);
  const visibles = filtrarClientes(clientes, filtro, consulta);
  const bruto = totalBruto(ar);

  const copiar = async (r: RecordatorioV04) => {
    const ok = onCopiar ? await onCopiar(r.texto) : false;
    if (!ok) return;
    setCopiadoKey(r.key);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiadoKey(null), 2000);
  };

  /* (0) Sin respuesta: la pantalla no está vacía, está ciega — y lo dice. */
  if (!ar) {
    return (
      <div className="space-y-5">
        <Crumb chip={crumb.chip} />
        <DataState
          status="error"
          what="las cuentas por cobrar"
          cause={
            arMotivo ??
            "El registro de cobranza no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones."
          }
          action={
            onReintentar
              ? { label: "Reintentar", onClick: onReintentar }
              : { label: "Revisar conexiones", href: "/conexiones" }
          }
        />
      </div>
    );
  }

  /* (0') Sin cartera: el registro no tiene documentos vivos (`document_count`, no `total`: una
     factura y su NC se netean a cero con cartera real). */
  if (ar.document_count === 0) {
    const faltan = (ar.missing_sources ?? []).filter((s) => s.trim() !== "");
    return (
      <div className="space-y-5">
        <Crumb chip={crumb.chip} />
        <DataState
          status="empty"
          what="clientes con saldo por cobrar"
          hint={
            faltan.length > 0
              ? `El registro de cobranza no tiene documentos de venta vivos. Falta: ${faltan.join(" · ")}.`
              : "El registro de cobranza no tiene documentos de venta vivos: no hay nada que cobrar hoy."
          }
          action={{ label: "Revisar conexiones", href: "/conexiones" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* (1) Crumb con el estado de gestión como chip gris. */}
      <Crumb chip={crumb.chip} />

      {/* (2) Las cinco tarjetas de aging. */}
      <section
        aria-label="Antigüedad de saldos"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        {tarjetas.map((t) =>
          t.monto == null ? (
            <KpiCard
              key={t.key}
              label={t.label}
              sinDato={{ reason: sinVencido.motivo, missingSources: ar.missing_sources ?? [] }}
              detail={
                t.key === "vencido" ? (
                  <>
                    {sinVencido.accion}{" "}
                    <InfoPopover label="Qué es Vencido bruto" info={explicacionVencido(ar, hoy)} />
                  </>
                ) : (
                  "sin este tramo no hay reparto"
                )
              }
            />
          ) : (
            <KpiCard
              key={t.key}
              label={t.label}
              value={formatClp(t.monto)}
              detail={
                <>
                  {t.piso && "al menos · "}
                  {t.pct == null ? "sin total que repartir" : `${formatPct(t.pct)} del total`}
                  {t.key === "vencido" && (
                    <>
                      {" "}
                      <InfoPopover
                        label="Qué es Vencido bruto"
                        info={explicacionVencido(ar, hoy)}
                      />
                    </>
                  )}
                  {t.key === "vencido" && t.monto === 0 && " · estás al día"}
                </>
              }
            />
          ),
        )}
      </section>

      {/* (3) Banner de concentración → lote. */}
      {conc && (
        <BannerConcentracion
          conc={conc}
          abierto={loteAbierto}
          onEnviar={() => setLoteAbierto(true)}
        />
      )}
      {conc && loteAbierto && (
        <LotePanel
          conc={conc}
          segundos={loteSegundos}
          gestionDisponible={gestionDisponible}
          onMarcarLote={onMarcarLote}
          onCopiar={copiar}
          copiadoKey={copiadoKey}
          onCerrar={() => setLoteAbierto(false)}
        />
      )}

      {/* (4) Filtros con conteo + búsqueda, (5) tabla. */}
      <section aria-labelledby="v04-clientes" className="space-y-2">
        <h2 id="v04-clientes" className={EYEBROW}>
          Clientes con saldo
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="relative min-w-0 flex-1 basis-[16rem]">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-rediseno-tinta-3-light"
              aria-hidden
            />
            <span className="sr-only">Buscar cliente o RUT</span>
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar cliente o RUT…"
              className="w-full rounded-full border border-rediseno-hairline bg-rediseno-superficie py-[7px] pr-3 pl-9 text-xs text-rediseno-tinta placeholder:text-rediseno-tinta-3-light focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none"
            />
          </label>
          <FilterChips
            aria-label="Filtrar clientes"
            className="mt-0 mb-0"
            options={FILTROS_V04.filter(
              /* El bucket del "no sé" se ofrece sólo cuando existe: con todos los vencimientos
                 conocidos un chip "Sin vencimiento conocido · 0" es ruido. */
              (f) => f.id !== "sin_vencimiento" || conteos.sin_vencimiento > 0 || filtro === f.id,
            ).map((f) => ({ ...f, count: conteos[f.id] }))}
            value={filtro}
            onChange={setFiltro}
          />
        </div>

        <TablaClientes
          clientes={visibles}
          totalClientes={clientes.length}
          bruto={bruto}
          explicacion={explicacionBruto(ar, hoy)}
          copiadoKey={copiadoKey}
          onCopiar={copiar}
          onToggleGestionado={onToggleGestionado}
          onExport={() => descargarCsv("clientes-por-cobrar.csv", csvClientes(visibles))}
          emptyMessage={
            clientes.length === 0
              ? "El registro no trae el detalle por cliente todavía."
              : consulta.trim()
                ? "Ningún cliente coincide con esa búsqueda."
                : "Ningún cliente en este filtro."
          }
        />

        {/* Hueco declarado (ver el encabezado del archivo). */}
        <p className="text-[12px] leading-relaxed text-rediseno-tinta-3">
          <b className="font-semibold text-rediseno-tinta-2">
            El envío en lote real todavía no está:
          </b>{" "}
          Qavante no tiene el contacto de tus clientes ni un canal propio, así que “Enviar a los 3”
          prepara los recordatorios, los marca gestionados tras la cuenta regresiva y cada WhatsApp
          o correo lo abres tú{issueLote ? ` (${issueLote})` : ""}. Las facturas cedidas por
          factoring ya vienen excluidas del registro; el registro no distingue moneda.
        </p>
      </section>
    </div>
  );
}

/* ── (1) Crumb ───────────────────────────────────────────────────────────────── */

function Crumb({ chip }: { chip: string }) {
  return (
    <p className={cn(EYEBROW, "flex flex-wrap items-center gap-x-2 gap-y-1")}>
      <span>Cobrar</span>
      <span aria-hidden="true">·</span>
      {/* SIEMPRE gris (Ley 2): haber gestionado es un pendiente administrativo, no un veredicto. */}
      <Pill variant="mut" aria-label="Estado de gestión" className="normal-case tracking-normal">
        {chip}
      </Pill>
    </p>
  );
}

/* ── ⓘ (§1.4: definición, incluye/excluye, fuente y frescura) ────────────────── */

function InfoPopover({
  label,
  info,
  hacia = "abajo",
}: {
  label: string;
  info: ExplicacionV04;
  /** `arriba` para los ⓘ que viven DENTRO del wrapper recortado de la tabla: abriéndose hacia
   *  abajo quedan cortados por su `overflow-hidden`, y en angosto además se salen por la derecha. */
  hacia?: "abajo" | "arriba";
}) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        className="inline-flex cursor-pointer list-none items-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        <Info className="size-3.5" aria-hidden />
      </summary>
      <div
        className={cn(
          "absolute z-40 rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left text-[12.5px] leading-relaxed font-normal text-rediseno-tinta-2 normal-case tracking-normal shadow-lg",
          hacia === "arriba"
            ? "right-0 bottom-full mb-1.5 w-[min(22rem,90cqw)]"
            : "top-full left-0 mt-1.5 w-[min(22rem,80vw)]",
        )}
      >
        <p className="font-semibold text-rediseno-tinta">{info.definicion}</p>
        <Bloque titulo="Incluye" items={info.incluye} />
        <Bloque titulo="Deja afuera" items={info.excluye} />
        <p className="mt-2">
          <span className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Fuente
          </span>{" "}
          <span className="font-rediseno-mono text-[11px]">{info.fuente}</span>
        </p>
        <p className="mt-1">
          <span className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Frescura
          </span>{" "}
          {info.frescura}
        </p>
      </div>
    </details>
  );
}

function Bloque({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
        {titulo}
      </p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── (3) Concentración ───────────────────────────────────────────────────────── */

function BannerConcentracion({
  conc,
  abierto,
  onEnviar,
}: {
  conc: NonNullable<ConcentracionV04>;
  abierto: boolean;
  onEnviar: () => void;
}) {
  const n = conc.clientes.length;
  const quienes = n === 1 ? "1 cliente concentra" : `${n} clientes concentran`;
  const cta = n === 1 ? "Enviar recordatorio" : `Enviar a los ${n}`;
  return (
    <Banner role="note">
      {conc.kind === "vencido" ? (
        <>
          <b className="text-rediseno-tinta">
            {quienes} {formatClp(conc.monto)} del vencido.
          </b>{" "}
          {conc.pct != null
            ? `Un recordatorio a cada uno cubre el ${formatPct(conc.pct)} de tu deuda vencida.`
            : "Un recordatorio a cada uno cubre lo más grande de tu deuda vencida."}
        </>
      ) : (
        <>
          <b className="text-rediseno-tinta">
            {quienes} {formatClp(conc.monto)} de tu saldo por cobrar
            {conc.pct != null ? ` (${formatPct(conc.pct)})` : ""}.
          </b>{" "}
          No sabemos cuánto de eso está vencido: {conc.motivo}
        </>
      )}
      {!abierto && (
        <button type="button" onClick={onEnviar} className={cn(PILL_OSCURA, "ml-auto")}>
          {cta}
        </button>
      )}
    </Banner>
  );
}

/* ── Lote con ventana de arrepentimiento (Ley 4) ─────────────────────────────── */

type FaseLote = "preparado" | "contando" | "listo" | "sin_prefs";

/** Cuenta regresiva de `segundos` a 0. `restante === null` = detenida. Al llegar a 0 dispara
 *  `onDone` UNA vez y se detiene. Cancelar antes de 0 no dispara nada. */
function useCountdown(segundos: number, onDone: () => void) {
  const [restante, setRestante] = React.useState<number | null>(null);
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  React.useEffect(() => {
    if (restante == null) return undefined;
    if (restante <= 0) {
      setRestante(null);
      onDoneRef.current();
      return undefined;
    }
    const t = setTimeout(() => setRestante((r) => (r == null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [restante]);
  return {
    restante,
    iniciar: () => setRestante(Math.max(1, Math.round(segundos))),
    cancelar: () => setRestante(null),
  };
}

function LotePanel({
  conc,
  segundos,
  gestionDisponible,
  onMarcarLote,
  onCopiar,
  copiadoKey,
  onCerrar,
}: {
  conc: NonNullable<ConcentracionV04>;
  segundos: number;
  gestionDisponible: boolean;
  onMarcarLote?: (clientes: ClienteV04[]) => boolean;
  onCopiar: (r: RecordatorioV04) => void;
  copiadoKey: string | null;
  onCerrar: () => void;
}) {
  const [fase, setFase] = React.useState<FaseLote>("preparado");
  const recordatorios = React.useMemo(() => loteRecordatorios(conc.clientes), [conc.clientes]);
  const n = conc.clientes.length;
  const cuenta = useCountdown(segundos, () => {
    const ok = gestionDisponible && (onMarcarLote ? onMarcarLote(conc.clientes) : false);
    setFase(ok ? "listo" : "sin_prefs");
  });
  const tituloId = React.useId();

  /* Escape cancela la cuenta: la ventana de arrepentimiento también se cierra con el teclado. */
  React.useEffect(() => {
    if (cuenta.restante == null) return undefined;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      cuenta.cancelar();
      setFase("preparado");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cancelar` es estable (setState); sólo importa si hay cuenta en curso
  }, [cuenta.restante]);

  return (
    <section
      role="region"
      aria-labelledby={tituloId}
      className="space-y-3 rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-4"
    >
      <h2 id={tituloId} className="font-rediseno-serif text-[17px] font-medium text-rediseno-tinta">
        Recordatorio a {n} {n === 1 ? "cliente" : "clientes"}
      </h2>
      <p className="text-[12.5px] leading-relaxed text-rediseno-tinta-2">
        Con la plantilla de siempre. Qavante no tiene el contacto de tus clientes: al terminar la
        cuenta los {n === 1 ? "deja" : "deja a los " + n} marcados como gestionados (se puede
        deshacer) y cada WhatsApp o correo lo abres tú con un clic.
      </p>

      <ul className="divide-y divide-rediseno-hairline-row">
        {recordatorios.map((r, i) => {
          const c = conc.clientes[i]!;
          return (
            <li
              key={r.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]"
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-rediseno-tinta">{r.nombre}</span>
                <span className="block text-[11.5px] text-rediseno-tinta-3">
                  {conc.kind === "vencido"
                    ? `${formatClp(c.vencido ?? 0)} vencido`
                    : `${formatClp(c.saldo)} por cobrar · vencido: no se sabe`}
                </span>
              </span>
              <details className="w-full text-[12px] text-rediseno-tinta-3 sm:w-auto">
                <summary className="cursor-pointer text-rediseno-azul">Ver texto</summary>
                <pre className="mt-1 whitespace-pre-wrap font-rediseno-sans text-rediseno-tinta-2">
                  {r.texto}
                </pre>
              </details>
              {fase === "listo" && (
                <AccionesRecordatorio r={r} copiado={copiadoKey === r.key} onCopiar={onCopiar} />
              )}
            </li>
          );
        })}
      </ul>

      {fase === "contando" && cuenta.restante != null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="status"
            aria-live="polite"
            className="text-[13px] font-semibold text-rediseno-tinta"
          >
            {textoCountdown(cuenta.restante, n)}
          </p>
          <button
            type="button"
            onClick={() => {
              cuenta.cancelar();
              setFase("preparado");
            }}
            className={cn(BOTON_QUIETO, "ml-auto")}
          >
            Cancelar
          </button>
        </div>
      ) : fase === "listo" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-[13px] text-rediseno-tinta-2">
            Listo: {n === 1 ? "quedó marcado" : `los ${n} quedaron marcados`} como gestionados. Abre
            cada recordatorio arriba.
          </p>
          <button type="button" onClick={onCerrar} className={cn(BOTON_QUIETO, "ml-auto")}>
            Cerrar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {fase === "sin_prefs" && (
            /* Ley 6: el primario respondió y dice qué falta. Ámbar, no rojo (Ley 2). */
            <p role="alert" className="text-[12.5px] font-semibold text-rediseno-ambar">
              No pudimos registrar la gestión: no cargaron tus preferencias. Recarga e intenta de
              nuevo.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setFase("contando");
              cuenta.iniciar();
            }}
            className={cn(PILL_OSCURA, "ml-auto")}
          >
            {n === 1 ? "Enviar el recordatorio" : `Enviar los ${n} recordatorios`}
          </button>
          <button type="button" onClick={onCerrar} className={BOTON_QUIETO}>
            Cerrar
          </button>
        </div>
      )}
    </section>
  );
}

/** WhatsApp · correo · Recordatorio (copiar) — los flujos actuales de Cobrar v2, como links. */
function AccionesRecordatorio({
  r,
  copiado,
  onCopiar,
}: {
  r: RecordatorioV04;
  copiado: boolean;
  onCopiar: (r: RecordatorioV04) => void;
}) {
  return (
    /* Sin `whitespace-nowrap`: en una tabla angosta el trío quiebra línea en vez de empujar la
       columna (y con ella el monto) fuera del contenedor. Cada acción es una palabra suelta, así
       que ninguna se parte por dentro. */
    <span className="text-[12.5px]">
      <a href={r.waHref} target="_blank" rel="noopener noreferrer" className={LINK}>
        WhatsApp
      </a>
      <span aria-hidden="true"> · </span>
      <a href={r.mailtoHref} className={LINK}>
        correo
      </a>
      <span aria-hidden="true"> · </span>
      <button
        type="button"
        onClick={() => onCopiar(r)}
        aria-live="polite"
        className={cn(LINK, "font-bold", copiado && "text-rediseno-verde")}
      >
        {copiado ? "Copiado ✓" : "Recordatorio"}
      </button>
    </span>
  );
}

/* ── (5) Tabla (§1.3 `.tw > table.t`, §5.5) ──────────────────────────────────── */

function TablaClientes({
  clientes,
  totalClientes,
  bruto,
  explicacion,
  copiadoKey,
  onCopiar,
  onToggleGestionado,
  onExport,
  emptyMessage,
}: {
  clientes: ClienteV04[];
  totalClientes: number;
  bruto: number;
  explicacion: ExplicacionV04;
  copiadoKey: string | null;
  onCopiar: (r: RecordatorioV04) => void;
  onToggleGestionado?: (c: ClienteV04) => void;
  onExport: () => void;
  emptyMessage: string;
}) {
  const columns = React.useMemo<ColumnDef<ClienteV04, unknown>[]>(
    () => [
      {
        id: "cliente",
        accessorFn: (c) => c.nombre,
        header: "Cliente",
        meta: { principal: true },
        cell: ({ row }) => (
          <TablePrimaryCell
            value={row.original.nombre}
            /* El `.sub` envuelve en vez de truncar cuando la tabla es angosta: su `nowrap` fijaba
               el ancho mínimo de la columna en el metadato ENTERO y empujaba el monto fuera del
               contenedor. Envolver muestra MÁS que truncar, y con la tabla ancha se ve igual. */
            sub={
              <span className="@max-[640px]:whitespace-normal" title={row.original.sub}>
                {row.original.sub}
              </span>
            }
          />
        ),
      },
      {
        id: "antiguedad",
        /* Orden por días de mora; el "no se sabe" al final, pero presente. */
        accessorFn: (c) => (c.vencido == null ? -2 : (c.dias ?? (c.vencido > 0 ? -1 : -1.5))),
        header: "Antigüedad",
        /* §1.3/§5.2: "en viewport angosto colapsar columnas de metadato, jamás la principal ni el
           monto". Los días de mora ya están escritos en el `.sub` de la fila (y en el CSV), así
           que colapsar esta columna no esconde información: evita que el SALDO se recorte.

           `hideBelowTable` y no `hideBelow`: se mide contra el ancho de la TABLA. Es opt-in del
           primitivo — las tablas de caja v02, banco v03 y pagar v05 siguen midiendo contra el
           viewport, exactamente como en `main`. */
        meta: { hideBelowTable: "sm" },
        cell: ({ row }) => (
          <Pill variant={row.original.antiguedad.tono}>{row.original.antiguedad.texto}</Pill>
        ),
      },
      {
        id: "saldo",
        accessorFn: (c) => c.saldo,
        header: "Saldo",
        meta: { align: "right" },
        cell: ({ row }) => formatClp(row.original.saldo),
      },
      {
        id: "acciones",
        header: "",
        enableSorting: false,
        /* SIN `align: "right"`: esa meta trae `whitespace-nowrap` (pensado para montos) y forzaba
           las tres acciones a una línea, fijando el ancho mínimo de la columna y sacando el saldo
           del contenedor en angosto. Se alinean a la derecha con el flex de abajo. */
        cell: ({ row }) => {
          const c = row.original;
          const r = recordatorioDe(c);
          return (
            <span className="flex flex-wrap justify-end gap-x-1 text-[12.5px] font-normal">
              <AccionesRecordatorio r={r} copiado={copiadoKey === c.key} onCopiar={onCopiar} />
              {onToggleGestionado && (
                <>
                  <span aria-hidden="true"> · </span>
                  <button
                    type="button"
                    onClick={() => onToggleGestionado(c)}
                    aria-pressed={c.ultimaGestion != null}
                    className="font-semibold text-rediseno-tinta-3 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded"
                  >
                    {c.ultimaGestion != null ? "Reabrir" : "Gestionado"}
                  </button>
                </>
              )}
            </span>
          );
        },
      },
    ],
    [copiadoKey, onCopiar, onToggleGestionado],
  );
  return (
    <RedisenoTable
      columns={columns}
      data={clientes}
      totalCount={totalClientes}
      countNoun="clientes con saldo"
      /* 18 px de padding por lado × 2 × 3 columnas = 108 px de los 360 de una pantalla chica.
         Opt-in del primitivo: sólo esta tabla los baja a 10 px cuando es angosta. */
      celdasCompactasEnAngosto
      pageSize={50}
      onExport={onExport}
      emptyMessage={emptyMessage}
      footer={
        <span className="inline-flex flex-wrap items-center gap-x-1">
          <span aria-hidden="true">·</span>
          <span>
            total por cobrar (bruto){" "}
            <span className="font-semibold tabular-nums text-rediseno-tinta">
              {formatClp(bruto)}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-rediseno-azul">
            ¿por qué “bruto”?
            <InfoPopover label="Por qué el total es bruto" info={explicacion} hacia="arriba" />
          </span>
        </span>
      }
    />
  );
}

/** Exportar (§5.5): descarga el CSV en el navegador. Sólo corre en cliente. */
function descargarCsv(nombre: string, contenido: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
