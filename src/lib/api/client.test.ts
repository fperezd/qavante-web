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

  it("FormData se envía sin serializar y sin forzar Content-Type JSON (uploads)", async () => {
    server.use(
      http.post(`${BASE}/api/upload`, async ({ request }) => {
        const ct = request.headers.get("content-type") ?? "";
        const form = await request.formData();
        return HttpResponse.json({
          isMultipart: ct.includes("multipart/form-data"),
          fileName: (form.get("file") as File | null)?.name ?? null,
        });
      }),
    );
    const fd = new FormData();
    fd.append("file", new File(["%PDF-1.4"], "cartola.pdf", { type: "application/pdf" }));
    await expect(api.post("/api/upload", { body: fd })).resolves.toEqual({
      isMultipart: true,
      fileName: "cartola.pdf",
    });
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

  it("detail anidado {code,detail} se extrae como message+code (no [object Object])", async () => {
    server.use(
      http.get(`${BASE}/api/nested`, () =>
        HttpResponse.json(
          { detail: { code: "captcha_failed", detail: "Verificación de captcha fallida." } },
          { status: 403 },
        ),
      ),
    );
    await expect(api.get("/api/nested")).rejects.toMatchObject({
      status: 403,
      code: "captcha_failed",
      message: "Verificación de captcha fallida.",
    });
  });

  it("detail array (validación 422) usa el primer msg, no [object Object]", async () => {
    server.use(
      http.get(`${BASE}/api/invalid`, () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "email"], msg: "value is not a valid email", type: "x" }] },
          { status: 422 },
        ),
      ),
    );
    await expect(api.get("/api/invalid")).rejects.toMatchObject({
      status: 422,
      message: "value is not a valid email",
    });
  });

  it("error sin body usable → message fallback 'Error <status>'", async () => {
    server.use(http.get(`${BASE}/api/empty`, () => new HttpResponse(null, { status: 500 })));
    await expect(api.get("/api/empty")).rejects.toMatchObject({
      status: 500,
      message: "Error 500",
    });
  });

  it("error con solo {message} (sin detail) usa message", async () => {
    server.use(
      http.get(`${BASE}/api/msg`, () =>
        HttpResponse.json({ message: "Algo puntual" }, { status: 400 }),
      ),
    );
    await expect(api.get("/api/msg")).rejects.toMatchObject({
      status: 400,
      message: "Algo puntual",
    });
  });

  it("detail objeto sin string usa el code anidado y cae al fallback de message", async () => {
    server.use(
      http.get(`${BASE}/api/codeonly`, () =>
        HttpResponse.json({ detail: { code: "rate_limited" } }, { status: 429 }),
      ),
    );
    await expect(api.get("/api/codeonly")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      message: "Error 429",
    });
  });

  it("detail array vacío cae al fallback sin reventar", async () => {
    server.use(
      http.get(`${BASE}/api/emptyarr`, () => HttpResponse.json({ detail: [] }, { status: 422 })),
    );
    await expect(api.get("/api/emptyarr")).rejects.toMatchObject({
      status: 422,
      message: "Error 422",
    });
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

  it("si el refresh es 2xx pero el retry SIGUE 401, no loopea y lanza ApiError 401 (#1)", async () => {
    /* Caso del fix #1: rotación de token / cookie nueva que sigue sin
       autorizar. Antes el retry (skipAuthRetry) caía a un ApiError 401 plano
       SIN redirigir; ahora redirige a /login. El refresh se llama UNA sola vez
       (el retry usa skipAuthRetry → no re-dispara refresh → sin loop). */
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      http.get(`${BASE}/api/secure`, () => new HttpResponse(null, { status: 401 })),
    );
    await expect(api.get("/api/secure")).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(1);
  });
});

describe("api — body JSON vacío o inválido (#2)", () => {
  it("200 con content-type JSON y body vacío resuelve undefined (no SyntaxError crudo)", async () => {
    server.use(
      http.get(
        `${BASE}/api/empty`,
        () =>
          new HttpResponse("", { status: 200, headers: { "content-type": "application/json" } }),
      ),
    );
    await expect(api.get("/api/empty")).resolves.toBeUndefined();
  });

  it("200 con JSON malformado lanza ApiError invalid_json (no SyntaxError crudo)", async () => {
    server.use(
      http.get(
        `${BASE}/api/bad-json`,
        () =>
          new HttpResponse("{not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    await expect(api.get("/api/bad-json")).rejects.toBeInstanceOf(ApiError);
    await expect(api.get("/api/bad-json")).rejects.toMatchObject({ code: "invalid_json" });
  });
});
