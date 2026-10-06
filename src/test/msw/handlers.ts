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
import {
  evaluationV13,
  overviewCompletoV13,
} from "@/components/financiamiento/v13/financiamiento-v13-fixtures";
import { simulationReadyV14 } from "@/components/simular/v14/simulador-v14-fixtures";
import type { SimulationEvaluateRequest } from "@/lib/api/simulations";
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
import { DECISION_BRIEF_E2E_FIXTURE } from "./decision-brief-fixture";
import { SEED_SESSION_USER } from "./fixtures";
import { cashProjectionRunHandlers } from "./cash-projection-runs";
import { receivableDebtorsHandlers } from "./receivable-debtors";

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

/* Fecha de inicio DECLARADA por sociedad. Las seis sociedades medidas en producción el
   2026-10-04, todas con la fecha heredada de una carga anterior y ninguna declarada. */
const activityStartState: Array<{
  legal_entity_id: string;
  legal_name: string;
  effective_from: string;
  declared: boolean;
  provenance: "declared_by_company" | "inherited_from_backfill" | "platform_default";
}> = [
  "Tooxs Digital SpA",
  "Tooxs Servicios SpA",
  "Tooxs Retail SpA",
  "Tooxs Holding SpA",
  "Tooxs Logistica SpA",
  "Tooxs Consultoria SpA",
].map((legal_name, i) => ({
  legal_entity_id: `a58a2ea8-0000-0000-0000-00000000000${i + 1}`,
  legal_name,
  effective_from: "2024-07-02",
  declared: false,
  provenance: "inherited_from_backfill" as const,
}));

function activityStartCensus() {
  const declared = activityStartState.filter((e) => e.declared).length;
  return {
    entities: activityStartState.map((e) => ({ ...e })),
    declared_count: declared,
    undeclared_count: activityStartState.length - declared,
    unattributed_history: {
      documents: 395,
      amount: "610236099.00",
      payables_documents: 220,
      payables_periods: 15,
      payables_amount: "175878842.00",
      receivables_documents: 175,
      receivables_periods: 12,
      receivables_amount: "434357257.00",
    },
    live_debt_protected: {
      payables_count: 93,
      payables_amount: "48200100.00",
      receivables_count: 41,
      receivables_amount: "12750000.00",
    },
    opening_cutoff_overlap: {
      active: true,
      cutoff_date: "2026-08-31",
      import_start_date: "2026-03-01",
      overlap_months: 5,
      detail:
        "La ventana de importación parte el 2026-03-01 y el corte quedó al 2026-08-31: 5 meses.",
    },
    summary:
      "6 de 6 sociedades no declararon su fecha de inicio en el onboarding. 220 documentos de compra en 15 períodos por $175878842.00 y 175 de venta en 12 períodos por $434357257.00 quedan sin atribuir.",
  };
}

const legalEntitiesState: Array<{
  id: string;
  legal_name: string;
  is_default: boolean;
  identifiers: Array<{ scheme: string; value: string }>;
}> = [
  { id: "e_tooxs", legal_name: "Tooxs Digital SpA", is_default: true, identifiers: [] },
  { id: "e_demo", legal_name: "Tooxs Operaciones SpA", is_default: false, identifiers: [] },
];

export const authHandlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { rut?: string; email?: string; password?: string };
    if ((!body?.rut && !body?.email) || !body?.password) {
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

  http.post("*/api/auth/oauth/callback", () => {
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

  /* Permisos reales del rol (registry PERMISSIONS_BY_ROLE). La sesión sembrada es owner → wildcard. */
  http.get("*/api/users/me/permissions", () =>
    HttpResponse.json({ permissions: ["*"], role: "owner" }, { status: 200 }),
  ),
  http.get("*/api/me", () => {
    return HttpResponse.json({
      user: {
        ...SEED_SESSION_USER,
        tenant_id: "t_qavante_demo",
        name: "Fernando Pérez",
        rut: "10341986-7",
        company_rut: "76123456-0",
        last_login_at: "2026-05-13T08:00:00Z",
        permissions: ["users.read", "users.write"],
      },
    });
  }),

  http.patch("*/api/me", async ({ request }) => {
    const body = (await request.json()) as { name?: string; rut?: string };
    return HttpResponse.json({
      user: {
        ...SEED_SESSION_USER,
        tenant_id: "t_qavante_demo",
        name: body.name ?? "Fernando Pérez",
        rut: body.rut ?? "10341986-7",
        company_rut: "76123456-0",
        last_login_at: "2026-05-13T08:00:00Z",
        permissions: ["users.read", "users.write"],
      },
    });
  }),

  http.get("*/api/legal-entities", () =>
    HttpResponse.json({ entities: legalEntitiesState }, { status: 200 }),
  ),

  http.post("*/api/legal-entities", async ({ request }) => {
    const body = (await request.json()) as { legal_name?: string };
    if (!body.legal_name?.trim()) {
      return HttpResponse.json(errorBody("validation_error", "legal_name requerido."), {
        status: 422,
      });
    }
    const entity = {
      id: `e_new_${legalEntitiesState.length + 1}`,
      legal_name: body.legal_name.trim(),
      is_default: false,
      identifiers: [] as Array<{ scheme: string; value: string }>,
    };
    legalEntitiesState.push(entity);
    return HttpResponse.json(entity, { status: 201 });
  }),

  http.patch("*/api/legal-entities/:entityId", async ({ params, request }) => {
    const body = (await request.json()) as { legal_name?: string };
    const entity = legalEntitiesState.find((item) => item.id === params.entityId);
    if (!entity)
      return HttpResponse.json(errorBody("not_found", "Empresa no encontrada."), { status: 404 });
    if (body.legal_name?.trim()) entity.legal_name = body.legal_name.trim();
    return HttpResponse.json(entity, { status: 200 });
  }),

  /* N:M multi-empresa (ADR-0049): rutas legacy internas de tenant. */
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

  http.post("*/api/onboarding/sync-runs", () =>
    HttpResponse.json(
      {
        run_id: "00000000-0000-0000-0000-000000000001",
        status: "running",
        updated_at: "2026-09-02T12:00:00Z",
        sources: [
          {
            source: "sii",
            status: "running",
            step: "reading",
            records_read: 1,
            eta_seconds: null,
            updated_at: "2026-09-02T12:00:00Z",
          },
        ],
      },
      { status: 202 },
    ),
  ),

  http.get("*/api/onboarding/sync-runs/:runId", ({ params }) =>
    HttpResponse.json({
      run_id: params.runId,
      status: "completed",
      updated_at: "2026-09-02T12:01:00Z",
      sources: [
        {
          source: "sii",
          status: "ok",
          step: null,
          records_read: 1,
          eta_seconds: null,
          updated_at: "2026-09-02T12:01:00Z",
        },
      ],
    }),
  ),

  /* `GET` / `PUT /api/onboarding/activity-start` — la fecha de inicio que la empresa DECLARA
     por sociedad, con su procedencia y la cifra de lo que queda sin atribuir.

     Las cifras son las medidas en producción el 2026-10-04: 6 de 6 sociedades con la fecha
     heredada de una carga anterior y cero declaradas, 220 compras en 15 períodos por
     $175.878.842 y 175 ventas en 12 períodos por $434.357.257 sin atribuir, y el caso del
     corte de Fernando (importación desde el 2026-03-01 con corte al 2026-08-31 → 5 meses).

     Es CON ESTADO a propósito: declarar mueve la procedencia a `declared_by_company` y baja
     `undeclared_count`, que es justo lo que la pantalla tiene que mostrar moviéndose. */
  http.get("*/api/onboarding/activity-start", () => HttpResponse.json(activityStartCensus())),

  http.put("*/api/onboarding/activity-start", async ({ request }) => {
    const body = (await request.json()) as { legal_entity_id?: string; start_date?: string };
    if (body?.start_date === "1970-01-01") {
      return HttpResponse.json(
        errorBody(
          "invalid_activity_start_date",
          "1970-01-01 es el valor que puso la plataforma por omisión, no una fecha declarada.",
        ),
        { status: 422 },
      );
    }
    const entidad = activityStartState.find((e) => e.legal_entity_id === body?.legal_entity_id);
    if (!entidad) {
      return HttpResponse.json(
        errorBody("legal_entity_not_found", "La sociedad no pertenece a esta empresa."),
        { status: 404 },
      );
    }
    entidad.effective_from = body!.start_date!;
    entidad.declared = true;
    entidad.provenance = "declared_by_company";
    return HttpResponse.json(activityStartCensus());
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
  {
    id: "mov-unclas-3",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1007",
    description: "TRANSFERENCIA PROVEEDOR ACME SPA",
    amount: "-125000.00",
    date: "2026-05-11",
    direction: "debit",
    canonical_category: null,
    management_account_id: null,
  },
  {
    id: "mov-unclas-4",
    bank_account_id: "acct-1",
    external_id: "ext-bice-1008",
    description: "TRANSFERENCIA PROVEEDOR ACME SPA",
    amount: "-98000.00",
    date: "2026-05-10",
    direction: "debit",
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
          active: true,
          balance: "1931152.70",
          balance_as_of: "2026-09-11T12:00:00Z",
        },
        {
          id: "acct-2",
          name: "Cuenta Internacional",
          bank_name: "BICE",
          currency_code: "USD",
          account_type: "checking",
          active: true,
          balance: "5000.00",
          balance_as_of: "2026-09-11T12:00:00Z",
        },
      ],
    }),
  ),
  /* Saldos BICE por cuenta (SaldoResponse). Cada cuenta trae su `numeroCuenta` (token) que se usa como
     ID en `/api/bice/cuentas/{numeroCuenta}/balance`. */
  http.get("*/api/bice/saldo", () =>
    HttpResponse.json({
      status: "ok",
      cuentas: [
        {
          numeroCuenta: "tok-cc-clp",
          numeroFormateado: "12-34567-8",
          nombreCuenta: "Cuenta Corriente",
          codigoProducto: "100",
          codigoMoneda: "CLP",
          esExtranjera: false,
          saldoContable: "1931152.70",
          saldoDisponible: "6931152.70",
          moneda: "CLP",
          fechaDesde: "2026-08-01",
          fechaHasta: "2026-08-03",
        },
        {
          numeroCuenta: "tok-cc-usd",
          numeroFormateado: "98-76543-2",
          nombreCuenta: "Cuenta Internacional",
          codigoProducto: "101",
          codigoMoneda: "USD",
          esExtranjera: true,
          saldoContable: "5000.00",
          saldoDisponible: "5000.00",
          moneda: "USD",
          fechaDesde: "2026-08-01",
          fechaHasta: "2026-08-02",
        },
      ],
    }),
  ),
  /* Balance detallado por cuenta (BalanceData) — incluye la LÍNEA DE CRÉDITO. La cuenta CLP tiene LC
     (cupo $5M, usa $2M, quedan $3M); la USD no tiene línea (cupo null → el FE no muestra LC). */
  http.get("*/api/bice/cuentas/:numeroCuenta/balance", ({ params }) => {
    const numero = params.numeroCuenta as string;
    const conLinea = numero === "tok-cc-clp";
    return HttpResponse.json({
      status: "ok",
      data: {
        titulo: null,
        monto: null,
        saldoContableMonto: conLinea ? "1931152.70" : "5000.00",
        saldoContableCodigoMoneda: conLinea ? "CLP" : "USD",
        saldoDisponibleMonto: conLinea ? "6931152.70" : "5000.00",
        saldoDisponibleCodigoMoneda: conLinea ? "CLP" : "USD",
        saldoUtilizadoMonto: conLinea ? "2000000" : null,
        saldoUtilizadoCodigoMoneda: conLinea ? "CLP" : null,
        montoAprobadoMonto: conLinea ? "5000000" : null,
        montoAprobadoCodigoMoneda: conLinea ? "CLP" : null,
        montoUtilizadoMonto: conLinea ? "2000000" : null,
        montoUtilizadoCodigoMoneda: conLinea ? "CLP" : null,
        montoDisponibleMonto: conLinea ? "3000000" : null,
        montoDisponibleCodigoMoneda: conLinea ? "CLP" : null,
        fechaVencimientoSobregiro: conLinea ? "2026-09-30" : null,
        fechaConsultaSaldo: "2026-08-03",
      },
      error: null,
    });
  }),
  /* Tarjetas de crédito BICE (pantalla Banco): lista + cupo por tarjeta. Una CLP activa (con cupo) +
     una USD. */
  http.get("*/api/bice/tarjetas", () =>
    HttpResponse.json({
      status: "ok",
      data: [
        {
          operationNumber: "42595474000067584",
          creditCardCheckDigit: "1",
          product: "Tarjeta de Crédito CLP",
          holder: "TOOXS DIGITAL SPA",
          isActive: true,
        },
        {
          operationNumber: "42595474000067999",
          creditCardCheckDigit: "2",
          product: "Tarjeta de Crédito USD",
          holder: "TOOXS DIGITAL SPA",
          isActive: true,
        },
      ],
    }),
  ),
  http.get("*/api/bice/tarjetas/:op/saldo", ({ params }) => {
    const op = params.op as string;
    const esClp = op === "42595474000067584";
    return HttpResponse.json({
      status: "ok",
      data: {
        national: esClp
          ? {
              totalQuota: 8000000,
              spentQuota: 3200000,
              availableQuota: 4800000,
              billedAmmount: 3200000,
              billDate: "2026-08-25",
              dueDate: "2026-09-05",
            }
          : null,
        international: esClp
          ? null
          : {
              totalQuota: 5000,
              spentQuota: 1200,
              availableQuota: 3800,
              billedAmmount: 1200,
              billDate: "2026-08-25",
              dueDate: "2026-09-05",
            },
        isPacActive: true,
        pacPercentage: 100,
      },
      error: null,
    });
  }),
  /* Movimientos (cargos) de una tarjeta de crédito — para el detalle de tarjeta en Banco. Ventana; el
     FE filtra por mes. */
  http.get("*/api/bice/tarjetas/:op/movimientos", ({ params }) => {
    const esClp = params.op === "42595474000067584";
    return HttpResponse.json({
      status: "ok",
      data: esClp
        ? [
            {
              date: "2026-08-04",
              type: "compra",
              description: "MERCADOLIBRE",
              amount: "45990",
              currency: "CLP",
              state: "posted",
              installmentsDescription: null,
            },
            {
              date: "2026-08-01",
              type: "compra",
              description: "UBER *TRIP",
              amount: "8500",
              currency: "CLP",
              state: "posted",
              installmentsDescription: null,
            },
            {
              date: "2026-07-20",
              type: "compra",
              description: "PC FACTORY",
              amount: "129990",
              currency: "CLP",
              state: "posted",
              installmentsDescription: "03/06",
            },
          ]
        : [
            {
              date: "2026-08-03",
              type: "compra",
              description: "AWS",
              amount: "120.50",
              currency: "USD",
              state: "posted",
              installmentsDescription: null,
            },
          ],
    });
  }),
  /* Cuentas que trae BICE con su estado de vínculo. Una vinculada + una EN
     CUARENTENA (linked_bank_account_id null) → alimenta "Cuentas por vincular". */
  http.get("*/api/bank-movements/bice/accounts", () =>
    HttpResponse.json({
      accounts: [
        {
          // `external_id` = el `numeroFormateado` del saldo (join key para el detalle de cuenta).
          external_id: "12-34567-8",
          name: "Cuenta Corriente",
          currency: "CLP",
          linked_bank_account_id: "acct-1",
        },
        {
          external_id: "98-76543-2",
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
  http.post("*/api/treasury/bank-movements/classify-bulk", async ({ request }) => {
    const body = (await request.json()) as { movement_ids?: string[] };
    return HttpResponse.json(
      {
        items: (body.movement_ids ?? []).map((movementId) => ({
          movement_id: movementId,
          status: "applied",
          detail: "Clasificación aplicada.",
        })),
        reversible: false,
        action_id: null,
      },
      { status: 200 },
    );
  }),
  /* Aplica reglas activas a los sin clasificar (batch #545). Devuelve el
     resumen evaluados/clasificados/sin_regla. */
  http.post("*/api/treasury/bank-movements/apply-rules", () =>
    HttpResponse.json({ evaluados: 12, clasificados: 5, sin_regla: 7 }, { status: 200 }),
  ),
  // Traspasos internos (D1): 8 evaluados → 2 pares (4 patas clasificadas).
  http.post("*/api/treasury/bank-movements/detect-internal-transfers", () =>
    HttpResponse.json({ evaluados: 8, pares: 2, clasificados: 4 }, { status: 200 }),
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

/* e2e: estado del "propose" de Presupuesto. Vive en el contexto de la página (se reinicia en cada
   page.goto → aislado por test). Con la cookie sentinel `qa_presupuesto=empty`, budget-vs-actual arranca
   has_budget:false y pasa a true una vez que el dueño toca "Proponer presupuesto". */
let presupuestoPropuestoE2E = false;

/* e2e: grilla anual editable del Presupuesto (GET/PATCH/accept). Estado de módulo (se reinicia por
   page.goto → aislado por test): editar una celda deja `draft`; aceptar pasa a `approved`. */
const mesesFull = (v: number): { [k: string]: string } =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), String(v)]));
const budgetGridE2E: {
  status: string;
  accepted: boolean;
  categories: {
    account_id: string;
    account_code: string;
    account_name: string;
    impact_type: string;
    months: { [k: string]: string };
  }[];
} = {
  status: "draft",
  accepted: false,
  categories: [
    {
      account_id: "a1",
      account_code: "4.1",
      account_name: "Ventas",
      impact_type: "revenue",
      months: mesesFull(10_000_000),
    },
    {
      account_id: "c1",
      account_code: "5.1",
      account_name: "Sueldos",
      impact_type: "direct_cost",
      months: mesesFull(-4_000_000),
    },
    {
      account_id: "g1",
      account_code: "6.1",
      account_name: "Arriendo",
      impact_type: "operating_expense",
      months: mesesFull(-1_000_000),
    },
  ],
};
function budgetGridResponse(year: number) {
  const totals: { [k: string]: number } = {};
  let totalYear = 0;
  const categories = budgetGridE2E.categories.map((c) => {
    let ty = 0;
    for (let m = 1; m <= 12; m++) {
      const v = Number(c.months[String(m)] ?? "0");
      totals[String(m)] = (totals[String(m)] ?? 0) + v;
      ty += v;
    }
    totalYear += ty;
    return { ...c, total_year: String(ty) };
  });
  return {
    year,
    currency: "CLP",
    status: budgetGridE2E.status,
    accepted: budgetGridE2E.accepted,
    has_budget: true,
    categories,
    totals_by_month: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, String(v)])),
    total_year: String(totalYear),
    generated_at: "2026-08-01T00:00:00Z",
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
  origin: "unknown" | "learned_from_usage" | "created_by_user" | "qavante_base";
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
    origin: "learned_from_usage",
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
    origin: "created_by_user",
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
    name: "Transferencia banco · desactivada",
    source_type: "bank_movement",
    origin: "unknown",
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

  http.get("*/api/treasury/classification-rules/:ruleId/usage", ({ params }) => {
    const known = params.ruleId !== "rule-3";
    return HttpResponse.json(
      {
        rule_id: params.ruleId,
        application_count: known ? 3 : null,
        correction_count: known ? 1 : null,
        generated_at: "2026-09-09T12:00:00Z",
        as_of: "2026-09-09T12:00:00Z",
        tracking_started_at: known ? "2026-09-01T12:00:00Z" : null,
        last_applied_at: known ? "2026-09-08T12:00:00Z" : null,
        last_corrected_at: known ? "2026-09-07T12:00:00Z" : null,
        coverage: known ? "complete_since_tracking_started_at" : "unknown",
        correction_basis: "reverted_auto_classification",
      },
      { status: 200 },
    );
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
      origin: "created_by_user" as const,
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

  http.post("*/api/treasury/bank-movements/:movementId/suggest-rule", ({ params }) => {
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
  http.get("*/api/treasury/bank-movements/:movementId/suggested-category", ({ params }) => {
    /* #794-4: read-only. Sugiere la CUENTA que las reglas activas asignarían. El código matchea el
       árbol de cuentas del fixture (`costos.sueldos` → acc-sueldos) para que el "Clasificar" del
       banner resuelva a un management_account_id real. */
    const movementId = params.movementId as string;
    return HttpResponse.json(
      {
        movement_id: movementId,
        suggestion: {
          account_code: "costos.sueldos",
          account_name: "Sueldos y remuneraciones",
          canonical_category: "payroll",
          confidence: 0.92,
          matched_rule_id: "rule-1",
        },
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

/* D07 — `GET /api/sii/document-links`: observaciones de referencia entre DTE. El fixture cubre
   los dos casos que la pantalla tiene que distinguir: una anulación ACREDITADA por el productor
   (`automatic_allowed`) y una referencia observada SIN acreditación, que nunca puede rotularse
   como anulada. Las claves son las mismas del RCV (`tipo-folio-RUT`). */
const documentLinkFixtures = [
  {
    id: "dl-anulada",
    document_kind: "payable",
    correcting_document_id: "doc-nc-1",
    correcting_source_external_id: "61-9001-76543210-9",
    correcting_document_type: 61,
    target_document_id: "doc-fac-1",
    target_source_external_id: "33-5001-76543210-9",
    target_match_count: 1,
    link_status: "annulled_confirmed",
    reference_evidence: {
      source: "sii_rcv",
      reference_index: 1,
      observed_at: "2026-06-02T12:00:00Z",
      digest_sha256: "d".repeat(64),
      validated: true,
      identity_consistent: true,
      observation_kind: "reference",
      cod_ref: 1,
      referenced_document_type: 33,
      referenced_folio: "5001",
    },
    monetary_effect: {
      kind: "full_cancellation",
      automatic_allowed: true,
      amount: "119000",
      currency_code: "CLP",
    },
    classification_version: "dte-reference-v2",
    classification_reason: "reference_exact",
    is_current: true,
  },
  {
    id: "dl-posible",
    document_kind: "payable",
    correcting_document_id: "doc-nc-2",
    correcting_source_external_id: "61-9002-76543210-9",
    correcting_document_type: 61,
    target_document_id: null,
    target_source_external_id: null,
    target_match_count: 0,
    link_status: "annulled_confirmed",
    reference_evidence: {
      source: "sii_rcv",
      reference_index: 1,
      observed_at: "2026-06-02T12:00:00Z",
      digest_sha256: "e".repeat(64),
      validated: false,
      identity_consistent: false,
      observation_kind: "reference",
      cod_ref: null,
    },
    monetary_effect: {
      kind: "unknown",
      automatic_allowed: false,
      amount: null,
      currency_code: null,
    },
    classification_version: "dte-reference-v2",
    classification_reason: "reference_ambiguous",
    is_current: true,
  },
  /* Reemplazada: el cliente no puede dejar que pise a la vigente. */
  {
    id: "dl-historica",
    document_kind: "payable",
    correcting_document_id: "doc-nc-1",
    correcting_source_external_id: "61-9001-76543210-9",
    correcting_document_type: 61,
    target_document_id: null,
    target_source_external_id: null,
    target_match_count: 0,
    link_status: "unresolved",
    reference_evidence: {
      source: "legacy",
      reference_index: null,
      observed_at: "2026-05-02T12:00:00Z",
      digest_sha256: "f".repeat(64),
      validated: false,
      identity_consistent: false,
      observation_kind: "no_references",
      cod_ref: null,
    },
    monetary_effect: {
      kind: "none",
      automatic_allowed: false,
      amount: null,
      currency_code: null,
    },
    classification_version: "dte-reference-v1",
    classification_reason: "superseded",
    is_current: false,
  },
];

const siiHandlers = [
  http.get("*/api/sii/document-links", ({ request }) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const includeHistory = url.searchParams.get("include_history") === "true";
    const items = documentLinkFixtures.filter(
      (link) =>
        (kind === null || link.document_kind === kind) && (includeHistory || link.is_current),
    );
    return HttpResponse.json({ count: items.length, items }, { status: 200 });
  }),
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

  /* Signup sin sesión: misma consulta SII para nombre / razón social. */
  http.get("*/api/auth/signup/contribuyente/:rut", ({ params }) => {
    const rut = String(params.rut);
    if (rut === "11111111-1") {
      return HttpResponse.json({
        status: "ok",
        rut,
        razon_social: "FERNANDO ARANDA",
      });
    }
    if (rut === "76123456-0") {
      return HttpResponse.json({
        status: "ok",
        rut,
        razon_social: "EMPRESA DEMO SPA",
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
    const url = new URL(request.url);
    const anio = Number(url.searchParams.get("anio")) || 2026;
    const mes = Number(url.searchParams.get("mes")) || 1;
    /* Noviembre 2025: la Consulta de Giros NO RESPONDE. Es el único período así, y existe porque la
       ausencia de respuesta del SII tiene su propia rama en el detalle (#202): un período declarado
       cuyos giros no se pudieron consultar muestra lo que declaró y ofrece re-consultar, en vez de
       convertir el silencio del SII en una orden de pago. Sin un período que falle, el test que
       afirma eso no tiene qué medir. */
    if (anio === 2025 && mes === 11) {
      return HttpResponse.json(
        errorBody("upstream_unavailable", "El SII no respondió la Consulta de Giros."),
        { status: 502 },
      );
    }
    /* Tres casos, porque los tres se ven distinto en el detalle del mes (#202):
         · par            → postergado: el período difirió el IVA y lo debe aparte.
         · marzo          → GIRO PENDIENTE: el único mes que ofrece las dos opciones de pago.
                            Existe para que un test que afirme "acá NO se ofrece pagar" tenga su
                            gemelo positivo y no pase por vacuidad.
         · resto de impar → `sin_giro` con el período declarado, que el contrato define como pagado. */
    const postergado = mes % 2 === 0;
    const giroPendiente = mes === 3;
    return HttpResponse.json({
      status: "ok",
      periodo: `${anio}-${String(mes).padStart(2, "0")}`,
      tiene_giros: postergado || giroPendiente,
      estado: postergado ? "postergado" : giroPendiente ? "giro_no_determinado" : "sin_giro",
      postergado_iva: postergado,
      iva_postergado: postergado ? 400000 : null,
      vencimiento_postergado: postergado ? "2026-08-12" : null,
      multiples_giros: false,
    });
  }),

  /* El puente entre lo que el F29 publica y lo que el SII cobra (D13, #202). Antes de :folio.

     Las cifras son las del período REAL medido en producción (folio 9238206586, 2026-07): IVA
     débito 7.213.010, crédito NULL, PPM 52.519 → los códigos observados suman 7.265.529, contra un
     total oficial (código 91) de 7.450.761. El contrato define
     `unexplained_delta = composed_total − declaration_total`, así que el valor es −185.232.

     Un período por mes, porque cada rama se ve distinta en la pantalla y la de al lado es su
     gemelo:
       · 2026-01  → `pending` con AUSENCIA EXPLÍCITA (nadie declaró movimiento ni comprobante) y la
                    diferencia no explicada rotulada. Trae DOS bridges: la declaración original y la
                    rectificatoria con el folio que la tarjeta muestra, para que el recorrido ejerza
                    la elección por folio y una rectificatoria no quede escondida detrás de la
                    original.
       · 2026-02  → `deferred`: el período postergó el IVA y lo debe aparte.
       · 2025-11  → `partial` pagado en DOS cuotas, ningún movimiento único representa el pago. Es
                    el gemelo de la ausencia explícita: los dos traen `bank_movement_id` null y
                    tienen que leerse distinto.
       · 2025-10  → `bridges: []`. El gemelo negativo del panel: un período sin bridge no muestra
                    panel, y el Desglose sigue ahí. Sin este caso, borrar el panel entero dejaría la
                    suite verde.
       · el resto → `paid` con UN movimiento bancario declarado y reconciliado (delta 0). */
  http.get("*/api/sii/f29/bridge", ({ request }) => {
    const url = new URL(request.url);
    const anio = Number(url.searchParams.get("anio")) || 2026;
    const mes = Number(url.searchParams.get("mes")) || 1;
    const totalOficial = 7_450_761;
    const delta = -185_232;
    /* El folio que la tarjeta muestra sale de `/f29/impuesto`. El bridge del período tiene que
       traerlo, o la elección por folio no se ejerce. */
    const folioEnPantalla = 6123;

    const base = {
      declaration_id: `decl-${anio}-${mes}`,
      folio: folioEnPantalla,
      period_year: anio,
      period_month: mes,
      observed_at: `${anio}-${String(mes).padStart(2, "0")}-14T10:00:00Z`,
      data_state: "partial",
      declaration_total: totalOficial,
      official_components: { code_538: 7_213_010, code_537: null, code_62: 52_519 },
      comparators: {},
      payment_evidence: null,
      reconciled: false,
      unexplained_delta: delta,
    };
    const recibo = {
      folio: folioEnPantalla,
      declaration_total: totalOficial,
      source: "sii_f29_pdf",
    };

    if (anio === 2025 && mes === 10) {
      return HttpResponse.json({
        status: "ok",
        period_year: anio,
        period_month: mes,
        bridges: [],
      });
    }

    let bridge: Record<string, unknown>;
    if (anio === 2025 && mes === 11) {
      bridge = {
        ...base,
        payment_state: "partial",
        payment: {
          payment_state: "partial",
          evidence_declared: 2,
          evidence_required: 1,
          missing_requirements: [],
          declaration_receipt: recibo,
          bank_evidence: { applied_amount: "5000000", bank_movement_id: null, currency: "CLP" },
          residual_amount: String(totalOficial - 5_000_000),
          applications: [
            {
              application_kind: "bank_movement",
              applied_amount: "4000000",
              applied_at: "2025-12-18T00:00:00Z",
              declared_at: "2025-12-19T00:00:00Z",
              currency: "CLP",
              provenance: "bank_movement_declared",
              bank_movement_id: "mov-7f3a",
              receipt_reference: null,
            },
            {
              application_kind: "declaration_receipt",
              applied_amount: "1000000",
              applied_at: "2026-01-12T00:00:00Z",
              declared_at: "2026-01-13T00:00:00Z",
              currency: "CLP",
              provenance: "manual_receipt_declared",
              bank_movement_id: null,
              receipt_reference: "OP-884120",
            },
          ],
        },
      };
    } else if (anio === 2026 && mes === 1) {
      bridge = {
        ...base,
        payment_state: "pending",
        payment: {
          payment_state: "pending",
          evidence_declared: 0,
          evidence_required: 1,
          missing_requirements: ["bank_movement_declared"],
          declaration_receipt: recibo,
          bank_evidence: { applied_amount: "0", bank_movement_id: null },
          residual_amount: String(totalOficial),
          applications: [],
        },
      };
    } else if (anio === 2026 && mes === 2) {
      bridge = {
        ...base,
        payment_state: "deferred",
        official_components: { ...base.official_components, code_755: 400_000 },
        payment: {
          payment_state: "deferred",
          evidence_declared: 0,
          evidence_required: 1,
          missing_requirements: ["bank_movement_declared"],
          declaration_receipt: recibo,
          bank_evidence: { applied_amount: "0", bank_movement_id: null },
          residual_amount: String(totalOficial),
          applications: [],
        },
      };
    } else {
      bridge = {
        ...base,
        data_state: "complete",
        reconciled: true,
        unexplained_delta: 0,
        payment_state: "paid",
        payment: {
          payment_state: "paid",
          evidence_declared: 1,
          evidence_required: 1,
          missing_requirements: [],
          declaration_receipt: recibo,
          bank_evidence: {
            applied_amount: String(totalOficial),
            bank_movement_id: "mov-7f3a",
            currency: "CLP",
            linked_at: `${anio}-${String(mes).padStart(2, "0")}-20T00:00:00Z`,
            provenance: "bank_movement_declared",
          },
          residual_amount: "0",
          applications: [
            {
              application_kind: "bank_movement",
              applied_amount: String(totalOficial),
              applied_at: `${anio}-${String(mes).padStart(2, "0")}-20T00:00:00Z`,
              declared_at: `${anio}-${String(mes).padStart(2, "0")}-21T00:00:00Z`,
              currency: "CLP",
              provenance: "bank_movement_declared",
              bank_movement_id: "mov-7f3a",
              receipt_reference: null,
            },
          ],
        },
      };
    }

    /* Enero 2026 trae DOS declaraciones: la del folio que la tarjeta muestra (6123) y una
       RECTIFICATORIA con otro folio, observada después y con otro total. La pantalla tiene que
       mostrar las cifras del folio que tiene al frente —cualquier otra sería de otra declaración—,
       así que este caso distingue la elección por folio de un "la última observada" por omisión. */
    const bridges =
      anio === 2026 && mes === 1
        ? [
            bridge,
            {
              ...bridge,
              declaration_id: "decl-2026-1-rectificatoria",
              folio: 7777,
              observed_at: "2026-04-10T10:00:00Z",
              declaration_total: 6_000_000,
              unexplained_delta: 0,
              reconciled: true,
            },
          ]
        : [bridge];

    return HttpResponse.json({
      status: "ok",
      period_year: anio,
      period_month: mes,
      bridges,
    });
  }),

  /* Detalle F29 de un mes — con/sin IVA + impuesto trabajadores. */
  http.get("*/api/sii/f29/impuesto", ({ request }) => {
    const url = new URL(request.url);
    const manual = url.searchParams.get("impuesto_trabajadores");
    // Por defecto la fuente es BUK (así llega en prod para Tooxs: el IUSC/código 48 lo
    // provee BUK); `manual` solo cuando el usuario pasa el override.
    const impuesto = manual != null ? Number(manual) : 618000;
    const fuente = manual != null ? "manual" : "buk";
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
        iva_postergado: 0, // este período no postergó (decisión hacia adelante disponible)
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
    const canonicalPeriod = periodo.replace(/^(\d{4})(\d{2})$/, "$1-$2");
    const folioBase = Number(canonicalPeriod.replace("-", "")) * 10;
    return HttpResponse.json(
      {
        status: "ok",
        compras: [
          {
            tipo_doc: 33,
            folio: folioBase + 1,
            fecha: `${canonicalPeriod}-01`,
            rut_contraparte: "76555444-K",
            razon_social: "Proveedor SpA",
            monto_neto: 800000,
            monto_iva: 152000,
            monto_total: 952000,
          },
          {
            tipo_doc: 33,
            folio: folioBase + 2,
            fecha: `${canonicalPeriod}-01`,
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
    const canonicalPeriod = periodo.replace(/^(\d{4})(\d{2})$/, "$1-$2");
    const folioBase = Number(canonicalPeriod.replace("-", "")) * 10;
    return HttpResponse.json(
      {
        status: "ok",
        ventas: [
          {
            tipo_doc: 33,
            folio: folioBase + 1,
            fecha: `${canonicalPeriod}-01`,
            rut_contraparte: "78000111-K",
            razon_social: "Cliente A SA",
            monto_neto: 3000000,
            monto_iva: 570000,
            monto_total: 3570000,
          },
          {
            tipo_doc: 33,
            folio: folioBase + 2,
            fecha: `${canonicalPeriod}-01`,
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

  /* Comparativos del Libro pre-agregados (CC-API #766): neto del período + serie mensual + los 3
     comparativos del ritmo. El FE ya no baja mes a mes; consume esto directo. */
  http.get("*/api/sii/rcv/:kind/comparativos", ({ request }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    if (!desde || !hasta) {
      return HttpResponse.json(errorBody("validation_error", "Faltan `desde`/`hasta`."), {
        status: 422,
      });
    }
    return HttpResponse.json(
      {
        neto_periodo: "189765944",
        serie_mensual: [
          { periodo: "2026-05", neto: "30958134" },
          { periodo: "2026-06", neto: "25845693" },
          { periodo: "2026-07", neto: "42015325" },
        ],
        mismo_dia_mes_anterior: {
          pct: 12.5,
          dia_corte: 15,
          neto_actual: "21000000",
          neto_base: "18666666",
        },
        mes_vs_promedio_anual: {
          pct: 54.98,
          mes_label: "julio",
          neto_mes: "42015325",
          promedio_anual: "27109420",
        },
        yoy: {
          pct: 13.06,
          neto_periodo: "189765944",
          neto_anio_anterior: "167845841",
        },
        last_synced_at: "2026-08-01T12:01:35Z",
        stale: false,
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
  /* Certeza de la fecha (contrato #558): `due_date_certainty` es requerido por documento y
     `due_date_note` es copy del servidor. El E2E de Cobrar cubre los TRES valores: los tres
     confirmados de siempre, un ESTIMADO más atrasado que el confirmado de su cliente (si moviera
     los días de mora se notaría) y uno SIN CONFIRMAR sin nota. Sólo lo confirmado es mora. */
  estimated_due_date_count: 1,
  overdue_documents: [
    {
      client_name: "Constructora Andes SpA",
      client_rut: "76.123.456-7",
      document: "Factura 1234",
      due_date: "2026-05-10",
      due_date_certainty: "confirmed",
      amount: "3200000",
      balance: "3200000",
      days_overdue: 23,
    },
    {
      client_name: "Comercial del Sur Ltda",
      client_rut: "77.987.654-3",
      document: "Factura 5678",
      due_date: "2026-05-18",
      due_date_certainty: "confirmed",
      amount: "2400000",
      balance: "2400000",
      days_overdue: 15,
    },
    {
      client_name: "Comercial del Sur Ltda",
      client_rut: "77.987.654-3",
      document: "Factura 5680",
      due_date: "2026-04-23",
      due_date_certainty: "estimated",
      due_date_note:
        "Fecha estimada a 30 días desde la emisión; no acredita un vencimiento pactado.",
      amount: "950000",
      balance: "950000",
      days_overdue: 40,
    },
    {
      client_name: "Minera Atacama SA",
      client_rut: "96.555.444-2",
      document: "Factura 9012",
      due_date: "2026-05-25",
      due_date_certainty: "confirmed",
      amount: "1100000",
      balance: "800000",
      days_overdue: 8,
    },
    {
      client_name: "Minera Atacama SA",
      client_rut: "96.555.444-2",
      document: "Factura 9020",
      due_date: "2026-05-31",
      due_date_certainty: "unconfirmed",
      due_date_note: "",
      amount: "300000",
      balance: "300000",
      days_overdue: 2,
    },
  ],
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const cobranzaHandlers = [
  http.get("*/api/treasury/accounts-receivable/documents", () =>
    HttpResponse.json(
      {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            folio: "1234",
            document_type: 33,
            customer_name: "Constructora Andes SpA",
            customer_rut: "76.111.111-1",
            counterparty_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            issue_date: "2026-05-01",
            due_date: "2026-05-31",
            due_date_certainty: "confirmed",
            status: "open",
            total_amount: "9800000",
            outstanding_amount: "3200000",
            currency_code: "CLP",
            days_overdue: 23,
            ceded: false,
            claimed: false,
            credit_note: false,
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            folio: "5680",
            document_type: 33,
            customer_name: "Comercial del Sur Ltda",
            customer_rut: "77.987.654-3",
            counterparty_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            issue_date: "2026-04-23",
            due_date: null,
            due_date_certainty: "estimated",
            status: "open",
            total_amount: "950000",
            outstanding_amount: "950000",
            currency_code: "CLP",
            days_overdue: null,
            ceded: false,
            claimed: true,
            credit_note: false,
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            folio: "9012",
            document_type: 33,
            customer_name: "Minera Atacama SA",
            customer_rut: "96.555.444-2",
            counterparty_key: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            issue_date: "2026-05-10",
            due_date: "2026-05-25",
            due_date_certainty: "confirmed",
            status: "open",
            total_amount: "1100000",
            outstanding_amount: "800000",
            currency_code: "CLP",
            days_overdue: 8,
            ceded: true,
            claimed: false,
            credit_note: false,
          },
        ],
        total: 3,
        limit: 100,
        offset: 0,
        overdue: [{ currency: "CLP", amount: "4000000" }],
        due_soon: [{ currency: "CLP", amount: "1250000" }],
        collected: [{ currency: "CLP", amount: "2400000" }],
        generated_at: "2026-06-02T12:00:00Z",
      },
      { status: 200 },
    ),
  ),
  http.get("*/api/treasury/accounts-receivable", () =>
    HttpResponse.json(accountsReceivableFixture, { status: 200 }),
  ),
  http.post("*/api/treasury/collection-reminders/send", async ({ request }) => {
    const body = (await request.json()) as { receivable_ids?: string[] };
    return HttpResponse.json(
      {
        items: (body.receivable_ids ?? []).map((receivable_id) => ({
          receivable_id,
          status: "sent",
          detail: "Enviado.",
        })),
      },
      { status: 200 },
    );
  }),
  http.get("*/api/treasury/collection-reminders/settings", () =>
    HttpResponse.json(
      {
        items: [
          {
            kind: "before_due",
            enabled: false,
            days_offset: 3,
            schedule_time: "09:00:00",
            audience_mode: "all",
            counterparty_keys: [],
          },
          {
            kind: "due_today",
            enabled: false,
            days_offset: 0,
            schedule_time: "09:00:00",
            audience_mode: "all",
            counterparty_keys: [],
          },
          {
            kind: "overdue",
            enabled: false,
            days_offset: 3,
            schedule_time: "09:00:00",
            audience_mode: "all",
            counterparty_keys: [],
          },
        ],
      },
      { status: 200 },
    ),
  ),
  http.put("*/api/treasury/collection-reminders/settings/:kind", async ({ request, params }) =>
    HttpResponse.json(
      { kind: params.kind, ...((await request.json()) as object) },
      { status: 200 },
    ),
  ),
];

/* Preferencias de UI del usuario (#571). Blob opaco stateful: el PUT REEMPLAZA el
   blob completo (no mergea), como el contrato real. Lo usan el orden de widgets del
   Inicio v2 y el "marcar gestionado" de Cobrar v2. En e2e cada contexto de browser
   reinicia MSW → el blob arranca vacío por test. */
let preferencesBlob: Record<string, unknown> = {};
const preferencesHandlers = [
  http.get("*/api/me/preferences", () =>
    HttpResponse.json({ preferences: preferencesBlob }, { status: 200 }),
  ),
  http.put("*/api/me/preferences", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      preferences?: Record<string, unknown>;
    };
    preferencesBlob = body?.preferences ?? {};
    return HttpResponse.json({ preferences: preferencesBlob }, { status: 200 });
  }),
];

/* Pagar — cuentas por pagar. Publica el contrato D02 COMPLETO (agregados sobre todo el
   registro + metadatos de filtro + paginación), que es lo que el cliente exige en runtime:
   `assertAccountsPayableResponse` falla cerrado ante un payload legacy y la pantalla queda
   ciega. Los ítems y los tramos son los mismos de siempre; lo nuevo es el sobre. */
const AP_ITEMS = [
  {
    id: "ap-f29-202605",
    label: "IVA / F29 mayo",
    category: "tax" as const,
    due_date: "2026-06-12",
    due_date_certainty: "confirmed" as const,
    amount: "2400000",
    criticality: "high" as const,
    source: "SII",
    currency: "CLP",
    currency_status: "verified" as const,
    amount_clp: null,
    reclamado: false,
  },
  {
    id: "ap-payroll-202606",
    label: "Sueldos junio",
    category: "payroll" as const,
    due_date: "2026-06-30",
    due_date_certainty: "confirmed" as const,
    amount: "4200000",
    criticality: "high" as const,
    source: "Previred",
    source_external_id: "payroll-202606",
    currency: "CLP",
    currency_status: "verified" as const,
    amount_clp: null,
    reclamado: false,
  },
  /* Certeza de la fecha (contrato #558): el E2E de Pagar cubre los TRES valores. Este ítem va
     ESTIMADO con la nota del servidor; el leasing va SIN CONFIRMAR con su nota; el resto,
     confirmado. Lo estimado no entra en `due_*` (ver `due_30d`) y se cuenta aparte. */
  {
    id: "ap-telefonica-4471",
    label: "Proveedor Telefónica",
    category: "supplier" as const,
    due_date: "2026-06-18",
    due_date_certainty: "estimated" as const,
    due_date_note:
      "Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado.",
    amount: "890000",
    criticality: "medium" as const,
    source: "SII",
    currency: "CLP",
    currency_status: "verified" as const,
    amount_clp: null,
    reclamado: false,
  },
  {
    id: "ap-arriendo-bodega",
    label: "Arriendo bodega",
    category: "rent" as const,
    due_date: "2026-06-05",
    due_date_certainty: "confirmed" as const,
    amount: "1300000",
    criticality: "medium" as const,
    source: "Manual",
    currency: "CLP",
    currency_status: "verified" as const,
    amount_clp: null,
    reclamado: false,
  },
  {
    id: "ap-leasing-camioneta",
    label: "Leasing camioneta",
    category: "leasing" as const,
    due_date: "2026-06-22",
    due_date_certainty: "unconfirmed" as const,
    due_date_note: "La fecha viene del contrato registrado a mano y no fue verificada.",
    amount: "640000",
    criticality: "low" as const,
    source: "Manual",
    currency: "CLP",
    currency_status: "verified" as const,
    amount_clp: null,
    reclamado: false,
  },
];

/** Agregado completo: monto conocido == publicado, sin monedas excluidas ni fechas ausentes. */
const apAggregate = (amount: string, count: number) => ({
  amount_clp: amount,
  known_amount_clp: amount,
  complete: true,
  count,
  unknown_due_date_count: 0,
  excluded_by_currency: [],
});

const accountsPayableFixture = {
  as_of: "2026-06-02",
  snapshot_id: "a".repeat(64),
  items: AP_ITEMS,
  items_total: AP_ITEMS.length,
  limit: 100,
  has_more: false,
  next_cursor: null,
  total: "9430000",
  total_by_currency: [{ currency: "CLP", currency_status: "verified", amount: "9430000" }],
  excluded_from_total_by_currency: [],
  /* Acumulativos desde `as_of` 2026-06-02: 7 días = arriendo (05-jun); 14 días = + F29
     (12-jun); 30 días = todo el registro MENOS la factura con fecha estimada (Telefónica,
     $890.000): el contrato la cuenta en `estimated_due_date_count` y no en ningún tramo. */
  due_7d: "1300000",
  due_14d: "3700000",
  due_30d: "8540000",
  estimated_due_date_count: 1,
  /* Coherente con `as_of` 2026-06-02 y los vencimientos 05/12/18/22/30-jun: al corte NO hay
     nada vencido. Un agregado de vencido inventado haría que la pantalla afirme mora que el
     propio corte desmiente. */
  overdue_summary: apAggregate("0", 0),
  /* Impuestos y sueldos no se postergan (Ley 9): dentro de 14 días desde el corte sólo entra
     el F29 del 12-jun; los sueldos del 30-jun caen fuera de la ventana. */
  non_postponable_or_overdue_14d: apAggregate("2400000", 1),
  by_category: [
    { ...apAggregate("890000", 1), category: "supplier" },
    { ...apAggregate("2400000", 1), category: "tax" },
    { ...apAggregate("4200000", 1), category: "payroll" },
    { ...apAggregate("1300000", 1), category: "rent" },
    { ...apAggregate("0", 0), category: "debt" },
    { ...apAggregate("640000", 1), category: "leasing" },
    { ...apAggregate("0", 0), category: "other" },
  ],
  undated_summary: apAggregate("0", 0),
  undated_amount: "0",
  undated_count: 0,
  credits: apAggregate("0", 0),
  zero_balance_count: 0,
  filter_metadata: {
    unfiltered_items_total: AP_ITEMS.length,
    matched_items_total: AP_ITEMS.length,
    by_category: [
      { category: "supplier", count: 1 },
      { category: "tax", count: 1 },
      { category: "payroll", count: 1 },
      { category: "rent", count: 1 },
      { category: "debt", count: 0 },
      { category: "leasing", count: 1 },
      { category: "other", count: 0 },
    ],
    by_criticality: [
      { criticality: "high", count: 2 },
      { criticality: "medium", count: 2 },
      { criticality: "low", count: 1 },
    ],
    by_state: [
      { state: "open", count: 5 },
      { state: "partially_paid", count: 0 },
    ],
  },
  payroll_coverage: {
    complete: true,
    sources: [
      {
        source: "buk",
        status: "ready",
        last_success_at: "2026-06-02T08:00:00Z",
        freshness_confirmed: true,
        covered: true,
      },
      {
        source: "previred",
        status: "ready",
        last_success_at: "2026-06-02T08:00:00Z",
        freshness_confirmed: true,
        covered: true,
      },
    ],
  },
  next_payroll: {
    label: "Sueldos junio",
    category: "payroll",
    due_date: "2026-06-30",
    amount: "4200000",
    currency: "CLP",
    currency_status: "verified",
    amount_clp: null,
    is_overdue: false,
  },
  cash_projection_publicable_14d: true,
  projected_cash_14d: "5400000",
  projected_cash_currency: "CLP",
  min_14d: "-800000",
  cash_gap_amount_14d: "800000",
  has_gap: true,
  covers_critical: false,
  confidence: "high",
  data_state: "available",
  generated_at: "2026-06-02T12:00:00Z",
};

const pagosHandlers = [
  /* Los sub-paths van ANTES del handler general para que MSW los resuelva primero. */
  http.get("*/api/treasury/accounts-payable/anomalies", () =>
    HttpResponse.json({ items: [] }, { status: 200 }),
  ),
  http.get("*/api/treasury/document-actions/deferred/payable", () =>
    HttpResponse.json({ document_ids: [] }, { status: 200 }),
  ),
  http.get("*/api/treasury/accounts-payable", () =>
    HttpResponse.json(accountsPayableFixture, { status: 200 }),
  ),
];

/* Obligaciones con entidades financieras (Tesorería). Seed con una de cada categoría de la
   pantalla —crédito, leasing y compra en cuotas— + calendario. */
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
    type: "leasing",
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
  {
    // La mayoría de las "obligaciones" reales son COMPRAS A PLAZO con la tarjeta (SII/TGR/proveedores
    // en cuotas), NO préstamos. El FE las etiqueta "Compra a plazo" (no "préstamo").
    id: "obl-3",
    type: "card_purchase",
    counterparty: "SII",
    principal_total: "627894",
    annual_rate: null,
    currency_code: "CLP",
    origination_date: "2026-06-10",
    installments_total: 6,
    status: "active",
    needs_review: false,
    pending_count: 4,
    next_due_date: "2026-08-10",
    outstanding_total: "418596",
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
    days_of_cash: 26,
    days_of_cash_vencido_exigible_excluido: "73641695",
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

function pulsoScoreReadingFixture(objetivo: string | null) {
  const focused = objetivo !== null && objetivo !== "equilibrado";
  return {
    publication_state: "available",
    abstention_reason: null,
    focused_abstention_reason: null,
    legal_entity_id: "11111111-1111-1111-1111-111111111111",
    currency: "CLP",
    score_kind: focused ? "focused" : "base",
    objective_requested: objetivo ?? "equilibrado",
    objective_applied: objetivo ?? "equilibrado",
    objective_effective: focused,
    base_score: 68,
    base_status: "stable",
    score: focused ? 74 : 68,
    status: "stable",
    delta_vs_base: focused ? 6 : 0,
    /* Factores del Pulso base (contrato `PulsoScoreWeight`): la vista canónica compone
       "Qué compone tu Pulso" desde acá, no desde los `components` legacy. */
    weights: [
      {
        key: "COB",
        score: 72,
        exact_score: 72.4,
        configured_weight: 40,
        multiplier: 1,
        raw_weight: 40,
        effective_weight: 40,
        contribution: 28.96,
      },
      {
        key: "RUN",
        score: 65,
        exact_score: 65.1,
        configured_weight: 25,
        multiplier: 1,
        raw_weight: 25,
        effective_weight: 25,
        contribution: 16.28,
      },
      {
        key: "DPC",
        score: 60,
        exact_score: 60,
        configured_weight: 20,
        multiplier: 1,
        raw_weight: 20,
        effective_weight: 20,
        contribution: 12,
      },
      {
        key: "CAL",
        score: 74,
        exact_score: 74.2,
        configured_weight: 15,
        multiplier: 1,
        raw_weight: 15,
        effective_weight: 15,
        contribution: 11.13,
      },
    ],
    coverage: { available_weight: 100, configured_weight: 100, ratio: 1 },
    omitted: [],
    knockout_code: null,
    knockout_cap: null,
    evaluation_id: `evaluation-${objetivo ?? "equilibrado"}`,
    input_snapshot_id: "snapshot-1",
    model_version: "PULSO-2.0",
    methodology_id: "PULSO-2.0+pulso-focus-personal-v1",
    calculated_at: "2026-06-03T12:00:00Z",
    data_as_of: "2026-06-03",
    status_thresholds: [
      { minimum_score: 80, status: "strong" },
      { minimum_score: 60, status: "stable" },
      { minimum_score: 40, status: "weak" },
      { minimum_score: 20, status: "weak" },
      { minimum_score: 0, status: "critical" },
    ],
    freshness_state: "unknown",
    freshness_reason: "source_lineage_not_available",
  };
}

const pulsoHandlers = [
  http.get("*/api/management/pulso/score-reading", ({ request }) => {
    const objetivo = new URL(request.url).searchParams.get("objetivo");
    return HttpResponse.json(pulsoScoreReadingFixture(objetivo), { status: 200 });
  }),
  http.get("*/api/management/pulso", ({ request }) => {
    // Simula el re-ponderado por objetivo que hará CC-API: con un `?objetivo=` distinto de
    // equilibrado, el backend devolverá el Pulso con el foco aplicado. Acá reflejamos el foco en el
    // headline para que el e2e verifique que el parámetro viaja y la respuesta lo respeta.
    const objetivo = new URL(request.url).searchParams.get("objetivo");
    if (objetivo && objetivo !== "equilibrado") {
      return HttpResponse.json(
        { ...pulsoDetailFixture, headline: `Foco: ${objetivo}. ${pulsoDetailFixture.headline}` },
        { status: 200 },
      );
    }
    return HttpResponse.json(pulsoDetailFixture, { status: 200 });
  }),
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
  /* Presupuesto vs real (ADR-0091, pantalla Presupuesto). Montos SIGNADOS: revenue +, costos/gastos −,
     result = suma. `has_budget:true` → el hero "¿cómo vas?" se muestra con el semáforo. */
  http.get("*/api/planning/budget-vs-actual", ({ request }) => {
    const period = new URL(request.url).searchParams.get("period") ?? "2026-07";
    // e2e: con la cookie sentinel `qa_presupuesto=empty` arrancamos sin presupuesto; tras "Proponer"
    // (handler de budget/propose) el flag pasa a true y el refetch ya devuelve has_budget:true.
    // Leemos `document.cookie` (no `request.headers`: el navegador prohíbe leer el header Cookie en
    // fetch/SW). Los handlers de MSW corren en el contexto de la página → document está disponible.
    const pideEmpty =
      typeof document !== "undefined" && document.cookie.includes("qa_presupuesto=empty");
    if (pideEmpty && !presupuestoPropuestoE2E) {
      return HttpResponse.json(
        { period, has_budget: false, data_state: "no_budget", lines: [] },
        { status: 200 },
      );
    }
    return HttpResponse.json(
      {
        period,
        has_budget: true,
        data_state: "available",
        generated_at: "2026-08-01T00:00:00Z",
        // Líneas que FOOTEAN: revenue + direct_cost + operating_expense = result (budget, actual y
        // variance). Historia coherente: vendió más (+4M) pero los costos se lo comieron (−5M/−2M) →
        // resultado 3M bajo plan. Consistencia verificable por el e2e de datos.
        lines: [
          {
            concept: "revenue",
            budget: "40000000",
            actual: "44000000",
            variance: "4000000",
            variance_pct: "10",
          },
          {
            concept: "direct_cost",
            budget: "-20000000",
            actual: "-25000000",
            variance: "-5000000",
            variance_pct: "-25",
          },
          {
            concept: "operating_expense",
            budget: "-10000000",
            actual: "-12000000",
            variance: "-2000000",
            variance_pct: "-20",
          },
          {
            concept: "result",
            budget: "10000000",
            actual: "7000000",
            variance: "-3000000",
            variance_pct: "-30",
          },
        ],
      },
      { status: 200 },
    );
  }),
  /* Plan vs Real POR CUENTA de un mes (drill-down). Montos SIGNADOS; variance = actual − budget. */
  http.get("*/api/planning/budget-by-account", ({ request }) => {
    const period = new URL(request.url).searchParams.get("period") ?? "2026-07";
    return HttpResponse.json(
      {
        period,
        has_budget: true,
        data_state: "available",
        generated_at: "2026-08-01T00:00:00Z",
        accounts: [
          {
            account_id: "a1",
            account_code: "4.1",
            account_name: "Ventas",
            budget: "10000000",
            actual: "12000000",
            variance: "2000000",
            variance_pct: "20",
          },
          {
            account_id: "c1",
            account_code: "5.1",
            account_name: "Sueldos",
            budget: "-4000000",
            actual: "-5000000",
            variance: "-1000000",
            variance_pct: "-25",
          },
          {
            account_id: "g1",
            account_code: "6.1",
            account_name: "Arriendo",
            budget: "-1000000",
            actual: "-900000",
            variance: "100000",
            variance_pct: "10",
          },
        ],
      },
      { status: 200 },
    );
  }),
  /* PROPONE el presupuesto del año (ADR-0091 F1a). En e2e marca el flag → el refetch de
     budget-vs-actual tras invalidar pasa a has_budget:true (poblado). */
  http.post("*/api/planning/budget/propose", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { fiscal_year?: number };
    presupuestoPropuestoE2E = true;
    return HttpResponse.json(
      {
        version_id: "v-msw-1",
        fiscal_year: body?.fiscal_year ?? 2026,
        result_year: "2026",
        history_months: 7,
        impacts_written: 12,
      },
      { status: 200 },
    );
  }),
  /* Grilla anual editable (CC-API F2). GET arma la grilla desde el estado de módulo; PATCH edita una
     celda (deja draft); accept publica (approved). */
  http.get("*/api/planning/budget/:year", ({ params }) =>
    HttpResponse.json(budgetGridResponse(Number(params.year)), { status: 200 }),
  ),
  http.patch("*/api/planning/budget/:year/line", async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as {
      account_id?: string;
      month?: number;
      amount?: number | string;
    };
    const cat = budgetGridE2E.categories.find((c) => c.account_id === body.account_id);
    if (cat && body.month) cat.months[String(body.month)] = String(body.amount ?? 0);
    budgetGridE2E.status = "draft";
    budgetGridE2E.accepted = false;
    return HttpResponse.json(
      {
        year: Number(params.year),
        account_id: body.account_id ?? null,
        month: body.month ?? 0,
        amount: String(body.amount ?? 0),
        status: "draft",
      },
      { status: 200 },
    );
  }),
  http.post("*/api/planning/budget/:year/accept", ({ params }) => {
    budgetGridE2E.status = "approved";
    budgetGridE2E.accepted = true;
    return HttpResponse.json(
      { year: Number(params.year), status: "approved", accepted: true },
      { status: 200 },
    );
  }),
  /* P&L 'al día N' del flujo RCV vs el mismo tramo del mes anterior (#794-P0-2). actual/mes_anterior
     como string-decimal; variacion con {amount, pct} por métrica. Sirve la comparación PAREJA del
     Comparativo cuando el mes va en curso. */
  http.get("*/api/management/operational-result/al-dia", ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "2026-08";
    const hastaDia = Number(url.searchParams.get("hasta_dia") ?? "15");
    return HttpResponse.json(
      {
        period,
        hasta_dia: hastaDia,
        actual: {
          revenue: "9200000",
          cogs: "3100000",
          gasto: "1400000",
          gross_margin: "6100000",
          ebitda_proxy: "4700000",
          result: "4700000",
        },
        mes_anterior: {
          period: "2026-07",
          revenue: "8000000",
          cogs: "2900000",
          gasto: "1300000",
          gross_margin: "5100000",
          ebitda_proxy: "3800000",
          result: "3800000",
        },
        variacion: {
          revenue: { amount: "1200000", pct: 15.0 },
          gross_margin: { amount: "1000000", pct: 19.6 },
          result: { amount: "900000", pct: 23.7 },
        },
      },
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
    const sinClasificar = months.map((_, i) => String(-1287054 - i * 10000));
    const resultado = months.map((_, i) =>
      String(Number(margen[i]) + Number(gastos[i]) + Number(sinClasificar[i])),
    );
    const pctBy = (arr: string[]) =>
      months.map((_, i) =>
        Number(ingresos[i]) > 0 ? ((Number(arr[i]) / Number(ingresos[i])) * 100).toFixed(1) : "0",
      );
    return HttpResponse.json(
      {
        generated_at: "2026-07-11T12:00:00Z",
        period_from: from,
        period_to: to,
        mode: url.searchParams.get("mode") ?? "por_cuenta",
        months,
        proforma_month: months[months.length - 1] ?? null,
        warnings: [],
        // Marca el PRIMER mes del rango como "sin nómina" (CC-API #895) → la matriz muestra "(sin nómina)".
        incomplete_months: months[0]
          ? [
              {
                month: months[0],
                reason: "payroll_not_loaded",
                detail: "Nómina no cargada este mes; el margen puede estar sobreestimado.",
              },
            ]
          : [],
        rows: [
          {
            kind: "section",
            key: "income",
            label: "Total Ingresos",
            by_month: ingresos,
            total: sumArr(ingresos),
            children: [
              {
                kind: "account",
                key: "proyectos",
                label: "Proyectos",
                by_month: proyectos,
                total: sumArr(proyectos),
              },
              {
                kind: "account",
                key: "servicio",
                label: "Servicio Mensual",
                by_month: servicio,
                total: sumArr(servicio),
              },
            ],
          },
          {
            kind: "section",
            key: "costs",
            label: "Total Costos",
            by_month: sueldos,
            total: sumArr(sueldos),
            children: [
              {
                kind: "account",
                key: "sueldos",
                label: "Sueldos",
                by_month: sueldos,
                total: sumArr(sueldos),
              },
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
              {
                kind: "account",
                key: "recurrentes",
                label: "Gastos recurrentes",
                by_month: gastos,
                total: sumArr(gastos),
              },
            ],
          },
          {
            kind: "section",
            key: "unclassified",
            label: "Otros egresos sin clasificar",
            by_month: sinClasificar,
            total: sumArr(sinClasificar),
            children: [
              {
                kind: "account",
                key: "unclassified.purchases",
                label: "Compras sin clasificar",
                by_month: sinClasificar,
                total: sumArr(sinClasificar),
              },
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

  /* Drill-down por documento de una cuenta (CC-API #786): las facturas que caen en una cuenta un mes. */
  http.get("*/api/management/operational-result/documents", ({ request }) => {
    const url = new URL(request.url);
    const account = url.searchParams.get("account") ?? "";
    const period = url.searchParams.get("period") ?? "2026-06";
    const documents = [
      {
        side: "compras",
        source_external_id: "34-119-78163706-8",
        document_ref: "34-119",
        counterparty: "SOCIEDAD DE PROFESIONALES VASQUEZ, GONZALEZ Y CIA LTDA",
        rut: "78163706-8",
        net_amount: "-407633.00",
        origen: "memo",
      },
      {
        side: "compras",
        source_external_id: "33-508-96888880-1",
        document_ref: "33-508",
        counterparty: "PROVEEDOR DEMO SPA",
        rut: "96888880-1",
        net_amount: "-120000.00",
        origen: "giro",
      },
      {
        // Sin propuesta → mantiene visible "Sugerir clasificación" (residuo aún sin sugerir).
        side: "compras",
        source_external_id: "33-777-77777777-7",
        document_ref: "33-777",
        counterparty: "SIN SUGERENCIA SPA",
        rut: "77777777-7",
        net_amount: "-90000.00",
        origen: "giro",
      },
    ];
    return HttpResponse.json(
      {
        account_code: account,
        account_name: account,
        period,
        total: "-617633.00",
        count: documents.length,
        documents,
      },
      { status: 200 },
    );
  }),

  /* Clasificar en el drill-down (pedido de Fernando 2026-08-01, ADR-0062): propuestas de clasificación
     para lo sin clasificar + confirmar (aplica + crea regla por contraparte) + correr el clasificador.
     La propuesta cubre uno de los dos docs del fixture ("33-508…") → ese muestra "Sugerido: …" +
     botón; el otro ("34-119…") queda sin sugerencia → aparece el botón "Sugerir clasificación". */
  http.get("*/api/management/operational-result/classifications/proposals", () =>
    HttpResponse.json(
      {
        proposals: [
          {
            id: "prop-508",
            side: "compras",
            source_external_id: "33-508-96888880-1",
            account_code: "costos.sueldos",
            confidence: "media",
            reasoning: "El proveedor sugiere un gasto recurrente.",
            provider: "gemini",
          },
          {
            id: "prop-119",
            side: "compras",
            source_external_id: "34-119-78163706-8",
            account_code: "costos.sueldos",
            confidence: "media",
            reasoning: "Servicios profesionales recurrentes.",
            provider: "gemini",
          },
        ],
        count: 2,
      },
      { status: 200 },
    ),
  ),
  http.post("*/api/management/operational-result/classifications/:id/confirm", ({ params }) =>
    HttpResponse.json({ id: params.id, status: "applied" }, { status: 200 }),
  ),
  http.post("*/api/management/operational-result/classifications/:id/reject", ({ params }) =>
    HttpResponse.json({ id: params.id, status: "rejected" }, { status: 200 }),
  ),
  /* Clasificación MANUAL a una cuenta elegida (classify-document): aplica + aprende regla. */
  http.post(
    "*/api/management/operational-result/classifications/classify-document",
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ status: "applied", ...body }, { status: 200 });
    },
  ),
  http.post("*/api/management/operational-result/classify", () =>
    HttpResponse.json(
      {
        status: "ok",
        residuo: 2,
        applied: 1,
        proposed: 1,
        descartadas: 0,
        provider: "gemini",
        model_id: "gemini-2.5-flash",
        errores: [],
      },
      { status: 200 },
    ),
  ),
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

/* Conciliación de sueldos ACCIONABLE (#835) — board MUTABLE en memoria para el flow e2e
   (asignar / desasignar). Estado por sesión de página: MSW re-evalúa los handlers en cada
   page.goto → se reinicia solo. El board ignora el período (devuelve el mismo set); los
   candidatos de débito salen de la cartola (`/api/bank-movements`), no de acá. */
interface MswSettlementWorker {
  worker_rut: string;
  worker_name: string;
  liquido: string;
  paid_amount: string;
  outstanding: string;
  status: string;
}
interface MswSettlementLink {
  link_id: string;
  worker_rut: string;
  worker_name: string;
  amount: string;
  bank_movement_id: string;
  glosa: string;
  created_at: string;
}
function freshSettlementBoard(): { workers: MswSettlementWorker[]; links: MswSettlementLink[] } {
  return {
    workers: [
      {
        worker_rut: "12.345.678-9",
        worker_name: "Ana Pérez Soto",
        liquido: "2500000",
        paid_amount: "0",
        outstanding: "2500000",
        status: "pendiente",
      },
      {
        worker_rut: "9.876.543-2",
        worker_name: "Benjamín Rojas Díaz",
        liquido: "1500000",
        paid_amount: "0",
        outstanding: "1500000",
        status: "pendiente",
      },
    ],
    // Match MALO sembrado (caso real del #835): Carrasco quedó conciliado contra una transferencia
    // a Fernando Pérez (mismo monto). El worker no está en la lista → revert sólo borra el link.
    links: [
      {
        link_id: "lnk_carrasco",
        worker_rut: "20.009.075-6",
        worker_name: "Carrasco Díaz",
        amount: "1000000",
        bank_movement_id: "bm_fp_transfer",
        glosa: "TRANSFERENCIA A FERNANDO PEREZ",
        created_at: "2026-07-31T10:00:00Z",
      },
    ],
  };
}
const settlementBoard = freshSettlementBoard();
let settlementLinkSeq = 1;
function settlementPeriodOutstanding(): string {
  return settlementBoard.workers.reduce((s, w) => s + Number(w.outstanding || 0), 0).toString();
}

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
          // El impuesto de remuneraciones (IUSC) NO viene en el payroll de BUK — llega del
          // F29 (`/api/sii/f29/impuesto`). Acá solo las cotizaciones (Previred).
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
        // Por empleado: `costo_empresa` (líquido + leyes sociales) lo trae BUK real;
        // `total_haberes` es contrato FE-first (pendiente CC-API). El FE lee ambos tolerante.
        empleados: [
          {
            employee_id: 1,
            nombre: "Ana Pérez Soto",
            rut: "12.345.678-9",
            total_haberes: 6300000,
            costo_empresa: 6500000,
            liquido: 5000000,
          },
          {
            employee_id: 2,
            nombre: "Benjamín Rojas Díaz",
            rut: "9.876.543-2",
            total_haberes: 6300000,
            costo_empresa: 6500000,
            liquido: 5000000,
          },
          {
            employee_id: 3,
            nombre: "Carla Muñoz Vera",
            rut: "15.111.222-3",
            total_haberes: 5850000,
            costo_empresa: 5630000,
            liquido: 4330000,
          },
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
  /* #835 — board de conciliación de sueldos (owner/admin). Objeto genérico como en el backend. */
  http.get("*/api/admin/treasury/payroll-settlements/:period", () =>
    HttpResponse.json(
      {
        period_outstanding: settlementPeriodOutstanding(),
        workers: settlementBoard.workers,
        links: settlementBoard.links,
      },
      { status: 200 },
    ),
  ),
  http.post("*/api/admin/treasury/payroll-reconcile", async ({ request }) => {
    const body = (await request.json()) as {
      period?: string;
      amount?: number;
      worker_ruts?: string[];
      bank_movement_id?: string;
      dry_run?: boolean;
    };
    const ruts = body.worker_ruts ?? [];
    const requestedAmount = Math.max(0, Number(body.amount ?? 0));
    let remaining = requestedAmount;
    const applications = [];
    for (const rut of [...ruts].sort()) {
      const worker = settlementBoard.workers.find((item) => item.worker_rut === rut);
      if (!worker || remaining <= 0) continue;
      const outstanding = Number(worker.outstanding);
      const applyAmount = Math.min(remaining, outstanding);
      if (applyAmount <= 0) continue;
      const newPaid = Number(worker.paid_amount) + applyAmount;
      const newOutstanding = Math.max(0, Number(worker.liquido) - newPaid);
      applications.push({
        settlement_id: `settlement_${worker.worker_rut}`,
        worker_rut: worker.worker_rut,
        worker_name: worker.worker_name,
        apply_amount: applyAmount.toString(),
        new_paid: newPaid.toString(),
        new_outstanding: newOutstanding.toString(),
        new_status: newOutstanding <= 0 ? "paid" : "partially_paid",
      });
      remaining -= applyAmount;
    }
    const appliedTotal = requestedAmount - remaining;
    const response = {
      dry_run: body.dry_run === true,
      period: body.period ?? "",
      amount: requestedAmount.toString(),
      method: "manual",
      applied: applications,
      applied_total: appliedTotal.toString(),
      unapplied: remaining.toString(),
      period_outstanding_after: Math.max(
        0,
        Number(settlementPeriodOutstanding()) - appliedTotal,
      ).toString(),
    };
    if (body.dry_run) return HttpResponse.json(response, { status: 200 });

    const glosa =
      bankMovementsFixture.find((m) => m.id === body.bank_movement_id)?.description ??
      "Débito banco";
    for (const application of applications) {
      const w = settlementBoard.workers.find((x) => x.worker_rut === application.worker_rut);
      if (!w) continue;
      w.outstanding = application.new_outstanding;
      w.paid_amount = application.new_paid;
      w.status = application.new_status;
      settlementBoard.links.push({
        link_id: `lnk_${settlementLinkSeq++}`,
        worker_rut: w.worker_rut,
        worker_name: w.worker_name,
        amount: application.apply_amount,
        bank_movement_id: body.bank_movement_id ?? "",
        glosa,
        created_at: "2026-08-04T12:00:00Z",
      });
    }
    return HttpResponse.json(response, { status: 200 });
  }),
  http.post("*/api/admin/treasury/payroll-reconcile/revert", async ({ request }) => {
    const body = (await request.json()) as { link_id?: string };
    const idx = settlementBoard.links.findIndex((l) => l.link_id === body.link_id);
    if (idx < 0) {
      return HttpResponse.json({ detail: { code: "link_not_found" } }, { status: 404 });
    }
    const [link] = settlementBoard.links.splice(idx, 1);
    const w = settlementBoard.workers.find((x) => x.worker_rut === link!.worker_rut);
    if (w) {
      w.outstanding = w.liquido;
      w.paid_amount = "0";
      w.status = "pendiente";
    }
    return HttpResponse.json(
      {
        reverted: true,
        settlement: w ?? {
          worker_rut: link!.worker_rut,
          worker_name: link!.worker_name,
        },
      },
      { status: 200 },
    );
  }),
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
    {
      period: "2026-07-14",
      total_inflow: "1600000",
      total_outflow: "2400000",
      net: "-800000",
      row_count: 6,
    },
    {
      period: "2026-07-21",
      total_inflow: "500000",
      total_outflow: "1900000",
      net: "-1400000",
      row_count: 4,
    },
    {
      period: "2026-07-28",
      total_inflow: "3200000",
      total_outflow: "1100000",
      net: "2100000",
      row_count: 7,
    },
    {
      period: "2026-08-04",
      total_inflow: "800000",
      total_outflow: "2600000",
      net: "-1800000",
      row_count: 5,
    },
  ],
  grand_total: { inflow: "6100000", outflow: "8000000", net: "-1900000", row_count: 22 },
  excluded_attention: 0,
};

const cashMinimumFixture = {
  thresholds: [{ currency_code: "CLP", amount: "3000000", updated_at: "2026-07-01T00:00:00Z" }],
};

/* Ciclo de caja (DSO/DPO/CCC) — alimenta Gestión → Ciclo de caja (CicloCajaView).
   Caso realista: cobra a 48d, paga a 30d ⇒ 18 días de plata atrapada (CCC>0). */
const cashCycleFixture = {
  dso_days: 48,
  dpo_days: 30,
  ccc_days: 18,
  ar_total: "42000000",
  ap_total: "18500000",
  revenue_window: "111000000",
  cogs_window: "40000000",
  window_months: 3,
  window_from: "2026-05-01",
  window_to: "2026-07-01",
  as_of: "2026-07-29",
};

const cajaV2Handlers = [
  http.get("*/api/treasury/reports/cash-flow", () =>
    HttpResponse.json(cashFlowReportFixture, { status: 200 }),
  ),
  http.get("*/api/treasury/cash-minimum", () =>
    HttpResponse.json(cashMinimumFixture, { status: 200 }),
  ),
  http.get("*/api/treasury/cash-cycle", () => HttpResponse.json(cashCycleFixture, { status: 200 })),
  /* `GET /api/treasury/collection-forecast` — cobranza por VENCIMIENTO nominal. La app lo pide desde
     /caja para el KPI "Entra · 14 días" (`caja-v02-live.tsx`) y hasta ahora el mock no lo servía: la
     tarjeta quedaba en "sin dato" en todos los E2E, y un KPI que nunca publica cifra no prueba nada.

     El fixture FOOTEA contra los otros dos agregados a propósito, porque es lo que el gate de
     aceptación compara (INV-02):
       overdue 7.900.000 + buckets 16.900.000 + beyond 0 + sin_vencimiento 0 = 24.800.000
     que es exactamente `accounts-receivable.total` y `dashboard/summary.overdue_collections
     .total_receivable`. Si alguien cambia uno de los tres y no los otros, el invariante lo dice. */
  http.get("*/api/treasury/collection-forecast", () =>
    HttpResponse.json(
      {
        as_of: "2026-06-02",
        /* Vencido = la suma del aging no corriente de `accountsReceivableFixture`
           (3.200.000 + 2.100.000 + 1.400.000 + 1.200.000). */
        overdue: { nominal: "7900000", expected: "4740000" },
        /* Los cinco buckets del contrato. Suman 16.900.000 = el `aging.current` de la cartera. */
        buckets: [
          { label: "0-7d", days_from: 0, days_to: 7, nominal: "4200000", expected: "2520000" },
          { label: "8-14d", days_from: 8, days_to: 14, nominal: "3100000", expected: "1860000" },
          { label: "15-30d", days_from: 15, days_to: 30, nominal: "5000000", expected: "3000000" },
          { label: "31-60d", days_from: 31, days_to: 60, nominal: "3000000", expected: "1800000" },
          { label: "61-90d", days_from: 61, days_to: 90, nominal: "1600000", expected: "960000" },
        ],
        beyond_horizon: { nominal: "0", expected: "0" },
        /* Cero a propósito: el fixture no tiene receivables sin `due_date`. En producción este bucket
           se come la cartera entera (185 cuentas por $364.846.883, ninguna con vencimiento), y por eso
           el KPI de 14 días da +$0 allá. El mock no reproduce el bug: lo reproduce el gemelo. */
        sin_vencimiento: { nominal: "0", expected: "0" },
        total_nominal: "24800000",
        total_expected: "14880000",
      },
      { status: 200 },
    ),
  ),
  /* Proyección de cobros por comportamiento (ADR-0083 B2) — el insight "comportamiento de pago" de
     Ciclo de caja usa `vs_nominal.behavior_shift_days`. Fixture: tus clientes pagan 12 días TARDE, con
     18 de 25 facturas con historial. */
  http.get("*/api/treasury/collection-projection", () =>
    HttpResponse.json(
      {
        as_of: "2026-07-29",
        total_nominal: "87360000",
        total_expected: "81200000",
        overdue: { amount: "12000000", count: 4 },
        sin_fecha: { amount: "3000000", count: 2 },
        buckets: [],
        beyond_horizon: { amount: "0", count: 0 },
        vs_nominal: {
          behavior_shift_days: 12,
          docs_comportamiento: 18,
          docs_por_vencimiento: 7,
        },
      },
      { status: 200 },
    ),
  ),
  /* Modelo único de caja (#770): proyección forward del backend que alimenta el medidor de Caja v3.
     Escenario "ajustado": la caja toca su piso ($1,5M < mínima $2M) al día ~21 y se recupera. */
  http.get("*/api/treasury/cash-projection", ({ request }) => {
    const horizon = Number(new URL(request.url).searchParams.get("horizon_days")) || 90;
    return HttpResponse.json(
      {
        as_of: "2026-08-03",
        horizon_days: horizon,
        moneda: "CLP",
        saldo_hoy: "9800000",
        minimo: "2000000",
        dias_de_caja: 21,
        serie: [
          { fecha: "2026-08-10", saldo_cierre: "7000000", capa: "esperado" },
          { fecha: "2026-08-24", saldo_cierre: "1500000", capa: "esperado" },
          { fecha: "2026-09-07", saldo_cierre: "4000000", capa: "esperado" },
        ],
        escenario_duro: { dias_de_caja: 10, piso: "-3000000", piso_fecha: "2026-08-31" },
        punto_quiebre: {
          fecha: "2026-08-24",
          saldo: "1500000",
          causas: [
            { glosa: "Remuneraciones", monto: "-8500000", tipo: "pago" },
            { glosa: "F29 (IVA)", monto: "-4200000", tipo: "pago" },
          ],
        },
        por_cobrar_vencido: { total: "9400000", n: 3 },
        esperado_con_recuperacion: {
          dias_de_caja: 1,
          recuperacion_days: 30,
          total_recuperado: "9400000",
          serie: [
            { fecha: "2026-08-05", saldo_cierre: "1200000", capa: "esperado_con_recuperacion" },
          ],
          punto_quiebre: { fecha: "2026-08-06", saldo: "-3639436", causas: [] },
        },
        esperado_con_ingresos: {
          dias_de_caja: 1,
          total_ingreso_proyectado: "31161339",
          n_flujos: 12,
          serie: [{ fecha: "2026-08-05", saldo_cierre: "2100000", capa: "esperado_con_ingresos" }],
          punto_quiebre: { fecha: "2026-08-06", saldo: "-4044096", causas: [] },
        },
        vencido: {
          total: "9400000",
          items: [
            {
              glosa: "TD SYNNEX CHILE LIMITADA",
              monto: "5000000",
              dias_atraso: 45,
              tipo: "cobro_vencido",
              side: "receivable",
              folio: "435",
              source_external_id: "sii-ventas-33-435",
            },
            {
              glosa: "COMERCIAL KAUFMANN S.A.",
              monto: "2960000",
              dias_atraso: null,
              tipo: "cobro_sin_fecha",
              side: "receivable",
              folio: null,
              source_external_id: "sii-ventas-33-9021",
            },
            {
              glosa: "INMOBILIARIA VISTA KENNEDY",
              monto: "1440000",
              dias_atraso: 12,
              tipo: "cobro_vencido",
              side: "receivable",
              folio: "1201",
              source_external_id: "sii-ventas-33-1201",
            },
          ],
        },
        fuentes: { calidad_fechas: { con_fecha_real: 0.8, items_totales: 40 } },
      },
      { status: 200 },
    );
  }),
];

/* Cola de conciliación (ADR-0036/0042). Handlers DETERMINISTAS a propósito: `review` devuelve
   siempre el mismo seed y las mutaciones responden éxito sin mutar la cola. Así el e2e no depende
   de estado que se filtre entre tests ni entre retries (MSW en browser no se resetea por test). */
const reconciliationReviewSeed = [
  /* Calza con un movimiento de la cuenta acct-1 (mayo 2026) → alimenta el tab "Sugerencias" + la banda
     de conciliar por movimiento en el detalle de Banco (Fase 2). */
  {
    movement_id: "mov-unclas-2",
    date: "2026-05-13",
    amount: "1190000",
    direction: "credit",
    currency_code: "CLP",
    description: "ABONO CLIENTE FACTURA 1042",
    suggestion: {
      document_kind: "receivable",
      document_id: "r-fac-1042",
      name: "X Capital SpA",
      score: "83",
      document_count: 1,
      topology: "1:1",
      reasons: ["RUT coincidente", "monto exacto"],
      eligibility: ["same_tenant", "same_currency", "open_balance", "feasible_date"],
      can_confirm: true,
      bulk_eligible: true,
      documents: [
        {
          document_id: "r-fac-1042",
          kind: "receivable",
          document_type: 33,
          folio: "1042",
          rut: "76123456-7",
          name: "X Capital SpA",
          amount: "1190000",
          date: "2026-05-13",
          due_date: "2026-06-13",
          source_provider: "sii_rcv",
        },
      ],
    },
  },
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
      can_confirm: false,
      bulk_eligible: false,
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
      can_confirm: false,
      bulk_eligible: false,
    },
  },
  {
    movement_id: "rec-mv-3",
    date: "2026-07-10",
    amount: "89900",
    description: "CARGO PAC",
    suggestion: {
      document_kind: "payable",
      document_id: null,
      name: null,
      score: "64",
      can_confirm: false,
      bulk_eligible: false,
    },
  },
];

const reconciliationHandlers = [
  /* #851 — conciliar cobros fila-por-fila desde Caja: concilia tantos documentos como IDs vengan. */
  http.post("*/api/treasury/reconciliation/mark-collected", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { source_external_ids?: string[] };
    return HttpResponse.json(
      { conciliados: body.source_external_ids?.length ?? 0 },
      { status: 200 },
    );
  }),
  /* #851 — "Deshacer": re-abre los documentos marcados (vuelven a por cobrar). */
  http.post("*/api/treasury/reconciliation/mark-collected/revert", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { source_external_ids?: string[] };
    return HttpResponse.json(
      { reabiertos: body.source_external_ids?.length ?? 0 },
      { status: 200 },
    );
  }),
  http.post("*/api/treasury/reconcile", () =>
    HttpResponse.json(
      {
        matched: 9,
        consolidated: 1,
        review: 3,
        excluded: 2,
        ambiguous: 0,
        no_candidate: 1,
        iva_retention: 0,
        nc_netting: 0,
        holding: 0,
        prepago_applied: 0,
        processor_batch: 0,
      },
      { status: 200 },
    ),
  ),
  http.get("*/api/treasury/reconciliation/review", () =>
    HttpResponse.json(
      { items: reconciliationReviewSeed, count: reconciliationReviewSeed.length },
      { status: 200 },
    ),
  ),
  http.get("*/api/treasury/reconciliation/:movementId/document-suggestions", ({ params }) => {
    const movementId = String(params.movementId);
    const candidates: Record<
      string,
      Array<{
        document_id: string;
        kind: string;
        document_type: number;
        folio: string;
        rut: string;
        name: string;
        amount: string;
        date: string;
        score: number;
        reasons: string[];
      }>
    > = {
      "mov-unclas-2": [
        {
          document_id: "r-fac-1042",
          kind: "receivable",
          document_type: 33,
          folio: "1042",
          rut: "76.123.456-0",
          name: "X Capital SpA",
          amount: "1190000",
          date: "2026-05-01",
          score: 83,
          reasons: ["folio", "amount"],
        },
      ],
      "rec-mv-1": [
        {
          document_id: "r1",
          kind: "receivable",
          document_type: 33,
          folio: "435",
          rut: "76.123.456-0",
          name: "Comercial Los Andes SpA",
          amount: "1250000",
          date: "2026-07-01",
          score: 86,
          reasons: ["amount", "name"],
        },
      ],
      "rec-mv-2": [
        {
          document_id: "p1",
          kind: "payable",
          document_type: 33,
          folio: "812",
          rut: "77.987.654-3",
          name: "Distribuidora del Sur Ltda",
          amount: "340000",
          date: "2026-07-02",
          score: 72,
          reasons: ["amount"],
        },
      ],
    };
    return HttpResponse.json(
      { movement_id: movementId, suggestions: candidates[movementId] ?? [] },
      { status: 200 },
    );
  }),
  http.post("*/api/treasury/reconciliation/:movementId/confirm", ({ params }) =>
    HttpResponse.json({ movement_id: params.movementId, status: "confirmed" }, { status: 200 }),
  ),
  http.post("*/api/treasury/reconciliation/:movementId/reject", ({ params }) =>
    HttpResponse.json({ movement_id: params.movementId, status: "rejected" }, { status: 200 }),
  ),
  http.post(
    "*/api/treasury/reconciliation/:movementId/document-suggestions/:documentId/reject",
    ({ params }) =>
      HttpResponse.json(
        {
          movement_id: params.movementId,
          document_id: params.documentId,
          status: "rejected",
        },
        { status: 200 },
      ),
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

/* e2e: API-keys de la empresa (MCP). Estado de módulo (se reinicia por page.goto → aislado por test):
   listar / crear (devuelve la key entera una vez) / revocar. */
let apiKeysE2E: {
  id: string;
  name: string;
  role_code: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}[] = [
  {
    id: "k1",
    name: "Asistente de finanzas",
    role_code: "viewer",
    key_prefix: "qav_live_ab12",
    created_at: "2026-08-01T10:00:00Z",
    last_used_at: "2026-08-09T08:30:00Z",
    revoked_at: null,
  },
];
let apiKeyCounter = 1;
const apiKeysHandlers = [
  http.get("*/api/admin/api-keys", () => HttpResponse.json({ items: apiKeysE2E }, { status: 200 })),
  http.post("*/api/admin/api-keys", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string; role_code?: string };
    apiKeyCounter += 1;
    const id = `k${apiKeyCounter}`;
    const prefix = `qav_live_${id}xy`;
    const item = {
      id,
      name: body.name || "Asistente",
      role_code: body.role_code || "viewer",
      key_prefix: prefix,
      created_at: "2026-08-10T00:00:00Z",
      last_used_at: null,
      revoked_at: null,
    };
    apiKeysE2E = [item, ...apiKeysE2E];
    return HttpResponse.json(
      { ...item, key: `${prefix}_FULLKEYSECRET1234567890` },
      { status: 201 },
    );
  }),
  http.delete("*/api/admin/api-keys/:keyId", ({ params }) => {
    apiKeysE2E = apiKeysE2E.map((k) =>
      k.id === params.keyId ? { ...k, revoked_at: "2026-08-10T00:00:00Z" } : k,
    );
    return new HttpResponse(null, { status: 204 });
  }),
  /* Info de conexión del MCP (la pinta Administración → MCP). El backend mantiene el instructivo. */
  http.get("*/api/mcp/connection", () =>
    HttpResponse.json(
      {
        server_url: "https://mcp.qavante.com",
        auth_header: "X-Api-Key",
        auth_bearer: "Bearer <API-key>",
        writes_enabled: false,
        has_api_key: true,
        docs: {
          resumen: "Conecta las finanzas de tu empresa a un asistente (Claude, ChatGPT) por MCP.",
          pasos: [
            "Copia o crea la API-key de tu empresa acá.",
            "En tu asistente, agrega un servidor MCP con la URL de arriba y tu key en el header X-Api-Key.",
            "Pregúntale '¿cómo va mi caja este mes?' y responde con tus números.",
          ],
          clientes: [
            { nombre: "Claude / ChatGPT vía API", soportado: true, nota: "Header X-Api-Key." },
            {
              nombre: "App de ChatGPT / Claude (OAuth)",
              soportado: false,
              nota: "Llega en la fase 3.",
            },
          ],
        },
      },
      { status: 200 },
    ),
  ),
];

const financialDecisionHandlers = [
  /* Envelope único de decisión para las cinco rutas. Los query params del CTA
     son deliberados: los tests prueban que la UI los conserva literalmente y
     no reconstruye links ni ids en el cliente. */
  http.get("*/api/treasury/decision-brief", () => HttpResponse.json(DECISION_BRIEF_E2E_FIXTURE)),
  http.get("*/api/core/financial-scope", ({ request }) => {
    const asOf = new URL(request.url).searchParams.get("as_of") ?? "2026-09-09";
    return HttpResponse.json(
      {
        legal_entity_id: overviewCompletoV13.scope.legal_entity_id,
        functional_currency_code: overviewCompletoV13.scope.currency,
        as_of: asOf,
        legal_entity_provenance: "test_fixture",
      },
      { status: 200 },
    );
  }),
  http.get("*/api/treasury/financing-overview", () =>
    HttpResponse.json(overviewCompletoV13, { status: 200 }),
  ),
  http.get("*/api/treasury/working-capital-refinancing-evaluation", () =>
    HttpResponse.json(evaluationV13, { status: 200 }),
  ),
  http.post("*/api/treasury/simulations/evaluate", async ({ request }) => {
    const body = (await request.json()) as SimulationEvaluateRequest;
    return HttpResponse.json(
      {
        ...simulationReadyV14,
        scope: {
          legal_entity_id: body.legal_entity_id,
          currency: body.currency,
          as_of: body.as_of,
          horizon_days: body.horizon_days,
        },
        memo: { ...simulationReadyV14.memo, assumptions: body.assumptions },
      },
      { status: 200 },
    );
  }),
];

const activityHandlers = [
  http.get("*/api/activity-log", () =>
    HttpResponse.json(
      {
        total: 2,
        items: [
          {
            source: "audit_event",
            source_id: "audit-1",
            event_type: "classification_rule.create",
            summary: "classification_rule.create",
            created_at: "2026-09-11T14:30:00Z",
            outcome: null,
          },
          {
            source: "sync_run",
            source_id: "sync-1",
            event_type: "sii.sync",
            summary: "sii.sync completed",
            created_at: "2026-09-11T13:00:00Z",
            outcome: "completed",
          },
        ],
      },
      { status: 200 },
    ),
  ),
  http.get("*/api/reversible-actions", () =>
    HttpResponse.json(
      {
        total: 1,
        items: [
          {
            action_id: "payable-proveedor-uno",
            action_type: "payable.postpone",
            summary:
              "Postergamos 15 días el pago a Proveedor Uno: vencía el 2026-03-10 y ahora vence el 2026-03-25",
            created_at: "2026-09-11T12:00:00Z",
            undo_expires_at: "2026-09-18T12:00:00Z",
            undo_available: true,
            undo_result: null,
            status: "active",
            reverted_at: null,
            reverted_by: null,
          },
        ],
      },
      { status: 200 },
    ),
  ),
  http.post("*/api/reversible-actions/:actionId/revert", ({ params }) =>
    HttpResponse.json(
      {
        action_id: String(params.actionId),
        action_type: "payable.postpone",
        result: "reverted",
        reverted_at: "2026-09-12T12:00:00Z",
        detail: {},
      },
      { status: 200 },
    ),
  ),
];

const INBOX_ENTITY_A = "e_tooxs";
const INBOX_ENTITY_B = "e_demo";

export const workInboxHandlers = [
  http.get("*/api/treasury/work-inbox", ({ request }) => {
    const entity = request.headers.get("x-qavante-company-id");
    const requestedEntity = new URL(request.url).searchParams.get("legal_entity_id");
    if ((entity !== INBOX_ENTITY_A && entity !== INBOX_ENTITY_B) || requestedEntity !== entity) {
      return HttpResponse.json(
        { detail: { code: "scope_mismatch:legal_entity" } },
        { status: 404 },
      );
    }
    const beta = entity === INBOX_ENTITY_B;
    const id = beta
      ? "22222222-2222-4222-8222-222222222223"
      : "11111111-1111-4111-8111-111111111112";
    const href = `/documentos/receivable/${id}`;
    const item = {
      id,
      title: beta ? "Cobro Beta" : "Cobro Alfa",
      amount: beta ? "200" : "1000",
      currency: beta ? "USD" : "CLP",
      relevant_date: "2026-09-18",
      urgency: "overdue" as const,
      status: "overdue",
      href,
    };
    const queue = (kind: "receivables" | "payables" | "reconciliation" | "classification") => ({
      kind,
      label: {
        receivables: "Cobrar",
        payables: "Pagar",
        reconciliation: "Conciliar",
        classification: "Clasificar",
      }[kind],
      action_label: "Abrir siguiente documento",
      href: kind === "receivables" ? href : "/bandeja",
      count: kind === "receivables" ? 1 : 0,
      amounts: kind === "receivables" ? [{ currency: item.currency, amount: item.amount }] : [],
      data_state: kind === "receivables" ? "available" : "partial",
      limitations: kind === "receivables" ? [] : ["Sin pendientes confirmados"],
      next_date: kind === "receivables" ? item.relevant_date : null,
      items: kind === "receivables" ? [item] : [],
    });
    return HttpResponse.json({
      generated_at: "2026-09-21T10:00:00Z",
      legal_entity_id: entity,
      queues: ["receivables", "payables", "reconciliation", "classification"].map((kind) =>
        queue(kind as "receivables" | "payables" | "reconciliation" | "classification"),
      ),
      priorities: [{ ...item, queue: "receivables" }],
    });
  }),
];

export const handlers = [
  ...workInboxHandlers,
  ...financialDecisionHandlers,
  ...activityHandlers,
  ...cashProjectionRunHandlers,
  ...apiKeysHandlers,
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
  ...receivableDebtorsHandlers,
  ...cobranzaHandlers,
  ...preferencesHandlers,
  ...pagosHandlers,
  ...dashboardHandlers,
  ...pulsoHandlers,
  ...assistantHandlers,
  ...currenciesHandlers,
  ...classificationRulesHandlers,
  ...industryTemplatesHandlers,
  ...siiHandlers,
];
