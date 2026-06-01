import { ApiError } from "./errors";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  body?: unknown;
  /* Si true, no intenta refresh del token en 401. Usado internamente para evitar loops. */
  skipAuthRetry?: boolean;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function tryRefresh(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* Redirige a /login preservando el destino. Guard: solo en browser y si no
   estamos ya en /login (evita loop de redirect, p.ej. el 401 del propio login). */
function redirectToLogin(): void {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    const redirect = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL no configurada. Revisar .env.local.",
      0,
      "config_missing",
    );
  }

  const { body, skipAuthRetry, headers, ...rest } = options;

  const init: RequestInit = {
    ...rest,
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError("Error de red. Verifica tu conexión y reintenta.", 0, "network_error", err);
  }

  if (response.status === 401 && !skipAuthRetry && path !== "/api/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      /* Reintento único tras refresh OK. Si AÚN da 401, la sesión es
         irrecuperable (rotación de refresh token / cookie nueva que sigue sin
         autorizar) → redirigir a /login en vez de dejar escapar un ApiError
         401 plano que varaba al usuario en la pantalla (#1). El retry usa
         skipAuthRetry, así que su 401 cae en `!response.ok` y se lanza como
         ApiError — lo atrapamos para redirigir antes de re-lanzar. */
      try {
        return await request<T>(method, path, { ...options, skipAuthRetry: true });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          redirectToLogin();
        }
        throw err;
      }
    }
    redirectToLogin();
    throw new ApiError("Sesión expirada. Volvé a iniciar sesión.", 401, "unauthorized");
  }

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = undefined;
    }
    const obj = (parsed ?? {}) as { code?: string; detail?: string; message?: string };
    const message = obj.detail ?? obj.message ?? `Error ${response.status}`;
    throw new ApiError(message, response.status, obj.code, parsed);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    /* Body vacío con content-type JSON (p.ej. 200/201 sin cuerpo) → undefined,
       no reventar con `SyntaxError` crudo fuera del contrato ApiError. JSON
       malformado → ApiError (no un SyntaxError que escape como unhandled
       rejection, p.ej. en handleLogoutError) (#2). */
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError("Respuesta inválida del servidor.", response.status, "invalid_json");
    }
  }
  return (await response.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, options?: ApiRequestOptions) => request<T>("POST", path, options),
  put: <T>(path: string, options?: ApiRequestOptions) => request<T>("PUT", path, options),
  patch: <T>(path: string, options?: ApiRequestOptions) => request<T>("PATCH", path, options),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>("DELETE", path, options),
};
