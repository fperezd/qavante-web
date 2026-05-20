/* Sanity de la NUEVA superficie de credenciales (Opción A, sii_rcv +
   certificados multi-holder) vía MSW + estabilidad de query keys. Si rompe
   tras tocar handlers.ts o credentials.ts, el mock dejó de respetar el
   contrato del OpenAPI generado. */
import { describe, expect, it } from "vitest";
import {
  credentialsKeysV2,
  SII_SOURCE_CODE,
  type CertificateMetadataResponse,
  type CertificatesListResponse,
  type CredentialMetadataResponse,
  type CredentialPutResponse,
} from "./credentials";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("credentialsKeysV2", () => {
  it("keys namespaced y separan credential vs certificates", () => {
    expect(credentialsKeysV2.all).toEqual(["credentials-v2"]);
    expect(credentialsKeysV2.siiCredential()).toEqual([
      "credentials-v2",
      "sources",
      "sii_rcv",
      "credential",
    ]);
    expect(credentialsKeysV2.certificates()).toEqual(["credentials-v2", "certificates"]);
  });

  it("SII_SOURCE_CODE es sii_rcv (decisión Opción A, no inventar otra fuente)", () => {
    expect(SII_SOURCE_CODE).toBe("sii_rcv");
  });
});

describe("MSW — credenciales V2 (Opción A)", () => {
  it("GET .../credential → metadata con shape esperado (sin secreto)", async () => {
    const r = await fetch(`${API}/api/admin/sources/sii_rcv/credential`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as CredentialMetadataResponse;
    expect(body.source_code).toBe("sii_rcv");
    expect(body.expected_keys).toEqual(["rut", "password"]);
    expect(typeof body.is_active).toBe("boolean");
    // El backend NO devuelve la clave (regla 6): no debe haber campo password.
    expect("password" in body).toBe(false);
  });

  it("POST .../credential sin rut/password → 422", async () => {
    const r = await fetch(`${API}/api/admin/sources/sii_rcv/credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(422);
  });

  it("POST .../credential con payload → 200 + is_active true; GET refleja el estado", async () => {
    const put = await fetch(`${API}/api/admin/sources/sii_rcv/credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "76.123.456-7", password: "secret" }),
    });
    expect(put.status).toBe(200);
    const putBody = (await put.json()) as CredentialPutResponse;
    expect(putBody.source_code).toBe("sii_rcv");
    expect(putBody.is_active).toBe(true);

    const get = await fetch(`${API}/api/admin/sources/sii_rcv/credential`);
    const getBody = (await get.json()) as CredentialMetadataResponse;
    expect(getBody.is_active).toBe(true);
  });

  it("POST .../credential/test devuelve validation con outcome", async () => {
    const r = await fetch(`${API}/api/admin/sources/sii_rcv/credential/test`, {
      method: "POST",
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { validation: { outcome: string; message: string } };
    expect(typeof body.validation.outcome).toBe("string");
    expect(typeof body.validation.message).toBe("string");
  });

  it("POST certificate + GET certificates list → incluye el subido con expires_at", async () => {
    const up = await fetch(`${API}/api/admin/certificates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pfx_base64: "ZmFrZS1wZngtcGF5bG9hZA==",
        password: "pfx-secret",
        password_hint: "la del banco",
        rut_holder: "76.987.654-3",
      }),
    });
    expect(up.status).toBe(200);
    const upBody = (await up.json()) as { certificate: CertificateMetadataResponse };
    expect(typeof upBody.certificate.id).toBe("string");
    expect(typeof upBody.certificate.expires_at).toBe("string");

    const list = await fetch(`${API}/api/admin/certificates`);
    const listBody = (await list.json()) as CertificatesListResponse;
    expect(listBody.count).toBeGreaterThanOrEqual(1);
    expect(listBody.certificates?.some((c) => c.id === upBody.certificate.id)).toBe(true);
  });
});
