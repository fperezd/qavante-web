/* Tests del cliente HTTP (`api`) — la capa central por la que pasa TODO
   el data layer. Cubre el contrato de `request()`: parseo de respuestas,
   manejo de 204, construcción de ApiError desde respuestas no-OK, error
   de red, y el flujo de 401 → refresh → retry.

   `client.ts` lee `NEXT_PUBLIC_API_URL` en module-load (`const API_URL`),
   por eso fijamos la env en `vi.hoisted` (corre ANTES de los imports), no
   con resetModules (que crearía un segundo grafo de módulos y rompería el
   `instanceof ApiError`). Las requests pegan contra el server MSW global. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

import { api } from "./client";
import { ApiError } from "./errors";

const BASE = "http://api.test";

afterEach(() => {
  server.resetHandlers();
});

describe("api — respuestas OK", () => {
  it("GET parsea JSON del backend", async () => {
    server.use(http.get(`${BASE}/api/ping`, () => HttpResponse.json({ ok: true })));
    await expect(api.get<{ ok: boolean }>("/api/ping")).resolves.toEqual({ ok: true });
  });

  it("204 No Content resuelve a undefined", async () => {
    server.use(http.post(`${BASE}/api/thing`, () => new HttpResponse(null, { status: 204 })));
    await expect(api.post<void>("/api/thing")).resolves.toBeUndefined();
  });

  it("serializa el body a JSON en POST", async () => {
    server.use(
      http.post(`${BASE}/api/echo`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body);
      }),
    );
    await expect(api.post("/api/echo", { body: { a: 1 } })).resolves.toEqual({ a: 1 });
  });
});

describe("api — errores", () => {
  it("respuesta no-OK lanza ApiError con status, code y detail como message", async () => {
    server.use(
      http.get(`${BASE}/api/boom`, () =>
        HttpResponse.json({ code: "bad_thing", detail: "Algo salió mal." }, { status: 400 }),
      ),
    );
    await expect(api.get("/api/boom")).rejects.toMatchObject({
      status: 400,
      code: "bad_thing",
      message: "Algo salió mal.",
    });
    await expect(api.get("/api/boom")).rejects.toBeInstanceOf(ApiError);
  });

  it("error de red se mapea a ApiError status 0 (isNetworkError)", async () => {
    server.use(http.get(`${BASE}/api/down`, () => HttpResponse.error()));
    try {
      await api.get("/api/down");
      expect.unreachable("debió lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).isNetworkError()).toBe(true);
    }
  });
});

describe("api — flujo de auth en 401", () => {
  it("con skipAuthRetry no intenta refresh y lanza ApiError 401", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      http.get(`${BASE}/api/secure`, () => new HttpResponse(null, { status: 401 })),
    );
    await expect(api.get("/api/secure", { skipAuthRetry: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshCalls).toBe(0);
  });

  it("un 401 dispara refresh OK y reintenta la request una vez", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      /* once:true PRIMERO → el primer GET consume el 401; el segundo (tras
         refresh) cae al handler 200 de abajo. El orden importa: MSW matchea
         el primer handler aplicable de la lista. */
      http.get(`${BASE}/api/secure`, () => new HttpResponse(null, { status: 401 }), { once: true }),
      http.get(`${BASE}/api/secure`, () => HttpResponse.json({ data: "ok" })),
    );
    await expect(api.get<{ data: string }>("/api/secure")).resolves.toEqual({ data: "ok" });
    expect(refreshCalls).toBe(1);
  });

  it("si el refresh falla, lanza ApiError 401 (sesión expirada)", async () => {
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${BASE}/api/secure`, () => new HttpResponse(null, { status: 401 })),
    );
    await expect(api.get("/api/secure")).rejects.toMatchObject({ status: 401 });
  });
});
