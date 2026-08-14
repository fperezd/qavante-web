/* ADAPTADOR — "conectar el banco" del wizard = credencial + AUTORIZACIÓN.
 *
 * Por qué existe este archivo (hallazgo bloqueante del review del PR #935):
 * `PUT /api/credentials/bice` responde 204 "credenciales guardadas" y NO valida
 * nada contra el banco. Con eso el wizard afirmaba "Banco conectado", mientras
 * la verdad canónica del backend (`onboarding.py` → `sources_service`) marcaba la
 * fuente como `consent_missing` → `error`. Además `GET /api/bank-movements/bice/
 * accounts` devuelve 403 `consent_missing` sin autorización, así que el usuario
 * quedaba con una pantalla que decía "conectado" y ninguna salida.
 *
 * REGLA DE PRODUCTO que sale de eso: el wizard NO guarda la credencial del banco
 * sin la autorización. O el usuario autoriza (credencial + consent, un solo
 * "Conectar"), o difiere el paso y no se escribe nada. Guardar la credencial sin
 * consent deja la fuente en `consent_missing` = `error`, o sea el header pasa a
 * "Con errores" y `cash_today.data_state` a `stale` por algo que el usuario no
 * pidió: peor que no haber tocado nada.
 *
 * ── Contrato: alineado con qavante-api PR #955 ─────────────────────────────
 * #955 pliega credencial + consent en el propio PUT: body
 * `{rut, password, accept_consent}`, y sin `accept_consent` la fuente queda
 * `consent_missing` (fail-closed). Ese es el camino PRINCIPAL de este adaptador.
 *
 * Mientras #955 no esté desplegado, el PUT en prod tiene `extra="forbid"`:
 * mandarle `accept_consent` da 422 `extra_forbidden`. Ese caso — y SOLO ese — cae
 * al camino heredado: `POST /api/admin/sources/bank_bice/consent` (endpoint vivo,
 * el mismo que usa Administración y el mismo registro legal que escribe #955)
 * ANTES de la credencial, y el PUT sin el campo nuevo. Mismo orden que #955:
 * consent primero; un consent sin credencial es inocuo, al revés no.
 *
 * 🔌 CUANDO #955 ESTÉ EN PROD: regenerar `types.ts` (`npm run generate:api`),
 * borrar `PutBankCredentialBodyV2`, `esAcceptConsentNoSoportado` y la rama
 * heredada de `connectBiceBank`. El resto del FE no cambia.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { bankCredentialKeys } from "@/lib/api/bank-credentials";
import { onboardingStatusKeys } from "@/lib/api/onboarding-status";
import { sourceConsentKeys } from "@/lib/api/source-consent";
import { sourcesStatusKeys } from "@/lib/api/sources-status";
import type { components } from "@/lib/api/types";

type PutBankCredentialBody = components["schemas"]["PutBankCredentialRequest"];

/** `source_code` del banco en el catálogo (`core.sources`). OJO: el provider de
 *  la credencial es `bice` y el código del catálogo es `bank_bice` — confundirlos
 *  fue un bug real del backend (#936). */
export const BANK_SOURCE_CODE = "bank_bice";

/** Body del PUT según el contrato del #955. `accept_consent` todavía no está en
 *  `types.ts` porque el snapshot OpenAPI no está mergeado. */
type PutBankCredentialBodyV2 = PutBankCredentialBody & { accept_consent: boolean };

export interface ConnectBankInput {
  rut: string;
  password: string;
  /** El usuario aceptó EXPLÍCITAMENTE el texto de autorización. Nunca se asume. */
  acceptConsent: boolean;
}

export interface ConnectBankResult {
  /** `true` si el backend aún no acepta `accept_consent` y hubo que registrar la
   *  autorización por el endpoint de Administración. Solo para diagnóstico. */
  usedLegacyConsentEndpoint: boolean;
}

/** ¿El 422 es "este backend no conoce `accept_consent`"? Se distingue del 422 de
 *  RUT inválido (que trae `detail.code = "invalid_rut"`) mirando el detalle de
 *  validación de FastAPI: `type: "extra_forbidden"` en `loc [..., accept_consent]`. */
export function esAcceptConsentNoSoportado(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) return false;
  const detail = (err.detail as { detail?: unknown } | undefined)?.detail;
  if (!Array.isArray(detail)) return false;
  return detail.some((e) => {
    const entry = e as { type?: unknown; loc?: unknown };
    const loc = Array.isArray(entry.loc) ? entry.loc.map(String) : [];
    return entry.type === "extra_forbidden" || loc.includes("accept_consent");
  });
}

/** Conecta el banco: autorización + credencial, en ese orden.
 *
 *  `skipAuthRetry` en el PUT: durante el onboarding (sesión recién creada) un 401
 *  ahí es rechazo persistente del endpoint, no expiración → cae como ApiError
 *  inline en el paso, en vez de expulsar al login. */
export async function connectBiceBank(input: ConnectBankInput): Promise<ConnectBankResult> {
  const { rut, password, acceptConsent } = input;
  const bodyV2: PutBankCredentialBodyV2 = { rut, password, accept_consent: acceptConsent };

  try {
    await api.put<void>("/api/credentials/bice", { body: bodyV2, skipAuthRetry: true });
    return { usedLegacyConsentEndpoint: false };
  } catch (err) {
    if (!esAcceptConsentNoSoportado(err)) throw err;
  }

  // Backend previo al #955: nada quedó escrito por el intento anterior (el 422 es
  // de validación del body), así que arrancamos limpio por el camino heredado.
  if (acceptConsent) {
    await api.post<unknown>(`/api/admin/sources/${BANK_SOURCE_CODE}/consent`, { body: {} });
  }
  const bodyV1: PutBankCredentialBody = { rut, password };
  await api.put<void>("/api/credentials/bice", { body: bodyV1, skipAuthRetry: true });
  return { usedLegacyConsentEndpoint: true };
}

/** Mutación del paso "Conectar banco" del wizard.
 *
 *  Invalida TODO lo que este cambio vuelve viejo — incluido el status del
 *  onboarding, que es de donde el wizard, el hub y el banner sacan si el banco
 *  quedó conectado de verdad. Sin esto la pantalla siguiente podía afirmar un
 *  estado que el backend ya había contradicho (hallazgo del review). */
export function useConnectBiceBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectBiceBank,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bankCredentialKeys.bice });
      void qc.invalidateQueries({ queryKey: sourceConsentKeys.consent(BANK_SOURCE_CODE) });
      void qc.invalidateQueries({ queryKey: sourcesStatusKeys.all });
      void qc.invalidateQueries({ queryKey: onboardingStatusKeys.status });
    },
  });
}
