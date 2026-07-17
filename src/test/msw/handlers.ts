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

/* Estado N:M multi-empresa (ADR-0049): empresas del usuario logueado. */
const meTenantsState: Array<{
  id: string;
  slug: string;
  legal_name: string;
  role: string;
  is_active: boolean;
}> = [
  {
    id: "t_tooxs",
    slug: "tooxs",
    legal_name: "Tooxs Digital SpA",
    role: "owner",
    is_active: true,
  },
  {
    // Presente pero inactivo: la vista/selector lo filtran (tapón MVP Tenant).
    id: "t_qavante_demo",
    slug: "qavante-demo",
    legal_name: "MVP Tenant",
    role: "owner",
    is_active: false,
  },
];

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
        company_rut: "76123456-0",
        last_login_at: "2026-05-13T08:00:00Z",
        permissions: ["users.read", "users.write"],
      },
    });
  }),

  /* N:M multi-empresa (ADR-0049): listar / crear / cambiar empresa activa. */
  http.get("*/api/me/tenants", () =>
    HttpResponse.json({ tenants: meTenantsState }, { status: 200 }),
  ),

  http.post("*/api/me/tenants", async ({ request }) => {
    const body = (await request.json()) as { legal_name?: string };
    if (!body?.legal_name) {
      return HttpResponse.json(errorBody("validation_error", "legal_name requerido."), {
        status: 422,
      });
    }
    const id = `t_new_${meTenantsState.length + 1}`;
    meTenantsState.push({
      id,
      slug: body.legal_name.toLowerCase().replace(/\s+/g, "-"),
      legal_name: body.legal_name,
      role: "owner",
      is_active: false,
    });
    return HttpResponse.json(
      { id, slug: id, legal_name: body.legal_name, role: "owner" },
      { status: 201 },
    );
  }),

  http.post("*/api/me/active-tenant", async ({ request }) => {
    const body = (await request.json()) as { tenant_id?: string };
    const target = meTenantsState.find((t) => t.id === body?.tenant_id);
    if (!target) {
      return HttpResponse.json(errorBody("forbidden", "No perteneces a esa empresa."), {
        status: 403,
      });
    }
    meTenantsState.forEach((t) => (t.is_active = t.id === target.id));
    return new HttpResponse(null, { status: 200, headers: { "Set-Cookie": SESSION_COOKIE } });
  }),

  /* Editar los datos de la empresa activa (PUT /api/admin/tenant). */
  http.put("*/api/admin/tenant", async ({ request }) => {
    const body = (await request.json()) as { legal_name?: string };
    const act = meTenantsState.find((t) => t.is_active);
    if (act && body?.legal_name) act.legal_name = body.legal_name;
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("*/api/onboarding/sync", () =>
    HttpResponse.json(
      { sources: { sii: { status: "ok" }, bank: { status: "ok" } } },
      { status: 200 },
    ),
  ),

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
        errorBody("last_owner_protection", "No puedes modificar al único owner activo del tenant."),
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
  /* Cuentas del tenant (CLP + USD) → alimenta el selector de cuenta de Caja
     (no mezclar monedas) y el formateo por moneda. Los ids matchean los
     `bank_account_id` de los movimientos del fixture (acct-1 / acct-2). */
  http.get("*/api/treasury/bank-accounts", () =>
    HttpResponse.json({
      items: [
        {
          id: "acct-1",
          name: "Cuenta Corriente",
          bank_name: "BICE",
          currency_code: "CLP",
          account_type: "checking",
        },
        {
          id: "acct-2",
          name: "Cuenta Internacional",
          bank_name: "BICE",
          currency_code: "USD",
          account_type: "checking",
        },
      ],
    }),
  ),
  /* Cuentas que trae BICE con su estado de vínculo. Una vinculada + una EN
     CUARENTENA (linked_bank_account_id null) → alimenta "Cuentas por vincular". */
  http.get("*/api/bank-movements/bice/accounts", () =>
    HttpResponse.json({
      accounts: [
        {
          external_id: "0001234567",
          name: "Cuenta Corriente",
          currency: "CLP",
          linked_bank_account_id: "acct-1",
        },
        {
          external_id: "0009876543",
          name: "Cuenta Internacional",
          currency: "USD",
          linked_bank_account_id: null,
        },
      ],
    }),
  ),
  http.post("*/api/treasury/bank-accounts", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: "acct-new",
        name: (body.account_name as string) ?? "Cuenta",
        bank_name: (body.bank_name as string) ?? "BICE",
        currency_code: (body.currency_code as string) ?? "CLP",
        account_type: (body.account_type as string) ?? "checking",
      },
      { status: 201 },
    );
  }),
  http.post("*/api/bank-movements/bice/accounts/:externalId/link", ({ params }) =>
    HttpResponse.json({
      external_id: String(params.externalId),
      linked_bank_account_id: "acct-new",
    }),
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
  /* Aplica reglas activas a los sin clasificar (batch #545). Devuelve el
     resumen evaluados/clasificados/sin_regla. */
  http.post("*/api/treasury/bank-movements/apply-rules", () =>
    HttpResponse.json({ evaluados: 12, clasificados: 5, sin_regla: 7 }, { status: 200 }),
  ),
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
let biceConnected = false;
let siiConsentAccepted = false;
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

  /* Consentimiento de fuente (Tooxs360). Estado mínimo en memoria. */
  http.get("*/api/admin/sources/:code/consent", ({ params }) =>
    siiConsentAccepted
      ? HttpResponse.json(
          {
            id: "consent-1",
            tenant_id: "t_qavante_demo",
            source_code: params.code,
            consent_text: "Autorizo a Qavante a acceder al SII en nombre de mi empresa.",
            consent_version: "v1",
            accepted_at: "2026-06-28T12:00:00Z",
            expires_at: "2027-06-28T12:00:00Z",
            is_valid: true,
            days_to_expiry: 365,
          },
          { status: 200 },
        )
      : HttpResponse.json(
          {
            source_code: params.code,
            is_valid: false,
            consent_text_offered:
              "Autorizo a Qavante a acceder al Servicio de Impuestos Internos (SII) en nombre de mi empresa, en modo solo lectura, para traer mis documentos tributarios.",
            consent_version_offered: "v1",
          },
          { status: 200 },
        ),
  ),

  http.post("*/api/admin/sources/:code/consent", ({ params }) => {
    siiConsentAccepted = true;
    return HttpResponse.json(
      { status: "ok", consent: { source_code: params.code, is_valid: true } },
      { status: 201 },
    );
  }),

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

  /* Conexión bancaria BICE (Administración → Credenciales + paso de onboarding). */
  http.get("*/api/credentials/bice", () =>
    HttpResponse.json({ provider: "bice", connected: biceConnected }, { status: 200 }),
  ),

  http.put("*/api/credentials/bice", async ({ request }) => {
    const body = (await request.json()) as { rut?: string; password?: string };
    if (!body?.rut || !body?.password) {
      return HttpResponse.json(errorBody("validation_error", "rut y password son requeridos."), {
        status: 422,
      });
    }
    biceConnected = true;
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("*/api/bank-movements/bice/sync", () =>
    HttpResponse.json({ started: true, synced: 0 }, { status: 200 }),
  ),

  http.post("*/api/bank-movements/bice/cards/sync", () =>
    HttpResponse.json({ started: true, synced: 0 }, { status: 200 }),
  ),

  /* Importar cartola de tarjeta (PDF) → resumen de lo extraído. */
  http.post("*/api/treasury/card-statements/import", async ({ request }) => {
    const form = await request.formData();
    if (!form.get("file")) {
      return HttpResponse.json(errorBody("validation_error", "Falta el archivo."), { status: 422 });
    }
    return HttpResponse.json(
      {
        type: "international",
        needs_review: 2,
        purchases_upserted: 7,
        charges_detected: 1,
        payment_detected: "350000",
        deuda_total_usd: "1240.50",
        pagar_hasta: "2026-07-05",
      },
      { status: 200 },
    );
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
  http.post("*/api/sii/sync-rcv", () =>
    HttpResponse.json({ status: "ok", periodo: "2026-05" }, { status: 200 }),
  ),

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

  /* Situación tributaria por RUT (autocompletar razón social al agregar empresa). */
  http.get("*/api/sii/contribuyente/:rut", ({ params }) => {
    const rut = String(params.rut);
    if (rut === "76123456-0") {
      return HttpResponse.json({
        status: "ok",
        rut,
        razon_social: "EMPRESA DEMO SPA",
        giro: "Servicios de tecnología",
        actividades: [],
        inicio_actividades: "2023-03-01",
      });
    }
    return HttpResponse.json({ status: "not_found", rut, razon_social: null }, { status: 200 });
  }),

  /* Sync F29 — enumera + persiste los F29 del año (incremental). */
  http.post("*/api/sii/f29/sync", ({ request }) => {
    const anio = Number(new URL(request.url).searchParams.get("anio")) || 2026;
    return HttpResponse.json(
      {
        status: "ok",
        anio,
        folios_encontrados: 8,
        ya_persistidos: 3,
        persistidos_nuevos: 5,
        errores: 0,
      },
      { status: 200 },
    );
  }),

  /* Panel F29 — estado por año (debe ir ANTES de `/f29/:folio` o lo captura). */
  http.get("*/api/sii/f29/estado", ({ request }) => {
    const anio = Number(new URL(request.url).searchParams.get("anio")) || 2026;
    const curYear = 2026;
    const curMonth = 5; // mayo (fixture determinista)
    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const periodo = `${anio}-${String(mes).padStart(2, "0")}`;
      let estado: string;
      if (anio > curYear || (anio === curYear && mes > curMonth)) estado = "sin_periodo";
      else if (anio === curYear && mes === curMonth) estado = "en_curso";
      else if (anio === curYear && mes === curMonth - 1) estado = "por_declarar";
      else if (anio === 2026 && mes === 3) estado = "no_declarado_vencido";
      else if (anio < curYear - 1)
        estado = "sin_dato"; // años viejos sin sincronizar
      else estado = "declarado";
      const declarado = estado === "declarado";
      return {
        mes,
        periodo,
        estado,
        declarado,
        folio: declarado ? 6000 + anio * 12 + mes : null,
        saldo: declarado ? (mes % 4 === 0 ? null : mes * 10000) : null,
        remanente: declarado ? 0 : null,
        vencimiento: `${anio}-${String(mes).padStart(2, "0")}-12`,
      };
    });
    return HttpResponse.json({ status: "ok", anio, meses, count: meses.length }, { status: 200 });
  }),

  /* Estado de pago/postergación de un período (Consulta de Giros). Antes de :folio. */
  http.get("*/api/sii/f29/giros", ({ request }) => {
    const mes = Number(new URL(request.url).searchParams.get("mes")) || 1;
    const postergado = mes % 2 === 0; // par → postergado; impar → pagado
    return HttpResponse.json({
      status: "ok",
      periodo: `2026-${String(mes).padStart(2, "0")}`,
      tiene_giros: postergado,
      estado: postergado ? "postergado" : "sin_giro",
      postergado_iva: postergado,
      iva_postergado: postergado ? 400000 : null,
      vencimiento_postergado: postergado ? "2026-08-12" : null,
      multiples_giros: false,
    });
  }),

  /* Detalle F29 de un mes — con/sin IVA + impuesto trabajadores. */
  http.get("*/api/sii/f29/impuesto", ({ request }) => {
    const url = new URL(request.url);
    const manual = url.searchParams.get("impuesto_trabajadores");
    const impuesto = manual != null ? Number(manual) : 0;
    const fuente = manual != null ? "manual" : "no_disponible";
    const ivaDeb = 1_200_000;
    const ivaCred = 800_000;
    const ivaDet = ivaDeb - ivaCred; // 400.000
    const ppm = 150_000;
    return HttpResponse.json(
      {
        status: "ok",
        periodo: `${url.searchParams.get("anio")}-${String(url.searchParams.get("mes")).padStart(2, "0")}`,
        declarado: true,
        folio: 6123,
        iva_debito: ivaDeb,
        iva_credito: ivaCred,
        remanente: 0,
        ppm,
        impuesto_trabajadores: impuesto,
        fuente_impuesto_trabajadores: fuente,
        iva_determinado: ivaDet,
        iva_postergable: ivaDet,
        total_con_iva: ivaDet + ppm + impuesto,
        total_sin_iva: ppm + impuesto,
      },
      { status: 200 },
    );
  }),

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

/* Cobrar — cuentas por cobrar (Sprint C4, contrato FE-first). Endpoint real
   aún no existe (ver docs/backend-contracts/cobrar-accounts-receivable-contract.md). */
const accountsReceivableFixture = {
  total: "24800000",
  overdue: "7900000",
  overdue_pct: "31.9",
  aging: {
    current: "16900000",
    d1_30: "3200000",
    d31_60: "2100000",
    d61_90: "1400000",
    d90_plus: "1200000",
  },
  top_debtors: [
    { name: "Constructora Andes SpA", rut: "76.123.456-7", total: "9800000", overdue: "3200000" },
    { name: "Comercial del Sur Ltda", rut: "77.987.654-3", total: "6100000", overdue: "2400000" },
    { name: "Minera Atacama SA", rut: "96.555.444-2", total: "4300000", overdue: "1100000" },
  ],
  overdue_documents: [
    {
      client_name: "Constructora Andes SpA",
      client_rut: "76.123.456-7",
      document: "Factura 1234",
      due_date: "2026-05-10",
      amount: "3200000",
      balance: "3200000",
      days_overdue: 23,
    },
    {
      client_name: "Comercial del Sur Ltda",
      client_rut: "77.987.654-3",
      document: "Factura 5678",
      due_date: "2026-05-18",
      amount: "2400000",
      balance: "2400000",
      days_overdue: 15,
    },
    {
      client_name: "Minera Atacama SA",
      client_rut: "96.555.444-2",
      document: "Factura 9012",
      due_date: "2026-05-25",
      amount: "1100000",
      balance: "800000",
      days_overdue: 8,
    },
  ],
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const cobranzaHandlers = [
  http.get("*/api/treasury/accounts-receivable", () =>
    HttpResponse.json(accountsReceivableFixture, { status: 200 }),
  ),
];

/* Pagar — cuentas por pagar (Sprint C4, contrato FE-first). Endpoint real aún
   no existe (ver docs/backend-contracts/pagar-accounts-payable-contract.md). */
const accountsPayableFixture = {
  total: "12600000",
  due_7d: "3800000",
  due_14d: "6200000",
  due_30d: "9100000",
  items: [
    {
      label: "IVA / F29 mayo",
      category: "tax",
      due_date: "2026-06-12",
      amount: "2400000",
      criticality: "high",
      source: "SII",
    },
    {
      label: "Sueldos junio",
      category: "payroll",
      due_date: "2026-06-30",
      amount: "4200000",
      criticality: "high",
      source: "Previred",
      source_external_id: "payroll-202606",
    },
    {
      label: "Proveedor Telefónica",
      category: "supplier",
      due_date: "2026-06-18",
      amount: "890000",
      criticality: "medium",
      source: "SII",
    },
    {
      label: "Arriendo bodega",
      category: "rent",
      due_date: "2026-06-05",
      amount: "1300000",
      criticality: "medium",
      source: "Manual",
    },
    {
      label: "Leasing camioneta",
      category: "leasing",
      due_date: "2026-06-22",
      amount: "640000",
      criticality: "low",
      source: "Manual",
    },
  ],
  projected_cash_14d: "5400000",
  covers_critical: false,
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const pagosHandlers = [
  http.get("*/api/treasury/accounts-payable", () =>
    HttpResponse.json(accountsPayableFixture, { status: 200 }),
  ),
];

/* Obligaciones / Préstamos (Tesorería). Seed con 1 préstamo + calendario. */
const obligationsSeed = [
  {
    id: "obl-1",
    type: "loan",
    counterparty: "Banco BICE",
    principal_total: "12000000",
    annual_rate: "0.18",
    currency_code: "CLP",
    origination_date: "2026-01-15",
    installments_total: 12,
    status: "active",
    needs_review: false,
    pending_count: 9,
    next_due_date: "2026-07-15",
    outstanding_total: "9100000",
  },
  {
    id: "obl-2",
    type: "loan",
    counterparty: "Leasing Andes",
    principal_total: "4500000",
    annual_rate: "0.22",
    currency_code: "CLP",
    origination_date: "2025-09-01",
    installments_total: 18,
    status: "active",
    needs_review: true,
    pending_count: 11,
    next_due_date: "2026-07-01",
    outstanding_total: "2750000",
  },
];

function loanSchedule(principal: number, monthlyRate: number, n: number, firstDue: string) {
  const cuota =
    monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -n);
  const parts = firstDue.split("-").map(Number);
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  let saldo = principal;
  const items = [];
  for (let i = 0; i < n; i++) {
    const interest = saldo * monthlyRate;
    const principalAmt = cuota - interest;
    saldo -= principalAmt;
    const due = new Date(Date.UTC(y, m - 1 + i, 1));
    items.push({
      number: i + 1,
      due_date: due.toISOString().slice(0, 10),
      principal_amount: principalAmt.toFixed(0),
      interest_amount: interest.toFixed(0),
      total_amount: cuota.toFixed(0),
      status: i < 3 ? "paid" : "pending",
    });
  }
  return items;
}

const obligationsHandlers = [
  http.get("*/api/treasury/obligations", () =>
    HttpResponse.json({ items: obligationsSeed }, { status: 200 }),
  ),

  http.get("*/api/treasury/obligations/:id", ({ params }) => {
    const o = obligationsSeed.find((x) => x.id === params.id) ?? obligationsSeed[0]!;
    return HttpResponse.json(
      {
        obligation: o,
        installments: loanSchedule(
          Number(o.principal_total),
          0.015,
          o.installments_total,
          o.origination_date,
        ),
      },
      { status: 200 },
    );
  }),

  http.post("*/api/treasury/obligations", async ({ request }) => {
    const b = (await request.json()) as {
      counterparty?: string;
      principal?: string | number;
      monthly_rate?: string | number;
      installments?: number;
      first_due_date?: string;
      currency_code?: string;
    };
    if (!b?.counterparty || !b?.principal || !b?.installments || !b?.first_due_date) {
      return HttpResponse.json(errorBody("validation_error", "Faltan datos del préstamo."), {
        status: 422,
      });
    }
    const principal = Number(b.principal);
    const rate = Number(b.monthly_rate ?? 0);
    const header = {
      id: "obl-new",
      type: "loan",
      counterparty: b.counterparty,
      principal_total: String(principal),
      annual_rate: String(rate * 12),
      currency_code: b.currency_code ?? "CLP",
      origination_date: b.first_due_date,
      installments_total: b.installments,
      status: "active",
      needs_review: false,
    };
    return HttpResponse.json(
      {
        obligation: header,
        installments: loanSchedule(principal, rate, b.installments, b.first_due_date),
      },
      { status: 201 },
    );
  }),

  http.post("*/api/treasury/obligations/reconcile", () =>
    HttpResponse.json({ reconciled: 2 }, { status: 200 }),
  ),

  /* Compras al extranjero (de la cartola). Lista + clasificar. */
  http.get("*/api/treasury/foreign-purchases", () =>
    HttpResponse.json(
      {
        items: [
          {
            id: "fp-1",
            merchant: "OpenAI LLC",
            op_date: "2026-06-12",
            country: "Estados Unidos",
            amount_usd: "20.00",
            clp_operative: "19200",
            currency_origin: "USD",
            status: "pending",
            needs_review: true,
          },
          {
            id: "fp-2",
            merchant: "Amazon Web Services",
            op_date: "2026-06-10",
            country: "Estados Unidos",
            amount_usd: "143.20",
            clp_operative: "137500",
            currency_origin: "USD",
            status: "classified",
            needs_review: false,
            concept: "Hosting",
            category: "Gastos operativos",
          },
        ],
      },
      { status: 200 },
    ),
  ),

  http.post("*/api/treasury/foreign-purchases/:id/classify", async ({ request }) => {
    const b = (await request.json()) as { concept?: string; category?: string };
    if (!b?.concept || !b?.category) {
      return HttpResponse.json(errorBody("validation_error", "Falta concepto/categoría."), {
        status: 422,
      });
    }
    return HttpResponse.json({ status: "ok" }, { status: 200 });
  }),
];

/* Inicio Ejecutivo — dashboard summary (Sprint C8, contrato FE-first). Endpoint
   real aún no existe (ver docs/backend-contracts/inicio-dashboard-summary-contract.md). */
const dashboardSummaryFixture = {
  executive_phrase:
    "Tu caja alcanza ~6 semanas; hay $7,9M vencidos por cobrar y un pago crítico esta semana.",
  pulso: {
    score: 68,
    status: "stable",
    confidence: "medium",
    top_driver_positive: "Ventas en alza vs. mes anterior",
    top_driver_negative: "Cobranza más lenta de lo normal",
    preliminary: false,
  },
  cash_today: { total: "9800000", last_updated: "2026-06-02T08:00:00Z", data_state: "available" },
  cash_forecast: {
    min_14d: "5400000",
    min_30d: "2100000",
    days_of_cash: 42,
    last_updated: "2026-06-02T08:00:00Z",
    source: "banco",
  },
  cash_gap: {
    critical_obligations_14d: "6600000",
    projected_cash_14d: "5400000",
    has_gap: true,
    last_updated: "2026-06-02T08:00:00Z",
    source: "banco",
  },
  overdue_collections: {
    total_receivable: "24800000",
    overdue: "7900000",
    top_clients: [
      { name: "Constructora Andes SpA", amount: "3200000" },
      { name: "Comercial del Sur Ltda", amount: "2400000" },
      { name: "Minera Atacama SA", amount: "1100000" },
    ],
    last_updated: "2026-06-02T08:00:00Z",
    source: "sii_rcv",
  },
  critical_payments: {
    due_7d: "3800000",
    due_14d: "6200000",
    next_critical: { label: "IVA / F29 mayo", due_date: "2026-06-12", amount: "2400000" },
    last_updated: "2026-06-02T08:00:00Z",
    source: "sii_rcv",
  },
  operational_result: {
    revenue: "18500000",
    gross_margin: "11100000",
    ebitda_proxy: "3900000",
    result: "3900000",
    last_updated: "2026-06-02T08:00:00Z",
    source: "sii_rcv",
  },
  priority_actions: [
    {
      priority: 1,
      reason: "Cobra $3,2M vencidos a Constructora Andes",
      deadline: "esta semana",
      cta_label: "Ver cobranza",
      cta_href: "/cobrar",
      amount: "3200000",
      impact_label: "vencido por cobrar",
    },
    {
      priority: 2,
      reason: "IVA / F29 vence el 12 — asegura la caja",
      deadline: "12 jun",
      cta_label: "Ver pagos",
      cta_href: "/pagar",
      amount: "1850000",
      impact_label: "a pagar",
    },
    {
      priority: 3,
      reason: "Tienes 12 movimientos sin clasificar",
      deadline: null,
      cta_label: "Clasificar",
      cta_href: "/caja/por-clasificar",
      amount: null,
      impact_label: null,
    },
  ],
  generated_at: "2026-06-02T12:00:00Z",
};

const dashboardHandlers = [
  http.get("*/api/dashboard/summary", () =>
    HttpResponse.json(dashboardSummaryFixture, { status: 200 }),
  ),
];

/* Pulso detalle (Sprint C6/C7, contrato FE-first). Endpoint real aún no existe
   (ver docs/backend-contracts/pulso-detail-contract.md). */
const pulsoDetailFixture = {
  score: 68,
  status: "stable",
  confidence: "medium",
  preliminary: false,
  headline: "Tu Pulso está estable: la rentabilidad ayuda, pero la cobranza más lenta lo frena.",
  components: [
    { key: "liquidity", label: "Liquidez", score: 72, weight: 0.3 },
    { key: "profitability", label: "Rentabilidad", score: 81, weight: 0.3 },
    { key: "collections", label: "Cobranza", score: 48, weight: 0.25 },
    { key: "debt", label: "Endeudamiento", score: 65, weight: 0.15 },
  ],
  drivers: [
    {
      label: "Margen en alza",
      direction: "positive",
      impact: "high",
      detail: "El margen bruto subió 4 pts vs. el mes anterior.",
      cta_label: "Ver resultado",
      cta_href: "/gestion",
    },
    {
      label: "Caja con colchón",
      direction: "positive",
      impact: "medium",
      detail: "La caja proyectada cubre las obligaciones críticas de 14 días.",
      cta_label: null,
      cta_href: null,
    },
    {
      label: "Cobranza lenta",
      direction: "negative",
      impact: "high",
      detail: "Hay $7,9M vencidos; el plazo promedio de cobro subió a 52 días.",
      cta_label: "Ver cobranza",
      cta_href: "/cobrar",
    },
    {
      label: "Pago crítico esta semana",
      direction: "negative",
      impact: "medium",
      detail: "IVA / F29 vence el 12 — asegura la caja.",
      cta_label: "Ver pagos",
      cta_href: "/pagar",
    },
  ],
  trend: [
    { period: "ene", score: 61 },
    { period: "feb", score: 58 },
    { period: "mar", score: 64 },
    { period: "abr", score: 66 },
    { period: "may", score: 68 },
  ],
  generated_at: "2026-06-03T12:00:00Z",
};

const pulsoHandlers = [
  http.get("*/api/management/pulso", () => HttpResponse.json(pulsoDetailFixture, { status: 200 })),
];

/* Asistente Qavante — chat (Sprint C9, contrato FE-first; wire format ADR-0004).
   Endpoint real aún no existe. Devuelve SOLO content + tools_used + sources (el
   FE ignora cualquier otra clave, incluido `reasoning`). */
const assistantHandlers = [
  http.post("*/api/assistant/chat", () =>
    HttpResponse.json(
      {
        content:
          "Tu caja proyectada para los próximos 14 días es de $5,4M y cubre las obligaciones críticas. " +
          "Tienes $7,9M en cobranzas vencidas — apretar esa cobranza es lo que más mueve tu Pulso.",
        reasoning: "internal trace omitted from client response",
        tools_used: ["caja", "cobranza", "pulso"],
        sources: [
          { type: "screen", url: "/caja/proyeccion", label: "Caja proyectada" },
          { type: "screen", url: "/cobrar", label: "Cobranza" },
        ],
      },
      { status: 200 },
    ),
  ),
];

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
  /* Reporte de RANGO (buckets mensuales + total). Deriva los meses entre
     period_from y period_to. */
  http.get("*/api/treasury/reports/operational-result", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("period_from") ?? "2026-05";
    const to = url.searchParams.get("period_to") ?? "2026-07";
    const months: string[] = [];
    let [y, m] = from.split("-").map(Number) as [number, number];
    const [ty, tm] = to.split("-").map(Number) as [number, number];
    while ((y < ty || (y === ty && m <= tm)) && months.length < 36) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      if (++m > 12) {
        m = 1;
        y += 1;
      }
    }
    const buckets = months.map((period, i) => ({
      period,
      revenue: String(8000000 + i * 500000),
      cogs: "2000000",
      gross_margin: String(6000000 + i * 500000),
      gasto: "3000000",
      ebitda_proxy: String(3000000 + i * 500000),
      result: String(3000000 + i * 500000),
    }));
    const sum = (k: "revenue" | "cogs" | "gross_margin" | "gasto" | "ebitda_proxy" | "result") =>
      String(buckets.reduce((a, b) => a + Number(b[k]), 0));
    return HttpResponse.json(
      {
        period_from: from,
        period_to: to,
        buckets,
        grand_total: {
          revenue: sum("revenue"),
          cogs: sum("cogs"),
          gross_margin: sum("gross_margin"),
          gasto: sum("gasto"),
          ebitda_proxy: sum("ebitda_proxy"),
          result: sum("result"),
        },
      },
      { status: 200 },
    );
  }),
  /* Estado de Resultados mensualizado (árbol, estilo Chipax). Deriva los meses
     del rango y arma un árbol Ingresos/Costos/Margen con hijos. */
  http.get("*/api/management/operational-result/breakdown", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("period_from") ?? "2026-05";
    const to = url.searchParams.get("period_to") ?? "2026-07";
    const months: string[] = [];
    let [y, m] = from.split("-").map(Number) as [number, number];
    const [ty, tm] = to.split("-").map(Number) as [number, number];
    while ((y < ty || (y === ty && m <= tm)) && months.length < 36) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      if (++m > 12) {
        m = 1;
        y += 1;
      }
    }
    const fill = (base: number) => months.map((_, i) => String(base + i * 100000));
    const sumArr = (arr: string[]) => String(arr.reduce((a, b) => a + Number(b), 0));
    const proyectos = fill(15000000);
    const servicio = fill(6000000);
    const sueldos = months.map((_, i) => String(-7000000 - i * 100000));
    const ingresos = months.map((_, i) => String(Number(proyectos[i]) + Number(servicio[i])));
    const margen = months.map((_, i) => String(Number(ingresos[i]) + Number(sueldos[i])));
    const gastos = months.map((_, i) => String(-3000000 - i * 50000));
    const resultado = months.map((_, i) => String(Number(margen[i]) + Number(gastos[i])));
    const pctBy = (arr: string[]) =>
      months.map((_, i) => (Number(ingresos[i]) > 0 ? ((Number(arr[i]) / Number(ingresos[i])) * 100).toFixed(1) : "0"));
    return HttpResponse.json(
      {
        generated_at: "2026-07-11T12:00:00Z",
        period_from: from,
        period_to: to,
        mode: url.searchParams.get("mode") ?? "por_cuenta",
        months,
        proforma_month: months[months.length - 1] ?? null,
        rows: [
          {
            kind: "section",
            key: "income",
            label: "Total Ingresos",
            by_month: ingresos,
            total: sumArr(ingresos),
            children: [
              { kind: "account", key: "proyectos", label: "Proyectos", by_month: proyectos, total: sumArr(proyectos) },
              { kind: "account", key: "servicio", label: "Servicio Mensual", by_month: servicio, total: sumArr(servicio) },
            ],
          },
          {
            kind: "section",
            key: "costs",
            label: "Total Costos",
            by_month: sueldos,
            total: sumArr(sueldos),
            children: [
              { kind: "account", key: "sueldos", label: "Sueldos", by_month: sueldos, total: sumArr(sueldos) },
            ],
          },
          {
            kind: "subtotal",
            key: "gross_margin",
            label: "Margen Bruto",
            by_month: margen,
            total: sumArr(margen),
            pct_total: "60.0",
            pct_by_month: pctBy(margen),
          },
          {
            kind: "section",
            key: "opex",
            label: "Gastos operacionales",
            by_month: gastos,
            total: sumArr(gastos),
            children: [
              { kind: "account", key: "recurrentes", label: "Gastos recurrentes", by_month: gastos, total: sumArr(gastos) },
            ],
          },
          {
            kind: "subtotal",
            key: "operational_result",
            label: "Resultado Operacional",
            by_month: resultado,
            total: sumArr(resultado),
            pct_total: ((Number(sumArr(resultado)) / Number(sumArr(ingresos))) * 100).toFixed(1),
            pct_by_month: pctBy(resultado),
          },
        ],
      },
      { status: 200 },
    );
  }),
];

/* Estado de las fuentes (indicador de sync del header). Seed con fuentes mixtas. */
const sourcesStatusHandlers = [
  http.get("*/api/sources/status", () =>
    HttpResponse.json(
      {
        sources: [
          {
            source: "sii_rcv",
            display_name: "SII",
            category: "tax",
            state: "ok",
            last_sync: "2026-06-27T12:30:00Z",
          },
          {
            source: "bice",
            display_name: "Banco BICE",
            category: "bank",
            state: "ok",
            last_sync: "2026-06-27T13:05:00Z",
          },
          {
            source: "tgr",
            display_name: "Tesorería (TGR)",
            category: "tax",
            state: "stale",
            last_sync: "2026-06-20T09:00:00Z",
            reason: "Última sincronización hace más de 5 días.",
          },
          {
            source: "direccion_trabajo",
            display_name: "Dirección del Trabajo",
            category: "labor",
            state: "missing",
            reason: "No conectada.",
          },
        ],
        count: 4,
      },
      { status: 200 },
    ),
  ),
];

/* BUK / Remuneraciones (ADR-0056). Dotación slim + planilla agregada + payday +
   sync a Pagar. Sin `detalle` por empleado (contrato futuro) → Conciliación/
   planilla-por-empleado muestran su estado "en preparación". */
const bukHandlers = [
  http.get("*/api/buk/health", () =>
    HttpResponse.json({ status: "ok", mode: "starter", reachable: true }, { status: 200 }),
  ),
  http.get("*/api/buk/employees", () =>
    HttpResponse.json(
      {
        status: "ok",
        count: 3,
        employees: [
          {
            id: 1,
            full_name: "Ana Pérez Soto",
            rut: "12.345.678-9",
            email: "ana@empresa.cl",
            gender: "F",
            role: "Analista de Finanzas",
            status: "activo",
          },
          {
            id: 2,
            full_name: "Benjamín Rojas Díaz",
            rut: "9.876.543-2",
            email: "benjamin@empresa.cl",
            gender: "M",
            role: "Jefe de Operaciones",
            status: "activo",
          },
          {
            id: 3,
            full_name: "Carla Muñoz Vera",
            rut: "15.111.222-3",
            email: "carla@empresa.cl",
            gender: "F",
            role: "Contadora",
            status: "activo",
          },
        ],
      },
      { status: 200 },
    ),
  ),
  http.get("*/api/buk/payroll", () =>
    HttpResponse.json(
      {
        status: "ok",
        period: "2026-06",
        totales: {
          total_haberes: 18450000,
          total_descuentos: 4120000,
          total_liquido: 14330000,
          total_imponible: 16800000,
          // Desembolsos que acompañan a la planilla (contrato FE-first, ADR pendiente CC-API):
          total_impuesto: 620000, // impuesto de remuneraciones a enterar en el F29
          total_previred: 3510000, // cotizaciones previsionales (Previred)
          empleados_contados: 3,
        },
      },
      { status: 200 },
    ),
  ),
  http.get("*/api/buk/payroll/detail", () =>
    HttpResponse.json(
      {
        status: "ok",
        period: "2026-06",
        empleados: [
          { employee_id: 1, nombre: "Ana Pérez Soto", rut: "12.345.678-9", liquido: 5000000 },
          { employee_id: 2, nombre: "Benjamín Rojas Díaz", rut: "9.876.543-2", liquido: 5000000 },
          { employee_id: 3, nombre: "Carla Muñoz Vera", rut: "15.111.222-3", liquido: 4330000 },
        ],
      },
      { status: 200 },
    ),
  ),
  http.post("*/api/buk/sync-payroll", () =>
    HttpResponse.json(
      { status: "ok", period: "2026-06", total_liquido: 14330000 },
      { status: 200 },
    ),
  ),
  http.get("*/api/treasury/payroll-payday", () =>
    HttpResponse.json({ payday_day: null, effective_rule: "último día hábil" }, { status: 200 }),
  ),
  http.put("*/api/treasury/payroll-payday", () =>
    HttpResponse.json({ payday_day: null, effective_rule: "último día hábil" }, { status: 200 }),
  ),
];

/* Caja v2 — reporte de caja (buckets semanales) + caja mínima. Contrato ya vivo en prod
   (cashFlowReport ON); acá permite que la vista Caja v2 (cajaV2 ON en e2e) renderee la curva
   derivada + el saldo por período contra datos realistas. Ver caja-v2-map / caja-v2-resumen-live. */
const cashFlowReportFixture = {
  period_from: "2026-07",
  period_to: "2026-08",
  granularity: "week",
  financial_layer: "committed",
  group_by: "none",
  currency: "functional",
  currency_code: "CLP",
  buckets: [
    { period: "2026-07-14", total_inflow: "1600000", total_outflow: "2400000", net: "-800000", row_count: 6 },
    { period: "2026-07-21", total_inflow: "500000", total_outflow: "1900000", net: "-1400000", row_count: 4 },
    { period: "2026-07-28", total_inflow: "3200000", total_outflow: "1100000", net: "2100000", row_count: 7 },
    { period: "2026-08-04", total_inflow: "800000", total_outflow: "2600000", net: "-1800000", row_count: 5 },
  ],
  grand_total: { inflow: "6100000", outflow: "8000000", net: "-1900000", row_count: 22 },
  excluded_attention: 0,
};

const cashMinimumFixture = {
  thresholds: [{ currency_code: "CLP", amount: "3000000", updated_at: "2026-07-01T00:00:00Z" }],
};

const cajaV2Handlers = [
  http.get("*/api/treasury/reports/cash-flow", () => HttpResponse.json(cashFlowReportFixture, { status: 200 })),
  http.get("*/api/treasury/cash-minimum", () => HttpResponse.json(cashMinimumFixture, { status: 200 })),
];

/* Cola de conciliación (ADR-0036/0042). Handlers DETERMINISTAS a propósito: `review` devuelve
   siempre el mismo seed y las mutaciones responden éxito sin mutar la cola. Así el e2e no depende
   de estado que se filtre entre tests ni entre retries (MSW en browser no se resetea por test). */
const reconciliationReviewSeed = [
  {
    movement_id: "rec-mv-1",
    date: "2026-07-12",
    amount: "1250000",
    description: "TRANSFERENCIA RECIBIDA COMERCIAL LOS ANDES",
    suggestion: {
      document_kind: "receivable",
      document_id: "r1",
      name: "Comercial Los Andes SpA",
      score: "86",
    },
  },
  {
    movement_id: "rec-mv-2",
    date: "2026-07-11",
    amount: "340000",
    description: "PAGO PROVEEDOR",
    suggestion: {
      document_kind: "payable",
      document_id: "p1",
      name: "Distribuidora del Sur Ltda",
      score: "72",
    },
  },
  {
    movement_id: "rec-mv-3",
    date: "2026-07-10",
    amount: "89900",
    description: "CARGO PAC",
    suggestion: { document_kind: "payable", document_id: null, name: null, score: "64" },
  },
];

const reconciliationHandlers = [
  http.get("*/api/treasury/reconciliation/review", () =>
    HttpResponse.json(
      { items: reconciliationReviewSeed, count: reconciliationReviewSeed.length },
      { status: 200 },
    ),
  ),
  http.get("*/api/treasury/reconciliation/:movementId/suggestions", ({ params }) =>
    HttpResponse.json(
      {
        movement_id: params.movementId,
        suggestions: [
          { rut: "76123456-0", name: "Comercial Los Andes SpA", score: "86" },
          { rut: "77987654-3", name: "Los Andes Retail Ltda", score: "61" },
        ],
      },
      { status: 200 },
    ),
  ),
  http.post("*/api/treasury/reconciliation/:movementId/confirm", ({ params }) =>
    HttpResponse.json({ movement_id: params.movementId, status: "confirmed" }, { status: 200 }),
  ),
  http.post("*/api/treasury/reconciliation/:movementId/reject", ({ params }) =>
    HttpResponse.json({ movement_id: params.movementId, status: "rejected" }, { status: 200 }),
  ),
  http.post("*/api/treasury/reconciliation/confirm-batch", async ({ request }) => {
    const body = (await request.json()) as { movement_ids: string[] };
    const ids = body.movement_ids ?? [];
    return HttpResponse.json(
      {
        confirmed: ids.length,
        failed: 0,
        results: ids.map((id) => ({ movement_id: id, status: "confirmed" })),
      },
      { status: 200 },
    );
  }),
];

export const handlers = [
  ...authHandlers,
  ...cajaV2Handlers,
  ...reconciliationHandlers,
  ...bukHandlers,
  ...sourcesStatusHandlers,
  ...usersHandlers,
  ...credentialsHandlersV2,
  ...treasuryHandlers,
  ...obligationsHandlers,
  ...managementHandlers,
  ...gestionHandlers,
  ...cobranzaHandlers,
  ...pagosHandlers,
  ...dashboardHandlers,
  ...pulsoHandlers,
  ...assistantHandlers,
  ...currenciesHandlers,
  ...classificationRulesHandlers,
  ...industryTemplatesHandlers,
  ...siiHandlers,
];
