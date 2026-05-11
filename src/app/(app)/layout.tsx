import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/header";
import { AppSidebar } from "@/components/shell/sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[220px_1fr]">
        <AppSidebar />
        <main className="rounded-lg bg-white p-6 shadow-sm">{children}</main>
      </div>
    </div>
  );
}
