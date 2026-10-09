/** ¿Estamos en entorno local de desarrollo?

 *  `NEXT_PUBLIC_APP_ENV` en `.env.local` es `development`; en staging/QAS/producción
 *  es otro valor. Si no está definido, se asume development (mismo default del README).
 *
 *  Sirve para superficies de diagnóstico (marcadores «!» de API pendiente, bloques de
 *  maqueta en Inicio, métricas provisionales). Esas piezas NO deben llegar al usuario
 *  real. */
export function isLocalDevAppEnv(): boolean {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || "development").trim().toLowerCase();
  return env === "development";
}
