/* Fixtures compartidas por los tests y las stories de V15 · Bienvenida. Sólo datos: nada se
 * formatea acá. Nada de datos de un tenant real (PII) — son estados sintéticos del onboarding. */

import type { OnboardingSourceStates } from "@/lib/api/onboarding-sources";

/** Referencia estable para los tests/stories de la promesa (paso 3): sábado 29 de agosto de 2026,
 *  15:00 UTC — bien entrada la tarde en Santiago, cualquiera sea el huso vigente. */
export const HOY = new Date("2026-08-29T15:00:00Z");

/** Las dos fuentes conectadas: el caso normal de esta pantalla — alguien que acaba de terminar el
 *  wizard con todo enchufado. */
export const AMBAS_CONECTADAS: OnboardingSourceStates = { sii: "connected", bank: "connected" };

/** Una conectada, la otra diferida ("la conectas después") — el patrón "siempre wizard, con
 *  conexiones diferibles" (Fernando 2026-08-12). */
export const UNA_DIFERIDA: OnboardingSourceStates = { sii: "connected", bank: "deferred" };

/** Ninguna conectada todavía — sólo posible si el usuario difirió las dos en el wizard; la
 *  pantalla no debe prometer una construcción que todavía no puede empezar. */
export const NINGUNA_CONECTADA: OnboardingSourceStates = { sii: "pending", bank: "pending" };
