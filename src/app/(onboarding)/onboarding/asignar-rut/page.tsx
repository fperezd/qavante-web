import { AssignRutView } from "@/components/onboarding/assign-rut-view";

/* `/onboarding/asignar-rut` — primer paso post-auth si la cuenta no tiene
   `core.users.rut`. Lo dispara `UserRutGuard` desde el panel. */
export default function AsignarRutPage() {
  return <AssignRutView />;
}
