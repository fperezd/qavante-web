"use client";

/* Botones oficiales de Google Identity y Microsoft identity branding.
   Logos y copy no se recoloran: las guías prohíben poner el G / los
   cuadrados de Microsoft sobre el brand Qavante. */

function startOAuth(provider: "google" | "microsoft") {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  window.location.assign(`${apiBase}/api/auth/oauth/start?provider=${provider}`);
}

function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#00A4EF" />
      <rect x="1" y="11" width="9" height="9" fill="#7FBA00" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const oauthButtonBase =
  "flex h-10 w-full items-center justify-center gap-3 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() => startOAuth("google")}
      className={`${oauthButtonBase} rounded-[4px] border border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa] focus-visible:ring-[#1f1f1f]/30`}
    >
      <GoogleGLogo className="h-5 w-5 shrink-0" />
      Iniciar sesión con Google
    </button>
  );
}

export function MicrosoftSignInButton() {
  return (
    <button
      type="button"
      onClick={() => startOAuth("microsoft")}
      className={`${oauthButtonBase} rounded-[2px] border border-[#8c8c8c] bg-white text-[#1f1f1f] hover:bg-[#f5f5f5] focus-visible:ring-[#1f1f1f]/30`}
    >
      <MicrosoftLogo className="h-5 w-5 shrink-0" />
      Iniciar sesión con Microsoft
    </button>
  );
}
