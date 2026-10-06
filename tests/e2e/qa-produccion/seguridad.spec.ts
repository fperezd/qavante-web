import { request as pwRequest } from "@playwright/test";
import { test, expect, ApiLectura, esperarApi } from "./support/fixtures";
import {
  APP_URL,
  COMPANY_HEADER,
  FOREIGN_LEGAL_ENTITY_ID,
  FOREIGN_TENANT_ID,
  SESSION,
  SESSION_READONLY,
  SIN_SESION,
} from "./support/env";

/* Seguridad, SÓLO LECTURA. Todas las llamadas son GET; ninguna prueba intenta escribir en producción.
   (a) Aislamiento entre empresas y autenticación. (b) Permisos de un rol limitado. */

/** Endpoints protegidos que la app lee en las cinco páginas. */
const PROTEGIDOS = [
  "/api/me",
  "/api/dashboard/summary",
  "/api/treasury/bank-accounts",
  "/api/bank-movements?limit=1",
  "/api/treasury/reconciliation/review",
  "/api/sources/status",
];

const ROLES_LIMITADOS = ["viewer", "accountant", "external_advisor"];

/** Señales de datos de negocio en un cuerpo de error. */
const DATOS = /"(items|entities|cash_today|balance|amount|movements|queues)"\s*:/;

test.describe("QA producción · Seguridad · autenticación y aislamiento", () => {
  test.skip(!SESSION, SIN_SESION);

  test("SEG-AUTH-sin-sesion — los endpoints protegidos responden 401 sin cookie y sin datos", async ({
    evidencia,
  }) => {
    const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Origin: APP_URL } });
    try {
      const api = new ApiLectura(ctx, evidencia, () => "");
      for (const ruta of PROTEGIDOS) {
        const r = await api.get(ruta, { sinEmpresa: true });
        expect.soft(r.status, `GET ${ruta} sin sesión → ${r.status}`).toBe(401);
        expect.soft(r.captura.body, `GET ${ruta} sin sesión devuelve datos`).not.toMatch(DATOS);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test("SEG-AUTH-cookie-invalida — una cookie inválida responde 401 sin datos", async ({
    evidencia,
  }) => {
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: {
        Origin: APP_URL,
        Cookie: `qavante_session=qa-invalida-${Date.now().toString(36)}`,
      },
    });
    try {
      const api = new ApiLectura(ctx, evidencia, () => "");
      for (const ruta of PROTEGIDOS) {
        const r = await api.get(ruta, { sinEmpresa: true });
        expect.soft(r.status, `GET ${ruta} con cookie inválida → ${r.status}`).toBe(401);
        expect
          .soft(r.captura.body, `GET ${ruta} con cookie inválida devuelve datos`)
          .not.toMatch(DATOS);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test("SEG-AISLAMIENTO-empresa — pedir una sociedad ajena responde 403/404 sin datos", async ({
    api,
  }) => {
    test.skip(
      !FOREIGN_LEGAL_ENTITY_ID,
      "Define QAVANTE_FOREIGN_LEGAL_ENTITY_ID (sociedad de OTRO tenant) para probar el aislamiento.",
    );
    const id = encodeURIComponent(FOREIGN_LEGAL_ENTITY_ID);
    // Con el id en la query: la API debe RECHAZAR la sociedad ajena.
    const porParametro = [
      `/api/treasury/work-inbox?legal_entity_id=${id}`,
      `/api/treasury/reconciliation/review?legal_entity_id=${id}`,
      `/api/bank-movements?legal_entity_id=${id}&limit=5`,
    ];
    for (const ruta of porParametro) {
      const r = await api.get(ruta, { sinEmpresa: true });
      expect
        .soft([403, 404], `GET ${ruta} → ${r.status} (debería negar la sociedad ajena)`)
        .toContain(r.status);
      expect
        .soft(r.captura.body, `GET ${ruta} devuelve datos de la sociedad ajena`)
        .not.toMatch(DATOS);
    }
    // Con el header de sociedad activa que usa la app (X-Qavante-Company-Id).
    const porHeader = [
      "/api/dashboard/summary",
      "/api/treasury/bank-accounts",
      "/api/bank-movements?limit=5",
    ];
    for (const ruta of porHeader) {
      const r = await api.get(ruta, {
        sinEmpresa: true,
        headers: { [COMPANY_HEADER]: FOREIGN_LEGAL_ENTITY_ID },
      });
      expect
        .soft([403, 404], `GET ${ruta} con ${COMPANY_HEADER} ajeno → ${r.status}`)
        .toContain(r.status);
      expect
        .soft(r.captura.body, `GET ${ruta} con ${COMPANY_HEADER} ajeno menciona la sociedad ajena`)
        .not.toContain(FOREIGN_LEGAL_ENTITY_ID);
    }
  });

  test("SEG-AISLAMIENTO-tenant — un tenant ajeno no aparece ni se puede leer", async ({ api }) => {
    test.skip(
      !FOREIGN_TENANT_ID,
      "Define QAVANTE_FOREIGN_TENANT_ID (id de OTRO tenant) para probar el aislamiento.",
    );
    const mios = await api.get("/api/me/tenants", { sinEmpresa: true });
    expect(mios.status, "GET /api/me/tenants").toBe(200);
    expect(mios.captura.body, "/api/me/tenants lista el tenant ajeno").not.toContain(
      FOREIGN_TENANT_ID,
    );

    // GET de plataforma que "no muta nada": para un usuario de tenant debe ser 403/404.
    const preview = await api.get(
      `/api/admin/platform/tenants/${encodeURIComponent(FOREIGN_TENANT_ID)}/purge-preview`,
      { sinEmpresa: true },
    );
    expect([401, 403, 404], `purge-preview del tenant ajeno → ${preview.status}`).toContain(
      preview.status,
    );
    expect(preview.captura.body, "purge-preview devuelve inventario del tenant ajeno").not.toMatch(
      /"(tables|inventory_digest|rows)"\s*:/,
    );
  });
});

test.describe("QA producción · Seguridad · rol de solo lectura", () => {
  test.skip(!SESSION, SIN_SESION);
  test.skip(
    !SESSION_READONLY,
    "Define QAVANTE_SESSION_READONLY (cookie de un usuario viewer/accountant) para probar permisos.",
  );
  test.use({ sesion: SESSION_READONLY });

  test("SEG-ROL-permisos — el rol limitado no tiene permiso de escritura financiera", async ({
    api,
  }) => {
    const me = await api.get<{ user?: { role?: string } }>("/api/me", { sinEmpresa: true });
    expect(me.status, "GET /api/me con la sesión de solo lectura").toBe(200);
    const rol = me.json?.user?.role ?? "";
    expect(ROLES_LIMITADOS, `La sesión de solo lectura tiene rol "${rol}"`).toContain(rol);
    const perms = await api.get<{ permissions?: string[] }>("/api/users/me/permissions", {
      sinEmpresa: true,
    });
    const lista = perms.json?.permissions ?? [];
    const escritura = lista.filter(
      (p) => p === "*" || /\.(write|\*)$/.test(p) || /^financial\.write/.test(p),
    );
    expect(
      escritura,
      `El rol "${rol}" trae permisos de escritura: ${escritura.join(", ")}`,
    ).toEqual([]);
  });

  test("SEG-ROL-ui — la UI no ofrece acciones de escritura al rol limitado", async ({ page }) => {
    const pReview = esperarApi(page, /^\/api\/treasury\/reconciliation\/review/);
    await page.goto("/bandeja");
    await pReview;
    for (const nombre of [/Sí, conciliar/i, /^Guardar/i, /^Clasificar( \d+)?$/i, /No es esta/i]) {
      const botones = page.getByRole("button", { name: nombre });
      const n = await botones.count();
      for (let i = 0; i < n; i++) {
        await expect
          .soft(botones.nth(i), `Bandeja ofrece "${nombre.source}" habilitado al rol limitado`)
          .toBeDisabled();
      }
    }
    await page.goto("/caja/clasificados");
    await expect
      .soft(
        page.getByRole("button", { name: /^Reclasificar movimiento/ }),
        "Clasificados ofrece Reclasificar al rol limitado",
      )
      .toHaveCount(0);
    await page.goto("/banco");
    await expect
      .soft(
        page.getByRole("button", { name: /Actualizar cuentas/i }),
        'Banco ofrece "Actualizar cuentas" al rol limitado',
      )
      .toHaveCount(0);
  });

  test.fixme("SEG-ROL-escritura-negada — un PATCH de clasificación con el rol limitado responde 403 y no cambia nada", async () => {
    /* NO se corre contra producción: probar que una escritura se niega exige INTENTAR la escritura.
         Correr en staging o local (npm run e2e contra MSW/backend local) con un usuario viewer:
           1. GET /api/bank-movements?status=unclassified&limit=1 → id del movimiento.
           2. PATCH /api/bank-movements/{id}/classify con un cuerpo válido → esperar 403.
           3. GET del mismo movimiento → classification_status sin cambios.
         También POST /api/treasury/reconciliation/{id}/confirm → 403. */
  });
});
