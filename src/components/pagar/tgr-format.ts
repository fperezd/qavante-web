/* Etiquetas de dueño para los datos de TGR (deudas fiscales). Puro, testeado. */

/** Código de formulario TGR → concepto en lenguaje de dueño.
    29=IVA, 22=Renta, 21=PPM, 99=multas/intereses (ver `MovimientoDeuda`). */
export function formularioLabelTgr(cod?: string | null): string {
  switch (cod) {
    case "29":
      return "IVA (mensual)";
    case "22":
      return "Renta (anual)";
    case "21":
      return "PPM";
    case "99":
      return "Multas e intereses";
    default:
      return cod ? `Formulario ${cod}` : "—";
  }
}
