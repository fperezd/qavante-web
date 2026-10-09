/** Rutas de autenticación en el FE. Login principal = correo/OAuth; RUT en ruta aparte. */
export const LOGIN_PATH = "/login-correo";
export const LOGIN_RUT_PATH = "/login-rut";
/** Alias histórico: redirige a {@link LOGIN_PATH}. */
export const LEGACY_LOGIN_PATH = "/login";

export const PUBLIC_LOGIN_PATHS = [LOGIN_PATH, LOGIN_RUT_PATH, LEGACY_LOGIN_PATH] as const;

export function isLoginPath(pathname: string): boolean {
  return (PUBLIC_LOGIN_PATHS as readonly string[]).includes(pathname);
}

export function loginPathWithRedirect(redirectTo?: string): string {
  if (redirectTo) {
    return `${LOGIN_PATH}?redirect=${encodeURIComponent(redirectTo)}`;
  }
  return LOGIN_PATH;
}
