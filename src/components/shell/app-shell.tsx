"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/shell/header";
import { AppSidebar } from "@/components/shell/sidebar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { SkipLink } from "@/components/shell/skip-link";
import { AssistantTrigger } from "@/components/assistant/trigger";
import { Assistant } from "@/components/assistant/assistant";
import type { UserRole } from "@/lib/auth/types";

export interface AppShellProps {
  children: ReactNode;
  userRole?: UserRole;
  /** `assistant` ON → monta el Asistente interactivo (chat). OFF → el trigger
     stub actual (comportamiento previo intacto). Lo resuelve el layout (server). */
  assistantEnabled?: boolean;
  /** `syncStatus` ON → muestra el indicador de sincronización en el header. */
  syncStatusEnabled?: boolean;
  /** `remuneraciones` ON → inyecta el grupo Equipo (Remuneraciones) en el nav. */
  remuneracionesEnabled?: boolean;
}

export function AppShell({
  children,
  userRole,
  assistantEnabled,
  syncStatusEnabled,
  remuneracionesEnabled,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <AppHeader onMenuClick={() => setSidebarOpen(true)} syncStatusEnabled={syncStatusEnabled} />

      <div className="flex">
        <AppSidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          userRole={userRole}
          remuneracionesEnabled={remuneracionesEnabled}
        />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] space-y-6 p-6 md:p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {assistantEnabled ? <Assistant /> : <AssistantTrigger />}
    </div>
  );
}
