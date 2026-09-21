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

interface FintocWidgetConfig {
  public_key: string;
  webhook_url: string | null;
  connected: boolean;
  holder_type: string;
  country: string;
  product: string;
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
  onSuccess: (payload: unknown) => void;
  onExit?: () => void;
}): Promise<void> {
  const Fintoc = await waitForFintoc();
  const callbacks = {
    onSuccess: options.onSuccess,
    onExit: options.onExit,
  };

  try {
    const intent = await api.post<FintocLinkIntent>("/api/fintoc/link-intent");
    Fintoc.create({
      ...callbacks,
      publicKey: intent.public_key,
      widgetToken: intent.widget_token,
    }).open();
    return;
  } catch (primary) {
    try {
      const config = await api.get<FintocWidgetConfig>("/api/fintoc/widget-config");
      Fintoc.create({
        ...callbacks,
        publicKey: config.public_key,
        product: config.product,
        holderType: config.holder_type,
        country: config.country,
        ...(config.webhook_url ? { webhookUrl: config.webhook_url } : {}),
      }).open();
      return;
    } catch {
      throw primary;
    }
  }
}

export function completeFintocWidget(payload: unknown) {
  const exchangeToken = extractExchangeToken(payload);
  const linkToken = extractLinkToken(payload);
  return api.post<{ accounts: number; imported: number }>("/api/fintoc/complete", {
    body: {
      ...(exchangeToken ? { exchange_token: exchangeToken } : {}),
      ...(linkToken ? { link_token: linkToken } : {}),
      ...(payload && typeof payload === "object" ? { link: payload } : {}),
    },
  });
}
