import { useMutation } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — Onboarding (signup + verificar email). Sprint onboarding,
   modelo ADR-0017 (la 1ra persona crea su empresa y queda owner).

   ⚠️ Contrato FE-FIRST. `POST /api/auth/signup` y `POST /api/auth/verify-email`
   AÚN NO existen en prod (404). Tipos hand-rolled según
   `docs/backend-contracts/onboarding-signup-verify-contract.md`; `generate:api`
   los reemplaza cuando el backend los exponga. Todo gated por `onboarding`. */

/* ── Signup ──────────────────────────────────────────────────────────────── */

export interface SignupBody {
  /** Nombre de la persona (owner). */
  name: string;
  /** Email — llave canónica de la persona (ADR-0017). */
  email: string;
  password: string;
  /** Razón social de la empresa que se crea. */
  company_name: string;
  /** RUT de la empresa (tenant). */
  company_rut: string;
}

export interface SignupResponse {
  /** Email al que se envió la verificación (eco para la pantalla). */
  email: string;
  /** El backend envió el correo de verificación. Fase 1: signup NO inicia sesión
      — primero hay que verificar el email. */
  verification_sent: boolean;
}

/** `POST /api/auth/signup` — crea persona + empresa (owner) y dispara el email de
    verificación. NO setea cookie (la sesión llega al verificar). NO retry. */
export function useSignup() {
  return useMutation({
    mutationFn: (body: SignupBody) => api.post<SignupResponse>("/api/auth/signup", { body }),
  });
}

/* ── Verificar email ─────────────────────────────────────────────────────── */

export interface VerifyEmailBody {
  /** Token del link del correo (`/verificar?token=…`). */
  token: string;
}

export interface VerifyEmailResponse {
  /** Verificación OK → el backend setea la cookie de sesión. El FE continúa al
      primer paso post-auth del wizard. */
  verified: boolean;
}

/** `POST /api/auth/verify-email` — valida el token y, si es válido, setea la
    cookie de sesión (200). Token inválido/expirado → 4xx con code para ofrecer
    reenviar. NO retry. */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (body: VerifyEmailBody) =>
      api.post<VerifyEmailResponse>("/api/auth/verify-email", { body, skipAuthRetry: true }),
  });
}

/* ── Reenviar verificación ───────────────────────────────────────────────── */

export interface ResendVerificationBody {
  email: string;
}

/** `POST /api/auth/resend-verification` — reenvía el correo de verificación. */
export function useResendVerification() {
  return useMutation({
    mutationFn: (body: ResendVerificationBody) =>
      api.post<void>("/api/auth/resend-verification", { body, skipAuthRetry: true }),
  });
}
