"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  useAccountsReceivable,
  type AccountsReceivableResponse,
  type TopDebtor,
} from "@/lib/api/cobranza";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import {
  PartialDataBanner,
  SyncPendingState,
  isPartial,
  isSyncPending,
} from "@/components/treasury/sync-pending-state";
import { normalizeRut } from "@/lib/validators/rut";
import { defaultRange } from "@/lib/period/period-range";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmount, agingBars } from "../cobranza-format";
import { useDebtorInvoices } from "../debtor-invoices";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { readTerminos, readPagados, buildMaestro } from "@/components/terminos/terminos-pago";
import { CobrarHero } from "./cobrar-hero";
import { CobranzaAcciones } from "./cobranza-acciones";
import { CobrarV2View, ResumenCobranza, DeudorRow } from "./cobrar-v2-view";
import {
  pickPrioridad,
  reminderText,
  waHref,
  mailtoHref,
  readGestionado,
  isGestionado,
  withGestionado,
  withoutGestionado,
  sortDebtors,
  type PrioridadMode,
} from "./cobrar-v2-map";

/* Vista LIVE de Cobrar v2 (rediseño 2026-07-19), gated por `cobrarV2`. Cablea
   `accounts-receivable` + las prefs de UI (gestionado) al mapper puro y compone la
   vista. Degradación honesta (dos modos según haya o no vencimientos del SII).
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en
   `cobrar-v2-map` (testeada) y las piezas presentacionales tienen sus stories. */

const ASUNTO = "Cobranza pendiente";

/** Fecha de HOY en America/Santiago como ISO "YYYY-MM-DD" (en-CA da ese formato). */
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function CobrarV2Live({ siiEnabled }: { siiEnabled: boolean }) {
  const query = useAccountsReceivable();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <QavanteInlineError
        error={query.error}
        what="las cuentas por cobrar"
        onRetry={() => query.refetch()}
      />
    );
  }
  const data = query.data;
  if (!data) return null;
  if (parseAmount(data.total) === 0) {
    return isSyncPending(data) ? (
      <SyncPendingState missingSources={data.missing_sources} what="tus cuentas por cobrar" />
    ) : (
      <QavanteEmpty
        title="No tienes cuentas por cobrar"
        description="Cuando tengas documentos por cobrar pendientes, vas a verlos acá ordenados por prioridad."
      />
    );
  }
  return <Assembled data={data} siiEnabled={siiEnabled} />;
}

function Assembled({ data, siiEnabled }: { data: AccountsReceivableResponse; siiEnabled: boolean }) {
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const range = React.useMemo(() => defaultRange(), []);
  const [everOpened, setEverOpened] = React.useState(false);
  const invoices = useDebtorInvoices(range, siiEnabled && everOpened);

  const gestionadoMap = React.useMemo(
    () => readGestionado(prefs.data?.preferences),
    [prefs.data],
  );
  // UNIFICACIÓN de las fuentes de cobranza: la fuente primaria es el RCV del año (la MISMA
  // base que "Clientes") — completo, por-documento, net de NC, con conciliado descontado y
  // el vencimiento DERIVADO del término. `accounts-receivable` queda como respaldo si el RCV
  // aún no cargó. Así Cobrar y Clientes muestran exactamente lo mismo, y el vencido derivado
  // enciende el modo urgencia (antes atascado en "concentración" esperando al SII).
  const ventasDocs = useMaestroDocs("ventas");
  const cps = React.useMemo(() => {
    if (ventasDocs.docs.length === 0) return [];
    const terminos = readTerminos(prefs.data?.preferences);
    const pagadosMap = readPagados(prefs.data?.preferences);
    return buildMaestro(ventasDocs.docs, terminos, "ventas", new Date(), pagadosMap);
  }, [ventasDocs.docs, prefs.data]);
  const useRcv = cps.length > 0;
  const totalConciliado = React.useMemo(
    () => cps.reduce((s, cp) => s + Math.max(0, cp.pagado), 0),
    [cps],
  );

  // Deudores: del maestro RCV (por cobrar = facturado net NC − conciliado; vencido derivado)
  // o del accounts-receivable si el RCV no cargó (respaldo).
  const debtors: TopDebtor[] = React.useMemo(() => {
    if (useRcv) {
      return cps.map((cp) => ({
        name: cp.name,
        rut: cp.rut,
        total: String(Math.max(0, cp.total - cp.pagado)),
        overdue: String(Math.max(0, cp.vencido)),
      }));
    }
    return data.top_debtors ?? [];
  }, [useRcv, cps, data.top_debtors]);

  const grandTotal = useRcv
    ? debtors.reduce((s, d) => s + parseAmount(d.total), 0)
    : parseAmount(data.total);
  const totalVencido = useRcv
    ? debtors.reduce((s, d) => s + parseAmount(d.overdue), 0)
    : parseAmount(data.overdue);
  const overduePct = grandTotal > 0 ? (totalVencido / grandTotal) * 100 : 0;

  // Modo GLOBAL (para el resumen): con el vencido derivado del RCV, casi siempre hay mora
  // → urgencia. El hero usa el modo del deudor priorizado (que puede caer en concentración
  // si el único con mora ya está gestionado) — por eso se calcula aparte.
  const anyOverdue = debtors.some((d) => parseAmount(d.overdue) > 0);
  const globalMode: PrioridadMode = anyOverdue ? "urgencia" : "concentracion";

  const ordered = React.useMemo(() => sortDebtors(debtors, gestionadoMap), [debtors, gestionadoMap]);
  const pendientes = ordered.filter((d) => !isGestionado(gestionadoMap, d.rut));
  const prioridad = pickPrioridad({ ...data, top_debtors: pendientes });

  const [openRut, setOpenRut] = React.useState<string | null>(null);
  const [copiadoRut, setCopiadoRut] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copyTimer.current), []);

  const remFor = (d: TopDebtor) =>
    reminderText({
      name: d.name,
      total: parseAmount(d.total),
      overdue: parseAmount(d.overdue),
      mode: parseAmount(d.overdue) > 0 ? "urgencia" : "concentracion",
    });

  const copiar = (d: TopDebtor) => {
    const text = remFor(d);
    const ok = () => {
      setCopiadoRut(normalizeRut(d.rut));
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiadoRut(null), 2000);
      toast.success("Recordatorio copiado", {
        description: "Pégalo en WhatsApp, correo o donde le escribas al cliente.",
      });
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() =>
        toast.error("No pudimos copiar. Intenta de nuevo."),
      );
    } else {
      toast.error("Tu navegador no permite copiar automáticamente.");
    }
  };

  const toggleGestionado = (d: TopDebtor) => {
    if (!prefs.isSuccess) {
      toast.error("No pudimos guardar", {
        description: "No cargaron tus preferencias; recarga e intenta de nuevo.",
      });
      return;
    }
    const already = isGestionado(gestionadoMap, d.rut);
    const blob = already
      ? withoutGestionado(prefs.data?.preferences, d.rut)
      : withGestionado(prefs.data?.preferences, d.rut, todayISO());
    updatePrefs.mutate(blob, {
      onSuccess: () =>
        toast.success(already ? `Reabriste a ${d.name}` : `Marcaste a ${d.name} como gestionado`),
      onError: () => toast.error("No pudimos guardar el cambio."),
    });
  };

  const hero = prioridad ? (
    <CobrarHero
      antetitulo={prioridad.mode === "urgencia" ? "Cóbrale primero a" : "Tu mayor cobranza"}
      cliente={prioridad.debtor.name}
      rut={prioridad.debtor.rut}
      monto={prioridad.mode === "urgencia" ? prioridad.overdue : prioridad.total}
      montoLabel={prioridad.mode === "urgencia" ? "vencido" : "por cobrar"}
      montoTono={prioridad.mode === "urgencia" ? "danger" : "neutral"}
      bajada={
        prioridad.mode === "urgencia" ? (
          <>
            De {formatClp(prioridad.total)} que te debe. Es tu cobranza vencida más grande — pártele
            por acá.
          </>
        ) : (
          <>
            {Math.round(prioridad.pctDelTotal)}% de tus {formatClp(grandTotal)} por cobrar. Aún no
            sabemos qué está vencido (el SII no entregó los vencimientos), así que priorizamos por
            tamaño.
          </>
        )
      }
      infoHint={
        prioridad.mode === "urgencia"
          ? "Priorizamos por mora derivada del término de pago (emisión + término). Ajusta los términos por cliente en Clientes."
          : "Sin vencimientos del SII, priorizamos por tamaño de la deuda. Cuando lleguen las fechas, la pantalla prioriza por mora sola."
      }
      acciones={
        <CobranzaAcciones
          onCopiar={() => copiar(prioridad.debtor)}
          copiado={copiadoRut === normalizeRut(prioridad.debtor.rut)}
          waHref={waHref(remFor(prioridad.debtor))}
          mailtoHref={mailtoHref(ASUNTO, remFor(prioridad.debtor))}
          gestionado={gestionadoMap[normalizeRut(prioridad.debtor.rut)] ?? null}
          onToggleGestionado={() => toggleGestionado(prioridad.debtor)}
          gestionadoPending={updatePrefs.isPending}
        />
      }
    />
  ) : (
    <TodoGestionado count={debtors.length} />
  );

  const deudores = (
    <ul className="divide-y divide-border">
      {ordered.map((d) => {
        const rut = normalizeRut(d.rut);
        const text = remFor(d);
        return (
          <DeudorRow
            key={d.rut}
            name={d.name}
            rut={d.rut}
            total={parseAmount(d.total)}
            overdue={parseAmount(d.overdue)}
            pct={grandTotal > 0 ? (parseAmount(d.total) / grandTotal) * 100 : 0}
            gestionado={gestionadoMap[rut] ?? null}
            onCopiar={() => copiar(d)}
            copiado={copiadoRut === rut}
            waHref={waHref(text)}
            mailtoHref={mailtoHref(ASUNTO, text)}
            onToggleGestionado={() => toggleGestionado(d)}
            gestionadoPending={updatePrefs.isPending}
            isOpen={openRut === rut}
            onToggleOpen={() => {
              setEverOpened(true);
              setOpenRut(openRut === rut ? null : rut);
            }}
            docs={invoices.byRut.get(rut) ?? []}
            invoicesLoading={invoices.isFetching}
            invoicesError={invoices.isError}
            siiEnabled={siiEnabled}
          />
        );
      })}
    </ul>
  );

  return (
    <CobrarV2View
      hero={hero}
      resumen={
        <ResumenCobranza
          total={grandTotal}
          overdue={totalVencido}
          overduePct={overduePct}
          mode={globalMode}
          conciliado={totalConciliado}
        />
      }
      aging={useRcv ? undefined : agingBars(data.aging)}
      deudores={deudores}
      banner={!useRcv && isPartial(data) ? <PartialDataBanner missingSources={data.missing_sources} /> : undefined}
      siiEnabled={siiEnabled}
    />
  );
}

function TodoGestionado({ count }: { count: number }) {
  return (
    <div className="p-5">
      <p className="flex items-center gap-2 text-[15px] font-bold text-success-700">
        <CircleCheck className="size-5" aria-hidden="true" />
        Gestionaste toda tu cobranza
      </p>
      <p className="mt-1.5 text-[12.5px] text-neutral-mid">
        Marcaste como gestionados a tus {count} clientes con saldo. Reabre cualquiera abajo si
        necesitas volver a insistir.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
