import { EmpresasView } from "@/components/administracion/empresas-view";

/* /app/administracion/empresas — gestión de empresas (tenants) del usuario:
   listar, cambiar la activa y crear una nueva. Crear una empresa es configuración
   (ligada al plan / modelo de tenant), por eso vive en Administración y no en el
   selector del header (pedido de Fernando 2026-07-05). El módulo Administración
   ya está gateado por rol (viewer no lo ve). */
export default function AdministracionEmpresasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Empresas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Las empresas de tu cuenta. Cambia entre ellas o agrega una nueva.
        </p>
      </header>

      <EmpresasView />
    </div>
  );
}
