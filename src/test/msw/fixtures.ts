/* Seed determinístico para handlers MSW. Sin faker / Math.random —
   los tests deben ser reproducibles. Alineado con shape de
   docs/backend-contracts/c0-auth-and-users.md § 3.1. */
import type { User } from "@/lib/api/users";

export const SEED_USERS: User[] = [
  {
    id: "u_owner_01",
    email: "fperez@tooxs.com",
    name: "Fernando Pérez",
    role: "owner",
    status: "active",
    last_login_at: "2026-05-13T08:00:00Z",
    invited_at: null,
    created_at: "2026-04-01T10:00:00Z",
  },
  {
    id: "u_admin_01",
    email: "admin@empresa.cl",
    name: "Camila Soto",
    role: "admin",
    status: "active",
    last_login_at: "2026-05-12T20:14:00Z",
    invited_at: null,
    created_at: "2026-04-05T09:30:00Z",
  },
  {
    id: "u_finance_01",
    email: "finanzas@empresa.cl",
    name: "Diego Rojas",
    role: "finance_manager",
    status: "active",
    last_login_at: "2026-05-12T18:45:00Z",
    invited_at: null,
    created_at: "2026-04-10T14:00:00Z",
  },
  {
    id: "u_accountant_01",
    email: "contador@externo.cl",
    name: "Pablo Núñez",
    role: "accountant",
    status: "active",
    last_login_at: "2026-05-11T11:20:00Z",
    invited_at: null,
    created_at: "2026-04-15T12:00:00Z",
  },
  {
    id: "u_viewer_01",
    email: "viewer@empresa.cl",
    name: "Andrea Lagos",
    role: "viewer",
    status: "suspended",
    last_login_at: "2026-04-30T16:00:00Z",
    invited_at: null,
    created_at: "2026-04-20T10:00:00Z",
  },
  {
    id: "u_invited_01",
    email: "pendiente@empresa.cl",
    name: null,
    role: "finance_manager",
    status: "invited",
    last_login_at: null,
    invited_at: "2026-05-12T09:00:00Z",
    created_at: "2026-05-12T09:00:00Z",
  },
];

/* User devuelto por POST /api/auth/login. Coincide con el seed owner.
   El SEED_USERS[0] está fijado a `u_owner_01` (Fernando Pérez). */
const ownerSeed = SEED_USERS[0]!;
export const SEED_SESSION_USER = {
  id: ownerSeed.id,
  email: ownerSeed.email,
  role: ownerSeed.role,
};
