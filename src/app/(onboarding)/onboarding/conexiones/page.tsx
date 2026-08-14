import { ConnectionsView } from "@/components/onboarding/connections-view";

/* `/onboarding/conexiones` — hub de conexiones del wizard (post-auth, protegido
   por middleware). Punto de RETORNO del patrón "siempre wizard, con conexiones
   diferibles": desde acá el usuario retoma cualquier fuente que dejó para
   después. Gating del flag `onboarding` lo hace el layout del grupo. */
export default function ConexionesPage() {
  return <ConnectionsView />;
}
