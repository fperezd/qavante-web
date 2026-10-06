/* Las cuatro fronteras del día de negocio en la pantalla (B16).
 *
 * El `TimeZone` de la base de producción es `UTC` (parámetro `system-default` de
 * `psql-qavante-prod`, leído el 2026-10-06) y la API publica sus sellos como timestamps UTC.
 * Chile está en UTC-3 en horario de verano, así que **desde las 21:00 de Chile un día derivado
 * en UTC ya es el día siguiente**, y la tarjeta de cuenta decía «actualizada mañana».
 *
 * Estos tests fijan el reloj en las CUATRO horas donde se ve la diferencia —20:59, 21:00, 23:59
 * y 00:01 de Chile— porque son las únicas que distinguen un arreglo de su ausencia: a las 10:00
 * de la mañana los dos calendarios coinciden y el test pasa con el código roto.
 *
 * Y fijan la distinción que un arreglo apresurado rompe: un INSTANTE se convierte, una FECHA DE
 * CALENDARIO no.
 */
import { describe, expect, it } from "vitest";
import { formatDateShort, formatHoraCorta, formatRelative } from "./date";

/** El instante UTC correspondiente a una hora de Chile del 5-10-2026 (UTC-3, verano). */
function enChile(hora: number, minuto: number): Date {
  // 21:00 del 5 en Chile = 00:00Z del 6. 00:01 del 6 en Chile = 03:01Z del 6.
  const dia = hora === 0 ? 6 : 5;
  return new Date(Date.UTC(2026, 9, dia, hora + 3, minuto));
}

const FRONTERAS = [
  { hora: 20, minuto: 59, hoyChile: "2026-10-05", hoyUTC: "2026-10-05" }, // control
  { hora: 21, minuto: 0, hoyChile: "2026-10-05", hoyUTC: "2026-10-06" }, // ← empieza a mentir
  { hora: 23, minuto: 59, hoyChile: "2026-10-05", hoyUTC: "2026-10-06" },
  { hora: 0, minuto: 1, hoyChile: "2026-10-06", hoyUTC: "2026-10-06" },
];

describe("las cuatro fronteras del día de negocio", () => {
  it.each(FRONTERAS)(
    "a las $hora:$minuto de Chile, el sello de ese momento es «hoy», no «mañana»",
    ({ hora, minuto, hoyChile }) => {
      const ahora = enChile(hora, minuto);
      // El sello que publica la API: el mismo instante, en ISO UTC. Es el dato real que llega a
      // `frescuraCuenta` desde `GET /api/sources/status`.
      expect(formatRelative(ahora.toISOString(), ahora)).toBe("hoy");
      // Y el día civil chileno de ese instante es el que dice la frontera.
      expect(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora)).toBe(
        hoyChile,
      );
    },
  );

  it.each(FRONTERAS)(
    "MUTANTE (a): decidir el día en UTC rompe de 21:00 a 23:59 — $hora:$minuto",
    ({ hora, minuto, hoyChile, hoyUTC }) => {
      const ahora = enChile(hora, minuto);
      // El código viejo leía la parte de fecha del ISO con una regex: eso ES el día en UTC.
      const diaEnUTC = ahora.toISOString().slice(0, 10);
      expect(diaEnUTC).toBe(hoyUTC);
      // Si el día de Chile y el de UTC se separan, el mutante publicaría «mañana».
      if (hoyChile !== hoyUTC) {
        expect(formatRelative(diaEnUTC, ahora)).toBe("mañana");
      }
      // ...y el código arreglado dice «hoy» en las cuatro.
      expect(formatRelative(ahora.toISOString(), ahora)).toBe("hoy");
    },
  );

  it("de 21:00 a 23:59 los dos calendarios SE SEPARAN, y por eso estas horas prueban algo", () => {
    const separadas = FRONTERAS.filter((f) => f.hoyChile !== f.hoyUTC).map((f) => f.hora);
    expect(separadas).toEqual([21, 23]);
  });

  it("la hora del sello es hora de Chile, no del navegador", () => {
    // 00:30Z del 6 = 21:30 del 5 en Chile.
    expect(formatHoraCorta("2026-10-06T00:30:00Z")).toBe("21:30");
  });
});

describe("instante versus fecha de calendario", () => {
  it("MUTANTE (b): una fecha de calendario NO se convierte", () => {
    // `treasury.bank_movements.date` es `DATE`: el día que el banco declara, sin hora. No tiene
    // zona. Tratarla como instante (`new Date("2026-10-06")` = medianoche UTC) la retrocedería
    // al 5 en Chile — es el error que introduce un arreglo apresurado.
    const mutante = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
      new Date("2026-10-06"),
    );
    expect(mutante).toBe("2026-10-05"); // el mutante retrocede el día
    // El código correcto la lee literal, en cualquier hora del día.
    expect(formatDateShort("2026-10-06")).toBe("6 oct");
    for (const { hora, minuto } of FRONTERAS) {
      expect(formatRelative("2026-10-06", enChile(hora, minuto))).not.toBe("ayer");
    }
  });

  it("una fecha de calendario de hoy es «hoy» en las cuatro fronteras", () => {
    for (const { hora, minuto, hoyChile } of FRONTERAS) {
      expect(formatRelative(hoyChile, enChile(hora, minuto))).toBe("hoy");
    }
  });

  it("un instante sí se convierte: 00:30Z del 6 es el 5 en Chile", () => {
    expect(formatDateShort("2026-10-06T00:30:00Z")).toBe("5 oct");
    // ...y la fecha de calendario del mismo día NO cambia.
    expect(formatDateShort("2026-10-06")).toBe("6 oct");
  });
});
