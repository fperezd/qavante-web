import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* TGR (Tesorería General de la República) — deudas fiscales del contribuyente.
   Endpoints (cookie de sesión): `/api/tgr/health` (¿hay sesión TGR?),
   `/api/tgr/movimientos-deudas` (giros/multas/PPM/IVA con saldo + vencimiento).
   HOY el backend alimenta TGR desde un helper LOCAL (127.0.0.1) → `authenticated`
   queda false para todo tenant hasta que CC-API lo haga server-side (escalado,
   api#758). El FE consume igual y degrada honesto ("TGR en preparación"). */

export type TgrHealth = components["schemas"]["TgrHealthResponse"];
export type TgrDeudas = components["schemas"]["MovimientosDeudasResponse"];
export type TgrMovimiento = components["schemas"]["MovimientoDeuda"];

export const tgrKeys = {
  all: ["tgr"] as const,
  health: () => [...tgrKeys.all, "health"] as const,
  deudas: () => [...tgrKeys.all, "deudas"] as const,
};

/** `GET /api/tgr/health` — ¿hay una sesión TGR vigente cacheada? */
export function useTgrHealth(enabled = true) {
  return useQuery({
    queryKey: tgrKeys.health(),
    queryFn: () => api.get<TgrHealth>("/api/tgr/health"),
    enabled,
  });
}

/** `GET /api/tgr/movimientos-deudas` — deudas fiscales (solo si hay sesión). */
export function useTgrMovimientosDeudas(enabled = true) {
  return useQuery({
    queryKey: tgrKeys.deudas(),
    queryFn: () => api.get<TgrDeudas>("/api/tgr/movimientos-deudas"),
    enabled,
  });
}

/** URL del certificado de deudas TGR (PDF) para GET directo del browser con las
 *  cookies httpOnly (mismo patrón que los PDF del SII). `null` sin API URL. */
export function tgrCertificadoDeudasUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  return base ? `${base}/api/tgr/certificado-deudas` : null;
}
