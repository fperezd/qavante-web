// Handlers REST de MSW v2 alineados al contrato
// docs/backend-contracts/c0-auth-and-users.md.
//
// Wildcard host ("* slash api slash ...") intercepta tanto requests a la
// URL de prod (api.qavante.com) como a dev local (localhost:3000) sin
// acoplarse a un valor exacto de NEXT_PUBLIC_API_URL.
//
// Cookies: Set-Cookie HttpOnly funciona si el dev hace requests
// same-origin (i.e., NEXT_PUBLIC_API_URL apunta a su dev server). Para
// cross-origin, ver CONTRIBUTING.md sección "MSW dev mode".
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

const SESSION_COOKIE = "qavante_session=msw-mock-token; Path=/; HttpOnly; SameSite=Lax";

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
        "Set-Cookie": "qavante_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
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

export const handlers = [...authHandlers, ...usersHandlers];
