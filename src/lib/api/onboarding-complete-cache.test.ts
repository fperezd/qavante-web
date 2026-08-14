/* REGRESIÓN — cierre del wizard: el usuario que TERMINA el onboarding no puede
   ser devuelto al wizard.

   El bug (cazado en el review independiente del PR #935): el `QueryClient` es
   ÚNICO para toda la app (`app-providers.tsx`, layout raíz), y los pasos del
   wizard cablearon la query `["onboarding","status"]`. Al llegar al último paso
   la cache ya tiene `completed:false`. Si `POST /api/onboarding/complete` no
   escribe el status nuevo en esa misma entrada, el `OnboardingGuard` la lee en
   su PRIMER render — con cero fetches, antes de cualquier refetch de fondo — y
   manda de vuelta al wizard a quien acaba de terminarlo.

   Este test reproduce la cadena real: cache prellenada por el wizard → mutación
   de complete (con sus opciones REALES, no una copia) → observer del guard con
   las opciones REALES de la query. Falla si alguien saca la escritura de cache,
   el candado de frescura del guard, o la clave compartida.

   Sin jsdom en el proyecto `unit`: se ejercita `query-core` directo
   (`MutationObserver`/`QueryObserver`), que es el motor que corre debajo de los
   hooks. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

import {
  completeOnboardingMutationOptions,
  onboardingStatusKeys,
  onboardingStatusQueryOptions,
  type OnboardingStatus,
} from "./onboarding-status";
import { shouldResumeOnboarding } from "@/components/onboarding/onboarding-steps";

const BASE = "http://api.test";

const INCOMPLETO: OnboardingStatus = {
  completed: false,
  completed_at: null,
  steps: { sii_connected: false, bank_connected: false },
};

const COMPLETO: OnboardingStatus = {
  completed: true,
  completed_at: "2026-08-14T20:00:00Z",
  steps: { sii_connected: true, bank_connected: false },
};

function nuevoCliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Lo que decide el guard con lo que ve el observer, sin React de por medio. */
function guardRedirige(result: { data?: OnboardingStatus; isStale: boolean }): boolean {
  return shouldResumeOnboarding({
    isUnknown: !result.data,
    isStale: result.isStale,
    completed: result.data?.completed === true,
  });
}

afterEach(() => {
  server.resetHandlers();
});

describe("cierre del wizard — cache de ['onboarding','status']", () => {
  it("tras completar, el guard NO devuelve al wizard (y no necesita red para saberlo)", async () => {
    const qc = nuevoCliente();
    // 1. Los pasos del wizard ya dejaron el estado viejo en la cache compartida.
    qc.setQueryData(onboardingStatusKeys.status, INCOMPLETO);

    let statusFetches = 0;
    server.use(
      http.post(`${BASE}/api/onboarding/complete`, () => HttpResponse.json(COMPLETO)),
      http.get(`${BASE}/api/onboarding/status`, () => {
        statusFetches += 1;
        return HttpResponse.json(INCOMPLETO); // si el guard va a la red, ve lo viejo
      }),
    );

    // 2. "Ir a mi panel" — las opciones REALES de la mutación del wizard.
    const complete = new MutationObserver(qc, completeOnboardingMutationOptions(qc));
    await complete.mutate();

    // 3. El guard monta en (app) con un observer nuevo sobre la MISMA cache.
    const guard = new QueryObserver<OnboardingStatus>(qc, onboardingStatusQueryOptions());
    const primerRender = guard.getCurrentResult();

    expect(primerRender.data?.completed).toBe(true);
    expect(primerRender.isStale).toBe(false);
    expect(guardRedirige(primerRender)).toBe(false);
    expect(statusFetches).toBe(0);
  });

  it("si el complete falla, el status queda invalidado (no se confía en el dato viejo)", async () => {
    const qc = nuevoCliente();
    qc.setQueryData(onboardingStatusKeys.status, INCOMPLETO);

    server.use(
      http.post(`${BASE}/api/onboarding/complete`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 500 }),
      ),
    );

    const complete = new MutationObserver(qc, completeOnboardingMutationOptions(qc));
    await expect(complete.mutate()).rejects.toBeTruthy();

    const guard = new QueryObserver<OnboardingStatus>(qc, onboardingStatusQueryOptions());
    const primerRender = guard.getCurrentResult();

    // El dato viejo sigue ahí, pero marcado stale → el guard no actúa con él.
    expect(primerRender.isStale).toBe(true);
    expect(guardRedirige(primerRender)).toBe(false);
  });

  it("una respuesta que no es un status NO se guarda como si lo fuera", async () => {
    const qc = nuevoCliente();
    qc.setQueryData(onboardingStatusKeys.status, INCOMPLETO);

    server.use(
      http.post(`${BASE}/api/onboarding/complete`, () => new HttpResponse(null, { status: 204 })),
    );

    const complete = new MutationObserver(qc, completeOnboardingMutationOptions(qc));
    await complete.mutate();

    expect(qc.getQueryData(onboardingStatusKeys.status)).toEqual(INCOMPLETO);
    const guard = new QueryObserver<OnboardingStatus>(qc, onboardingStatusQueryOptions());
    // Invalidado: no afirmamos "completado" sin que el backend lo diga, pero
    // tampoco redirigimos con un dato del que ya desconfiamos.
    expect(guardRedirige(guard.getCurrentResult())).toBe(false);
  });

  it("el guard SIGUE redirigiendo a quien de verdad no terminó (dato fresco)", async () => {
    const qc = nuevoCliente();
    server.use(http.get(`${BASE}/api/onboarding/status`, () => HttpResponse.json(INCOMPLETO)));

    const guard = new QueryObserver<OnboardingStatus>(qc, onboardingStatusQueryOptions());
    const unsubscribe = guard.subscribe(() => {});
    await vi.waitFor(() => expect(guard.getCurrentResult().data).toBeDefined());

    expect(guardRedirige(guard.getCurrentResult())).toBe(true);
    unsubscribe();
  });
});
