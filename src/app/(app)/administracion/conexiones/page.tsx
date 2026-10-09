import { ConexionesView } from "@/components/conexiones/conexiones-view";

export default function AdministracionConexionesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Conexiones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Tus fuentes están al día o hay algo que debas resolver en esta empresa?
        </p>
      </header>

      <ConexionesView />
    </div>
  );
}
