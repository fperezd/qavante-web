/* Sanity tests sobre los handlers MSW. No testean el contrato del
   backend real, testean que: (1) el mock devuelve los shapes correctos,
   (2) las mutaciones funcionan (invite agrega, suspend cambia status),
   (3) los error states declarados en el contrato funcionan
   (last_owner_protection, email_already_exists, invitation_already_pending).

   Si estos tests rompen tras un cambio en handlers.ts o db.ts, el handler
   no respeta el contrato. */
import { describe, expect, it } from "vitest";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function json<T>(input: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const r = await fetch(`${API}${input}`, init);
  const body = r.status === 204 ? (undefined as T) : ((await r.json()) as T);
  return { status: r.status, body };
}

describe("MSW handlers — auth", () => {
  it("POST /api/auth/login con credenciales devuelve 200 + user", async () => {
    const { status, body } = await json<{ user: { id: string; email: string; role: string } }>(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: "10.341.986-7", password: "secret" }),
      },
    );
    expect(status).toBe(200);
    expect(body.user.email).toBe("fperez@tooxs.com");
    expect(body.user.role).toBe("owner");
  });

  it("POST /api/auth/login sin credenciales devuelve 401 invalid_credentials", async () => {
    const { status, body } = await json<{ code: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(401);
    expect(body.code).toBe("invalid_credentials");
  });

  it("GET /api/me devuelve el SessionUser extendido", async () => {
    const { status, body } = await json<{
      user: { email: string; tenant_id: string; permissions: string[] };
    }>("/api/me");
    expect(status).toBe(200);
    expect(body.user.tenant_id).toBeDefined();
    expect(body.user.permissions).toContain("users.read");
  });
});

describe("MSW handlers — users", () => {
  it("GET /api/users devuelve seed paginado", async () => {
    const { status, body } = await json<{ items: unknown[]; total: number }>("/api/users");
    expect(status).toBe(200);
    expect(body.total).toBe(6);
    expect(body.items.length).toBe(6);
  });

  it("GET /api/users?status=invited filtra correctamente", async () => {
    const { status, body } = await json<{
      items: { status: string }[];
      total: number;
    }>("/api/users?status=invited");
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items.every((u) => u.status === "invited")).toBe(true);
  });

  it("POST /api/users invita un usuario nuevo → status=invited", async () => {
    const { status, body } = await json<{ status: string; email: string }>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nuevo@empresa.cl", role: "accountant" }),
    });
    expect(status).toBe(201);
    expect(body.email).toBe("nuevo@empresa.cl");
    expect(body.status).toBe("invited");

    /* Verificar que aparece en la lista. */
    const list = await json<{ total: number }>("/api/users");
    expect(list.body.total).toBe(7);
  });

  it("POST /api/users con email duplicado activo → 409 email_already_exists", async () => {
    const { status, body } = await json<{ code: string }>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fperez@tooxs.com", role: "viewer" }),
    });
    expect(status).toBe(409);
    expect(body.code).toBe("email_already_exists");
  });

  it("POST /api/users con invitación pendiente → 409 invitation_already_pending", async () => {
    const { status, body } = await json<{ code: string }>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pendiente@empresa.cl", role: "viewer" }),
    });
    expect(status).toBe(409);
    expect(body.code).toBe("invitation_already_pending");
  });

  it("PATCH /api/users/{id} suspende usuario → status cambia", async () => {
    const { status, body } = await json<{ status: string }>("/api/users/u_admin_01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(status).toBe(200);
    expect(body.status).toBe("suspended");
  });

  it("PATCH /api/users/{único-owner} suspend → 409 last_owner_protection", async () => {
    const { status, body } = await json<{ code: string }>("/api/users/u_owner_01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(status).toBe(409);
    expect(body.code).toBe("last_owner_protection");
  });

  it("PATCH /api/users/{id-inexistente} → 404 not_found", async () => {
    const { status, body } = await json<{ code: string }>("/api/users/u_no_existe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });
});

describe("MSW handlers — credentials SII", () => {
  it("GET /api/credentials/sii devuelve seed completo (empresa + personas + cert)", async () => {
    const { status, body } = await json<{
      company: { configured: boolean; rut: string };
      persons: { rut: string }[];
      certificate: { configured: boolean };
    }>("/api/credentials/sii");
    expect(status).toBe(200);
    expect(body.company.configured).toBe(true);
    expect(body.company.rut).toBe("76.123.456-7");
    expect(body.persons.length).toBe(2);
    expect(body.certificate.configured).toBe(true);
  });

  it("PUT /api/credentials/sii/company con RUT distinto → 409 rut_mismatch", async () => {
    const { status, body } = await json<{ code: string }>("/api/credentials/sii/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "99.999.999-9", password: "x4digit" }),
    });
    expect(status).toBe(409);
    expect(body.code).toBe("rut_mismatch");
  });

  it("PUT /api/credentials/sii/company con clave corta → 422 validation_error", async () => {
    const { status, body } = await json<{ code: string }>("/api/credentials/sii/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "76.123.456-7", password: "x" }),
    });
    expect(status).toBe(422);
    expect(body.code).toBe("validation_error");
  });

  it("PUT /api/credentials/sii/person agrega persona nueva", async () => {
    const r = await fetch(`${API}/api/credentials/sii/person`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "11.111.111-1", name: "Nuevo", password: "secreta" }),
    });
    expect(r.status).toBe(204);
    const list = await json<{ persons: { rut: string }[] }>("/api/credentials/sii");
    expect(list.body.persons.some((p) => p.rut === "11.111.111-1")).toBe(true);
  });

  it("DELETE /api/credentials/sii/person/:rut existente → 204", async () => {
    const r = await fetch(`${API}/api/credentials/sii/person/10.341.986-7`, { method: "DELETE" });
    expect(r.status).toBe(204);
  });

  it("DELETE /api/credentials/sii/person/:rut inexistente → 404", async () => {
    const { status, body } = await json<{ code: string }>(
      "/api/credentials/sii/person/99.999.999-9",
      { method: "DELETE" },
    );
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });

  it("PUT /api/credentials/certificate sin file → 422 invalid_pkcs12", async () => {
    const form = new FormData();
    form.append("password", "asdf");
    const r = await fetch(`${API}/api/credentials/certificate`, { method: "PUT", body: form });
    const body = (await r.json()) as { code: string };
    expect(r.status).toBe(422);
    expect(body.code).toBe("invalid_pkcs12");
  });

  it("PUT /api/credentials/certificate con file válido + password → 200 + certificate status", async () => {
    const form = new FormData();
    form.append("file", new Blob(["mock-cert-binary"], { type: "application/x-pkcs12" }));
    form.append("password", "secreta");
    const r = await fetch(`${API}/api/credentials/certificate`, { method: "PUT", body: form });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { certificate: { configured: boolean; expires_at: string } };
    expect(body.certificate.configured).toBe(true);
    expect(body.certificate.expires_at).toBeDefined();
  });

  it("DELETE /api/credentials/certificate borra (204) y luego 404 si se reintenta", async () => {
    const first = await fetch(`${API}/api/credentials/certificate`, { method: "DELETE" });
    expect(first.status).toBe(204);
    const second = await fetch(`${API}/api/credentials/certificate`, { method: "DELETE" });
    const body = (await second.json()) as { code: string };
    expect(second.status).toBe(404);
    expect(body.code).toBe("certificate_not_configured");
  });
});
