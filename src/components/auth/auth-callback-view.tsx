"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { safeInternalPath } from "@/lib/navigation";

/** Query de `/registro` cuando Auth0 autenticó un correo sin cuenta Qavante. */
export function oauthRegistroPath(err: ApiError): string | null {
  if (err.code !== "oauth_user_not_found") return null;
  const parsed = err.detail;
  if (!parsed || typeof parsed !== "object") return null;
  const nested = (parsed as { detail?: unknown }).detail;
  if (!nested || typeof nested !== "object") return null;
  const d = nested as { email?: unknown; name?: unknown };
  const email = typeof d.email === "string" ? d.email.trim() : "";
  if (!email) return null;
  const q = new URLSearchParams({ email, oauth: "1" });
  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (name) q.set("nombre", name);
  return `/registro?${q.toString()}`;
}

export function AuthCallbackView() {
  const searchParams = useSearchParams();
  const redirect = safeInternalPath(searchParams.get("redirect"));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const oauthError = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (oauthError) {
      setError("Cancelaste el login o Auth0 lo rechazó. Volvé a intentar.");
      return;
    }
    if (!code || !state) {
      setError("Falta el código de Auth0. Volvé a /login e intentá de nuevo.");
      return;
    }

    void (async () => {
      try {
        await api.post("/api/auth/oauth/callback", {
          body: { code, state },
          skipAuthRetry: true,
        });
        window.location.assign(redirect);
      } catch (err) {
        if (err instanceof ApiError) {
          const registro = oauthRegistroPath(err);
          if (registro) {
            window.location.assign(registro);
            return;
          }
          setError(apiErrorToUserMessage(err, "login"));
        } else {
          setError("No pudimos completar el login. Reintentá.");
        }
      }
    })();
  }, [redirect, searchParams]);

  if (error) {
    return (
      <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-6 text-sm text-danger-500">
        <p role="alert">{error}</p>
        <p className="mt-4">
          <Link href="/login" className="text-brand-primary hover:underline">
            Volver al login
          </Link>
        </p>
      </div>
    );
  }

  return <p className="text-center text-sm text-neutral-mid">Entrando con tu cuenta…</p>;
}
