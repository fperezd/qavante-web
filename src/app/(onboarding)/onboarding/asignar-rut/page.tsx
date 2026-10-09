import { redirect } from "next/navigation";
import { routeAfter } from "@/components/onboarding/onboarding-steps";

/* Ruta legacy: el RUT personal se pide en `/registro` (paso 1). */
export default function AsignarRutLegacyRedirect() {
  redirect(routeAfter("verify-email"));
}
