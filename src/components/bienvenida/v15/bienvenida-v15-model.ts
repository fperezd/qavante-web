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
import { concordar } from "@/lib/formatters/count";
export { concordar };

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
    // El status de onboarding no publica una ETA de conexión. Declaramos el hueco en vez de
    // convertir una duración histórica o de diseño en una promesa para esta empresa.
    tiempoConexion:
      states[id] === "connected" ? null : "Sin tiempo estimado publicado por la fuente.",
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
  if (seconds === 0) return "Finalización estimada ahora.";
  if (seconds < 60) return "Menos de un minuto estimado.";
  return `Aproximadamente ${Math.ceil(seconds / 60)} minutos estimados.`;
}

export function conteoLeido(recordsRead: number | null): string | null {
  return recordsRead === null
    ? null
    : `${recordsRead} ${concordar(recordsRead, "documento leído", "documentos leídos")}`;
}

const RUN_STATUS_LABEL: Record<OnboardingSyncRun["status"], string> = {
  queued: "En espera",
  running: "En curso",
  completed: "Completada",
  failed: "No completada",
};

type RunSource = OnboardingSyncRun["sources"][number];

const SOURCE_STATUS_LABEL: Record<RunSource["status"], string> = {
  queued: "En espera",
  running: "Leyendo datos",
  ok: "Completada",
  failed: "No completada",
  skipped: "Omitida",
};

const STEP_LABEL: Readonly<Record<string, string>> = {
  not_connected: "Fuente no conectada",
  syncing_bank: "Leyendo movimientos bancarios",
  reading_documents: "Leyendo documentos",
  normalizing_documents: "Ordenando documentos",
  completed: "Lectura terminada",
};

export function estadoRunLegible(status: OnboardingSyncRun["status"]): string {
  return RUN_STATUS_LABEL[status];
}

export function estadoFuenteRunLegible(status: RunSource["status"]): string {
  return SOURCE_STATUS_LABEL[status];
}

export function etapaRunLegible(step: string | null): string | null {
  if (step === null) return null;
  return STEP_LABEL[step] ?? "Etapa en curso";
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
    estado: estadoFuenteRunLegible(source.status),
    etapa: etapaRunLegible(source.step ?? null),
    conteo: conteoLeido(source.records_read ?? null),
    eta: etaLegible(source.eta_seconds ?? null),
  }));
}
