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
    throw new ApiError(
      "Error de red. Verifica tu conexión y reintenta.",
      0,
      "network_error",
      err,
    );
  }

  if (response.status === 401 && !skipAuthRetry && path !== "/api/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(method, path, { ...options, skipAuthRetry: true });
    }
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      const redirect = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
    }
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
    return (await response.json()) as T;
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
