/* Capa de datos — SII (Servicio de Impuestos Internos Chile). Arranque
 * Sprint C1 — primera consulta sobre los 8 endpoints SII que el backend
 * tiene live en prod (verificado 2026-05-23):
 *
 * - `GET /api/sii/health`          → estado del cert digital + RUT.
 * - `GET /api/sii/f22/status`      → estado canónico F22 (no impl. Fase 1).
 * - `GET /api/sii/f29/{folio}`     → F29 mensual parseado (IVA, PPM, total).
 * - `GET /api/sii/f29/{folio}/pdf` → PDF del Certificado Solemne (binario).
 * - `GET /api/sii/bhe?periodo`     → BHE recibidas del período.
 * - `GET /api/sii/rcv/compras?periodo[&full]` → RCV Compras (slim default).
 * - `GET /api/sii/rcv/ventas?periodo[&full]`  → RCV Ventas (slim default).
 * - `GET /api/sii/dte-recibidos?desde&hasta`  → DTE recibidos por rango.
 *
 * Notas de contrato (regla 16):
 * - F29 puede devolver `status='not_found'` (HTTP 200 igual) cuando el
 *   folio no existe o no hay declaración del período. El FE chequea
 *   `status` antes de leer `iva_debito_fiscal` etc. — campos numéricos
 *   son `?: number | null` (parseo deferido C1-03b si el backend no lo
 *   completa todavía).
 * - El PDF se devuelve como binario (`application/pdf`); el `api` client
 *   no maneja blobs — exponemos `siiF29PdfUrl(folio)` para que el browser
 *   haga GET directo con las cookies httpOnly (mismo origen vía proxy).
 * - `periodo` es flexible: el backend acepta `YYYY-MM`, `YYYYMM` o
 *   `'marzo 2026'`. El FE manda lo que tiene; el backend normaliza.
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./client";
import { cobranzaKeys } from "./cobranza";
import { pagosKeys } from "./pagos";
import type { components } from "./types";

export type SiiHealthResponse = components["schemas"]["SiiHealthResponse"];
export type SourceStatusResponse = components["schemas"]["SourceStatusResponse"];
export type F29Response = components["schemas"]["F29Response"];
export type F29Period = components["schemas"]["F29Period"];
export type F29EstadoResponse = components["schemas"]["F29EstadoResponse"];
export type F29ImpuestoResponse = components["schemas"]["F29ImpuestoResponse"];
export type ContribuyenteResponse = components["schemas"]["ContribuyenteResponse"];
export type F29GirosResponse = components["schemas"]["F29GirosResponse"];
export type F29SyncResponse = components["schemas"]["F29SyncResponse"];

/** Estado de un mes en el panel F29. El contrato tipa `meses[]` laxo
 *  (`{[k]: unknown}`); acá le damos forma según el handoff CC-API 2026-07-05. */
export type F29EstadoMesEstado =
  | "declarado"
  | "sin_dato"
  | "no_declarado_vencido"
  | "por_declarar"
  | "en_curso"
  | "sin_periodo";
export interface F29EstadoMes {
  mes: number;
  periodo: string;
  estado: F29EstadoMesEstado;
  declarado: boolean;
  folio: number | null;
  /** `null` = declarado con monto desconocido (NO es $0 — ver handoff). */
  saldo: number | null;
  remanente: number | null;
  vencimiento: string | null;
  /** Declarado pero con el IVA POSTERGADO (Consulta de Giros). Opcional: hoy solo lo trae `/f29/giros`
   *  por-período; escalado para que `/f29/estado` lo incluya y la grilla lo marque sin golpear el SII. */
  postergado_iva?: boolean;
  /** Fecha diferida del IVA postergado (ISO). Acompaña a `postergado_iva`. */
  vencimiento_postergado?: string | null;
}
export type BheResponse = components["schemas"]["BheResponse"];
export type BheRecibida = components["schemas"]["BheRecibida"];
export type RcvComprasResponse = components["schemas"]["RcvComprasResponse"];
export type RcvVentasResponse = components["schemas"]["RcvVentasResponse"];
export type LibroComparativosResponse = components["schemas"]["LibroComparativosResponse"];
export type DteRecibidosResponse = components["schemas"]["DteRecibidosResponse"];
export type DteRecibidosData = components["schemas"]["DteRecibidosData"];

export interface SiiPeriodoParams {
  /** Período `YYYY-MM`, `YYYYMM` o `'marzo 2026'` — el backend normaliza. */
  periodo: string;
}

export interface SiiRcvParams extends SiiPeriodoParams {
  /** `true` devuelve los 50+ campos crudos del SII (response grande).
   *  Default `false` (slim: ~8 campos canónicos). */
  full?: boolean;
}

export interface SiiDteRangoParams {
  /** Fecha desde YYYY-MM-DD. */
  desde: string;
  /** Fecha hasta YYYY-MM-DD. */
  hasta: string;
}

export const siiKeys = {
  all: ["sii"] as const,
  health: () => [...siiKeys.all, "health"] as const,
  f22Status: () => [...siiKeys.all, "f22-status"] as const,
  f29: (folio: number) => [...siiKeys.all, "f29", folio] as const,
  contribuyente: (rut: string) => [...siiKeys.all, "contribuyente", rut] as const,
  f29Estado: (anio: number) => [...siiKeys.all, "f29-estado", anio] as const,
  f29Impuesto: (anio: number, mes: number, imp?: number) =>
    [...siiKeys.all, "f29-impuesto", anio, mes, imp ?? null] as const,
  f29Giros: (anio: number, mes: number) => [...siiKeys.all, "f29-giros", anio, mes] as const,
  /** Blob del PDF del F29 cacheado por sesión (inmutable) → no re-bajarlo del SII en cada apertura. */
  f29Pdf: (folio: number) => [...siiKeys.all, "f29-pdf", folio] as const,
  bhe: (params: SiiPeriodoParams) => [...siiKeys.all, "bhe", params] as const,
  rcvCompras: (params: SiiRcvParams) => [...siiKeys.all, "rcv-compras", params] as const,
  rcvVentas: (params: SiiRcvParams) => [...siiKeys.all, "rcv-ventas", params] as const,
  rcvComparativos: (kind: string, desde: string, hasta: string) =>
    [...siiKeys.all, "rcv-comparativos", kind, desde, hasta] as const,
  dteRecibidos: (params: SiiDteRangoParams) => [...siiKeys.all, "dte-recibidos", params] as const,
};

/** `GET /api/sii/health` — estado del cert digital + RUT del tenant.
 *  No valida sesión web (eso lo hace cada endpoint específico). Útil
 *  para gating UI antes de pedir F29/RCV/BHE/DTE. */
export function useSiiHealth() {
  return useQuery({
    queryKey: siiKeys.health(),
    queryFn: () => api.get<SiiHealthResponse>("/api/sii/health"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/sii/f22/status` — F22 (declaración anual de renta) está
 *  diferido a Fase 2 (ver doc maestro Sec 11 TBL20). Devuelve un
 *  `SourceStatusResponse` con `state='unavailable'` para que la UI
 *  muestre la fuente como pendiente sin romper la experiencia. */
export function useSiiF22Status() {
  return useQuery({
    queryKey: siiKeys.f22Status(),
    queryFn: () => api.get<SourceStatusResponse>("/api/sii/f22/status"),
    staleTime: 60 * 60 * 1000, // 1 h: estado canónico estable hasta Fase 2
    retry: false,
  });
}

/** `GET /api/sii/f29/{folio}` — F29 parseado. `status='ok'` con campos
 *  numéricos poblados es el caso feliz. `status='not_found'` (HTTP 200)
 *  cuando el folio no existe o el período no tiene declaración. El FE
 *  chequea `data.status` antes de leer montos. Folio inválido (≤ 0 o
 *  NaN) NO dispara el query. */
export function useSiiF29(folio: number) {
  const validFolio = Number.isInteger(folio) && folio > 0;
  return useQuery({
    queryKey: siiKeys.f29(folio),
    queryFn: () => api.get<F29Response>(`/api/sii/f29/${folio}`),
    enabled: validFolio,
    staleTime: 30 * 60 * 1000, // 30 min: el F29 declarado no cambia salvo rectificatoria
    retry: false,
  });
}

/** Helper (no es hook) — URL absoluta del PDF F29 para descarga directa
 *  del browser. Mismo origen (vía proxy `NEXT_PUBLIC_API_URL`) → las
 *  cookies httpOnly viajan automáticamente. Patrón: `<a href={url}
 *  download>` o `window.open(url)`. NO usamos `api.get` porque el client
 *  no maneja blobs binarios (text/json only).
 *
 *  Devuelve `null` si el folio es inválido o `NEXT_PUBLIC_API_URL`
 *  no está configurada — el caller maneja el caso. */
export function siiF29PdfUrl(folio: number): string | null {
  const validFolio = Number.isInteger(folio) && folio > 0;
  if (!validFolio) return null;
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return `${base}/api/sii/f29/${folio}/pdf`;
}

/** Base de la API para las URLs de PDF (GET directo del browser con cookies
 *  httpOnly, mismo origen vía proxy). `null` si no está configurada. */
function apiBase(): string | null {
  return process.env.NEXT_PUBLIC_API_URL ?? null;
}

/** URL del PDF de una BHE — `GET /api/sii/bhe/pdf?periodo&folio&rut_emisor`.
 *  El browser hace el GET directo. `null` si faltan datos o la base. */
export function siiBhePdfUrl(args: {
  periodo: string;
  folio: number;
  rutEmisor?: string | null;
}): string | null {
  const base = apiBase();
  if (!base || !args.periodo || !(args.folio > 0)) return null;
  const q = new URLSearchParams({ periodo: args.periodo, folio: String(args.folio) });
  if (args.rutEmisor) q.set("rut_emisor", args.rutEmisor);
  return `${base}/api/sii/bhe/pdf?${q.toString()}`;
}

/** Builder común de las URLs de PDF de DTE por rango (`desde&hasta&folio&<rut>`).
 *  Los dos endpoints del SII (recibidos/emitidos) solo difieren en el path, el
 *  nombre del param del RUT y si el RUT es obligatorio. `null` si faltan datos. */
function dteRangoPdfUrl(
  path: string,
  args: { desde: string; hasta: string; folio: number; rut?: string | null },
  rutParam: string,
  rutRequired: boolean,
): string | null {
  const base = apiBase();
  if (!base || !args.desde || !args.hasta || !(args.folio > 0)) return null;
  if (rutRequired && !args.rut) return null;
  const q = new URLSearchParams({
    desde: args.desde,
    hasta: args.hasta,
    folio: String(args.folio),
  });
  if (args.rut) q.set(rutParam, args.rut);
  return `${base}${path}?${q.toString()}`;
}

/** URL del PDF de un DTE recibido (factura de proveedor) —
 *  `GET /api/sii/dte-recibidos/pdf?desde&hasta&folio&rut_emisor`. */
export function siiDteRecibidoPdfUrl(args: {
  desde: string;
  hasta: string;
  folio: number;
  rutEmisor?: string | null;
}): string | null {
  return dteRangoPdfUrl(
    "/api/sii/dte-recibidos/pdf",
    { desde: args.desde, hasta: args.hasta, folio: args.folio, rut: args.rutEmisor },
    "rut_emisor",
    false,
  );
}

/** URL del PDF de un DTE emitido (factura de venta) —
 *  `GET /api/sii/dte-emitidos/pdf?desde&hasta&folio&rut_receptor` (qavante-api #501,
 *  acepta folio + rango en vez del `codigo` opaco del Portal). El `rut_receptor`
 *  —el cliente— es obligatorio en este endpoint. `null` si faltan datos o base. */
export function siiDteEmitidoPdfUrl(args: {
  desde: string;
  hasta: string;
  folio: number;
  rutReceptor?: string | null;
}): string | null {
  return dteRangoPdfUrl(
    "/api/sii/dte-emitidos/pdf",
    { desde: args.desde, hasta: args.hasta, folio: args.folio, rut: args.rutReceptor },
    "rut_receptor",
    true,
  );
}

/** `GET /api/sii/contribuyente/{rut}` — situación tributaria pública por RUT
 *  (razón social, giro, inicio de actividades) vía `getstc` del SII. No requiere
 *  cert del tenant. `rut` debe venir normalizado (`normalizeRut`). Se usa para
 *  autocompletar la razón social al agregar una empresa. `status='not_found'`
 *  (HTTP 200) si el SII no tiene datos para el RUT. */
export function useSiiContribuyente(rut: string, enabled = true) {
  return useQuery({
    queryKey: siiKeys.contribuyente(rut),
    queryFn: () =>
      api.get<ContribuyenteResponse>(`/api/sii/contribuyente/${encodeURIComponent(rut)}`),
    enabled: enabled && rut.trim().length >= 3,
    staleTime: 60 * 60 * 1000, // 1 h: razón social no cambia
    retry: false,
  });
}

/** `GET /api/sii/f29/estado?anio=` — los 12 meses de un año con su estado
 *  (semáforo del panel). Acepta cookie (require_api_key_or_session). */
export function useSiiF29Estado(anio: number, enabled = true) {
  const valid = Number.isInteger(anio) && anio > 0;
  return useQuery({
    queryKey: siiKeys.f29Estado(anio),
    queryFn: () => api.get<F29EstadoResponse>(`/api/sii/f29/estado?anio=${anio}`),
    enabled: enabled && valid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Panel multi-año: un `/f29/estado` por año (react-query `useQueries`, orden
 *  estable). Devuelve `{ anio, mesesByMes }` por año, donde `mesesByMes` mapea
 *  `mes (1-12)` → `F29EstadoMes`. */
export function useSiiF29EstadoMulti(anios: number[], enabled = true) {
  return useQueries({
    queries: anios.map((anio) => ({
      queryKey: siiKeys.f29Estado(anio),
      queryFn: () => api.get<F29EstadoResponse>(`/api/sii/f29/estado?anio=${anio}`),
      enabled: enabled && Number.isInteger(anio) && anio > 0,
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
}

/** `GET /api/sii/f29/impuesto?anio&mes[&impuesto_trabajadores]` — el desglose
 *  con/sin IVA de un mes. `impuestoTrabajadores` opcional: cuando la fuente es
 *  `no_disponible`, el usuario lo ingresa y el back recomputa (`fuente=manual`). */
export function useSiiF29Impuesto(
  anio: number,
  mes: number,
  impuestoTrabajadores?: number,
  enabled = true,
) {
  const valid = Number.isInteger(anio) && anio > 0 && mes >= 1 && mes <= 12;
  return useQuery({
    queryKey: siiKeys.f29Impuesto(anio, mes, impuestoTrabajadores),
    queryFn: () => {
      const q = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (impuestoTrabajadores != null && Number.isFinite(impuestoTrabajadores)) {
        q.set("impuesto_trabajadores", String(impuestoTrabajadores));
      }
      return api.get<F29ImpuestoResponse>(`/api/sii/f29/impuesto?${q.toString()}`);
    },
    enabled: enabled && valid,
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Al ingresar el impuesto manual cambia el queryKey → sin esto el detalle
    // colapsa a skeleton (y el propio input desaparece bajo el cursor). Mantener
    // los datos previos mientras recomputa.
    placeholderData: keepPreviousData,
  });
}

/** `GET /api/sii/f29/giros?anio&mes` — estado de pago/postergación de IVA de un
 *  período (Consulta de Giros del SII, en vivo). `estado` ∈ `sin_giro` (declarado
 *  + sin giro = pagado) · `postergado` · `giro_no_determinado` · `multiples_no_determinado`.
 *  ⚠️ NO afirma "pagado" ante error: si falla, el caller muestra el estado base. */
export function useSiiF29Giros(anio: number, mes: number, enabled = true) {
  const valid = Number.isInteger(anio) && anio > 0 && mes >= 1 && mes <= 12;
  return useQuery({
    queryKey: siiKeys.f29Giros(anio, mes),
    queryFn: () => api.get<F29GirosResponse>(`/api/sii/f29/giros?anio=${anio}&mes=${mes}`),
    enabled: enabled && valid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `POST /api/sii/f29/sync?anio=` — enumera los F29 declarados del año y los
 *  persiste (incremental). Tras un sync ok, `/f29/estado` y `/f29/anual` se llenan.
 *  `status='in_progress'` = ya hay un sync corriendo para el tenant (no dispares
 *  otro). NO retry. NO invalida en cada mutación: cuando se sincronizan varios
 *  años en un loop, el caller invalida UNA vez al final (evita el refetch-storm). */
export function useSyncF29() {
  return useMutation({
    mutationFn: (anio: number) => api.post<F29SyncResponse>(`/api/sii/f29/sync?anio=${anio}`),
  });
}

function buildPeriodoQuery(p: SiiPeriodoParams): string {
  const s = new URLSearchParams();
  s.set("periodo", p.periodo);
  return `?${s.toString()}`;
}

function buildRcvQuery(p: SiiRcvParams): string {
  const s = new URLSearchParams();
  s.set("periodo", p.periodo);
  if (p.full) s.set("full", "true");
  return `?${s.toString()}`;
}

function buildDteQuery(p: SiiDteRangoParams): string {
  const s = new URLSearchParams();
  s.set("desde", p.desde);
  s.set("hasta", p.hasta);
  return `?${s.toString()}`;
}

/** `GET /api/sii/bhe?periodo` — BHE recibidas (otros me cobran honorarios).
 *  Solo corre con `periodo` no vacío. */
export function useSiiBhe(params: SiiPeriodoParams) {
  return useQuery({
    queryKey: siiKeys.bhe(params),
    queryFn: () => api.get<BheResponse>(`/api/sii/bhe${buildPeriodoQuery(params)}`),
    enabled: Boolean(params.periodo),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/sii/rcv/compras?periodo[&full]` — RCV Compras del período.
 *  Slim por default (~8 campos canónicos); `full=true` trae los 50+ del
 *  SII (response grande, usar solo cuando se requiera). */
export function useSiiRcvCompras(params: SiiRcvParams) {
  return useQuery({
    queryKey: siiKeys.rcvCompras(params),
    queryFn: () => api.get<RcvComprasResponse>(`/api/sii/rcv/compras${buildRcvQuery(params)}`),
    enabled: Boolean(params.periodo),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/sii/rcv/ventas?periodo[&full]` — RCV Ventas del período.
 *  Mismo contrato que compras (slim/full). */
export function useSiiRcvVentas(params: SiiRcvParams) {
  return useQuery({
    queryKey: siiKeys.rcvVentas(params),
    queryFn: () => api.get<RcvVentasResponse>(`/api/sii/rcv/ventas${buildRcvQuery(params)}`),
    enabled: Boolean(params.periodo),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/sii/rcv/{kind}/comparativos?desde&hasta` — comparativos del ritmo del Libro pre-agregados
 *  por el backend (CC-API #766): neto del período, serie mensual, y los 3 comparativos (misma fecha del
 *  mes anterior, mes vs. promedio anual, YoY) con el neto ya neteado de NC. Reemplaza el cálculo FE que
 *  bajaba mes a mes. NO retry; solo corre con rango válido. */
export function useSiiRcvComparativos(
  kind: "ventas" | "compras",
  desde: string,
  hasta: string,
  enabled = true,
) {
  return useQuery({
    queryKey: siiKeys.rcvComparativos(kind, desde, hasta),
    queryFn: () =>
      api.get<LibroComparativosResponse>(
        `/api/sii/rcv/${kind}/comparativos?desde=${encodeURIComponent(
          desde,
        )}&hasta=${encodeURIComponent(hasta)}`,
      ),
    enabled: enabled && Boolean(desde) && Boolean(hasta),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** `GET /api/sii/dte-recibidos?desde&hasta` — DTE recibidos por rango
 *  de fechas. Scrapea el portal SII — más latente que RCV. Devuelve
 *  `data.filas[]` (primera fila = headers). Solo corre con desde+hasta. */
export function useSiiDteRecibidos(params: SiiDteRangoParams) {
  return useQuery({
    queryKey: siiKeys.dteRecibidos(params),
    queryFn: () => api.get<DteRecibidosResponse>(`/api/sii/dte-recibidos${buildDteQuery(params)}`),
    enabled: Boolean(params.desde) && Boolean(params.hasta),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** `POST /api/sii/sync-rcv?periodo=YYYY-MM` — dispara la sincronización del RCV
 *  (compras y ventas) del período desde el SII. Requiere consentimiento `sii_rcv`
 *  aceptado (si falta → 403 "consent missing"). Invalida el estado de fuentes
 *  para refrescar la última sincronización. NO retry. */
export function useSyncSiiRcv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodo: string) =>
      api.post<unknown>(`/api/sii/sync-rcv?periodo=${encodeURIComponent(periodo)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources-status"] });
      qc.invalidateQueries({ queryKey: siiKeys.all });
      // sync-rcv puebla el devengado de Cobrar/Pagar (ADR-0055) → refrescarlos
      // también, o los agregados quedan stale hasta staleTime/refocus.
      qc.invalidateQueries({ queryKey: cobranzaKeys.all });
      qc.invalidateQueries({ queryKey: pagosKeys.all });
    },
  });
}
