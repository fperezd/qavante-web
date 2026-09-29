import { api } from "@/lib/api/client";

declare global {
  interface Window {
    Fintoc?: {
      create: (options: Record<string, unknown>) => {
        open: () => void;
      };
    };
  }
}

export interface FintocLinkIntent {
  public_key: string;
  widget_token: string;
  webhook_url: string | null;
  connected: boolean;
  holder_type: string;
  country: string;
  product: string;
}

export interface FintocCompletionResult {
  status: "ok" | "partial" | "error";
  accounts: number;
  imported: number;
  per_account: Array<{
    sync_error?: { code?: string; message?: string };
  }>;
}

export function extractLinkToken(payload: unknown): string | null {
  if (typeof payload === "string" && payload.startsWith("link_")) return payload;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["link_token", "linkToken", "token"]) {
    const value = record[key];
    if (typeof value === "string" && value.startsWith("link_")) return value;
  }
  for (const key of ["data", "link", "object"]) {
    const nested = extractLinkToken(record[key]);
    if (nested) return nested;
  }
  return null;
}

export function extractExchangeToken(payload: unknown): string | null {
  if (typeof payload === "string") {
    if (payload.includes("_exc_") || payload.includes("_exchange_token_")) return payload;
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["exchange_token", "exchangeToken"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const key of ["data", "link", "object", "link_intent", "linkIntent"]) {
    const nested = extractExchangeToken(record[key]);
    if (nested) return nested;
  }
  return null;
}

export async function waitForFintoc(timeoutMs = 8000): Promise<NonNullable<Window["Fintoc"]>> {
  const started = Date.now();
  while (!window.Fintoc && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  if (!window.Fintoc) {
    throw new Error("No se cargó el widget de Fintoc.");
  }
  return window.Fintoc;
}

export async function openOfficialFintocWidget(options: {
  /** Sociedad que inició el flujo. Se propaga explícitamente porque el
   * CompanyScope se hidrata después del primer render y localStorage no es una
   * fuente segura para atribuir una operación financiera. */
  legalEntityId: string;
  onSuccess: (payload: unknown) => void;
  onExit?: () => void;
}): Promise<void> {
  if (!options.legalEntityId) {
    throw new Error("No hay una sociedad activa para conectar el banco.");
  }
  const Fintoc = await waitForFintoc();
  const callbacks = {
    onSuccess: options.onSuccess,
    onExit: options.onExit,
  };

  const intent = await api.post<FintocLinkIntent>("/api/fintoc/link-intent", {
    headers: { "X-Qavante-Company-Id": options.legalEntityId },
    body: { holder_type: "business" },
  });
  Fintoc.create({
    ...callbacks,
    publicKey: intent.public_key,
    widgetToken: intent.widget_token,
  }).open();
}

export function completeFintocWidget(payload: unknown, legalEntityId: string) {
  if (!legalEntityId)
    throw new Error("Selecciona una sociedad registrada antes de conectar el banco.");
  const exchangeToken = extractExchangeToken(payload);
  const linkToken = extractLinkToken(payload);
  return api.post<FintocCompletionResult>("/api/fintoc/complete", {
    headers: { "X-Qavante-Company-Id": legalEntityId },
    body: {
      ...(exchangeToken ? { exchange_token: exchangeToken } : {}),
      ...(linkToken ? { link_token: linkToken } : {}),
      legal_entity_id: legalEntityId,
      ...(payload && typeof payload === "object" ? { link: payload } : {}),
    },
  });
}
