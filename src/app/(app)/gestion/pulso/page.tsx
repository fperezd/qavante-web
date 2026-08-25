import { redirect } from "next/navigation";

/* Compatibilidad: la vista se renombró a /alertas, pero el motor backend
   dashboard_pulso sigue siendo el mismo en Fase 1. */
export default function PulsoPage() {
  redirect("/alertas");
}
