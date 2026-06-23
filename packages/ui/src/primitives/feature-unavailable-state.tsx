"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Empty } from "./empty";

/* Estado canónico para una pantalla gateada (feature flag OFF / backend no
   conectado): informativa y accionable, NUNCA UI mock. Wrapper fino de Empty. */
export interface FeatureUnavailableStateProps {
  title?: string;
  description?: React.ReactNode;
}

export function FeatureUnavailableState({
  title = "Esta sección todavía no está disponible",
  description = "Estamos terminando de conectarla. Vas a poder usarla muy pronto.",
}: FeatureUnavailableStateProps) {
  return <Empty icon={Clock} title={title} description={description} />;
}
