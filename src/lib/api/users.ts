/* Tipos + hooks de TanStack Query para los endpoints de C0-14 (User CRUD + invitaciones).
   Alineado con [docs/backend-contracts/c0-auth-and-users.md § 3]. Backend todavía
   no expone estos endpoints (qavante-api#58 + C0-11). La UI compila y renderiza
   estados de error/vacío con copys de Anexo C.3 mientras BE no esté arriba. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
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
};

export { usersKeys };

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
