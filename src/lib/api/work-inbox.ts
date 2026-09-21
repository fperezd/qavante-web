"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type WorkInboxResponse = components["schemas"]["WorkInboxResponse"];
export type WorkInboxQueue = components["schemas"]["InboxQueue"];
export type WorkInboxPriority = components["schemas"]["InboxPriority"];

export const workInboxKeys = {
  all: ["work-inbox"] as const,
  current: (legalEntityId: string | null) => [...workInboxKeys.all, legalEntityId] as const,
};

export function useWorkInbox(legalEntityId: string | null) {
  return useQuery({
    queryKey: workInboxKeys.current(legalEntityId),
    queryFn: () =>
      api.get<WorkInboxResponse>(
        `/api/treasury/work-inbox?legal_entity_id=${encodeURIComponent(legalEntityId!)}`,
      ),
    enabled: Boolean(legalEntityId),
    staleTime: 30_000,
    retry: false,
  });
}
