import * as React from "react";
import { Clock } from "lucide-react";
import { QavanteEmpty } from "./qavante-empty";

/* Estado canónico cuando una pantalla del Addendum Frontend v2.0 está
   gateada (feature flag OFF / backend aún no conectado) — addendum §20 +
   §23.1 + ADR-0008. Regla dura del ADR: flag off ⇒ pantalla informativa
   accionable, NUNCA UI mock que simule datos, NUNCA ruta rota.

   Es un wrapper fino de QavanteEmpty (Anexo B.2 + Anexo F voice & tone):
   mensaje de negocio, tranquilizador, sin jerga técnica. */
export interface FeatureUnavailableStateProps {
  /** Override del título. Default: copy genérico de "todavía no disponible". */
  title?: string;
  /** Override de la descripción. Default: copy de negocio Anexo F. */
  description?: React.ReactNode;
}

export function FeatureUnavailableState({
  title = "Esta sección todavía no está disponible",
  description = "Estamos terminando de conectarla con tu información. Vas a poder usarla muy pronto.",
}: FeatureUnavailableStateProps) {
  return <QavanteEmpty icon={Clock} title={title} description={description} />;
}
