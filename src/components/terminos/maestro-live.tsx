"use client";

import * as React from "react";
import { toast } from "sonner";
import { QavanteEmpty } from "@/components/qavante";
import { QavanteInlineError } from "@/components/qavante";
import { usePreferences, useUpdatePreferences, type PreferencesBlob } from "@/lib/api/preferences";
import {
  useDocumentStatuses,
  type DocumentStatusKey,
  type DocumentRowStatus,
} from "@/lib/api/reconciliation";
import { useMaestroDocs } from "./use-maestro-docs";
import { MaestroContrapartes } from "./maestro-view";
import {
  readTerminos,
  buildMaestro,
  totalesMaestro,
  withTerm,
  withoutTerm,
  withDefaultTerm,
  readPagados,
  type ConciliacionMap,
  type EstadoConciliacion,
  type MaestroKind,
} from "./terminos-pago";

/** Lado documental con el que el motor de conciliación identifica cada tipo de maestro. */
const DOCUMENT_KIND: Record<MaestroKind, DocumentRowStatus["document_kind"]> = {
  ventas: "receivable",
  compras: "payable",
  honorarios: "professional_fee",
};

const ESTADOS_CONOCIDOS = new Set<string>(["reconciled", "partial", "unreconciled"]);

/* Contenedor del maestro (clientes/proveedores/honorarios). Cablea los documentos del
   año (useMaestroDocs) + los términos de las prefs al motor puro (buildMaestro) y persiste
   las ediciones de término (por contraparte o el default del tipo). Container: la lógica
   vive testeada en `terminos-pago`; la vista tiene sus stories. */

const PLURAL: Record<MaestroKind, string> = {
  ventas: "clientes",
  compras: "proveedores",
  honorarios: "profesionales",
};

const MESES_ABR = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** ["2026-01", …, "2026-07"] → "ene–jul 2026". */
function periodosLabel(periods: string[]): string {
  if (periods.length === 0) return "";
  const parse = (p: string) => {
    const m = p.match(/^(\d{4})-(\d{2})/);
    return m ? { y: m[1], mes: MESES_ABR[Number(m[2]) - 1] ?? m[2] } : { y: "", mes: p };
  };
  const a = parse(periods[0]!);
  const b = parse(periods[periods.length - 1]!);
  if (periods.length === 1) return `${a.mes} ${a.y}`;
  return `${a.mes}–${b.mes} ${b.y}`;
}

export function MaestroLive({
  kind,
  titulo,
  subtitulo,
}: {
  kind: MaestroKind;
  titulo?: string;
  subtitulo?: React.ReactNode;
}) {
  const { docs, periods, isFetching, isError } = useMaestroDocs(kind);
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const today = React.useMemo(() => new Date(), []);

  const terminos = React.useMemo(() => readTerminos(prefs.data?.preferences), [prefs.data]);
  const pagados = React.useMemo(() => readPagados(prefs.data?.preferences), [prefs.data]);

  /* Estado REAL de conciliación por documento: una sola llamada por lote al motor
     (`POST /api/treasury/reconciliation/document-resolution/statuses`, batcheada a 500 en
     `fetchDocumentStatuses`). El SII no sabe si pagaste; el motor sí, porque un documento
     sólo queda `reconciled` cuando tiene un movimiento bancario asignado y saldo 0. */
  const statusDocuments = React.useMemo<DocumentStatusKey[]>(
    () =>
      docs.flatMap((d) =>
        d.sourceExternalId
          ? [{ document_kind: DOCUMENT_KIND[kind], source_external_id: d.sourceExternalId }]
          : [],
      ),
    [docs, kind],
  );
  const statuses = useDocumentStatuses(statusDocuments, docs.length > 0);
  const conciliacion = React.useMemo<ConciliacionMap>(() => {
    const out: ConciliacionMap = {};
    for (const item of statuses.data?.items ?? []) {
      if (ESTADOS_CONOCIDOS.has(item.reconciliation_status)) {
        out[item.source_external_id] = item.reconciliation_status as EstadoConciliacion;
      }
    }
    return out;
  }, [statuses.data?.items]);

  /* Sin la respuesta del motor NO se pasa el mapa: `buildMaestro` cae al comportamiento
     histórico (muestra todo lo facturado) en vez de ocultar documentos por un mapa vacío. */
  const cps = React.useMemo(
    () =>
      statuses.isSuccess
        ? buildMaestro(docs, terminos, kind, today, pagados, conciliacion)
        : buildMaestro(docs, terminos, kind, today, pagados),
    [docs, terminos, kind, today, pagados, conciliacion, statuses.isSuccess],
  );
  const totals = React.useMemo(() => totalesMaestro(cps), [cps]);

  const persist = (blob: PreferencesBlob) => {
    if (!prefs.isSuccess) {
      toast.error("No pudimos guardar", {
        description: "No cargaron tus preferencias; recarga e intenta de nuevo.",
      });
      return;
    }
    updatePrefs.mutate(blob, { onError: () => toast.error("No pudimos guardar el cambio.") });
  };
  const onSetTerm = (rut: string, days: number) =>
    persist(withTerm(prefs.data?.preferences, kind, rut, days));
  const onResetTerm = (rut: string) => persist(withoutTerm(prefs.data?.preferences, kind, rut));
  const onSetDefault = (days: number) =>
    persist(withDefaultTerm(prefs.data?.preferences, kind, days));

  // Esperar a las PREFS (términos): sin ellas el vencimiento se derivaría con el default del
  // tipo y no con el término que el usuario fijó (race cazada en prod).
  if (prefs.isLoading) return <MaestroSkeleton />;
  if (isFetching && docs.length === 0) return <MaestroSkeleton />;
  // Esperar al MOTOR: sin su respuesta la lista incluiría documentos ya conciliados.
  if (docs.length > 0 && statuses.isLoading) return <MaestroSkeleton />;
  if (docs.length === 0) {
    return (
      <QavanteEmpty
        title={isError ? "No pudimos cargar los documentos del SII" : `Sin documentos este año`}
        description={
          isError
            ? "Revisa la conexión con el SII o intenta de nuevo en un momento."
            : `Cuando el SII registre ${kind === "compras" ? "compras" : kind === "honorarios" ? "honorarios recibidos" : "ventas"} este año, vas a ver acá tu maestro con los vencimientos derivados.`
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {statuses.isError && (
        <QavanteInlineError
          error={statuses.error}
          what="el estado de conciliación de cada documento"
          onRetry={() => statuses.refetch()}
        />
      )}
      <MaestroContrapartes
        kind={kind}
        contrapartePlural={PLURAL[kind]}
        cps={cps}
        totals={totals}
        defaultTerm={terminos[kind].default}
        onSetTerm={onSetTerm}
        onResetTerm={onResetTerm}
        onSetDefault={onSetDefault}
        pending={updatePrefs.isPending}
        periodosLabel={periodosLabel(periods)}
        titulo={titulo}
        subtitulo={subtitulo}
      />
    </div>
  );
}

function MaestroSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
