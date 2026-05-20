// Handlers REST de MSW v2 alineados al contrato
// docs/backend-contracts/c0-auth-and-users.md.
//
// Wildcard host ("* slash api slash ...") intercepta tanto requests a la
// URL de prod (api.qavante.com) como a dev local (localhost:3000) sin
// acoplarse a un valor exacto de NEXT_PUBLIC_API_URL.
//
// Cookies (dev MSW): Set-Cookie SIN HttpOnly ni Secure. Los service
// workers corren en contexto JS y no pueden setear cookies HttpOnly
// (el browser las descarta silenciosamente — limitación documentada
// del Service Worker API). Para que el middleware Next.js vea la
// cookie tras el login, MSW la setea como JS-visible. Esto es una
// concesión SOLO en mocks de dev/test; en prod el backend real
// devuelve HttpOnly + Secure normalmente (regla 6 de CLAUDE.md
// sigue vigente — los tokens reales nunca pasan por JS).
import { http, HttpResponse } from "msw";
import type {
  InviteUserBody,
  UpdateUserBody,
  AcceptInvitationBody,
  UsersListResponse,
} from "@/lib/api/users";
import type { SetCompanyCredentialsBody, SetPersonCredentialsBody } from "@/lib/api/credentials";
import {
  listUsers,
  findUser,
  emailExists,
  invitationPending,
  inviteUser,
  updateUser,
  isLastActiveOwner,
  getCredentialsStatus,
  setCompanyCreds,
  setPersonCreds,
  deletePersonCreds,
  uploadCertificate,
  deleteCertificate,
} from "./db";
import { SEED_SESSION_USER } from "./fixtures";

const SESSION_COOKIE = "qavante_session=msw-mock-token; Path=/; SameSite=Lax";

const errorBody = (code: string, detail: string) => ({ code, detail });

export const authHandlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { rut: string; password: string };
    if (!body?.rut || !body?.password) {
      return HttpResponse.json(errorBody("invalid_credentials", "Credenciales inválidas."), {
        status: 401,
      });
    }
    return HttpResponse.json(
      { user: SEED_SESSION_USER },
      {
        status: 200,
        headers: { "Set-Cookie": SESSION_COOKIE },
      },
    );
  }),

  http.post("*/api/auth/refresh", () => {
    return HttpResponse.json(
      { user: SEED_SESSION_USER },
      {
        status: 200,
        headers: { "Set-Cookie": SESSION_COOKIE },
      },
    );
  }),

  http.post("*/api/auth/logout", () => {
    return new HttpResponse(null, {
      status: 204,
      headers: {
        "Set-Cookie": "qavante_session=; Path=/; Max-Age=0; SameSite=Lax",
      },
    });
  }),

  http.get("*/api/me", () => {
    return HttpResponse.json({
      user: {
        ...SEED_SESSION_USER,
        tenant_id: "t_qavante_demo",
        name: "Fernando Pérez",
        last_login_at: "2026-05-13T08:00:00Z",
        permissions: ["users.read", "users.write"],
      },
    });
  }),

  http.post("*/api/auth/accept-invitation", async ({ request }) => {
    const body = (await request.json()) as AcceptInvitationBody;
    if (!body?.token) {
      return HttpResponse.json(errorBody("invitation_not_found", "Token inválido."), {
        status: 404,
      });
    }
    if (body.password !== body.password_confirmation) {
      return HttpResponse.json(errorBody("password_mismatch", "Las claves no coinciden."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      { user: SEED_SESSION_USER },
      {
        status: 200,
        headers: { "Set-Cookie": SESSION_COOKIE },
      },
    );
  }),
];

export const usersHandlers = [
  http.get("*/api/users", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("page_size") ?? "25");
    const search = url.searchParams.get("search")?.toLowerCase();
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");

    let items = listUsers();
    if (search) {
      items = items.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          (u.name?.toLowerCase().includes(search) ?? false),
      );
    }
    if (role) items = items.filter((u) => u.role === role);
    if (status) items = items.filter((u) => u.status === status);

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    const response: UsersListResponse = {
      items: paged,
      total,
      page,
      page_size: pageSize,
    };
    return HttpResponse.json(response);
  }),

  http.post("*/api/users", async ({ request }) => {
    const body = (await request.json()) as InviteUserBody;
    if (!body?.email || !body?.role) {
      return HttpResponse.json(errorBody("validation_error", "Email y rol son requeridos."), {
        status: 422,
      });
    }
    if (emailExists(body.email) && !invitationPending(body.email)) {
      return HttpResponse.json(
        errorBody("email_already_exists", "Ya existe un usuario activo con ese email."),
        { status: 409 },
      );
    }
    if (invitationPending(body.email)) {
      return HttpResponse.json(
        errorBody("invitation_already_pending", "Ya hay una invitación pendiente para ese email."),
        { status: 409 },
      );
    }
    const user = inviteUser(body);
    return HttpResponse.json(user, { status: 201 });
  }),

  http.patch("*/api/users/:id", async ({ request, params }) => {
    const id = params.id as string;
    const body = (await request.json()) as UpdateUserBody;
    const target = findUser(id);
    if (!target) {
      return HttpResponse.json(errorBody("not_found", "Usuario no encontrado."), { status: 404 });
    }
    /* Protección last owner activo (contrato § 3.3). */
    const tryingToBreakLastOwner =
      isLastActiveOwner(id) &&
      ((body.role && body.role !== "owner") || body.status === "suspended");
    if (tryingToBreakLastOwner) {
      return HttpResponse.json(
        errorBody("last_owner_protection", "No podés modificar al único owner activo del tenant."),
        { status: 409 },
      );
    }
    const updated = updateUser(id, body);
    return HttpResponse.json(updated);
  }),
];

export const credentialsHandlers = [
  http.get("*/api/credentials/sii", () => {
    return HttpResponse.json(getCredentialsStatus());
  }),

  http.put("*/api/credentials/sii/company", async ({ request }) => {
    const body = (await request.json()) as SetCompanyCredentialsBody;
    if (!body?.rut || !body?.password || body.password.length < 4) {
      return HttpResponse.json(errorBody("validation_error", "RUT y clave requeridos."), {
        status: 422,
      });
    }
    const result = setCompanyCreds(body);
    if (!result.ok) {
      return HttpResponse.json(
        errorBody("rut_mismatch", "El RUT no coincide con el RUT empresa del tenant."),
        { status: 409 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.put("*/api/credentials/sii/person", async ({ request }) => {
    const body = (await request.json()) as SetPersonCredentialsBody;
    if (!body?.rut || !body?.password || body.password.length < 4) {
      return HttpResponse.json(errorBody("validation_error", "RUT y clave requeridos."), {
        status: 422,
      });
    }
    setPersonCreds(body);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/credentials/sii/person/:rut", ({ params }) => {
    const ok = deletePersonCreds(params.rut as string);
    if (!ok) {
      return HttpResponse.json(errorBody("not_found", "Credencial no encontrada."), {
        status: 404,
      });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.put("*/api/credentials/certificate", async ({ request }) => {
    const form = await request.formData();
    const file = form.get("file");
    const password = form.get("password");
    if (!(file instanceof Blob) || !file.size) {
      return HttpResponse.json(errorBody("invalid_pkcs12", "Archivo no recibido."), {
        status: 422,
      });
    }
    if (file.size > 100 * 1024) {
      return HttpResponse.json(errorBody("invalid_pkcs12", "Archivo > 100 KB."), { status: 413 });
    }
    if (typeof password !== "string" || password.length < 4) {
      return HttpResponse.json(
        errorBody("invalid_certificate_password", "La clave del certificado no es válida."),
        { status: 422 },
      );
    }
    /* Mock no valida formato PKCS#12 real — asume válido. expires_at fijo
       a 1 año desde ahora para que la UI pueda renderear "vence en N días". */
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    uploadCertificate({ expiresAt, subjectRut: "76.123.456-7" });
    return HttpResponse.json({ certificate: getCredentialsStatus().certificate }, { status: 200 });
  }),

  http.delete("*/api/credentials/certificate", () => {
    const ok = deleteCertificate();
    if (!ok) {
      return HttpResponse.json(
        errorBody("certificate_not_configured", "No hay certificado configurado."),
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

/* Treasury — canonical categories. Metadata read-only, contrato VIVO y
   CONGELADO (reconciliation P4-4): taxonomía §11/26 + shape §10.1. Subconjunto
   representativo (no las 26) con todos los campos de `CanonicalCategoryMeta`
   para que dev/test funcionen sin backend (ADR-0005). El contrato real lo
   sirve prod; esto NO hardcodea taxonomía en la app, solo en el mock. */
const canonicalCategoriesFixture = [
  {
    code: "client_collection",
    label: "Cobro de cliente",
    description: "Entrada de caja de cliente o deudor comercial.",
    expected_direction: "credit",
    cashflow_group: "cash_in",
    default_financial_model: "cash",
    default_impact_type: "operational",
    default_management_root: "ingresos",
    requires_review: false,
    affects_operational_result_by_default: true,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 10,
  },
  {
    code: "supplier_payment",
    label: "Pago a proveedor",
    description: "Pago comercial u operacional a proveedor.",
    expected_direction: "debit",
    cashflow_group: "cash_out",
    default_financial_model: "cash",
    default_impact_type: "operational",
    default_management_root: "costos",
    requires_review: false,
    affects_operational_result_by_default: true,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 40,
  },
  {
    code: "internal_bank_transfer",
    label: "Transferencia entre cuentas propias",
    description: "Movimiento entre cuentas de la misma empresa.",
    expected_direction: "any",
    cashflow_group: "internal",
    default_financial_model: "none",
    default_impact_type: "none",
    default_management_root: "tesoreria",
    requires_review: false,
    affects_operational_result_by_default: false,
    is_internal_movement: true,
    allowed_for_bank_movement: true,
    sort_order: 180,
  },
  {
    code: "unknown",
    label: "Por clasificar",
    description: "Movimiento sin clasificación suficiente.",
    expected_direction: "any",
    cashflow_group: "unknown",
    default_financial_model: "none",
    default_impact_type: "none",
    default_management_root: "por_clasificar",
    requires_review: true,
    affects_operational_result_by_default: false,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 999,
  },
];

/* Movimientos bancarios — listado + classify (PATCH). Shape de
   `BankMovement` (§17). classify devuelve el movimiento "clasificado"
   (echo del body) para que el FE vea el efecto sin backend (ADR-0005). */
const bankMovementsFixture = [
  {
    id: "mov-1",
    bank_account_id: "acct-1",
    description: "TRANSFERENCIA PROVEEDOR ACME SPA",
    amount: "-450000.00",
    date: "2026-05-12",
    canonical_category: null,
    management_account_id: null,
  },
  {
    id: "mov-2",
    bank_account_id: "acct-1",
    description: "ABONO CLIENTE FACTURA 1042",
    amount: "1190000.00",
    date: "2026-05-13",
    canonical_category: null,
    management_account_id: null,
  },
];

const treasuryHandlers = [
  http.get("*/api/treasury/canonical-categories", () =>
    HttpResponse.json({ items: canonicalCategoriesFixture }, { status: 200 }),
  ),
  http.get("*/api/bank-movements", () =>
    HttpResponse.json(
      { items: bankMovementsFixture, total: bankMovementsFixture.length },
      { status: 200 },
    ),
  ),
  http.patch("*/api/bank-movements/:movementId/classify", async ({ request, params }) => {
    const body = (await request.json()) as {
      management_account_id?: string;
      canonical_category?: string | null;
    };
    const base =
      bankMovementsFixture.find((m) => m.id === params.movementId) ?? bankMovementsFixture[0];
    return HttpResponse.json(
      {
        ...base,
        id: params.movementId,
        management_account_id: body.management_account_id ?? null,
        canonical_category: body.canonical_category ?? null,
      },
      { status: 200 },
    );
  }),
];

/* Management — árbol de cuentas + dimensiones. Read-only. Fixtures con
   shape de `ManagementAccountNode` / `ManagementDimension` (§10.2/§10.4)
   para dev/test sin backend (ADR-0005). No hardcodea estructura en la app. */
const managementAccountsTreeFixture = [
  {
    id: "acc-ingresos",
    code: "ingresos",
    name: "Ingresos",
    type: "income",
    parent_id: null,
    destination: "operational_income_statement",
    display_name: "Ingresos",
    description: null,
    level: 0,
    path: "ingresos",
    sort_order: 10,
    is_system: true,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    children: [
      {
        id: "acc-ventas",
        code: "ingresos.ventas",
        name: "Ventas",
        type: "income",
        parent_id: "acc-ingresos",
        destination: "operational_income_statement",
        display_name: "Ventas de productos",
        description: null,
        level: 1,
        path: "ingresos/ventas",
        sort_order: 10,
        is_system: false,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [],
      },
    ],
  },
];

const dimensionsFixture = [
  {
    id: "dim-proyecto",
    code: "proyecto",
    name: "Proyecto",
    description: "Analiza ingresos/costos por proyecto.",
    data_type: "text",
    is_system: false,
    is_required: false,
    is_visible: true,
    allows_hierarchy: true,
    allows_multiple_values: false,
    active: true,
    sort_order: 10,
  },
];

/* Valores de dimensión — lista PLANA con parent_id (shape §10.5 /
   ManagementDimensionValue). La jerarquía la deriva el adapter de UI. */
const dimensionValuesFixture = [
  {
    id: "val-norte",
    dimension_id: "dim-proyecto",
    parent_id: null,
    code: "norte",
    name: "Proyecto Norte",
    description: null,
    path: "norte",
    sort_order: 10,
    active: true,
  },
  {
    id: "val-norte-fase1",
    dimension_id: "dim-proyecto",
    parent_id: "val-norte",
    code: "norte.fase1",
    name: "Fase 1",
    description: null,
    path: "norte/fase1",
    sort_order: 10,
    active: true,
  },
];

const managementHandlers = [
  http.get("*/api/management/accounts/tree", () =>
    HttpResponse.json({ items: managementAccountsTreeFixture }, { status: 200 }),
  ),
  http.get("*/api/management/dimensions", () =>
    HttpResponse.json({ items: dimensionsFixture }, { status: 200 }),
  ),
  http.get("*/api/management/dimensions/:dimensionId/values", () =>
    HttpResponse.json({ items: dimensionValuesFixture }, { status: 200 }),
  ),
];

/* ============================================================
   Credenciales V2 — Opción A (sii_rcv + certs multi-holder).
   Conviven con los viejos `credentialsHandlers` mientras se migra
   (PR-Cb borra los viejos). Estado mínimo en memoria, suficiente
   para dev preview + tests sin backend (ADR-0005). */
let siiV2State: { is_active: boolean; rut?: string } = { is_active: false };
const certsV2State: Array<{
  id: string;
  rut_holder: string;
  holder_name: string;
  issued_at: string | null;
  expires_at: string;
  payload_size_bytes: number;
  password_hint: string | null;
}> = [];

const credentialsHandlersV2 = [
  http.get("*/api/admin/sources/sii_rcv/credential", () =>
    HttpResponse.json(
      {
        source_code: "sii_rcv",
        provider: "sii",
        purpose: "ingest",
        label: "Clave Tributaria SII",
        expected_keys: ["rut", "password"],
        human_label: "Clave del SII",
        is_active: siiV2State.is_active,
        created_at: "2026-05-19T00:00:00Z",
      },
      { status: 200 },
    ),
  ),

  http.post("*/api/admin/sources/sii_rcv/credential", async ({ request }) => {
    const body = (await request.json()) as { rut?: string; password?: string };
    if (!body?.rut || !body?.password) {
      return HttpResponse.json(errorBody("validation_error", "rut y password son requeridos."), {
        status: 422,
      });
    }
    siiV2State = { is_active: true, rut: body.rut };
    return HttpResponse.json(
      { status: "ok", source_code: "sii_rcv", is_active: true },
      { status: 200 },
    );
  }),

  http.delete("*/api/admin/sources/sii_rcv/credential", () => {
    siiV2State = { is_active: false };
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/admin/sources/sii_rcv/credential/test", () =>
    HttpResponse.json(
      {
        status: "ok",
        source_code: "sii_rcv",
        validation: {
          outcome: siiV2State.is_active ? "valid" : "skipped",
          message: siiV2State.is_active ? "Credencial válida." : "No hay credencial configurada.",
          details: {},
        },
      },
      { status: 200 },
    ),
  ),

  http.get("*/api/admin/certificates", () =>
    HttpResponse.json({ certificates: certsV2State, count: certsV2State.length }, { status: 200 }),
  ),

  http.post("*/api/admin/certificates", async ({ request }) => {
    const body = (await request.json()) as {
      pfx_base64?: string;
      password?: string;
      password_hint?: string | null;
      rut_holder?: string | null;
    };
    if (!body?.pfx_base64 || !body?.password) {
      return HttpResponse.json(errorBody("validation_error", "pfx_base64 y password requeridos."), {
        status: 422,
      });
    }
    const id = `cert-${certsV2State.length + 1}`;
    const cert = {
      id,
      rut_holder: body.rut_holder ?? "76.123.456-7",
      holder_name: "Holder Demo",
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      payload_size_bytes: Math.floor((body.pfx_base64.length * 3) / 4),
      password_hint: body.password_hint ?? null,
    };
    certsV2State.push(cert);
    return HttpResponse.json({ status: "ok", certificate: cert }, { status: 200 });
  }),

  http.delete("*/api/admin/certificates/:certificateId", ({ params }) => {
    const id = params.certificateId as string;
    const idx = certsV2State.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json(errorBody("not_found", "Certificado no encontrado."), {
        status: 404,
      });
    }
    certsV2State.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...credentialsHandlers,
  ...credentialsHandlersV2,
  ...treasuryHandlers,
  ...managementHandlers,
];
