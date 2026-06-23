"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { MswProvider } from "./msw-provider";
import { QavanteToaster, toast } from "@/components/qavante/qavante-toaster";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";

type AppProvidersProps = {
  children: ReactNode;
};

/* Defaults de TanStack Query (Tooxs Frontend Standard §3.2): retry acotado a 1
   (no 3, evita tormentas), sin refetch-on-focus (parpadeos en datos sensibles),
   staleTime base, y feedback GLOBAL de errores de mutación vía toast — así
   ninguna mutación falla en silencio. El Toaster se monta UNA vez, acá. */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: {
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? apiErrorToUserMessage(error)
              : "No pudimos completar la acción. Intenta nuevamente.",
          ),
      },
    },
  });
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <MswProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <QavanteToaster />
      </QueryClientProvider>
    </MswProvider>
  );
}
