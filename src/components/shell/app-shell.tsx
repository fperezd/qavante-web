"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/shell/header";
import { AppSidebar } from "@/components/shell/sidebar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { SkipLink } from "@/components/shell/skip-link";
import { CommandPalette } from "@/components/shell/command-palette";
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
  /** `bancoScreen` ON → muestra el ítem "Banco" en el nav. */
  bancoEnabled?: boolean;
  /** `presupuesto` ON → muestra el ítem "Presupuesto" en el nav. */
  presupuestoEnabled?: boolean;
}

export function AppShell({
  children,
  userRole,
  assistantEnabled,
  syncStatusEnabled,
  remuneracionesEnabled,
  bancoEnabled,
  presupuestoEnabled,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  /* Atajo global ⌘K / Ctrl+K → abre el command palette (navegación por teclado).
     Se ignora si el foco está en un input/textarea salvo que sea el propio atajo. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <AppHeader
        onMenuClick={() => setSidebarOpen(true)}
        onOpenSearch={() => setPaletteOpen(true)}
        syncStatusEnabled={syncStatusEnabled}
      />

      <div className="flex">
        <AppSidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          userRole={userRole}
          remuneracionesEnabled={remuneracionesEnabled}
          bancoEnabled={bancoEnabled}
          presupuestoEnabled={presupuestoEnabled}
        />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] space-y-6 p-6 md:p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} userRole={userRole} />

      {/* Sin el flag `assistant` (endpoint /api/assistant/chat todavía no existe) NO montamos el FAB:
          antes se mostraba `AssistantTrigger`, un botón prominente "Preguntar a Qavante" que no hacía
          nada al clic (ni ⌘J wired) → trust-killer. Vuelve cuando el backend exponga el chat. */}
      {assistantEnabled ? <Assistant /> : null}
    </div>
  );
}
