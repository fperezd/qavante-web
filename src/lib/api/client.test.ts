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

import { api, filenameFromContentDisposition } from "./client";
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

  it("GET binario conserva bytes, MIME, nombre y credentials del cliente común", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01]);
    server.use(
      http.get(`${BASE}/api/export`, ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.headers.get("accept")).toBe(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        return new HttpResponse(bytes, {
          headers: {
            "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "content-disposition": 'attachment; filename="resultado-operacional.xlsx"',
          },
        });
      }),
    );

    await expect(
      api.getFile("/api/export", {
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      }),
    ).resolves.toEqual({
      bytes,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentDisposition: 'attachment; filename="resultado-operacional.xlsx"',
      filename: "resultado-operacional.xlsx",
    });
  });

  it("GET binario comparte el refresh y reintenta con el mismo parser", async () => {
    let refreshCalls = 0;
    let exportCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${BASE}/api/export`, () => {
        exportCalls += 1;
        if (exportCalls === 1) return new HttpResponse(null, { status: 401 });
        return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
          headers: { "content-type": "application/octet-stream" },
        });
      }),
    );

    await expect(api.getFile("/api/export")).resolves.toMatchObject({
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    });
    expect(refreshCalls).toBe(1);
    expect(exportCalls).toBe(2);
  });

  it("GET binario sin contenido falla como ApiError, no como archivo vacío", async () => {
    server.use(http.get(`${BASE}/api/export`, () => new HttpResponse(null, { status: 204 })));
    await expect(api.getFile("/api/export")).rejects.toMatchObject({
      status: 204,
      code: "empty_file_response",
    });
    await expect(api.getFile("/api/export")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("Content-Disposition", () => {
  it("extrae filename entre comillas y filename* UTF-8", () => {
    expect(filenameFromContentDisposition('attachment; filename="reporte.xlsx"')).toBe(
      "reporte.xlsx",
    );
    expect(
      filenameFromContentDisposition("attachment; filename*=UTF-8''resultado%20operacional.xlsx"),
    ).toBe("resultado operacional.xlsx");
  });

  it("un filename* mal codificado no se convierte en un nombre plausible", () => {
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''%ZZ.xlsx")).toBeNull();
    expect(filenameFromContentDisposition(null)).toBeNull();
  });
});

describe("api — errores", () => {
  it("respuesta no-OK conserva detail técnico pero no lo usa como message", async () => {
    server.use(
      http.get(`${BASE}/api/boom`, () =>
        HttpResponse.json({ code: "bad_thing", detail: "Algo salió mal." }, { status: 400 }),
      ),
    );
    await expect(api.get("/api/boom")).rejects.toMatchObject({
      status: 400,
      code: "bad_thing",
      message: "Ocurrió un error inesperado. Intenta nuevamente.",
      detail: { code: "bad_thing", detail: "Algo salió mal." },
    });
    await expect(api.get("/api/boom")).rejects.toBeInstanceOf(ApiError);
  });

  it("detail anidado conserva code y no expone el texto crudo", async () => {
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
      message: "No pudimos verificar el captcha. Recárgalo e intenta de nuevo.",
    });
  });

  it("detail array de validación no expone msg crudo", async () => {
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
      message: "Algunos datos no son válidos. Revisa el formulario.",
    });
  });

  it("error sin body usable usa un fallback seguro", async () => {
    server.use(http.get(`${BASE}/api/empty`, () => new HttpResponse(null, { status: 500 })));
    await expect(api.get("/api/empty")).rejects.toMatchObject({
      status: 500,
      message: "No pudimos cargar la información. Intenta nuevamente.",
    });
  });

  it("error con solo {message} no expone message", async () => {
    server.use(
      http.get(`${BASE}/api/msg`, () =>
        HttpResponse.json({ message: "Algo puntual" }, { status: 400 }),
      ),
    );
    await expect(api.get("/api/msg")).rejects.toMatchObject({
      status: 400,
      message: "Ocurrió un error inesperado. Intenta nuevamente.",
    });
  });

  it("detail objeto sin texto conserva code y usa fallback seguro", async () => {
    server.use(
      http.get(`${BASE}/api/codeonly`, () =>
        HttpResponse.json({ detail: { code: "rate_limited" } }, { status: 429 }),
      ),
    );
    await expect(api.get("/api/codeonly")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      message: "Hiciste muchas operaciones seguidas. Espera un momento.",
    });
  });

  it("detail array vacío cae al fallback seguro sin reventar", async () => {
    server.use(
      http.get(`${BASE}/api/emptyarr`, () => HttpResponse.json({ detail: [] }, { status: 422 })),
    );
    await expect(api.get("/api/emptyarr")).rejects.toMatchObject({
      status: 422,
      message: "Algunos datos no son válidos. Revisa el formulario.",
    });
  });

  it("renderiza sólo UserMessage conocido con params y correlation_id seguros", async () => {
    server.use(
      http.get(`${BASE}/api/safe`, () =>
        HttpResponse.json(
          {
            detail: {
              code: "invalid_request",
              message_code: "invalid_field",
              params: { field: "rut" },
              detail: "SELECT password_hash FROM users",
            },
          },
          { status: 422, headers: { "x-correlation-id": "req_ABC-123" } },
        ),
      ),
    );
    await expect(api.get("/api/safe")).rejects.toMatchObject({
      message: "Revisa el campo RUT. Referencia: req_ABC-123.",
      userMessage: {
        message_code: "invalid_field",
        params: { field: "rut" },
        correlation_id: "req_ABC-123",
      },
    });
  });

  it.each([
    ["traceback", { detail: "Traceback: File /srv/api/users.py line 9" }],
    ["SQL", { detail: "SELECT password_hash FROM users" }],
    ["ruta", { message: "POST /api/internal/retry" }],
    ["token", { detail: { message: "Bearer secret-token" } }],
    ["upstream", { detail: "upstream http://10.0.0.4:8080 failed" }],
    ["message_code desconocido", { message_code: "raw_message", params: { text: "secreto" } }],
    ["params no permitidos", { message_code: "invalid_field", params: { field: "password_hash" } }],
  ])("%s no cruza la frontera de presentación", async (_name, body) => {
    server.use(http.get(`${BASE}/api/leak`, () => HttpResponse.json(body, { status: 500 })));
    await expect(api.get("/api/leak")).rejects.toMatchObject({
      message: "No pudimos cargar la información. Intenta nuevamente.",
    });
  });

  it("descarta correlation_id inseguro aunque el message_code sea válido", async () => {
    server.use(
      http.get(`${BASE}/api/correlation`, () =>
        HttpResponse.json(
          { message_code: "service_unavailable", correlation_id: "Bearer secret/token" },
          { status: 503 },
        ),
      ),
    );
    await expect(api.get("/api/correlation")).rejects.toMatchObject({
      message: "No pudimos cargar la información. Intenta nuevamente.",
      userMessage: { message_code: "service_unavailable" },
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

  it("401 concurrentes comparten UN solo refresh (single-flight)", async () => {
    /* Sin single-flight, N requests con 401 simultáneo disparan N refresh que
       se pisan la rotación del refresh-token y expulsan una sesión válida. */
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, async () => {
        refreshCalls += 1;
        // Delay para que ambos 401 lleguen mientras el refresh está en vuelo.
        await new Promise((r) => setTimeout(r, 20));
        return new HttpResponse(null, { status: 200 });
      }),
      http.get(`${BASE}/api/a`, () => new HttpResponse(null, { status: 401 }), { once: true }),
      http.get(`${BASE}/api/a`, () => HttpResponse.json({ v: "a" })),
      http.get(`${BASE}/api/b`, () => new HttpResponse(null, { status: 401 }), { once: true }),
      http.get(`${BASE}/api/b`, () => HttpResponse.json({ v: "b" })),
    );
    const [a, b] = await Promise.all([
      api.get<{ v: string }>("/api/a"),
      api.get<{ v: string }>("/api/b"),
    ]);
    expect(a).toEqual({ v: "a" });
    expect(b).toEqual({ v: "b" });
    expect(refreshCalls).toBe(1); // UN solo refresh compartido, no 2
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
