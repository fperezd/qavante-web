/* Estado in-memory mutable de los handlers MSW. Sobrevive entre requests
   en un mismo proceso (browser dev session, vitest run). Para tests con
   aislamiento, llamá resetDb() en beforeEach. */
import type { User, InviteUserBody, UpdateUserBody } from "@/lib/api/users";
import type {
  SiiCompanyStatus,
  SiiPersonStatus,
  CertificateStatus,
  SetCompanyCredentialsBody,
  SetPersonCredentialsBody,
} from "@/lib/api/credentials";
import { SEED_USERS, SEED_SII_COMPANY, SEED_SII_PERSONS, SEED_CERTIFICATE } from "./fixtures";

let usersStore: User[] = [];
let nextId = 1;
let companyCreds: SiiCompanyStatus = { configured: false };
let personCreds: SiiPersonStatus[] = [];
let certificateState: CertificateStatus = { configured: false };

export function resetDb(): void {
  usersStore = SEED_USERS.map((u) => ({ ...u }));
  nextId = 1;
  companyCreds = { ...SEED_SII_COMPANY };
  personCreds = SEED_SII_PERSONS.map((p) => ({ ...p }));
  certificateState = { ...SEED_CERTIFICATE };
}

resetDb();

export function listUsers(): User[] {
  return usersStore;
}

export function findUser(id: string): User | undefined {
  return usersStore.find((u) => u.id === id);
}

export function emailExists(email: string): boolean {
  return usersStore.some((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function invitationPending(email: string): boolean {
  return usersStore.some(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.status === "invited",
  );
}

export function inviteUser(body: InviteUserBody): User {
  const now = new Date().toISOString();
  const user: User = {
    id: `u_invited_${String(nextId++).padStart(4, "0")}`,
    email: body.email,
    name: body.name ?? null,
    role: body.role,
    status: "invited",
    last_login_at: null,
    invited_at: now,
    created_at: now,
  };
  usersStore.push(user);
  return user;
}

export function updateUser(id: string, body: UpdateUserBody): User | null {
  const user = findUser(id);
  if (!user) return null;
  if (body.role !== undefined) user.role = body.role;
  if (body.status !== undefined) user.status = body.status;
  return user;
}

/* Última owner activo del tenant: protección documentada en
   docs/backend-contracts/c0-auth-and-users.md § 3.3 — el backend rechaza
   con 409 last_owner_protection si se intenta cambiar/suspender al único. */
export function isLastActiveOwner(id: string): boolean {
  const activeOwners = usersStore.filter((u) => u.role === "owner" && u.status === "active");
  return activeOwners.length === 1 && activeOwners[0]?.id === id;
}

/* ===== Credenciales SII (C1 prep, ver c1-sii-credentials.md) ===== */

/* RUT empresa del tenant fixture. Hardcoded a SEED_SII_COMPANY.rut para
   poder testear rut_mismatch. */
const TENANT_COMPANY_RUT = SEED_SII_COMPANY.rut;

export function getCredentialsStatus(): {
  company: SiiCompanyStatus;
  persons: SiiPersonStatus[];
  certificate: CertificateStatus;
} {
  return {
    company: companyCreds,
    persons: personCreds,
    certificate: certificateState,
  };
}

export function setCompanyCreds(body: SetCompanyCredentialsBody): {
  ok: boolean;
  code?: "rut_mismatch";
} {
  if (body.rut !== TENANT_COMPANY_RUT) return { ok: false, code: "rut_mismatch" };
  companyCreds = {
    configured: true,
    rut: body.rut,
    last_rotated_at: new Date().toISOString(),
  };
  return { ok: true };
}

export function setPersonCreds(body: SetPersonCredentialsBody): SiiPersonStatus {
  const existing = personCreds.find((p) => p.rut === body.rut);
  if (existing) {
    existing.last_rotated_at = new Date().toISOString();
    if (body.name !== undefined) existing.name = body.name;
    return existing;
  }
  const fresh: SiiPersonStatus = {
    rut: body.rut,
    name: body.name ?? null,
    configured: true,
    last_rotated_at: new Date().toISOString(),
  };
  personCreds.push(fresh);
  return fresh;
}

export function deletePersonCreds(rut: string): boolean {
  const idx = personCreds.findIndex((p) => p.rut === rut);
  if (idx === -1) return false;
  personCreds.splice(idx, 1);
  return true;
}

/* Upload de certificado: el mock no parsea el archivo (sería overkill),
   solo valida que es un Blob/File de tamaño razonable y trackea estado.
   Para escenarios de error, ver handlers.ts. */
export function uploadCertificate(opts: { expiresAt: string; subjectRut: string }): void {
  certificateState = {
    configured: true,
    subject_rut: opts.subjectRut,
    expires_at: opts.expiresAt,
    uploaded_at: new Date().toISOString(),
  };
}

export function deleteCertificate(): boolean {
  if (!certificateState.configured) return false;
  certificateState = { configured: false };
  return true;
}
