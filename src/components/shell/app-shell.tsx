"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/shell/header";
import { AppSidebar } from "@/components/shell/sidebar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { AssistantTrigger } from "@/components/assistant/trigger";
import type { UserRole } from "@/lib/auth/types";

export interface AppShellProps {
  children: ReactNode;
  userRole?: UserRole;
}

export function AppShell({ children, userRole }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex">
        <AppSidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          userRole={userRole}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] space-y-6 p-6 md:p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      <AssistantTrigger />
    </div>
  );
}
