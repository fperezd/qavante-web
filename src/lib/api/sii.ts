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
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type SiiHealthResponse = components["schemas"]["SiiHealthResponse"];
export type SourceStatusResponse = components["schemas"]["SourceStatusResponse"];
export type F29Response = components["schemas"]["F29Response"];
export type F29Period = components["schemas"]["F29Period"];
export type BheResponse = components["schemas"]["BheResponse"];
export type BheRecibida = components["schemas"]["BheRecibida"];
export type RcvComprasResponse = components["schemas"]["RcvComprasResponse"];
export type RcvVentasResponse = components["schemas"]["RcvVentasResponse"];
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
  bhe: (params: SiiPeriodoParams) => [...siiKeys.all, "bhe", params] as const,
  rcvCompras: (params: SiiRcvParams) => [...siiKeys.all, "rcv-compras", params] as const,
  rcvVentas: (params: SiiRcvParams) => [...siiKeys.all, "rcv-ventas", params] as const,
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
