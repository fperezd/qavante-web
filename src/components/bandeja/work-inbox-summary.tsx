"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, RefreshCw, Tags } from "lucide-react";
import Link from "next/link";
import { QavanteBadge, QavanteButton } from "@/components/qavante";
import {
  type WorkInboxPriority,
  type WorkInboxQueue,
  type WorkInboxResponse,
  useWorkInbox,
} from "@/lib/api/work-inbox";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { formatCount } from "@/lib/formatters/count";
import { formatDateLike } from "@/lib/formatters/date";
import {
  emptyQueueLabel,
  formattedQueueAmounts,
  pendingCount,
  queueCoverageLabel,
} from "./work-inbox-model";
import { useBandejaLegalEntityId } from "./bandeja-scope";

const ICONS: Record<WorkInboxQueue["kind"], LucideIcon> = {
  reconciliation: Landmark,
  receivables: ArrowDownLeft,
  payables: ArrowUpRight,
  classification: Tags,
};

const QUEUE_LABELS: Record<WorkInboxPriority["queue"], string> = {
  reconciliation: "Conciliar",
  receivables: "Cobrar",
  payables: "Pagar",
  classification: "Clasificar",
};

export function WorkInboxSummary() {
  const legalEntityId = useBandejaLegalEntityId();
  const query = useWorkInbox(legalEntityId);

  if (query.isLoading) return <WorkInboxSkeleton />;
  if (query.isError || !query.data || query.data.legal_entity_id !== legalEntityId) {
    return (
      <section className="rounded-lg border border-border bg-surface p-5" aria-live="polite">
        <h1 className="text-2xl font-bold text-neutral-dark">Bandeja</h1>
        <p className="mt-2 text-sm text-neutral-mid">
          No pudimos actualizar las tareas operativas. No mostramos cifras anteriores como vigentes.
        </p>
        <QavanteButton
          className="mt-3"
          size="sm"
          variant="secondary"
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {!query.isFetching && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {query.isFetching ? "Reintentando…" : "Reintentar"}
        </QavanteButton>
      </section>
    );
  }

  return <WorkInboxSummaryView inbox={query.data} />;
}

export function WorkInboxSummaryView({ inbox }: { inbox: WorkInboxResponse }) {
  const total = pendingCount(inbox.queues);
  const priorities = inbox.priorities.slice(0, 4);

  return (
    <section className="space-y-5" data-testid="work-inbox">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Bandeja</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            Prioridades operativas ordenadas por vencimiento y necesidad de revisión.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-neutral-dark">{total}</p>
          <p className="text-xs text-neutral-mid">pendientes en cuatro colas</p>
        </div>
      </header>

      {priorities.length > 0 && (
        <section aria-labelledby="work-inbox-priorities" className="border-y border-border py-4">
          <h2 id="work-inbox-priorities" className="text-sm font-semibold text-neutral-dark">
            Primero
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {priorities.map((priority) => (
              <PriorityRow key={`${priority.queue}-${priority.id}`} priority={priority} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Colas de trabajo" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {inbox.queues.map((queue) => (
          <QueueCard key={queue.kind} queue={queue} />
        ))}
      </section>
    </section>
  );
}

function PriorityRow({ priority }: { priority: WorkInboxPriority }) {
  const amount = priority.currency
    ? formatMoneyFromDecimalString(priority.amount, priority.currency)
    : `${priority.amount} · moneda no informada`;
  return (
    <li>
      <Link
        href={priority.href}
        className="group flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-dark group-hover:text-brand-primary">
            {priority.title}
          </p>
          <p className="text-xs text-neutral-mid">
            {QUEUE_LABELS[priority.queue]}
            {priority.relevant_date ? ` · ${formatDateLike(priority.relevant_date)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-neutral-dark">{amount}</span>
          <ArrowRight className="h-4 w-4 text-brand-primary" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

function QueueCard({ queue }: { queue: WorkInboxQueue }) {
  const Icon = ICONS[queue.kind];
  const amounts = formattedQueueAmounts(queue);
  const coverage = queueCoverageLabel(queue);
  return (
    <article className="flex min-h-52 flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-neutral-dark">{queue.label}</h2>
        </div>
        {coverage && <QavanteBadge variant="warning">{coverage}</QavanteBadge>}
      </div>

      <p className="mt-4 text-2xl font-semibold tabular-nums text-neutral-dark">
        {formatCount(queue.count)}
      </p>
      <p className="text-xs text-neutral-mid">
        {queue.count === 0 ? emptyQueueLabel(queue) : "pendientes"}
      </p>

      <div className="mt-3 min-h-10 text-sm text-neutral-dark">
        {amounts.length > 0 ? (
          amounts.map((amount) => (
            <p key={amount} className="font-medium tabular-nums">
              {amount}
            </p>
          ))
        ) : (
          <p className="text-neutral-mid">Monto no disponible</p>
        )}
      </div>

      {queue.next_date && (
        <p className="mt-2 text-xs text-neutral-mid">
          Fecha prioritaria: {formatDateLike(queue.next_date)}
        </p>
      )}
      {queue.limitations[0] && (
        <p className="mt-2 line-clamp-2 text-xs text-warning-700">{queue.limitations[0]}</p>
      )}

      {queue.items.length > 0 && (
        <Link
          href={queue.href}
          className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-semibold text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          {queue.action_label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function WorkInboxSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando la bandeja" className="space-y-4">
      <div className="h-14 animate-pulse rounded-lg bg-neutral-light/30" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-52 animate-pulse rounded-lg bg-neutral-light/30" />
        ))}
      </div>
    </section>
  );
}
