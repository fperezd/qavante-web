/* Fuentes que el usuario decidió conectar DESPUÉS ("conectar después").
 *
 * Patrón ratificado (Fernando 2026-08-12): SIEMPRE wizard, con conexiones
 * diferibles. Si al registrarse falta una conexión (banco, SII, ERP…), el
 * usuario la salta y la conecta más tarde desde el mismo wizard. Nada bloquea
 * el registro.
 *
 * ⚠️ ESTADO DE LA VERDAD — hoy el backend NO persiste el diferimiento:
 * `OnboardingSteps` solo trae `sii_connected` / `bank_connected` (verificado
 * contra `docs/contracts/openapi.snapshot.json` del backend, 2026-08-14). Por
 * eso el diferimiento vive acá, EN MEMORIA y por sesión de navegación: alcanza
 * para que el wizard no vuelva a empujar al usuario al paso que acaba de saltar,
 * y NO miente — al recargar, la fuente vuelve a mostrarse como "pendiente"
 * (que es la verdad conocida), nunca como conectada.
 *
 * Cuando CC-API publique el campo real (p.ej. `steps.sii_deferred` o
 * `deferred_sources: string[]`), el cambio es de UNA línea en
 * `deferredSourcesFromStatus()` (`src/lib/api/onboarding-sources.ts`) y este
 * store pasa a ser solo el eco optimista de la mutación.
 *
 * Sin `localStorage`/`sessionStorage` (prohibido por CLAUDE.md: incompatible con
 * el runtime de Cloudflare Workers). Store módulo-level + `useSyncExternalStore`
 * → sin dependencias nuevas, SSR-safe (snapshot de servidor estable y vacío).
 */

import * as React from "react";
import type { OnboardingSourceId } from "@/lib/api/onboarding-sources";

/** Snapshot inmutable (referencia estable mientras no cambie) para `useSyncExternalStore`. */
const EMPTY: readonly OnboardingSourceId[] = Object.freeze([]);

let snapshot: readonly OnboardingSourceId[] = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly OnboardingSourceId[] {
  return snapshot;
}

/** En SSR nunca hay diferimientos (no hay interacción todavía) → lista vacía estable. */
function getServerSnapshot(): readonly OnboardingSourceId[] {
  return EMPTY;
}

/** Marca una fuente como "la conecto después". Idempotente. */
export function deferSource(id: OnboardingSourceId): void {
  if (snapshot.includes(id)) return;
  snapshot = Object.freeze([...snapshot, id]);
  emit();
}

/** Saca una fuente del diferimiento (el usuario volvió a conectarla). Idempotente. */
export function undeferSource(id: OnboardingSourceId): void {
  if (!snapshot.includes(id)) return;
  snapshot = Object.freeze(snapshot.filter((s) => s !== id));
  emit();
}

/** Lectura no reactiva (tests, handlers). */
export function getDeferredSources(): readonly OnboardingSourceId[] {
  return snapshot;
}

/** Reset — solo para tests. */
export function resetDeferredSources(): void {
  if (snapshot === EMPTY) return;
  snapshot = EMPTY;
  emit();
}

/** Fuentes diferidas en esta sesión de navegación (reactivo). */
export function useDeferredSources(): readonly OnboardingSourceId[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
