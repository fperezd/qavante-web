import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Onboarding (signup + verificar email). Sprint onboarding,
   modelo ADR-0017 (la 1ra persona crea su empresa y queda owner).

   signup, verify-email y resend-verification YA existen en prod (2026-06-22) →
   tipos GENERADOS del OpenAPI (regla 3). signup y resend exigen `captcha_token`
   de Turnstile (anti-bot, fail-closed). verify-email devuelve LoginResponse
   (auto-login + cookie). Gated por `onboarding`. */

/* ── Signup ──────────────────────────────────────────────────────────────── */

export type SignupBody = components["schemas"]["SignupRequest"];
export type SignupResponse = components["schemas"]["SignupResponse"];

/** `POST /api/auth/signup` — crea persona + empresa (owner) y dispara el email de
    verificación. Requiere `captcha_token` (Turnstile). NO setea cookie (la sesión
    llega al verificar). NO retry. */
export function useSignup() {
  return useMutation({
    mutationFn: (body: SignupBody) => api.post<SignupResponse>("/api/auth/signup", { body }),
  });
}

/* ── Verificar email ─────────────────────────────────────────────────────── */

export type VerifyEmailBody = components["schemas"]["VerifyEmailRequest"];
/** verify-email devuelve LoginResponse: queda logueado (cookie seteada). */
export type VerifyEmailResponse = components["schemas"]["LoginResponse"];

/** `POST /api/auth/verify-email` — valida el token; si es válido setea la cookie
    de sesión y devuelve la sesión (LoginResponse). Token inválido/expirado → 4xx
    (el FE ofrece reenviar). NO retry. */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (body: VerifyEmailBody) =>
      api.post<VerifyEmailResponse>("/api/auth/verify-email", { body, skipAuthRetry: true }),
  });
}

/* ── Reenviar verificación ───────────────────────────────────────────────── */

export type ResendVerificationBody = components["schemas"]["ResendVerificationRequest"];

/** `POST /api/auth/resend-verification` — reenvía el correo de verificación.
    Requiere `email` + `captcha_token` (Turnstile). */
export function useResendVerification() {
  return useMutation({
    mutationFn: (body: ResendVerificationBody) =>
      api.post<void>("/api/auth/resend-verification", { body, skipAuthRetry: true }),
  });
}
