/* Nombre canónico de la cookie de sesión Qavante. Compartido entre
   middleware.ts (server edge layer) y src/lib/auth/session.ts
   (server side render). El backend FastAPI debe usar el mismo nombre
   cuando setee la cookie en /api/auth/login (C0-11). */

export const SESSION_COOKIE_NAME = "qavante_session";
