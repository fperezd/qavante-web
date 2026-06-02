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
    code: "payroll_payment",
    label: "Sueldos",
    description: "Pago de remuneraciones al personal.",
    expected_direction: "debit",
    cashflow_group: "cash_out",
    default_financial_model: "cash",
    default_impact_type: "operational",
    default_management_root: "costos",
    requires_review: false,
    affects_operational_result_by_default: true,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 50,
  },
  {
    code: "tax_payment",
    label: "Pago de impuestos",
    description: "Pago al fisco (F29, F22, IVA, PPM, etc).",
    expected_direction: "any",
    cashflow_group: "cash_out",
    default_financial_model: "cash",
    default_impact_type: "operational",
    default_management_root: "impuestos",
    requires_review: false,
    affects_operational_result_by_default: true,
    is_internal_movement: false,
    allowed_for_bank_movement: true,
    sort_order: 60,
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
   `BankMovement` (§17). Fixtures cubren AMBOS estados (unclassified +
   classified) para dev preview de /caja/por-clasificar y /caja/clasificados.
   Handler filtra por query `status` y `period` (mismo contrato que el
   backend live, regla 16). classify devuelve el movimiento "clasificado"
   con el body aplicado (ADR-0005). */
const bankMovementsFixture = [
  /* Sin clasificar (status='unclassified') — alimentan /caja/por-clasificar */
  {
    id: "mov-unclas-1",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1001",
    description: "TRANSFERENCIA PROVEEDOR ACME SPA",
    amount: "-450000.00",
    date: "2026-05-12",
    direction: "debit",
    canonical_category: null,
    management_account_id: null,
  },
  {
    id: "mov-unclas-2",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1002",
    description: "ABONO CLIENTE FACTURA 1042",
    amount: "1190000.00",
    date: "2026-05-13",
    direction: "credit",
    canonical_category: null,
    management_account_id: null,
  },
  /* Clasificados (status='classified') — alimentan /caja/clasificados.
     Cubren los canonical_category más comunes de PYME para que la vista
     muestre badges variados al filtrar. */
  {
    id: "mov-clas-1",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1003",
    description: "SUELDO FERNANDO PEREZ MAYO",
    amount: "-2500000.00",
    date: "2026-05-30",
    direction: "debit",
    canonical_category: "payroll_payment",
    management_account_id: "acc-sueldos",
  },
  {
    id: "mov-clas-2",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1004",
    description: "PAGO MOVISTAR FACTURA 87654321",
    amount: "-42500.00",
    date: "2026-05-15",
    direction: "debit",
    canonical_category: "supplier_payment",
    management_account_id: "acc-servicios",
  },
  {
    id: "mov-clas-3",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1005",
    description: "ABONO CLIENTE X CAPITAL SPA - FACTURA 217576",
    amount: "96990.00",
    date: "2026-05-15",
    direction: "credit",
    canonical_category: "client_collection",
    management_account_id: "acc-ventas",
  },
  {
    id: "mov-clas-4",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1006",
    description: "PAGO F29 ABRIL 2026",
    amount: "-2150000.00",
    date: "2026-05-12",
    direction: "debit",
    canonical_category: "tax_payment",
    management_account_id: "acc-impuestos",
  },
  {
    id: "mov-clas-5",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1007",
    description: "ABONO TGR PPM ABRIL",
    amount: "850000.00",
    date: "2026-05-18",
    direction: "credit",
    canonical_category: "tax_payment",
    management_account_id: "acc-impuestos",
  },
  {
    id: "mov-clas-6",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1008",
    description: "TRANSFERENCIA ENTRE CUENTAS PROPIAS",
    amount: "-1000000.00",
    date: "2026-05-20",
    direction: "debit",
    canonical_category: "internal_bank_transfer",
    management_account_id: null,
  },
  {
    id: "mov-clas-7",
    bank_account_id: "acct-2",
    external_id: "ext-bice-2001",
    description: "TRANSFERENCIA ENTRE CUENTAS PROPIAS (RECEPCION)",
    amount: "1000000.00",
    date: "2026-05-20",
    direction: "credit",
    canonical_category: "internal_bank_transfer",
    management_account_id: null,
  },
  {
    id: "mov-clas-8",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1009",
    description: "PAGO HONORARIOS PROFESIONAL ASESOR 1",
    amount: "-875000.00",
    date: "2026-05-22",
    direction: "debit",
    canonical_category: "supplier_payment",
    management_account_id: "acc-honorarios",
  },
];

function isClassified(m: { canonical_category: string | null }): boolean {
  return m.canonical_category != null;
}

function inPeriod(m: { date: string }, period: string | null): boolean {
  if (!period) return true;
  /* `period` formato YYYY-MM o YYYYMM. Comparamos contra los primeros
     7 chars de la fecha (YYYY-MM). El backend live también acepta texto
     libre tipo "mayo 2026" pero el FE normaliza a YYYY-MM antes de
     enviar (sii-period-form-schema). */
  const normalized = period.includes("-") ? period : `${period.slice(0, 4)}-${period.slice(4)}`;
  return m.date.startsWith(normalized);
}

const treasuryHandlers = [
  http.get("*/api/treasury/canonical-categories", () =>
    HttpResponse.json({ items: canonicalCategoriesFixture }, { status: 200 }),
  ),
  http.get("*/api/bank-movements", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const period = url.searchParams.get("period");

    let items = bankMovementsFixture.filter((m) => inPeriod(m, period));
    if (status === "classified") {
      items = items.filter(isClassified);
    } else if (status === "unclassified") {
      items = items.filter((m) => !isClassified(m));
    }

    return HttpResponse.json({ items, total: items.length }, { status: 200 });
  }),
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
  {
    id: "acc-costos",
    code: "costos",
    name: "Costos",
    type: "expense",
    parent_id: null,
    destination: "operational_income_statement",
    display_name: "Costos operacionales",
    description: null,
    level: 0,
    path: "costos",
    sort_order: 20,
    is_system: true,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    children: [
      {
        id: "acc-sueldos",
        code: "costos.sueldos",
        name: "Sueldos",
        type: "expense",
        parent_id: "acc-costos",
        destination: "operational_income_statement",
        display_name: "Sueldos y remuneraciones",
        description: null,
        level: 1,
        path: "costos/sueldos",
        sort_order: 10,
        is_system: false,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [],
      },
      {
        id: "acc-servicios",
        code: "costos.servicios",
        name: "Servicios",
        type: "expense",
        parent_id: "acc-costos",
        destination: "operational_income_statement",
        display_name: "Software y servicios",
        description: null,
        level: 1,
        path: "costos/servicios",
        sort_order: 20,
        is_system: false,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [],
      },
      {
        id: "acc-honorarios",
        code: "costos.honorarios",
        name: "Honorarios",
        type: "expense",
        parent_id: "acc-costos",
        destination: "operational_income_statement",
        display_name: "Honorarios profesionales",
        description: null,
        level: 1,
        path: "costos/honorarios",
        sort_order: 30,
        is_system: false,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [],
      },
    ],
  },
  {
    id: "acc-impuestos",
    code: "impuestos",
    name: "Impuestos",
    type: "expense",
    parent_id: null,
    destination: "operational_income_statement",
    display_name: "Impuestos",
    description: null,
    level: 0,
    path: "impuestos",
    sort_order: 30,
    is_system: true,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    children: [],
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

/* Mutations management/accounts — Sprint C2 PR-Mng1. Por simplicidad
   las mutaciones NO persisten en el árbol mutable; devuelven shape
   contractual completo derivado del body + fixture base. Tests validan
   shape de request/response, no comportamiento end-to-end. Cuando el
   editor UI llegue, agregamos persistencia real con `let` mutable
   (patrón ya usado en credentials/rules/templates). */
let managementAccountIdCounter = 1000;
function syntheticAccount(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  managementAccountIdCounter += 1;
  return {
    id: `acc-synth-${managementAccountIdCounter}`,
    code: "ingresos.ejemplo",
    name: "Cuenta sintética",
    type: "income",
    parent_id: null,
    destination: "operational_income_statement",
    display_name: null,
    description: null,
    sort_order: 100,
    is_system: false,
    is_visible: true,
    affects_pulso: true,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const managementHandlers = [
  http.get("*/api/management/accounts/tree", () =>
    HttpResponse.json({ items: managementAccountsTreeFixture }, { status: 200 }),
  ),
  http.post("*/api/management/accounts", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.code || !body.name || !body.type || !body.destination) {
      return HttpResponse.json(
        errorBody("validation_error", "code, name, type y destination son requeridos."),
        { status: 422 },
      );
    }
    return HttpResponse.json(syntheticAccount(body), { status: 201 });
  }),
  http.patch("*/api/management/accounts/:accountId", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(syntheticAccount({ ...body, id: params.accountId }), {
      status: 200,
    });
  }),
  http.post("*/api/management/accounts/:accountId/move", async ({ params, request }) => {
    const body = (await request.json()) as { new_parent_id?: string | null };
    return HttpResponse.json(
      syntheticAccount({ id: params.accountId, parent_id: body.new_parent_id ?? null }),
      { status: 200 },
    );
  }),
  http.post("*/api/management/accounts/:accountId/toggle-active", ({ params }) =>
    HttpResponse.json(syntheticAccount({ id: params.accountId, active: false }), {
      status: 200,
    }),
  ),
  http.post("*/api/management/accounts/:accountId/toggle-visible", ({ params }) =>
    HttpResponse.json(syntheticAccount({ id: params.accountId, is_visible: false }), {
      status: 200,
    }),
  ),
  http.get("*/api/management/dimensions", () =>
    HttpResponse.json({ items: dimensionsFixture }, { status: 200 }),
  ),
  http.get("*/api/management/dimensions/:dimensionId/values", () =>
    HttpResponse.json({ items: dimensionValuesFixture }, { status: 200 }),
  ),
  /* Sprint C2 PR-Mng2 — mutations dimensions + values + assignments.
     Mismo patrón que PR-Mng1: shape contractual desde body + defaults,
     SIN persistencia mutable. Para tests de contrato y feedback UI
     loading/success. Persistencia real se agrega cuando llegue el
     editor UI. */
  http.post("*/api/management/dimensions", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.code || !body.name) {
      return HttpResponse.json(errorBody("validation_error", "code y name son requeridos."), {
        status: 422,
      });
    }
    managementAccountIdCounter += 1;
    return HttpResponse.json(
      {
        id: `dim-synth-${managementAccountIdCounter}`,
        data_type: "text",
        is_system: false,
        is_required: false,
        is_visible: true,
        allows_hierarchy: false,
        allows_multiple_values: false,
        active: true,
        sort_order: 100,
        ...body,
      },
      { status: 201 },
    );
  }),
  http.patch("*/api/management/dimensions/:dimensionId", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: params.dimensionId,
        code: "proyecto",
        name: "Proyecto",
        description: null,
        data_type: "text",
        is_system: false,
        is_required: false,
        is_visible: true,
        allows_hierarchy: true,
        allows_multiple_values: false,
        active: true,
        sort_order: 10,
        ...body,
      },
      { status: 200 },
    );
  }),
  http.post("*/api/management/dimensions/:dimensionId/values", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.name) {
      return HttpResponse.json(errorBody("validation_error", "name es requerido."), {
        status: 422,
      });
    }
    managementAccountIdCounter += 1;
    return HttpResponse.json(
      {
        id: `val-synth-${managementAccountIdCounter}`,
        dimension_id: params.dimensionId,
        parent_id: null,
        code: null,
        description: null,
        path: String(body.name).toLowerCase().replace(/\s+/g, "-"),
        sort_order: 0,
        active: true,
        ...body,
      },
      { status: 201 },
    );
  }),
  http.patch("*/api/management/dimension-values/:valueId", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: params.valueId,
        dimension_id: "dim-proyecto",
        parent_id: null,
        code: "norte",
        name: "Proyecto Norte",
        description: null,
        path: "norte",
        sort_order: 10,
        active: true,
        ...body,
      },
      { status: 200 },
    );
  }),
  http.post("*/api/management/dimension-values/:valueId/move", async ({ params, request }) => {
    const body = (await request.json()) as { new_parent_id?: string | null };
    return HttpResponse.json(
      {
        id: params.valueId,
        dimension_id: "dim-proyecto",
        parent_id: body.new_parent_id ?? null,
        code: "norte",
        name: "Proyecto Norte",
        description: null,
        path: "norte",
        sort_order: 10,
        active: true,
      },
      { status: 200 },
    );
  }),
  http.post("*/api/management/dimension-assignments", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.entity_type || !body.entity_id || !body.dimension_id || !body.dimension_value_id) {
      return HttpResponse.json(
        errorBody(
          "validation_error",
          "entity_type, entity_id, dimension_id y dimension_value_id son requeridos.",
        ),
        { status: 422 },
      );
    }
    managementAccountIdCounter += 1;
    return HttpResponse.json(
      {
        id: `assignment-synth-${managementAccountIdCounter}`,
        created_by: "u_owner_01",
        created_at: new Date().toISOString(),
        ...body,
      },
      { status: 201 },
    );
  }),
  http.delete(
    "*/api/management/dimension-assignments/:assignmentId",
    () => new HttpResponse(null, { status: 204 }),
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

/* ============================================================
   Industry Templates — Addendum §13.5/§13.6/§14.1/§14.2. Seed
   con 3 plantillas (services / commerce / construction) y un
   detail completo para `services` (la más común). El apply
   responde un diff determinístico según el modo solicitado.
   NUNCA destructivo (§14.1). */
const industryTemplatesFixture = [
  {
    id: "tpl-services",
    code: "services",
    name: "Servicios profesionales",
    description: "Estudios contables, jurídicos, consultoras y otros servicios B2B.",
    business_family: "services" as const,
    is_active: true,
    sort_order: 10,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "tpl-commerce",
    code: "retail_commerce",
    name: "Comercio minorista",
    description: "Tiendas con punto de venta físico o e-commerce.",
    business_family: "commerce" as const,
    is_active: true,
    sort_order: 20,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "tpl-construction",
    code: "construction_projects",
    name: "Construcción y proyectos",
    description: "Constructoras, contratistas y empresas por obra/proyecto.",
    business_family: "construction_projects" as const,
    is_active: true,
    sort_order: 30,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  },
];

const industryTemplatesDetailsFixture: Record<
  string,
  {
    dimensions: Array<{
      id: string;
      industry_template_id: string;
      dimension_code: string;
      dimension_name: string;
      description: string | null;
      default_visible: boolean;
      default_required: boolean;
      allows_hierarchy: boolean;
      allows_multiple_values: boolean;
      sort_order: number;
      created_at: string;
    }>;
    accounts: Array<{
      id: string;
      industry_template_id: string;
      management_account_code: string;
      default_visible: boolean;
      default_required: boolean;
      sort_order: number;
      created_at: string;
    }>;
  }
> = {
  services: {
    dimensions: [
      {
        id: "tpl-services-dim-1",
        industry_template_id: "tpl-services",
        dimension_code: "client",
        dimension_name: "Cliente",
        description: "Cliente asignado al ingreso/gasto.",
        default_visible: true,
        default_required: true,
        allows_hierarchy: false,
        allows_multiple_values: false,
        sort_order: 10,
        created_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "tpl-services-dim-2",
        industry_template_id: "tpl-services",
        dimension_code: "project",
        dimension_name: "Proyecto",
        description: "Proyecto o engagement.",
        default_visible: true,
        default_required: false,
        allows_hierarchy: true,
        allows_multiple_values: false,
        sort_order: 20,
        created_at: "2026-04-01T00:00:00Z",
      },
    ],
    accounts: [
      {
        id: "tpl-services-acc-1",
        industry_template_id: "tpl-services",
        management_account_code: "ingresos_servicios",
        default_visible: true,
        default_required: false,
        sort_order: 10,
        created_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "tpl-services-acc-2",
        industry_template_id: "tpl-services",
        management_account_code: "honorarios_pagados",
        default_visible: true,
        default_required: false,
        sort_order: 20,
        created_at: "2026-04-01T00:00:00Z",
      },
    ],
  },
};

const industryTemplatesHandlers = [
  http.get("*/api/management/industry-templates", () =>
    HttpResponse.json({ items: industryTemplatesFixture }, { status: 200 }),
  ),

  http.get("*/api/management/industry-templates/:templateCode", ({ params }) => {
    const code = params.templateCode as string;
    const template = industryTemplatesFixture.find((t) => t.code === code);
    if (!template) {
      return HttpResponse.json(errorBody("not_found", "Plantilla no encontrada."), {
        status: 404,
      });
    }
    const detail = industryTemplatesDetailsFixture[code] ?? {
      dimensions: [],
      accounts: [],
    };
    return HttpResponse.json(
      { template, dimensions: detail.dimensions, accounts: detail.accounts },
      { status: 200 },
    );
  }),

  http.post(
    "*/api/management/industry-templates/:templateCode/apply",
    async ({ params, request }) => {
      const code = params.templateCode as string;
      const body = (await request.json()) as {
        mode?: "suggest_only" | "add_missing" | "replace_visibility";
        overwrite_existing?: boolean;
      };
      const mode = body.mode ?? "suggest_only";
      const exists = industryTemplatesFixture.some((t) => t.code === code);
      if (!exists) {
        return HttpResponse.json(errorBody("not_found", "Plantilla no encontrada."), {
          status: 404,
        });
      }
      const detail = industryTemplatesDetailsFixture[code] ?? {
        dimensions: [],
        accounts: [],
      };
      /* Mock determinístico: nada existe todavía, así que
         accounts_to_add y dimensions_to_add = total de sugerencias. */
      return HttpResponse.json(
        {
          template_code: code,
          mode,
          summary: {
            accounts_to_add: detail.accounts.length,
            dimensions_to_add: detail.dimensions.length,
            accounts_existing: 0,
            dimensions_existing: 0,
          },
          accounts_preview: detail.accounts.map((a) => ({
            management_account_code: a.management_account_code,
            default_visible: a.default_visible,
          })),
          dimensions_preview: detail.dimensions.map((d) => ({
            dimension_code: d.dimension_code,
            dimension_name: d.dimension_name,
            default_visible: d.default_visible,
          })),
        },
        { status: 200 },
      );
    },
  ),
];

/* ============================================================
   Classification Rules — Addendum §17.5/§17.6/§18.7. Estado en
   memoria con seed mínimo (2 reglas activas + 1 desactivada) para
   probar listado ordenado, toggle, create y suggest. */
const rulesV2State: Array<{
  id: string;
  name: string;
  source_type: string;
  condition_field: string;
  operator: string;
  condition_value: string;
  canonical_category: string | null;
  management_account_id: string | null;
  dimension_assignments: unknown[];
  priority: number;
  confidence: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}> = [
  {
    id: "rule-1",
    name: "Sueldo Fernando",
    source_type: "bank_movement",
    condition_field: "description",
    operator: "contains",
    condition_value: "REMUN FERNANDO",
    canonical_category: "payroll",
    management_account_id: "acc-9",
    dimension_assignments: [],
    priority: 10,
    confidence: "0.95",
    active: true,
    created_by: "u_owner_01",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: null,
  },
  {
    id: "rule-2",
    name: "Proveedor Movistar",
    source_type: "bank_movement",
    condition_field: "counterparty_name",
    operator: "equals",
    condition_value: "TELEFONICA CHILE S.A.",
    canonical_category: "supplier_payment",
    management_account_id: "acc-12",
    dimension_assignments: [],
    priority: 50,
    confidence: "0.90",
    active: true,
    created_by: "u_owner_01",
    created_at: "2026-05-03T10:00:00Z",
    updated_at: null,
  },
  {
    id: "rule-3",
    name: "Transferencia banco — desactivada",
    source_type: "bank_movement",
    condition_field: "description",
    operator: "starts_with",
    condition_value: "TRANSF",
    canonical_category: "internal_transfer",
    management_account_id: null,
    dimension_assignments: [],
    priority: 90,
    confidence: "0.70",
    active: false,
    created_by: "u_admin_01",
    created_at: "2026-04-20T10:00:00Z",
    updated_at: "2026-05-10T15:00:00Z",
  },
];

let rulesV2Counter = rulesV2State.length;

const classificationRulesHandlers = [
  http.get("*/api/treasury/classification-rules", () => {
    /* Listado ordenado por priority ASC (orden de evaluación). */
    const sorted = [...rulesV2State].sort((a, b) => a.priority - b.priority);
    return HttpResponse.json({ items: sorted }, { status: 200 });
  }),

  http.post("*/api/treasury/classification-rules", async ({ request }) => {
    const body = (await request.json()) as {
      name?: string;
      source_type?: string;
      condition_field?: string;
      operator?: string;
      condition_value?: string;
      canonical_category?: string | null;
      management_account_id?: string | null;
      priority?: number;
      confidence?: number;
    };
    if (!body.name || !body.condition_field || !body.operator || !body.condition_value) {
      return HttpResponse.json(
        errorBody(
          "validation_error",
          "name, condition_field, operator y condition_value requeridos.",
        ),
        { status: 422 },
      );
    }
    rulesV2Counter += 1;
    const newRule = {
      id: `rule-${rulesV2Counter}`,
      name: body.name,
      source_type: body.source_type ?? "bank_movement",
      condition_field: body.condition_field,
      operator: body.operator,
      condition_value: body.condition_value,
      canonical_category: body.canonical_category ?? null,
      management_account_id: body.management_account_id ?? null,
      dimension_assignments: [],
      priority: body.priority ?? 100,
      confidence: String(body.confidence ?? 0.8),
      active: true,
      created_by: "u_owner_01",
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    rulesV2State.push(newRule);
    return HttpResponse.json(newRule, { status: 201 });
  }),

  http.patch("*/api/treasury/classification-rules/:ruleId", async ({ params, request }) => {
    const id = params.ruleId as string;
    const idx = rulesV2State.findIndex((r) => r.id === id);
    if (idx === -1) {
      return HttpResponse.json(errorBody("not_found", "Regla no encontrada."), { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const existing = rulesV2State[idx]!;
    const patched = {
      ...existing,
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.condition_field === "string"
        ? { condition_field: body.condition_field }
        : {}),
      ...(typeof body.operator === "string" ? { operator: body.operator } : {}),
      ...(typeof body.condition_value === "string"
        ? { condition_value: body.condition_value }
        : {}),
      ...(body.canonical_category !== undefined
        ? { canonical_category: body.canonical_category as string | null }
        : {}),
      ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
      ...(typeof body.confidence === "number" ? { confidence: String(body.confidence) } : {}),
      updated_at: new Date().toISOString(),
    };
    rulesV2State[idx] = patched;
    return HttpResponse.json(patched, { status: 200 });
  }),

  http.post("*/api/treasury/classification-rules/:ruleId/toggle-active", ({ params }) => {
    const id = params.ruleId as string;
    const idx = rulesV2State.findIndex((r) => r.id === id);
    if (idx === -1) {
      return HttpResponse.json(errorBody("not_found", "Regla no encontrada."), { status: 404 });
    }
    const existing = rulesV2State[idx]!;
    const toggled = {
      ...existing,
      active: !existing.active,
      updated_at: new Date().toISOString(),
    };
    rulesV2State[idx] = toggled;
    return HttpResponse.json(toggled, { status: 200 });
  }),

  http.post("*/api/bank-movements/:movementId/suggest-rule", ({ params }) => {
    /* §18.7: read-only, no persiste. Sugerencia simple basada en el id
       del movimiento (en backend real usa la glosa del movimiento). */
    const movementId = params.movementId as string;
    return HttpResponse.json(
      {
        name: `Regla sugerida para ${movementId}`,
        source_type: "bank_movement",
        condition_field: "description",
        operator: "contains",
        condition_value: "PAGO PROV",
      },
      { status: 200 },
    );
  }),
];

/* ============================================================
   SII — Sprint C1. Backend tiene los 8 endpoints live en prod
   (verificado 2026-05-23). MSW reproduce el shape contractual y
   los casos canónicos: éxito, folio no encontrado (status='not_found'
   con HTTP 200), credencial ausente (412), validation (422). El
   PDF se sirve como `application/pdf` con un placeholder mínimo
   suficiente para que `<a href={url} download>` no rompa. */

const SII_F29_FIXTURE_FOLIO = 1234567890;

const siiHandlers = [
  http.get("*/api/sii/health", () =>
    HttpResponse.json(
      {
        status: "ok",
        reachable: true,
        rut_configured: true,
        cert_available: true,
        ambiente: "produccion",
        code: null,
        message: null,
        details: null,
        error: null,
      },
      { status: 200 },
    ),
  ),

  http.get("*/api/sii/f22/status", () =>
    HttpResponse.json(
      {
        source: "sii_f22",
        state: "unavailable",
        reason: "F22 (declaración anual) no implementado en Fase 1.",
        last_sync: null,
        display_name: "Declaración Anual de Renta (F22)",
        category: "tax",
      },
      { status: 200 },
    ),
  ),

  http.get("*/api/sii/f29/:folio", ({ params }) => {
    const folio = Number(params.folio);
    if (!Number.isFinite(folio) || folio <= 0) {
      return HttpResponse.json(errorBody("validation_error", "Folio inválido."), { status: 422 });
    }
    if (folio !== SII_F29_FIXTURE_FOLIO) {
      /* §C1-03: folio no encontrado devuelve HTTP 200 + status='not_found'.
         No es error visible — la UI muestra "Sin declaración para este folio". */
      return HttpResponse.json(
        {
          status: "not_found",
          folio,
          period: { year: 2026, month: 4 },
          rut_base: 76123456,
          estado: "sin_declaracion",
          fecha_presentacion: null,
          iva_debito_fiscal: null,
          iva_credito_fiscal: null,
          ppm: null,
          total_a_pagar: null,
          code: "folio_not_found",
          message: "El folio no corresponde a una declaración del período consultado.",
          details: null,
          error: null,
        },
        { status: 200 },
      );
    }
    return HttpResponse.json(
      {
        status: "ok",
        folio,
        period: { year: 2026, month: 4 },
        rut_base: 76123456,
        estado: "vigente",
        fecha_presentacion: "2026-05-12",
        iva_debito_fiscal: 4500000,
        iva_credito_fiscal: 3200000,
        ppm: 850000,
        total_a_pagar: 2150000,
        code: null,
        message: null,
        details: { codigos: { "538": 4500000, "511": 3200000, "563": 850000 } },
        error: null,
      },
      { status: 200 },
    );
  }),

  http.get("*/api/sii/f29/:folio/pdf", ({ params }) => {
    const folio = Number(params.folio);
    if (!Number.isFinite(folio) || folio <= 0) {
      return HttpResponse.json(errorBody("validation_error", "Folio inválido."), { status: 422 });
    }
    if (folio !== SII_F29_FIXTURE_FOLIO) {
      return new HttpResponse(null, { status: 404 });
    }
    /* Placeholder mínimo de un PDF (header válido + EOF) — suficiente para que
       el browser no falle al recibirlo. NO es un PDF renderizable. Tests
       solo validan el content-type y el status. */
    const pdfHeader = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
    return new HttpResponse(pdfHeader, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  }),

  http.get("*/api/sii/bhe", ({ request }) => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo");
    if (!periodo) {
      return HttpResponse.json(errorBody("validation_error", "Falta query `periodo`."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      {
        status: "ok",
        bhe: [
          {
            periodo,
            rut_emisor: "12345678-9",
            nombre_emisor: "Profesional Asesor 1",
            folio: 101,
            fecha_emision: "2026-04-15",
            monto_bruto: 1000000,
            retencion: 125000,
            monto_liquido: 875000,
          },
          {
            periodo,
            rut_emisor: "98765432-1",
            nombre_emisor: "Estudio Jurídico XYZ",
            folio: 202,
            fecha_emision: "2026-04-22",
            monto_bruto: 500000,
            retencion: 62500,
            monto_liquido: 437500,
          },
        ],
        count: 2,
        periodo,
        error: null,
      },
      { status: 200 },
    );
  }),

  http.get("*/api/sii/rcv/compras", ({ request }) => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo");
    if (!periodo) {
      return HttpResponse.json(errorBody("validation_error", "Falta query `periodo`."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      {
        status: "ok",
        compras: [
          {
            tipo_doc: 33,
            folio: 1001,
            fecha: "2026-04-03",
            rut_contraparte: "76555444-K",
            razon_social: "Proveedor SpA",
            monto_neto: 800000,
            monto_iva: 152000,
            monto_total: 952000,
          },
          {
            tipo_doc: 33,
            folio: 1002,
            fecha: "2026-04-18",
            rut_contraparte: "77123456-7",
            razon_social: "Insumos Chile Ltda",
            monto_neto: 1200000,
            monto_iva: 228000,
            monto_total: 1428000,
          },
        ],
        count: 2,
        periodo,
        error: null,
      },
      { status: 200 },
    );
  }),

  http.get("*/api/sii/rcv/ventas", ({ request }) => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo");
    if (!periodo) {
      return HttpResponse.json(errorBody("validation_error", "Falta query `periodo`."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      {
        status: "ok",
        ventas: [
          {
            tipo_doc: 33,
            folio: 5001,
            fecha: "2026-04-05",
            rut_contraparte: "78000111-K",
            razon_social: "Cliente A SA",
            monto_neto: 3000000,
            monto_iva: 570000,
            monto_total: 3570000,
          },
          {
            tipo_doc: 33,
            folio: 5002,
            fecha: "2026-04-25",
            rut_contraparte: "79222333-4",
            razon_social: "Cliente B Ltda",
            monto_neto: 2000000,
            monto_iva: 380000,
            monto_total: 2380000,
          },
        ],
        count: 2,
        periodo,
        error: null,
      },
      { status: 200 },
    );
  }),

  http.get("*/api/sii/dte-recibidos", ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    if (!desde || !hasta) {
      return HttpResponse.json(errorBody("validation_error", "Faltan query `desde` y/o `hasta`."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      {
        status: "ok",
        dte_recibidos: {
          titulo: "DTE Recibidos",
          url: "https://www4.sii.cl/.../consulta_dte_recibidos",
          /* Primera fila = headers (siempre, según contrato). */
          filas: [
            ["Ver", "Emisor", "Razón Social", "Documento", "Folio", "Fecha", "Monto", "Estado"],
            [
              "",
              "76555444-K",
              "Proveedor SpA",
              "Factura",
              "1001",
              "2026-04-03",
              "952.000",
              "Aceptado",
            ],
            [
              "",
              "77123456-7",
              "Insumos Chile Ltda",
              "Factura",
              "1002",
              "2026-04-18",
              "1.428.000",
              "Aceptado",
            ],
          ],
        },
        desde,
        hasta,
        error: null,
      },
      { status: 200 },
    );
  }),
];

/* Gestión — Resultado Operacional (Sprint C5, contrato FE-first). El endpoint
   real aún no existe en el backend (ver docs/backend-contracts/
   gestion-operational-result-contract.md). Fixture realista para dev/test;
   `period=2026-13` (inválido) → 404 para ejercitar el estado "sin datos". */
const operationalResultFixture = {
  period: "2026-05",
  revenue: "18500000",
  direct_cost: "7400000",
  gross_margin: "11100000",
  gross_margin_pct: "60.0",
  labor_cost: "4200000",
  professional_fees: "900000",
  recurring_expenses: "2100000",
  ebitda_proxy: "3900000",
  result: "3900000",
  variation: {
    vs_previous_month: { amount: "600000", pct: "18.2" },
    vs_same_month_last_year: { amount: "-300000", pct: "-7.1" },
  },
  drivers: [
    {
      direction: "improves",
      concept: "Ventas",
      impact: "1200000",
      explanation: "Más ventas que el mes anterior.",
    },
    {
      direction: "worsens",
      concept: "Sueldos",
      impact: "-500000",
      explanation: "Subió el gasto en remuneraciones.",
    },
  ],
  confidence: "high",
  data_state: "available",
  missing_sources: [],
  generated_at: "2026-06-01T12:00:00Z",
};

const gestionHandlers = [
  http.get("*/api/management/operational-result", ({ request }) => {
    const period = new URL(request.url).searchParams.get("period");
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      return HttpResponse.json(errorBody("not_found", "Sin datos para el período."), {
        status: 404,
      });
    }
    return HttpResponse.json(
      { ...operationalResultFixture, period: period ?? operationalResultFixture.period },
      { status: 200 },
    );
  }),
];

export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...credentialsHandlersV2,
  ...treasuryHandlers,
  ...managementHandlers,
  ...gestionHandlers,
  ...currenciesHandlers,
  ...classificationRulesHandlers,
  ...industryTemplatesHandlers,
  ...siiHandlers,
];
