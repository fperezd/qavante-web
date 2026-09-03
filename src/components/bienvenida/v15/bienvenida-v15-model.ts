import { ONBOARDING_SOURCE_IDS } from "@/lib/api/onboarding-sources";
import type {
  OnboardingSourceId,
  OnboardingSourceState,
  OnboardingSourceStates,
} from "@/lib/api/onboarding-sources";
import type { OnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import {
  ONBOARDING_SOURCE_META,
  sourceActionLabel,
  sourceStateDescription,
} from "@/components/onboarding/onboarding-source-meta";
import { routeForSource } from "@/components/onboarding/onboarding-steps";
export { concordar } from "@/lib/formatters/count";

export const TIEMPO_CONEXION: Record<OnboardingSourceId, string> = {
  sii: "~2 minutos",
  bank: "~3 minutos",
};

export interface FuenteV15 {
  id: OnboardingSourceId;
  label: string;
  estado: OnboardingSourceState;
  descripcion: string;
  tiempoConexion: string | null;
  accion: string;
  href: string;
}

export function fuentesV15(states: OnboardingSourceStates): FuenteV15[] {
  return ONBOARDING_SOURCE_IDS.map((id) => ({
    id,
    label: ONBOARDING_SOURCE_META[id].label,
    estado: states[id],
    descripcion: sourceStateDescription(id, states[id]),
    tiempoConexion: states[id] === "connected" ? null : TIEMPO_CONEXION[id],
    accion: sourceActionLabel(states[id]),
    href: routeForSource(id),
  }));
}

export function fuentesConectadas(fuentes: ReadonlyArray<FuenteV15>): FuenteV15[] {
  return fuentes.filter((f) => f.estado === "connected");
}

export function fuentesPendientes(fuentes: ReadonlyArray<FuenteV15>): FuenteV15[] {
  return fuentes.filter((f) => f.estado !== "connected");
}

export function etaLegible(seconds: number | null): string {
  if (seconds === null) return "Sin tiempo estimado disponible.";
  if (seconds < 60) return "Menos de un minuto estimado.";
  return `Aproximadamente ${Math.ceil(seconds / 60)} minutos estimados.`;
}

export function conteoLeido(recordsRead: number | null): string | null {
  return recordsRead === null ? null : `${recordsRead} documentos leídos`;
}

export interface FuenteRunV15 {
  id: OnboardingSourceId;
  label: string;
  estado: string;
  etapa: string | null;
  conteo: string | null;
  eta: string;
}

/** No deriva progreso ni ETA: muestra únicamente los hechos publicados por el run. */
export function fuentesRunV15(run: OnboardingSyncRun): FuenteRunV15[] {
  return run.sources.map((source) => ({
    id: source.source,
    label: ONBOARDING_SOURCE_META[source.source].label,
    estado: source.status,
    etapa: source.step ?? null,
    conteo: conteoLeido(source.records_read ?? null),
    eta: etaLegible(source.eta_seconds ?? null),
  }));
}
