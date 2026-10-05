/* Capa de datos — la fecha de inicio que la empresa DECLARA para cada sociedad.
 *
 * `GET` / `PUT /api/onboarding/activity-start`.
 *
 * La decisión que esto implementa (Fernando, 2026-10-04, textual): *"Desde la misma fecha de
 * inicio en el onboarding, recuerda que para todo es así, salvo para las deudas."* La vigencia
 * de una sociedad es la fecha que la empresa declara, y rige para todo —F29, RCV, ventas,
 * compras, remuneraciones, clasificación— SALVO las deudas: una deuda viva se exige hoy sin
 * importar cuándo nació.
 *
 * Tres cosas que esta capa NO hace, a propósito:
 *
 * 1. **No lee la fecha del SII.** Se propuso y Fernando lo rechazó de plano el 2026-10-04. La
 *    fuente es la declaración de la empresa y ninguna otra.
 * 2. **No pre-llena nada.** Ni desde `created_at`, ni desde la fecha heredada, ni desde la
 *    ventana de importación. Una sociedad sin declarar llega con el campo vacío.
 * 3. **No confunde la fecha de inicio con la ventana de importación.** Son dos declaraciones
 *    distintas que se parecen: `onboarding_import_start_date` dice desde cuándo IMPORTAR y está
 *    acotada a seis meses antes del alta; la fecha de inicio es un hecho histórico por sociedad
 *    y sin cota (puede ser 2017). El productor lo dice en el contrato y la pantalla lo separa.
 *
 * ⚠️ TIPOS A MANO, Y POR QUÉ (regla 3 del repo: los tipos salen del OpenAPI generado).
 *
 * El productor ya publica este contrato en su `main`, pero el snapshot que ESTE repo versiona
 * (`docs/contracts/openapi.snapshot.json`, sidecar al SHA `ff992068`) todavía no lo trae, así
 * que `components["schemas"]` no tiene estos nombres. Y sincronizarlo no es gratis: medido en
 * esta rama el 2026-10-04, copiar el snapshot del `main` del productor y correr `generate:api`
 * arrastra ~25 commits de contrato y deja **27 errores de tipo en 7 archivos de `src/`**
 * (`caja/v02`, `inicio/resumen`, `inicio/v01`, `onboarding/readiness-copy`,
 * `onboarding-complete-cache`) — contra 0 en la base. Eso es una migración de contrato de tres
 * áreas, con su propia revisión, y dos de esos archivos los está editando otro agente ahora
 * mismo. Mezclarlo acá convertiría esta pantalla en ese PR.
 *
 * Los tipos de abajo son una transcripción LITERAL del esquema medido (`ActivityStartLiveDebt`,
 * `ActivityStartUnattributed`, `ActivityStartOpeningCutoffOverlap`,
 * `LegalEntityActivityStartItem`, `OnboardingActivityStartRequest/Response`), campo por campo y
 * con su opcionalidad. `contractShapeOf` existe para que un test pueda afirmar la forma contra
 * el esquema en vez de dejarla a la buena fe.
 *
 * 🔌 Cuando el snapshot se sincronice, este bloque de tipos se borra y pasan a salir de
 * `./types`. Los hooks no cambian.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

/** Cómo se obtuvo la fecha. **No es un detalle técnico: es la diferencia entre un dato y un
 *  artefacto.** Medido en producción el 2026-10-04: 6 de 6 sociedades `inherited_from_backfill`
 *  y cero declaradas; el `DEFAULT` de la columna era `1970-01-01`, así que toda sociedad nueva
 *  afirmaba que la empresa existe desde 1970 y nada lo decía. */
export type ActivityStartProvenance =
  | "declared_by_company"
  | "inherited_from_backfill"
  | "platform_default";

/** El único valor que es una declaración de la empresa. */
export const DECLARED_BY_COMPANY: ActivityStartProvenance = "declared_by_company";

/** La fecha fabricada que dejó el `DEFAULT` de la columna. */
export const FABRICATED_SENTINEL = "1970-01-01";

export interface LegalEntityActivityStartItem {
  legal_entity_id: string;
  legal_name: string;
  /** Fecha desde la que la sociedad existe para la atribución de su historia. */
  effective_from: string;
  /** True SÓLO si la empresa declaró esta fecha en el onboarding. */
  declared: boolean;
  provenance: ActivityStartProvenance;
}

/** Documento histórico sin sociedad que la atribución fechada no alcanza. Montos decimales en
 *  string (el productor serializa `Decimal`), nunca `number`. */
export interface ActivityStartUnattributed {
  documents: number;
  amount: string;
  payables_documents: number;
  payables_periods: number;
  payables_amount: string;
  receivables_documents: number;
  receivables_periods: number;
  receivables_amount: string;
}

/** Deuda viva sin sociedad. **Exenta de la compuerta por fecha: sigue contando.** Es la
 *  excepción de las deudas hecha visible. */
export interface ActivityStartLiveDebt {
  payables_count: number;
  payables_amount: string;
  receivables_count: number;
  receivables_amount: string;
}

/** Las dos fechas que se parecen, juntas. `cutoff_date` es null cuando ningún corte está
 *  aplicado; `overlap_months` se publica SIEMPRE, también cuando vale 0. */
export interface ActivityStartOpeningCutoffOverlap {
  active: boolean;
  cutoff_date: string | null;
  import_start_date: string;
  overlap_months: number;
  /** Prosa del productor. La pantalla NO la imprime: arma su propio copy con los números,
   *  porque esta prosa trae los montos sin formatear. Vive en el tipo para no mentir sobre
   *  el contrato. */
  detail: string;
}

export interface OnboardingActivityStartResponse {
  entities: LegalEntityActivityStartItem[];
  declared_count: number;
  undeclared_count: number;
  unattributed_history: ActivityStartUnattributed;
  live_debt_protected: ActivityStartLiveDebt;
  opening_cutoff_overlap: ActivityStartOpeningCutoffOverlap;
  /** Igual que `detail`: prosa del productor con montos crudos. No se imprime. */
  summary: string;
}

export interface OnboardingActivityStartRequest {
  legal_entity_id: string;
  /** Fecha que la empresa declara, `YYYY-MM-DD`. Sin cota: puede ser de 2017. */
  start_date: string;
}

/** Forma del contrato transcrito, para que un test la afirme campo por campo contra el esquema
 *  medido en vez de confiar en que la transcripción salió bien. */
export const contractShapeOf = {
  entity: [
    "legal_entity_id",
    "legal_name",
    "effective_from",
    "declared",
    "provenance",
  ] as readonly string[],
  unattributed: [
    "documents",
    "amount",
    "payables_documents",
    "payables_periods",
    "payables_amount",
    "receivables_documents",
    "receivables_periods",
    "receivables_amount",
  ] as readonly string[],
  liveDebt: [
    "payables_count",
    "payables_amount",
    "receivables_count",
    "receivables_amount",
  ] as readonly string[],
  overlap: [
    "active",
    "cutoff_date",
    "import_start_date",
    "overlap_months",
    "detail",
  ] as readonly string[],
  response: [
    "entities",
    "declared_count",
    "undeclared_count",
    "unattributed_history",
    "live_debt_protected",
    "opening_cutoff_overlap",
    "summary",
  ] as readonly string[],
  provenances: [
    "declared_by_company",
    "inherited_from_backfill",
    "platform_default",
  ] as readonly ActivityStartProvenance[],
} as const;

/** La ruta, en UN solo lugar. La prueba de contrato la importa de acá en vez de reescribirla:
 *  si alguien le cambia una letra, el mock deja de responder y la prueba cae. Escrita a mano en
 *  los dos lados, un error de ruta no lo cazaría nadie. */
export const ACTIVITY_START_PATH = "/api/onboarding/activity-start";

export const activityStartKeys = {
  census: ["onboarding", "activity-start"] as const,
};

/** `GET /api/onboarding/activity-start` — el censo de TODAS las sociedades de la empresa.
 *
 *  Sin retry: los dos fracasos reales de este endpoint no mejoran reintentando. Uno es el 409
 *  por tener una sociedad seleccionada en la sesión (el censo es de todas), y el otro es el 403
 *  por rol; los dos tienen copy propio en el modelo de la pantalla. */
export function useActivityStartCensus() {
  return useQuery({
    queryKey: activityStartKeys.census,
    queryFn: () => api.get<OnboardingActivityStartResponse>(ACTIVITY_START_PATH),
    retry: false,
    staleTime: 30_000,
  });
}

/** `PUT /api/onboarding/activity-start` — la empresa declara la fecha de UNA sociedad
 *  (owner/admin). Es el único camino que deja la procedencia en `declared_by_company`.
 *
 *  La respuesta ya trae el censo completo actualizado → se escribe en la cache, así la cifra de
 *  lo que queda sin atribuir se mueve en la misma pantalla y no hay que ir a buscarla. */
export function useDeclareActivityStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingActivityStartRequest) =>
      api.put<OnboardingActivityStartResponse>(ACTIVITY_START_PATH, { body }),
    onSuccess: (res) => {
      qc.setQueryData(activityStartKeys.census, res);
    },
  });
}
