/**
 * Única frontera para texto de error controlado por el servidor.
 *
 * `detail` y `message` son evidencia técnica: pueden contener rutas, SQL o
 * secretos y nunca se renderizan. Sólo un `message_code` conocido, con
 * parámetros enumerados, puede convertirse en texto para el usuario.
 */
export const USER_MESSAGE_CODES = [
  "action_forbidden",
  "captcha_failed",
  "invalid_credentials",
  "invalid_field",
  "invalid_input",
  "resource_not_found",
  "service_unavailable",
  "source_unavailable",
] as const;

export type UserMessageCode = (typeof USER_MESSAGE_CODES)[number];

const SAFE_FIELD_LABELS = {
  email: "correo",
  fecha: "fecha",
  monto: "monto",
  rut: "RUT",
} as const;
type SafeField = keyof typeof SAFE_FIELD_LABELS;
type SimpleUserMessageCode = Exclude<UserMessageCode, "invalid_field">;

export type UserMessage =
  | {
      message_code: "invalid_field";
      params: Readonly<{ field: SafeField }>;
      correlation_id?: string;
    }
  | {
      message_code: SimpleUserMessageCode;
      params?: never;
      correlation_id?: string;
    };

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

const SIMPLE_MESSAGES: Record<SimpleUserMessageCode, string> = {
  action_forbidden: "No tienes permisos para realizar esta acción.",
  captcha_failed: "No pudimos verificar el captcha. Recárgalo e intenta de nuevo.",
  invalid_credentials: "La credencial requiere revisión.",
  invalid_input: "Algunos datos no son válidos. Revisa el formulario.",
  resource_not_found: "No encontramos la información que buscas.",
  service_unavailable: "No pudimos cargar la información. Intenta nuevamente.",
  source_unavailable: "La fuente no está disponible en este momento.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeCorrelationId(value: unknown): string | undefined {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value) ? value : undefined;
}

function safeParams(
  code: UserMessageCode,
  value: unknown,
): Readonly<{ field: SafeField }> | undefined {
  if (code !== "invalid_field" || !isRecord(value)) return undefined;
  const field = value.field;
  if (typeof field !== "string" || !(field in SAFE_FIELD_LABELS)) return undefined;
  return { field: field as SafeField };
}

function isUserMessageCode(value: unknown): value is UserMessageCode {
  return typeof value === "string" && (USER_MESSAGE_CODES as readonly string[]).includes(value);
}

/** Rechaza todo el objeto si el código o sus parámetros obligatorios no son válidos. */
export function parseUserMessage(
  value: unknown,
  headerCorrelationId?: string | null,
): UserMessage | null {
  if (!isRecord(value) || !isUserMessageCode(value.message_code)) return null;

  const params = safeParams(value.message_code, value.params);
  if (value.message_code === "invalid_field" && !params) return null;

  const correlation_id = safeCorrelationId(value.correlation_id ?? headerCorrelationId);
  if (value.message_code === "invalid_field") {
    return {
      message_code: value.message_code,
      params: params!,
      ...(correlation_id ? { correlation_id } : {}),
    };
  }
  return { message_code: value.message_code, ...(correlation_id ? { correlation_id } : {}) };
}

export function renderUserMessage(message: UserMessage): string {
  const base =
    message.message_code === "invalid_field"
      ? `Revisa el campo ${SAFE_FIELD_LABELS[message.params.field]}.`
      : SIMPLE_MESSAGES[message.message_code];
  return message.correlation_id ? `${base} Referencia: ${message.correlation_id}.` : base;
}

export function fallbackUserMessage(status: number, code?: string): string {
  switch (code) {
    case "captcha_failed":
      return SIMPLE_MESSAGES.captcha_failed;
    case "invalid_credentials":
      return SIMPLE_MESSAGES.invalid_credentials;
    case "source_unavailable":
      return SIMPLE_MESSAGES.source_unavailable;
    case "config_missing":
      return "La aplicación no pudo conectarse al servicio. Intenta nuevamente.";
  }

  /* No sabemos si el corte está en la red del usuario o en Qavante: atribuirlo a "tu internet"
     sería afirmar una causa que no observamos (#274). */
  if (status === 0) return "No pudimos comunicarnos con Qavante. Intenta nuevamente.";
  switch (status) {
    case 401:
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    case 403:
      return SIMPLE_MESSAGES.action_forbidden;
    case 404:
      return SIMPLE_MESSAGES.resource_not_found;
    case 408:
    case 504:
      return "La operación está demorando más de lo esperado.";
    case 422:
      return SIMPLE_MESSAGES.invalid_input;
    case 429:
      return "Hiciste muchas operaciones seguidas. Espera un momento.";
    case 503:
      return "Qavante está en mantenimiento. Volvemos pronto.";
    default:
      return status >= 500
        ? SIMPLE_MESSAGES.service_unavailable
        : "Ocurrió un error inesperado. Intenta nuevamente.";
  }
}
