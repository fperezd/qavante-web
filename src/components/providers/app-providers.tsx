"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { MswProvider } from "./msw-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <MswProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MswProvider>
  );
}
