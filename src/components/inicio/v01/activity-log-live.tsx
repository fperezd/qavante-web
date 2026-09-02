"use client";

import * as React from "react";
import { useReversibleActions, useRevertReversibleAction } from "@/lib/api/reversible-actions";
import { actividadesAutomaticas } from "./activity-log-model";
import { ActivityLogView } from "./activity-log-view";

const PAGE_SIZE = 20;

/** Cableado de la fuente única de Ley 5: sólo automatismos del tenant, no sync ni usuario. */
export function ActivityLogLive({ complete = false }: { complete?: boolean }) {
  const [offset, setOffset] = React.useState(0);
  const limit = complete ? PAGE_SIZE : 5;
  const activity = useReversibleActions({ onlyUndoable: true, limit, offset });
  const revert = useRevertReversibleAction();
  const activities = activity.isError ? null : actividadesAutomaticas(activity.data, limit);
  const total = activity.data?.total ?? 0;
  const next = offset + limit < total;

  return (
    <div className="space-y-3">
      <ActivityLogView
        activities={activities}
        loading={activity.isLoading}
        error={activity.isError}
        onRetry={() => void activity.refetch()}
        onUndo={(actionId) => revert.mutateAsync(actionId)}
        detailLinks={!complete}
      />
      {complete && !activity.isLoading && !activity.isError && total > PAGE_SIZE && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Paginación de bitácora"
        >
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            className={PAGINATION_BUTTON}
          >
            Anteriores
          </button>
          <span className="text-xs text-neutral-mid">
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </span>
          <button
            type="button"
            disabled={!next}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
            className={PAGINATION_BUTTON}
          >
            Siguientes
          </button>
        </nav>
      )}
    </div>
  );
}

const PAGINATION_BUTTON =
  "rounded-md border border-brand-primary/40 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
