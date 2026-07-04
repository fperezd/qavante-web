"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { MswProvider } from "./msw-provider";
import { QavanteToaster } from "@/components/qavante/qavante-toaster";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <MswProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <QavanteToaster />
      </QueryClientProvider>
    </MswProvider>
  );
}
