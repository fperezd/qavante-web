import type { UserMessage } from "./user-message";

/* Error class para respuestas no-OK. `detail` conserva evidencia técnica para
   observabilidad; `userMessage` es la única carga del servidor renderizable. */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: unknown;
  readonly userMessage?: UserMessage;

  constructor(
    message: string,
    status: number,
    code?: string,
    detail?: unknown,
    userMessage?: UserMessage,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.userMessage = userMessage;
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
