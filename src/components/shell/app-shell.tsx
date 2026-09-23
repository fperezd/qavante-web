"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AppHeader } from "@/components/shell/header";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { SkipLink } from "@/components/shell/skip-link";
import type { UserRole } from "@/lib/auth/types";

const CommandPalette = dynamic(() =>
  import("@/components/shell/command-palette").then((module) => module.CommandPalette),
);
const AppSidebar = dynamic(() =>
  import("@/components/shell/sidebar").then((module) => module.AppSidebar),
);
const Assistant = dynamic(() =>
  import("@/components/assistant/assistant").then((module) => module.Assistant),
);

export interface AppShellProps {
  children: ReactNode;
  userRole?: UserRole;
  /** `assistant` ON → monta el Asistente interactivo (chat). OFF → el trigger
     stub actual (comportamiento previo intacto). Lo resuelve el layout (server). */
  assistantEnabled?: boolean;
  /** `syncStatus` ON → muestra el indicador de sincronización en el header. */
  syncStatusEnabled?: boolean;
  /** `decisionBrief` ON → el header deja de mostrar el Pulso heredado (#305). */
  decisionBriefEnabled?: boolean;
  /** `remuneraciones` ON → inyecta el grupo Equipo (Remuneraciones) en el nav. */
  remuneracionesEnabled?: boolean;
  /** `bancoScreen` ON → muestra el ítem "Banco" en el nav. */
  bancoEnabled?: boolean;
  bandejaEnabled?: boolean;
  /** `presupuesto` ON → muestra el ítem "Presupuesto" en el nav. */
  presupuestoEnabled?: boolean;
  financiamientoEnabled?: boolean;
  simuladorEnabled?: boolean;
}

export function AppShell({
  children,
  userRole,
  assistantEnabled,
  syncStatusEnabled,
  decisionBriefEnabled,
  remuneracionesEnabled,
  bancoEnabled,
  bandejaEnabled,
  presupuestoEnabled,
  financiamientoEnabled,
  simuladorEnabled,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebar, setDesktopSidebar] = useState(false);
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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktopSidebar(desktop.matches);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <AppHeader
        onMenuClick={() => setSidebarOpen(true)}
        onOpenSearch={() => setPaletteOpen(true)}
        syncStatusEnabled={syncStatusEnabled}
        decisionBriefEnabled={decisionBriefEnabled}
      />

      <div className="flex">
        {sidebarOpen || desktopSidebar ? (
          <AppSidebar
            mobileOpen={sidebarOpen}
            onCloseMobile={() => setSidebarOpen(false)}
            userRole={userRole}
            remuneracionesEnabled={remuneracionesEnabled}
            bancoEnabled={bancoEnabled}
            bandejaEnabled={bandejaEnabled}
            presupuestoEnabled={presupuestoEnabled}
            financiamientoEnabled={financiamientoEnabled}
            simuladorEnabled={simuladorEnabled}
          />
        ) : (
          <aside
            aria-label="Navegación principal"
            className="fixed inset-y-0 left-0 z-40 w-60 -translate-x-full border-r border-border bg-surface md:sticky md:top-14 md:z-10 md:h-[calc(100vh-3.5rem)] md:translate-x-0"
          />
        )}

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] space-y-6 p-6 md:p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {paletteOpen ? (
        <CommandPalette open onOpenChange={setPaletteOpen} userRole={userRole} />
      ) : null}

      {/* Sin el flag `assistant` (endpoint /api/assistant/chat todavía no existe) NO montamos el FAB:
          antes se mostraba `AssistantTrigger`, un botón prominente "Preguntar a Qavante" que no hacía
          nada al clic (ni ⌘J wired) → trust-killer. Vuelve cuando el backend exponga el chat. */}
      {assistantEnabled ? <Assistant /> : null}
    </div>
  );
}
