/* Error class para respuestas no-OK del backend. Mensaje en español,
   código del backend si está disponible. Mapping a textos amigables
   queda para el llamador via switch sobre .code (ver Anexo C.3 v2.6.4). */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: unknown;

  constructor(message: string, status: number, code?: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }
  isUnauthorized(): boolean {
    return this.status === 401;
  }
  isForbidden(): boolean {
    return this.status === 403;
  }
  isNotFound(): boolean {
    return this.status === 404;
  }
  isValidation(): boolean {
    return this.status === 422;
  }
  isServerError(): boolean {
    return this.status >= 500;
  }
}
