"use client";

import * as React from "react";
import { ExternalLink, X } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { Pill } from "@/components/rediseno/pill";
import { formatDateShort } from "@/lib/formatters/date";
import { CLASIFICACION_PILL, CONCILIACION_PILL, type MovimientoV03 } from "./banco-v03-model";
import type {
  BankMovementResolutionDetail,
  ResolutionAllocation,
  ResolutionHistoryEntry,
} from "./bank-resolution-detail-model";
import {
  DistributedClassificationEditor,
  type ClassificationAccountOption,
  type ClassificationDimensionOption,
  type ClassificationEventOption,
} from "./distributed-classification-editor";
import type { ReplaceClassificationRequest } from "@/lib/api/treasury";

export interface BankResolutionDetailDrawerProps {
  open: boolean;
  movement: MovimientoV03;
  detail: BankMovementResolutionDetail;
  onClose: () => void;
  onUnreconcile?: () => void;
  onReclassify?: () => void;
  onUnclassify?: () => void;
  classificationEditor?: {
    accounts: ClassificationAccountOption[];
    events: ClassificationEventOption[];
    dimensions: ClassificationDimensionOption[];
    saving?: boolean;
    onSave: (body: ReplaceClassificationRequest) => Promise<void>;
  };
}

export function BankResolutionDetailDrawer({
  open,
  movement,
  detail,
  onClose,
  onUnreconcile,
  onReclassify,
  onUnclassify,
  classificationEditor,
}: BankResolutionDetailDrawerProps) {
  const titleId = React.useId();
  const asideRef = React.useRef<HTMLElement>(null);
  const [editingClassification, setEditingClassification] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !asideRef.current) return;
      const focusable = Array.from(
        asideRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        asideRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (document.activeElement === asideRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const reconciliationPill = CONCILIACION_PILL[detail.reconciliation.status];
  const classificationPill = CLASIFICACION_PILL[detail.classification.status];
  const canEditClassification = Boolean(classificationEditor && movement.moneda !== "S/D");

  function confirmUnreconcile() {
    if (window.confirm("¿Desconciliar este movimiento y reabrir sus documentos asociados?")) {
      onUnreconcile?.();
    }
  }

  function confirmUnclassify() {
    if (window.confirm("¿Eliminar la clasificación y su distribución contable?")) {
      onUnclassify?.();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar detalle"
        className="absolute inset-0 cursor-default bg-neutral-dark/40"
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-xl focus-visible:outline-none"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-neutral-light bg-surface p-5">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-semibold tracking-wide text-neutral-mid uppercase">
              Movimiento bancario
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-neutral-dark">
              Cómo se resolvió
            </h2>
            <p className="mt-2 text-sm text-neutral-dark">{movement.glosa}</p>
            <p className="mt-1 text-xs text-neutral-mid">
              {formatDateShort(movement.fecha)} · {movement.cuenta}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-neutral-mid hover:bg-brand-primary-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 p-5">
          <ResolutionSection
            title="Conciliación"
            pill={<Pill variant={reconciliationPill.tono}>{reconciliationPill.texto}</Pill>}
          >
            {detail.reconciliation.topology && (
              <Fact label="Relación" value={detail.reconciliation.topology} />
            )}
            <Allocations
              items={detail.reconciliation.allocations}
              empty="El estado está disponible, pero la API todavía no publicó contra qué documento(s) se concilió."
            />
            {detail.reconciliation.balanceFormatted && (
              <Fact label="Saldo por conciliar" value={detail.reconciliation.balanceFormatted} />
            )}
            <Trace
              source={detail.reconciliation.source}
              confidence={detail.reconciliation.confidence}
            />
            {(detail.reconciliation.evidence?.length ?? 0) > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-mid">
                {detail.reconciliation.evidence!.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <History items={detail.reconciliation.history} />
            {detail.reconciliation.status === "conciliado" && (
              <QavanteButton
                size="sm"
                variant="ghost"
                disabled={!detail.reconciliation.canUnreconcile || !onUnreconcile}
                onClick={confirmUnreconcile}
                title={
                  !detail.reconciliation.canUnreconcile || !onUnreconcile
                    ? "Este tipo de vínculo todavía no admite una reversión segura desde Banco"
                    : undefined
                }
              >
                Desconciliar
              </QavanteButton>
            )}
          </ResolutionSection>

          <ResolutionSection
            title="Clasificación"
            pill={<Pill variant={classificationPill.tono}>{classificationPill.texto}</Pill>}
          >
            {detail.classification.canonicalType && (
              <Fact label="Tipo financiero" value={detail.classification.canonicalType} />
            )}
            <Allocations
              items={detail.classification.allocations}
              empty="La API todavía no publicó la cuenta de gestión o su distribución para este movimiento."
            />
            <Trace
              source={detail.classification.source}
              confidence={detail.classification.confidence}
              actor={detail.classification.actor}
              occurredAt={detail.classification.classifiedAt}
            />
            <History items={detail.classification.history} />
            {editingClassification && classificationEditor && canEditClassification && (
              <DistributedClassificationEditor
                totalAmount={Math.abs(movement.monto)}
                currency={movement.moneda}
                accounts={classificationEditor.accounts}
                events={classificationEditor.events}
                dimensions={classificationEditor.dimensions}
                saving={classificationEditor.saving}
                onCancel={() => setEditingClassification(false)}
                onSave={async (body) => {
                  await classificationEditor.onSave(body);
                  setEditingClassification(false);
                }}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <QavanteButton
                size="sm"
                variant="secondary"
                disabled={!canEditClassification && !onReclassify}
                onClick={() =>
                  canEditClassification ? setEditingClassification(true) : onReclassify?.()
                }
                title={
                  movement.moneda === "S/D"
                    ? "Corrige la moneda del movimiento antes de clasificar"
                    : undefined
                }
              >
                Modificar clasificación
              </QavanteButton>
              {detail.classification.status === "clasificado" && (
                <QavanteButton
                  size="sm"
                  variant="ghost"
                  disabled={!onUnclassify}
                  onClick={confirmUnclassify}
                >
                  Desclasificar
                </QavanteButton>
              )}
            </div>
          </ResolutionSection>
        </div>
      </aside>
    </div>
  );
}

function ResolutionSection({
  title,
  pill,
  children,
}: {
  title: string;
  pill: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-3 rounded-xl border border-neutral-light p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-neutral-dark">{title}</h3>
        {pill}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-neutral-mid">{label}</dt>
      <dd className="font-medium text-neutral-dark">{value}</dd>
    </dl>
  );
}

function Allocations({ items, empty }: { items: ResolutionAllocation[]; empty: string }) {
  if (items.length === 0)
    return <p className="rounded-lg bg-neutral-soft p-3 text-xs text-neutral-mid">{empty}</p>;
  return (
    <ul className="divide-y divide-neutral-light rounded-lg border border-neutral-light">
      {items.map((item) => (
        <li key={item.id} className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="font-medium text-neutral-dark">{item.label}</span>
            <span className="whitespace-nowrap font-semibold text-neutral-dark">
              {item.amountFormatted}
              {item.percentage ? ` · ${item.percentage}` : ""}
            </span>
          </div>
          {item.dimensions && item.dimensions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.dimensions.map((dimension) => (
                <span
                  key={`${dimension.name}:${dimension.value}`}
                  className="rounded-full bg-neutral-soft px-2 py-1 text-xs text-neutral-mid"
                >
                  {dimension.name}: {dimension.value}
                </span>
              ))}
            </div>
          )}
          {item.origin && (
            <a
              href={item.origin.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
            >
              {item.origin.label}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Trace({
  source,
  confidence,
  actor,
  occurredAt,
}: {
  source?: string | null;
  confidence?: string | null;
  actor?: string | null;
  occurredAt?: string | null;
}) {
  const values = [
    source && `Origen: ${source}`,
    confidence && `Confianza: ${confidence}`,
    actor && `Actor: ${actor}`,
    occurredAt && `Fecha: ${formatDateShort(occurredAt)}`,
  ].filter(Boolean);
  return values.length > 0 ? (
    <p className="text-xs text-neutral-mid">{values.join(" · ")}</p>
  ) : null;
}

function History({ items }: { items?: ResolutionHistoryEntry[] }) {
  if (!items?.length) return null;
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-brand-primary">
        Ver historial ({items.length})
      </summary>
      <ol className="mt-2 space-y-2 border-l border-neutral-light pl-3 text-xs text-neutral-mid">
        {items.map((item) => (
          <li key={item.id}>
            <span className="font-medium text-neutral-dark">{item.label}</span> ·{" "}
            {formatDateShort(item.occurredAt)}
            {item.actor ? ` · ${item.actor}` : ""}
          </li>
        ))}
      </ol>
    </details>
  );
}
