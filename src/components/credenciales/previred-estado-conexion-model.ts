/* Estado honesto de la conexión a Previred: son DOS pasos independientes (la clave y la
   autorización) y hasta ahora cada uno mostraba su propio badge verde por separado. Resultado:
   con el permiso dado y la clave vacía, la pantalla se leía como "listo" (reporte de Fernando,
   16-07-2026). Esta función deriva UN estado de los dos.

   Lógica pura y sin fetch a propósito: acá vive lo testeable (el runner de Storybook no corre
   MSW, así que los estados que vienen del backend no se pueden testear en una story). */

export type TonoConexion = "ok" | "falta" | "neutro";

export type EstadoConexionPrevired = {
  tono: TonoConexion;
  titulo: string;
  detalle: string;
};

export type EntradaConexionPrevired = {
  cargando: boolean;
  /** Alguna de las dos consultas falló. NO es lo mismo que "falta": no pudimos preguntar. */
  error: boolean;
  claveActiva: boolean;
  permisoValido: boolean;
};

export function estadoConexionPrevired(e: EntradaConexionPrevired): EstadoConexionPrevired {
  if (e.cargando) {
    return { tono: "neutro", titulo: "Revisando el estado…", detalle: "" };
  }

  // Un error de red NO se puede pintar como "falta autorizar": no sabemos qué falta.
  if (e.error) {
    return {
      tono: "neutro",
      titulo: "No pudimos leer el estado",
      detalle: "No significa que falte algo: no pudimos preguntarlo. Prueba refrescar la página.",
    };
  }

  if (e.claveActiva && e.permisoValido) {
    return {
      tono: "ok",
      titulo: "Clave y autorización listas",
      detalle:
        "Previred ya tiene lo que necesita de tu parte. Todavía no traemos las cotizaciones solas: falta activar la sincronización, así que por ahora no aparecen en Pagar.",
    };
  }

  if (e.claveActiva && !e.permisoValido) {
    return {
      tono: "falta",
      titulo: "Falta autorizar el acceso",
      detalle: "La clave está guardada. Falta darnos el permiso para usarla, acá abajo.",
    };
  }

  if (!e.claveActiva && e.permisoValido) {
    return {
      tono: "falta",
      titulo: "Falta la clave",
      detalle:
        "El acceso está autorizado, pero autorizar no guarda la clave. Falta el RUT del representante legal y su clave, acá arriba.",
    };
  }

  return {
    tono: "falta",
    titulo: "Sin conectar",
    detalle: "Faltan los dos pasos: guardar la clave y autorizar el acceso.",
  };
}

/* ¿Se muestra el formulario de credenciales? Una vez configurada, NO queda a la vista: resumen +
   "Cambiar credenciales", igual que banco y SII (reporte de Fernando, 16-07-2026). Acá porque es
   la decisión que él pidió y merece test; en el componente no se puede testear (el runner de
   Storybook no corre MSW → `is_active` nunca llega true). */
export function debeMostrarForm(e: {
  editando: boolean;
  claveActiva: boolean;
  cargando: boolean;
}): boolean {
  if (e.editando) return true;
  // Mientras carga no: evita mostrarlo un instante y esconderlo al llegar la respuesta.
  if (e.cargando) return false;
  return !e.claveActiva;
}
