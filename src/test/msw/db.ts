/* Estado in-memory mutable de los handlers MSW. Sobrevive entre requests
   en un mismo proceso (browser dev session, vitest run). Para tests con
   aislamiento, llamá resetDb() en beforeEach.

   El estado de credenciales SII (Opción A) vive ahora dentro de
   handlers.ts (sii_rcv credential + certificates collection), no acá. */
import type { User, InviteUserBody, UpdateUserBody } from "@/lib/api/users";
import { SEED_USERS } from "./fixtures";

let usersStore: User[] = [];
let nextId = 1;

export function resetDb(): void {
  usersStore = SEED_USERS.map((u) => ({ ...u }));
  nextId = 1;
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
