import { ApiError } from "./errors";
import { fallbackUserMessage, parseUserMessage, renderUserMessage } from "./user-message";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const ACTIVE_COMPANY_STORAGE_KEY = "qavante.active-company-id";

function activeCompanyHeaders(path: string): Record<string, string> {
  // La lista que alimenta el selector siempre debe ver todas las Empresas del
  // tenant. Un id persistido de una sesión anterior no puede bloquearla.
  if (path === "/api/legal-entities") return {};
  if (typeof window === "undefined") return {};
  const companyId = window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
  return companyId ? { "X-Qavante-Company-Id": companyId } : {};
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  body?: unknown;
  /* Si true, no intenta refresh del token en 401. Usado internamente para evitar loops. */
  skipAuthRetry?: boolean;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiFileResponse {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
  contentDisposition: string | null;
  filename: string | null;
}

type SuccessParser<T> = (response: Response) => Promise<T>;

/* Single-flight: si ya hay un refresh en vuelo, los 401 concurrentes lo COMPARTEN
   en vez de disparar N refresh en paralelo. Sin esto, cuando el dashboard lanza
   varias requests juntas y el access-token expiró, cada 401 pedía su propio
   /api/auth/refresh con la MISMA cookie; si el backend rota el refresh-token, el
   primero rota y los demás presentan un token ya inválido → refresh falla →
   expulsa a /login a un usuario con sesión válida. */
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const r = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
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
  parseSuccess: SuccessParser<T> = parseResponse<T>,
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(fallbackUserMessage(0, "config_missing"), 0, "config_missing");
  }

  const { body, skipAuthRetry, headers, ...rest } = options;

  /* FormData (uploads multipart, ej. subir cartola): el browser setea el
     Content-Type con su boundary y el body va sin serializar. Para todo lo
     demás, JSON. */
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const init: RequestInit = {
    ...rest,
    method,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...activeCompanyHeaders(path),
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = isFormData ? body : JSON.stringify(body);
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
        return await request<T>(method, path, { ...options, skipAuthRetry: true }, parseSuccess);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          redirectToLogin();
        }
        throw err;
      }
    }
    redirectToLogin();
    throw new ApiError("Sesión expirada. Vuelve a iniciar sesión.", 401, "unauthorized");
  }

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = undefined;
    }
    const { code, userMessage } = extractApiError(parsed, response.headers.get("x-correlation-id"));
    const message = userMessage
      ? renderUserMessage(userMessage)
      : fallbackUserMessage(response.status, code);
    throw new ApiError(message, response.status, code, parsed, userMessage ?? undefined);
  }

  return parseSuccess(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
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

/** Extrae el nombre declarado por HTTP sin normalizarlo. El consumidor decide
 * si ese nombre coincide con su contrato antes de entregarlo al navegador. */
export function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;

  const extended = /(?:^|;)\s*filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(value)?.[1];
  if (extended) {
    const encoded = extended.trim().replace(/^"|"$/g, "");
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }

  const quoted = /(?:^|;)\s*filename\s*=\s*"((?:\\.|[^"])*)"/i.exec(value)?.[1];
  if (quoted != null) return quoted.replace(/\\(["\\])/g, "$1");

  return /(?:^|;)\s*filename\s*=\s*([^;\s]+)/i.exec(value)?.[1] ?? null;
}

async function parseFileResponse(response: Response): Promise<ApiFileResponse> {
  if (response.status === 204) {
    throw new ApiError("El servidor no entregó el archivo.", 204, "empty_file_response");
  }
  const contentDisposition = response.headers.get("content-disposition");
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "",
    contentDisposition,
    filename: filenameFromContentDisposition(contentDisposition),
  };
}

/* El backend usa varias formas de error y NINGUNA debe escapar como
   "[object Object]" a la UI:
   - `{ detail: "texto" }`               → HTTPException clásico
   - `{ detail: { code, detail } }`      → endpoints nuevos (code + msg anidados)
   - `{ detail: [{ msg, loc, ... }] }`   → validación 422 de FastAPI
   - `{ message, code }`                 → handlers propios
   Devuelve siempre un `message` string + `code` opcional. */
function extractApiError(
  parsed: unknown,
  correlationId?: string | null,
): { code?: string; userMessage: ReturnType<typeof parseUserMessage> } {
  if (!parsed || typeof parsed !== "object") return { userMessage: null };
  const obj = parsed as {
    code?: unknown;
    detail?: unknown;
    user_message?: unknown;
  };
  const detail = obj.detail;
  const detailObject =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : undefined;
  const code =
    typeof detailObject?.code === "string"
      ? detailObject.code
      : typeof obj.code === "string"
        ? obj.code
        : undefined;
  const candidate = obj.user_message ?? detailObject?.user_message ?? detailObject ?? parsed;
  return { code, userMessage: parseUserMessage(candidate, correlationId) };
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>("GET", path, options),
  getFile: (path: string, options?: ApiRequestOptions) =>
    request<ApiFileResponse>("GET", path, options, parseFileResponse),
  post: <T>(path: string, options?: ApiRequestOptions) => request<T>("POST", path, options),
  put: <T>(path: string, options?: ApiRequestOptions) => request<T>("PUT", path, options),
  patch: <T>(path: string, options?: ApiRequestOptions) => request<T>("PATCH", path, options),
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>("DELETE", path, options),
};
