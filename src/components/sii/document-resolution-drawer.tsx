"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, Unlink, X } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteInlineError } from "@/components/qavante";
import { useClassifyDocument, useClearDocumentClassification } from "@/lib/api/gestion";
import { useManagementAccountsTree, type ManagementAccountNode } from "@/lib/api/management";
import {
  type CaseMovementDetail,
  type DocumentAllocationDetail,
  type DocumentCandidateAllocation,
  useAssignDocumentPayment,
  useDocumentResolution,
  useRevertReconciliation,
} from "@/lib/api/reconciliation";
import { formatClpBare, formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

export type ResolvableDocumentKind = "receivable" | "payable" | "professional_fee";
export type ClassifiableDocumentSide = "ventas" | "compras" | "bhe";

export interface DocumentResolutionTarget {
  documentKind: ResolvableDocumentKind;
  classificationSide: ClassifiableDocumentSide;
  sourceExternalId: string;
  label: string;
}

export interface DocumentResolutionDrawerProps {
  target: DocumentResolutionTarget | null;
  onClose: () => void;
}

interface AccountOption {
  code: string;
  name: string;
}

function leafAccounts(
  nodes: ManagementAccountNode[] | undefined,
  side: ClassifiableDocumentSide | undefined,
): AccountOption[] {
  const items: AccountOption[] = [];
  const visit = (current: ManagementAccountNode[]) => {
    for (const node of current) {
      if (node.children?.length) visit(node.children);
      else if (
        node.active &&
        node.is_visible &&
        (side === "ventas" ? node.type === "income" : node.type !== "income")
      ) {
        items.push({ code: node.code, name: node.display_name ?? node.name });
      }
    }
  };
  visit(nodes ?? []);
  return items.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function money(value: string, currency: string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency ?? ""}`.trim();
  if (!currency) return `${formatClpBare(amount)} · moneda sin informar`;
  return formatMoney(amount, currency);
}

const BLOCKED_COPY: Record<string, string> = {
  ceded_receivable:
    "Esta cuenta por cobrar fue cedida. Debe resolverse mediante el flujo de factoring.",
  document_date_required: "Falta la fecha de emisión del documento en el origen.",
  currency_evidence_required: "Falta la moneda del documento en el origen.",
  no_open_balance: "Este documento no tiene saldo pendiente.",
};

export function allocationLabel(
  allocation: DocumentCandidateAllocation,
  currency?: string | null,
): string {
  const identity = allocation.name
    ? `${allocation.source_external_id} · ${allocation.name}`
    : allocation.source_external_id;
  const amount = Number(allocation.amount);
  return `${identity}: ${currency ? formatMoney(amount, currency) : formatClpBare(amount)}`;
}

export function assignmentConfirmation(
  allocationInput: number | readonly DocumentCandidateAllocation[],
  currency?: string | null,
): string {
  const count = typeof allocationInput === "number" ? allocationInput : allocationInput.length;
  const details =
    typeof allocationInput === "number" || count <= 1
      ? ""
      : `\n\n${allocationInput.map((allocation) => `• ${allocationLabel(allocation, currency)}`).join("\n")}`;
  return count > 1
    ? `¿Asignar este movimiento a los ${count} documentos indicados? Se aplicará exactamente el conjunto completo:${details}`
    : "¿Asignar este movimiento bancario al documento?";
}

export function revertConfirmation(
  allocations: readonly DocumentAllocationDetail[],
  movements: readonly CaseMovementDetail[] = [],
): string {
  if (allocations.length <= 1 && movements.length <= 1) {
    return "¿Desasignar este movimiento y reabrir el documento vinculado?";
  }
  const movementCopy =
    movements.length > 1
      ? `\n\nSe liberarán estos ${movements.length} movimientos bancarios:\n${movements
          .map(
            (movement) =>
              `• ${formatDateLike(movement.date)} · ${money(movement.amount, movement.currency_code)} · ${movement.description ?? "Sin glosa"}`,
          )
          .join("\n")}`
      : "";
  const documentCopy =
    allocations.length > 0
      ? `\n\nSe reabrirán ${allocations.length} documento${allocations.length === 1 ? "" : "s"}:\n${allocations
          .map((allocation) => `• ${allocationLabel(allocation, movements[0]?.currency_code)}`)
          .join("\n")}`
      : "";
  return `¿Desasignar el caso completo?${movementCopy}${documentCopy}`;
}

export function DocumentResolutionDrawer({ target, onClose }: DocumentResolutionDrawerProps) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLElement>(null);
  const resolution = useDocumentResolution(
    target?.documentKind ?? "payable",
    target?.sourceExternalId ?? null,
    Boolean(target),
  );
  const accounts = useManagementAccountsTree();
  const classify = useClassifyDocument();
  const clearClassification = useClearDocumentClassification();
  const assign = useAssignDocumentPayment();
  const revert = useRevertReconciliation();
  const options = React.useMemo(
    () => leafAccounts(accounts.data?.items, target?.classificationSide),
    [accounts.data?.items, target?.classificationSide],
  );
  const [accountCode, setAccountCode] = React.useState("");

  React.useEffect(() => {
    if (resolution.data?.classification?.account_code) {
      setAccountCode(resolution.data.classification.account_code);
    } else if (resolution.data) {
      setAccountCode("");
    }
  }, [resolution.data]);

  React.useEffect(() => {
    if (!target) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (document.activeElement === panelRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [target, onClose]);

  if (!target) return null;
  const data = resolution.data;
  const assignments = data?.assignments ?? [];
  const candidates = data?.candidates ?? [];
  const isClassified = Boolean(data?.classification);
  const isReconciled = assignments.length > 0 && Number(data?.outstanding_amount ?? 0) === 0;
  const isPartial = assignments.length > 0 && !isReconciled;

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-surface shadow-xl focus:outline-none"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-surface p-5">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-mid">
              Documento
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-neutral-dark">
              Clasificación y pago
            </h2>
            <p className="mt-2 text-sm text-neutral-dark">{target.label}</p>
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
          {resolution.isLoading && (
            <p className="inline-flex items-center gap-2 text-sm text-neutral-mid" aria-busy="true">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando estado…
            </p>
          )}
          {resolution.isError && (
            <QavanteInlineError error={resolution.error} what="el estado del documento" />
          )}

          {data && (
            <>
              <div className="grid gap-3 rounded-xl border border-border bg-surface-muted p-4 sm:grid-cols-3">
                <Fact label="Total" value={money(data.total_amount, data.currency_code)} />
                <Fact
                  label="Saldo pendiente"
                  value={money(data.outstanding_amount, data.currency_code)}
                />
                <Fact label="Emisión" value={formatDateLike(data.issue_date)} />
              </div>

              <section className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-neutral-dark">Clasificación</h3>
                  <QavanteBadge variant={isClassified ? "success" : "warning"}>
                    {isClassified ? "Clasificado" : "Por clasificar"}
                  </QavanteBadge>
                </div>
                {data.classification && (
                  <p className="text-xs text-neutral-mid">
                    Cuenta actual:{" "}
                    <strong className="text-neutral-dark">
                      {data.classification.account_code}
                    </strong>
                    {data.classification.origin ? ` · Origen: ${data.classification.origin}` : ""}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={accountCode}
                    onChange={(event) => setAccountCode(event.target.value)}
                    aria-label="Cuenta de clasificación"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-neutral-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="">Elige una cuenta…</option>
                    {options.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <QavanteButton
                    size="sm"
                    variant={isClassified ? "secondary" : "primary"}
                    loading={classify.isPending}
                    disabled={!accountCode}
                    onClick={() =>
                      classify.mutate({
                        side: target.classificationSide,
                        source_external_id: target.sourceExternalId,
                        account_code: accountCode,
                      })
                    }
                  >
                    {isClassified ? "Modificar clasificación" : "Clasificar"}
                  </QavanteButton>
                  {isClassified && (
                    <QavanteButton
                      size="sm"
                      variant="ghost"
                      loading={clearClassification.isPending}
                      onClick={() => {
                        if (window.confirm("¿Retirar la clasificación de este documento?")) {
                          clearClassification.mutate({
                            side: target.classificationSide,
                            source_external_id: target.sourceExternalId,
                            classification_id: data.classification!.classification_id,
                          });
                        }
                      }}
                    >
                      Desclasificar
                    </QavanteButton>
                  )}
                </div>
                {(classify.isError || clearClassification.isError) && (
                  <p className="text-xs text-danger-500">No pudimos guardar la clasificación.</p>
                )}
              </section>

              <section className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-neutral-dark">Conciliación</h3>
                  <QavanteBadge variant={isReconciled ? "success" : isPartial ? "info" : "warning"}>
                    {isReconciled ? "Conciliado" : isPartial ? "Pago parcial" : "Por conciliar"}
                  </QavanteBadge>
                </div>

                {data.blocked_reason && (
                  <p className="rounded-lg bg-warning-50 p-3 text-xs text-warning-700">
                    {BLOCKED_COPY[data.blocked_reason] ?? data.blocked_reason}
                  </p>
                )}

                {assignments.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-neutral-dark">
                      Pagos asignados
                    </h4>
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {assignments.map((item) => (
                        <li
                          key={item.movement_id}
                          className="flex items-start justify-between gap-3 p-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-dark">
                              {formatDateLike(item.date)} ·{" "}
                              {money(item.amount_applied, item.currency_code)}
                            </p>
                            <p className="mt-1 truncate text-neutral-mid">
                              {item.description ?? "Sin glosa"}
                            </p>
                            {item.topology && (
                              <p className="mt-1 text-[11px] text-neutral-mid">
                                Relación {item.topology}
                                {item.case_id ? ` · caso ${item.case_id}` : ""}
                              </p>
                            )}
                            {(item.allocations?.length ?? 0) > 0 && (
                              <div className="mt-2 rounded-md bg-surface-muted p-2">
                                <p className="text-[11px] font-semibold text-neutral-dark">
                                  Documentos alcanzados por este vínculo
                                </p>
                                <ul className="mt-1 space-y-1 text-[11px] text-neutral-mid">
                                  {item.allocations!.map((allocation) => (
                                    <li
                                      key={`${allocation.document_kind}:${allocation.document_id}`}
                                    >
                                      {allocationLabel(allocation, item.currency_code)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(item.movements?.length ?? 0) > 1 && (
                              <div className="mt-2 rounded-md bg-surface-muted p-2">
                                <p className="text-[11px] font-semibold text-neutral-dark">
                                  Movimientos bancarios del mismo caso
                                </p>
                                <ul className="mt-1 space-y-1 text-[11px] text-neutral-mid">
                                  {item.movements!.map((movement) => (
                                    <li key={movement.movement_id}>
                                      <Link
                                        href={`/banco?movement=${encodeURIComponent(movement.movement_id)}&account=${encodeURIComponent(movement.bank_account_id)}`}
                                        className="text-brand-primary hover:underline"
                                      >
                                        {formatDateLike(movement.date)} ·{` `}
                                        {money(movement.amount, movement.currency_code)} ·{` `}
                                        {movement.description ?? "Sin glosa"}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <Link
                              href={`/banco?movement=${encodeURIComponent(item.movement_id)}&account=${encodeURIComponent(item.bank_account_id)}`}
                              className="mt-1 inline-flex items-center gap-1 text-brand-primary hover:underline"
                            >
                              Ver movimiento en Banco{" "}
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          </div>
                          <QavanteButton
                            size="sm"
                            variant="ghost"
                            loading={revert.isPending && revert.variables === item.movement_id}
                            onClick={() => {
                              if (
                                window.confirm(
                                  revertConfirmation(item.allocations ?? [], item.movements ?? []),
                                )
                              ) {
                                revert.mutate(item.movement_id);
                              }
                            }}
                          >
                            <Unlink className="h-3.5 w-3.5" aria-hidden /> Desasignar
                          </QavanteButton>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!data.blocked_reason && Number(data.outstanding_amount) > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-neutral-dark">
                      Movimientos bancarios elegibles
                    </h4>
                    {candidates.length === 0 ? (
                      <p className="text-xs text-neutral-mid">
                        No hay un movimiento con identidad, moneda y fecha compatibles. No se
                        propone el “menos malo”.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border rounded-lg border border-border">
                        {candidates.map((item) => (
                          <li
                            key={item.movement_id}
                            className="flex items-start justify-between gap-3 p-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-neutral-dark">
                                {formatDateLike(item.date)} ·{" "}
                                {money(item.amount, item.currency_code)}
                              </p>
                              <p className="mt-1 text-neutral-mid">
                                {item.description ?? "Sin glosa"}
                              </p>
                              {(item.reasons?.length ?? 0) > 0 && (
                                <p className="mt-1 text-[11px] text-success-700">
                                  {item.reasons!.join(" · ")}
                                </p>
                              )}
                              {(item.allocations?.length ?? 0) > 1 && (
                                <div className="mt-2 rounded-md bg-surface-muted p-2">
                                  <p className="text-[11px] font-semibold text-neutral-dark">
                                    Pago consolidado: se aplicará exactamente a estos documentos
                                  </p>
                                  <ul className="mt-1 space-y-1 text-[11px] text-neutral-mid">
                                    {item.allocations!.map((allocation) => (
                                      <li key={allocation.document_id}>
                                        {allocationLabel(allocation, item.currency_code)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <QavanteButton
                              size="sm"
                              loading={
                                assign.isPending &&
                                assign.variables?.movement_id === item.movement_id
                              }
                              onClick={() => {
                                const allocationSet = item.allocations ?? [];
                                const question = assignmentConfirmation(
                                  allocationSet.length > 0 ? allocationSet : 1,
                                  item.currency_code,
                                );
                                if (!window.confirm(question)) return;
                                assign.mutate({
                                  document_kind: target.documentKind,
                                  source_external_id: target.sourceExternalId,
                                  movement_id: item.movement_id,
                                  expected_allocations: allocationSet.map((allocation) => ({
                                    document_id: allocation.document_id,
                                    source_external_id: allocation.source_external_id,
                                    amount: allocation.amount,
                                  })),
                                });
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Asignar pago
                            </QavanteButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {(assign.isError || revert.isError) && (
                  <p className="text-xs text-danger-500">
                    El vínculo cambió o dejó de ser elegible. Actualiza e intenta nuevamente.
                  </p>
                )}
              </section>

              {target.documentKind === "professional_fee" && (
                <p className="text-xs text-neutral-mid">
                  La BHE se paga por su monto líquido; la retención sigue separada como obligación
                  tributaria.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-mid">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-dark">{value}</p>
    </div>
  );
}
