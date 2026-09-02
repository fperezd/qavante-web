"use client";

import * as React from "react";
import { useActivityLog } from "@/lib/api/activity-log";
import { actividadesRegistradas } from "./activity-registered-model";
import { ActivityRegisteredView } from "./activity-registered-view";

const PAGE_SIZE = 20;

/** Reader separado del de Ley 5: agrega fuentes registradas, pero nunca reemplaza Deshacer. */
export function ActivityRegisteredLive() {
  const [offset, setOffset] = React.useState(0);
  const activity = useActivityLog({ limit: PAGE_SIZE, offset });
  const activities = activity.isError ? null : actividadesRegistradas(activity.data, PAGE_SIZE);
  const total = activity.data?.total ?? 0;
  const next = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-3">
      <ActivityRegisteredView
        activities={activities}
        loading={activity.isLoading}
        error={activity.isError}
        onRetry={() => void activity.refetch()}
      />
      {!activity.isLoading && !activity.isError && total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginación de actividad registrada">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className={PAGINATION_BUTTON}>
            Anteriores
          </button>
          <span className="text-xs text-neutral-mid">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <button type="button" disabled={!next} onClick={() => setOffset((value) => value + PAGE_SIZE)} className={PAGINATION_BUTTON}>
            Siguientes
          </button>
        </nav>
      )}
    </div>
  );
}

const PAGINATION_BUTTON =
  "rounded-md border border-brand-primary/40 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
