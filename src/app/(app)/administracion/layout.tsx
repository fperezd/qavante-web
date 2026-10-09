import { AdministracionShell } from "@/components/administracion/administracion-shell";

export default function AdministracionLayout({ children }: { children: React.ReactNode }) {
  return <AdministracionShell>{children}</AdministracionShell>;
}
