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
import {
  listUsers,
  findUser,
  emailExists,
  invitationPending,
  inviteUser,
  updateUser,
  isLastActiveOwner,
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
   Currencies — catálogo global + lookup TC + settings tenant
   (Addendum §15.2/§15.4/§15.7). Seed mínimo cubre los casos
   chilenos típicos: CLP fiat funcional, USD/EUR/BRL reporting,
   UF/UTM indexed_unit. Estado mutable del settings vive en
   memoria para PATCH dev preview. */
const currenciesFixture = [
  {
    code: "CLP",
    name: "Peso chileno",
    symbol: "$",
    currency_type: "fiat",
    decimals: 0,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "USD",
    name: "Dólar estadounidense",
    symbol: "US$",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "BRL",
    name: "Real brasileño",
    symbol: "R$",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "UF",
    name: "Unidad de Fomento",
    symbol: "UF",
    currency_type: "indexed_unit",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "UTM",
    name: "Unidad Tributaria Mensual",
    symbol: "UTM",
    currency_type: "indexed_unit",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

/* TC seed determinístico — solo pares más usados en preview. La ausencia
   del par solicitado dispara `requires_attention` + rate=null (§15.7). */
const exchangeRatesFixture: Record<string, { rate: string; rate_date: string }> = {
  "USD>CLP": { rate: "920.45", rate_date: "2026-05-21" },
  "EUR>CLP": { rate: "1015.30", rate_date: "2026-05-21" },
  "BRL>CLP": { rate: "168.92", rate_date: "2026-05-21" },
  "UF>CLP": { rate: "39124.18", rate_date: "2026-05-21" },
  "UTM>CLP": { rate: "67429.00", rate_date: "2026-05-21" },
};

let companyCurrencySettingsState: {
  tenant_id: string;
  functional_currency_code: string;
  default_reporting_currency_code: string | null;
  indexed_unit_enabled: boolean;
  indexed_unit_currency_code: string | null;
  reporting_currency_codes: string[];
  default_exchange_rate_source: string | null;
  updated_at: string;
} = {
  tenant_id: "tenant-demo",
  functional_currency_code: "CLP",
  default_reporting_currency_code: "USD",
  indexed_unit_enabled: true,
  indexed_unit_currency_code: "UF",
  reporting_currency_codes: ["USD", "EUR"],
  default_exchange_rate_source: "BCCH",
  updated_at: "2026-05-21T00:00:00Z",
};

const currenciesHandlers = [
  http.get("*/api/core/currencies", () =>
    HttpResponse.json({ items: currenciesFixture }, { status: 200 }),
  ),

  http.get("*/api/core/exchange-rates", ({ request }) => {
    const url = new URL(request.url);
    const base = url.searchParams.get("base");
    const quote = url.searchParams.get("quote");
    const date = url.searchParams.get("date");
    if (!base || !quote) {
      return HttpResponse.json(errorBody("validation_error", "base y quote requeridos."), {
        status: 422,
      });
    }
    const key = `${base}>${quote}`;
    const found = exchangeRatesFixture[key];
    if (!found) {
      /* §15.7: ausencia ≠ error. data_status=requires_attention. */
      return HttpResponse.json({ data_status: "requires_attention", rate: null }, { status: 200 });
    }
    return HttpResponse.json(
      {
        data_status: "ok",
        rate: {
          id: `er-${base}-${quote}-${found.rate_date}`,
          base_currency_code: base,
          quote_currency_code: quote,
          rate: found.rate,
          rate_date: date ?? found.rate_date,
          source: "BCCH",
          created_at: `${found.rate_date}T00:00:00Z`,
        },
      },
      { status: 200 },
    );
  }),

  http.get("*/api/core/company-currency-settings", () =>
    HttpResponse.json(companyCurrencySettingsState, { status: 200 }),
  ),

  http.patch("*/api/core/company-currency-settings", async ({ request }) => {
    const body = (await request.json()) as Partial<typeof companyCurrencySettingsState>;
    /* Update parcial — solo campos presentes; el resto preserva el estado. */
    companyCurrencySettingsState = {
      ...companyCurrencySettingsState,
      ...(body.functional_currency_code !== undefined && body.functional_currency_code !== null
        ? { functional_currency_code: body.functional_currency_code }
        : {}),
      ...(body.default_reporting_currency_code !== undefined
        ? { default_reporting_currency_code: body.default_reporting_currency_code }
        : {}),
      ...(body.indexed_unit_enabled !== undefined && body.indexed_unit_enabled !== null
        ? { indexed_unit_enabled: body.indexed_unit_enabled }
        : {}),
      ...(body.indexed_unit_currency_code !== undefined
        ? { indexed_unit_currency_code: body.indexed_unit_currency_code }
        : {}),
      ...(body.reporting_currency_codes !== undefined && body.reporting_currency_codes !== null
        ? { reporting_currency_codes: body.reporting_currency_codes }
        : {}),
      ...(body.default_exchange_rate_source !== undefined
        ? { default_exchange_rate_source: body.default_exchange_rate_source }
        : {}),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(companyCurrencySettingsState, { status: 200 });
  }),
];

/* ============================================================
   Credenciales — Opción A (sii_rcv + certs multi-holder). Decisión
   Fernando 2026-05-18. Modelo viejo (persons[], cert único) borrado
   en PR-Cb2. Estado mínimo en memoria, suficiente para dev preview +
   tests sin backend (ADR-0005). */
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
  ...credentialsHandlersV2,
  ...treasuryHandlers,
  ...managementHandlers,
  ...currenciesHandlers,
];
