/* Tipos + hooks de TanStack Query para User CRUD + invitaciones + permisos.
   Alineado con [docs/backend-contracts/c0-auth-and-users.md § 3]. Endpoints VIVOS en prod y
   aceptan cookie (verificado 2026-07-17): GET/POST /api/users, PATCH /api/users/{id},
   GET /api/me, GET /api/users/me/permissions. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ApiError } from "./errors";
import type { UserRole } from "@/lib/auth/types";
import type { components } from "./types";

/* `/api/me` — payload del usuario logueado. Source de verdad: schema
   `MeResponse` del OpenAPI generado. Re-exportamos para que la UI no
   tenga que conocer el namespace `components`. */
export type MeResponse = components["schemas"]["MeResponse"];
export type MeUser = components["schemas"]["MeUser"];

export type UserStatus = "active" | "suspended" | "invited";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  last_login_at: string | null;
  invited_at: string | null;
  created_at: string;
}

export interface UsersListResponse {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}

export interface InviteUserBody {
  email: string;
  role: UserRole;
  name?: string;
}

export interface UpdateUserBody {
  role?: UserRole;
  status?: Extract<UserStatus, "active" | "suspended">;
}

export interface UsersListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

const usersKeys = {
  all: ["users"] as const,
  list: (params: UsersListParams) => [...usersKeys.all, "list", params] as const,
  me: () => [...usersKeys.all, "me"] as const,
  myPermissions: () => [...usersKeys.all, "me", "permissions"] as const,
};

export { usersKeys };

export type PermissionsResponse = components["schemas"]["PermissionsResponse"];

/** `GET /api/users/me/permissions` — permisos reales del rol del usuario logueado
 *  (`{ permissions: string[], role }`, del registry `PERMISSIONS_BY_ROLE`). Cualquier rol puede
 *  llamarlo (solo expone lo propio). Reemplaza el adivinar permisos con tablas hardcodeadas. */
export function useMyPermissions() {
  return useQuery({
    queryKey: usersKeys.myPermissions(),
    queryFn: () => api.get<PermissionsResponse>("/api/users/me/permissions"),
    staleTime: 60_000,
    retry: false,
  });
}

function buildListQuery(params: UsersListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.search) search.set("search", params.search);
  if (params.role) search.set("role", params.role);
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /api/me` — datos del usuario logueado (cookie session). Uno de
 *  los 12 endpoints sin `security` declarado, por lo que SÍ acepta cookie
 *  auth del FE (ver Brecha 0 en docs/backend-contracts/c3-treasury-reports-gaps.md).
 *  Util para mostrar saludo, role, tenant_id en pantallas que solo
 *  necesitan info del usuario. */
export function useMe() {
  return useQuery({
    queryKey: usersKeys.me(),
    queryFn: () => api.get<MeResponse>("/api/me"),
    /* 60s: el shape de /api/me cambia raramente (solo en cambio de role
       o invalidación de sesión); 60s evita hits innecesarios y no
       compromete frescura. */
    staleTime: 60_000,
    retry: false,
  });
}

/** Maneja el error de `POST /api/auth/logout`. Un 401 es éxito funcional:
 *  la sesión ya estaba inválida, así que el objetivo del logout ya se
 *  cumplió y lo tragamos. Cualquier otro error se propaga para que la UI
 *  lo muestre. Exportado para poder testear la lógica sin renderizar el hook. */
export function handleLogoutError(err: unknown): void {
  if (err instanceof ApiError && err.status === 401) {
    return;
  }
  throw err;
}

/** `POST /api/auth/logout` — invalida la sesión en el servidor y
 *  limpia las cookies. Tras éxito (204), redirige a /login con
 *  `window.location.href` (no router.push) para forzar reset COMPLETO
 *  del state cliente: queryClient cache + cualquier estado React in-memory.
 *
 *  `skipAuthRetry: true` evita el loop si la sesión ya está expirada
 *  (un 401 en logout es éxito funcional — ver `handleLogoutError`). */
export function useLogout() {
  return useMutation({
    mutationFn: () =>
      api.post<void>("/api/auth/logout", { skipAuthRetry: true }).catch(handleLogoutError),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
}

export function useUsers(params: UsersListParams = {}) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => api.get<UsersListResponse>(`/api/users${buildListQuery(params)}`),
    staleTime: 30_000,
    retry: false,
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteUserBody) => api.post<User>("/api/users", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) =>
      api.patch<User>(`/api/users/${id}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

/* Endpoint público que consume /aceptar-invitacion?token=xxx (C0-15 deliverable).
   Setea cookies de sesión, deja al user logueado. */
export interface AcceptInvitationBody {
  token: string;
  password: string;
  password_confirmation: string;
}

export interface AcceptInvitationResponse {
  user: { id: string; email: string; role: UserRole };
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (body: AcceptInvitationBody) =>
      api.post<AcceptInvitationResponse>("/api/auth/accept-invitation", {
        body,
        skipAuthRetry: true,
      }),
  });
}
