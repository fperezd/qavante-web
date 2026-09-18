import { GestionCobrosShell } from "@/components/cobrar/gestion-cobros-shell";

export default function CobrarLayout({ children }: { children: React.ReactNode }) {
  return <GestionCobrosShell>{children}</GestionCobrosShell>;
}
