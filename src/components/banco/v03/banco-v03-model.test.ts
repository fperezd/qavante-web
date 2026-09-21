import { describe, expect, it } from "vitest";
import type { BankMovement } from "@/lib/api/treasury";
import { cajaHoy } from "@/lib/finanzas/caja-hoy";
import {
  chipCajaHoy,
  cicloDe,
  coincideBusqueda,
  conexionBanco,
  contarMovimientosV03,
  documentoConciliadoDe,
  csvMovimientos,
  cuadreCajaHoy,
  cuentasV03,
  estaClasificado,
  filtrarMovimientosV03,
  frescuraCuenta,
  hrefClasificar,
  montoConSigno,
  montoFirmado,
  movimientosV03,
  parcial,
  pendientesPorCuenta,
  quedaPorConciliar,
  subMovimiento,
  sumaPorMoneda,
  textoActualizando,
  tarjetasV03,
  totalesPorMoneda,
  type MovimientoV03,
} from "./banco-v03-model";
import {
  BANCO,
  HOY,
  SUMMARY_STALE,
  categorias,
  cuentasQavante,
  links,
  movimientos,
  saldoOk,
  saldoSesionVencida,
  saldoTarjetas,
  sourcesError,
  sourcesOk,
  sourcesSinConectar,
  sourcesSyncing,
  summary,
  tarjetasOk,
  tarjetasSesionVencida,
} from "./banco-v03-fixtures";

/* V03 · Banco — el modelo, fijado.
 *
 * El estado de la conexión (con su "no sé"), el ciclo de vida de cada movimiento, los conteos de
 * los filtros, la búsqueda por glosa/RUT/monto, INV-FX-001 y el cuadre de la Ley 1. Cada negativo
 * lleva su gemelo positivo con la MISMA cadena. */

function movs(): MovimientoV03[] {
  return movimientosV03({
    items: movimientos(),
    cuentas: new Map(cuentasQavante().map((a) => [a.id, a])),
    categorias: categorias(),
  });
}

/* ── Conexión ────────────────────────────────────────────────────────────────── */

describe("conexionBanco — el estado de la conexión, sin defaults tranquilizadores", () => {
  it("fuente ok + bice con cuentas → Conectada ✓", () => {
    const c = conexionBanco(sourcesOk(), saldoOk(), tarjetasOk());
    expect(c.estado).toBe("conectada");
    expect(c.pill).toBe("Conectada ✓");
    expect(c.tono).toBe("ok");
    expect(c.ultimaSync).toBe("2026-08-30T00:12:00Z");
  });

  it("bice responde 200 con cuerpo de error (session_expired) → Tu acción, aunque sources diga ok", () => {
    const c = conexionBanco(sourcesOk(), saldoSesionVencida(), tarjetasOk());
    expect(c.estado).toBe("accion_requerida");
    expect(c.pill).toBe("Tu acción");
    /* El mensaje libre del conector no encaja en ninguna señal documentada: se dice que no
       se sabe, con salida a la conexión. No se adivina "credencial inválida" por prosa. */
    expect(c.motivo).toBe(
      "El último intento de leer esta fuente falló y no sabemos por qué. Revisa la conexión e intenta nuevamente.",
    );
    // Gemelo: NO es "Conectada ✓".
    expect(c.pill).not.toBe("Conectada ✓");
  });

  it("no expone configuración ni trazas contenidas en el mensaje libre de BICE", () => {
    const c = conexionBanco(sourcesOk(), {
      status: "error",
      message:
        "BiceAuthError: BICE_LOGIN_STRATEGY=local_only storage_state missing at /srv/bice.py:42",
    });

    expect(c.motivo).toContain("no sabemos por qué");
    expect(c.motivo).not.toMatch(/BiceAuthError|local_only|storage_state|\/srv\/|\.py/i);
  });

  it("la forma real del 2026-08-30: sources error + bice error → Tu acción, ámbar, con la última sync", () => {
    const c = conexionBanco(sourcesError(), saldoSesionVencida(), tarjetasSesionVencida());
    expect(c.estado).toBe("accion_requerida");
    expect(c.tono).toBe("warn"); // ámbar, nunca rojo (Ley 2)
    expect(c.ultimaSync).toBe("2026-08-28T00:02:47Z");
  });

  it("sin dato de sources NI de bice → Sin dato de conexión (nunca 'Conectada')", () => {
    const c = conexionBanco(null, null, null);
    expect(c.estado).toBe("sin_dato");
    expect(c.pill).toBe("Sin dato de conexión");
    expect(c.tono).toBe("mut");
    expect(c.estado).not.toBe("conectada");
  });

  it("sources sin fuente de banco y bice sin cuentas → sin dato", () => {
    const c = conexionBanco([{ source: "sii", state: "ok" }], { status: "ok", cuentas: [] });
    expect(c.estado).toBe("sin_dato");
  });

  it("sin sources pero bice responde cuentas → conectada por evidencia directa", () => {
    expect(conexionBanco(null, saldoOk()).estado).toBe("conectada");
  });

  it("syncing → Actualizando; stale → Desactualizada; missing → Sin conectar", () => {
    expect(conexionBanco(sourcesSyncing(), null).estado).toBe("actualizando");
    expect(
      conexionBanco([{ source: "bank_bice", state: "stale", category: "bank" }], null).estado,
    ).toBe("desactualizada");
    expect(conexionBanco(sourcesSinConectar(), null).estado).toBe("sin_conectar");
  });

  it("unavailable CON last_sync es una caída real (Tu acción); SIN last_sync, nunca se conectó", () => {
    const base = { source: "bank_bice", state: "unavailable" as const, category: "bank" };
    expect(conexionBanco([{ ...base, last_sync: "2026-08-28T00:00:00Z" }], null).estado).toBe(
      "accion_requerida",
    );
    expect(conexionBanco([base], null).estado).toBe("sin_conectar");
  });
});

describe("frescuraCuenta — el `.sub` en humano", () => {
  it("conectada hoy → 'actualizada hoy'", () => {
    expect(frescuraCuenta(conexionBanco(sourcesOk(), saldoOk()), HOY)).toBe("actualizada hoy");
  });

  it("acción requerida → dice desde cuándo no llegan movimientos (la última sync real)", () => {
    const c = conexionBanco(sourcesError(), saldoSesionVencida());
    expect(frescuraCuenta(c, HOY)).toBe("desde el 28 ago no llegan movimientos");
  });

  it("actualizando usa el ETA y la etapa publicados por el backend", () => {
    const conexion = conexionBanco(sourcesSyncing(), null);
    expect(frescuraCuenta(conexion, HOY)).toBe("trayendo la cartola… listo en 45 s");
    expect(textoActualizando(conexion, HOY)).toContain("45 s");
    expect(textoActualizando(conexion, HOY)).not.toContain("Leyendo cartola");
  });

  it("sin ETA backend muestra progreso transcurrido y declara la ausencia; sin progreso conserva la referencia fija", () => {
    const sinEta = conexionBanco(
      [
        {
          source: "bank_bice",
          state: "syncing",
          category: "bank",
          sync_progress: { started_at: "2026-08-30T11:58:00Z" },
        },
      ],
      null,
    );
    expect(textoActualizando(sinEta, HOY)).toBe(
      "trayendo la cartola… en curso hace 2 min; el banco no informó un tiempo estimado",
    );
    const legado = conexionBanco(
      [{ source: "bank_bice", state: "syncing", category: "bank" }],
      null,
    );
    expect(textoActualizando(legado, HOY)).toBe(
      "trayendo la cartola… en curso; el banco no informó un tiempo estimado",
    );
  });

  it("sin dato → lo dice; conectada sin fecha → lo dice", () => {
    expect(frescuraCuenta(conexionBanco(null, null), HOY)).toBe("sin dato de actualización");
    const sinFecha = conexionBanco([{ source: "bank_bice", state: "ok", category: "bank" }], null);
    expect(frescuraCuenta(sinFecha, HOY)).toBe("sin fecha de actualización");
  });
});

/* ── Cuentas ─────────────────────────────────────────────────────────────────── */

describe("cuentasV03 — la tabla de cuentas", () => {
  const conexionOk = conexionBanco(sourcesOk(), saldoOk());

  it("con bice vivo: una fila por cuenta del banco, con saldo contable, nº parcial y pendientes", () => {
    const filas = cuentasV03({
      banco: BANCO,
      saldo: saldoOk(),
      cuentasQavante: cuentasQavante(),
      links: links(),
      conexion: conexionOk,
      pendientes: pendientesPorCuenta(movs()),
      hoy: HOY,
    });
    expect(filas).toHaveLength(2);
    expect(filas[0]!.nombre).toBe("BICE · Cuenta Corriente CLP ···67-8");
    expect(filas[0]!.saldo).toBe(9_800_000);
    expect(filas[0]!.moneda).toBe("CLP");
    expect(filas[0]!.sub).toBe("actualizada hoy · 4 movimientos por conciliar");
    expect(filas[0]!.href).toBe("/banco/cuenta/tok-clp");
    expect(filas[1]!.moneda).toBe("USD");
    expect(filas[1]!.saldo).toBe(1240);
    expect(filas[1]!.sub).toBe("actualizada hoy · 1 movimiento por conciliar");
  });

  it("con la sesión vencida: las cuentas Qavante como filas, SIN saldo (null, no $0) y con motivo", () => {
    const conexion = conexionBanco(sourcesError(), saldoSesionVencida());
    const filas = cuentasV03({
      banco: BANCO,
      saldo: saldoSesionVencida(),
      cuentasQavante: cuentasQavante(),
      links: null,
      conexion,
      pendientes: pendientesPorCuenta(movs()),
      hoy: HOY,
    });
    expect(filas).toHaveLength(2);
    expect(filas[0]!.saldo).toBeNull();
    expect(filas[0]!.saldo).not.toBe(0);
    expect(filas[0]!.saldoMotivo).toContain("no sabemos por qué");
    expect(filas[0]!.sub).toBe(
      "desde el 28 ago no llegan movimientos · 4 movimientos por conciliar",
    );
    // El detalle vive en treasury: el id de la URL es `bank_account_id`.
    expect(filas[0]!.href).toBe("/banco/cuenta/acc-clp");
  });

  it("sin pendientes contables (movimientos no llegaron) el `.sub` no inventa un cero", () => {
    const filas = cuentasV03({
      banco: BANCO,
      saldo: saldoOk(),
      cuentasQavante: cuentasQavante(),
      links: links(),
      conexion: conexionOk,
      pendientes: null,
      hoy: HOY,
    });
    expect(filas[0]!.porConciliar).toBeNull();
    expect(filas[0]!.sub).toBe("actualizada hoy");
  });

  it("parcial(): los últimos 4 caracteres visibles", () => {
    expect(parcial("12-34567-8")).toBe("···67-8");
    expect(parcial("9876543210")).toBe("···3210");
    expect(parcial(null)).toBe("");
  });
});

describe("tarjetasV03 — una fila por moneda con cupo, en negativo (es deuda)", () => {
  it("CLP y USD como filas separadas; sin saldo, una fila 'sin dato'", () => {
    const conexion = conexionBanco(sourcesOk(), saldoOk());
    const filas = tarjetasV03(BANCO, tarjetasOk(), saldoTarjetas(), conexion, HOY);
    expect(filas.map((f) => [f.moneda, f.saldo])).toEqual([
      ["CLP", -250_000],
      ["USD", -184],
    ]);
    expect(filas[0]!.nombre).toBe("BICE · Tarjeta de Crédito CLP ···3210");
    expect(filas[0]!.href).toBe("/banco/tarjeta/9876543210");

    const sinSaldo = tarjetasV03(BANCO, tarjetasOk(), new Map(), conexion, HOY);
    expect(sinSaldo).toHaveLength(1);
    expect(sinSaldo[0]!.saldo).toBeNull();
  });

  it("con la sesión vencida no hay tarjetas que listar (data: [])", () => {
    const conexion = conexionBanco(sourcesError(), saldoSesionVencida());
    expect(tarjetasV03(BANCO, tarjetasSesionVencida(), new Map(), conexion, HOY)).toEqual([]);
  });
});

/* ── INV-FX-001 + Ley 1 ──────────────────────────────────────────────────────── */

describe("sumaPorMoneda — INV-FX-001: CLP y USD nunca se suman entre sí", () => {
  it("un total por moneda; las tarjetas no entran; las filas sin saldo se cuentan aparte", () => {
    const conexion = conexionBanco(sourcesOk(), saldoOk());
    const cuentas = cuentasV03({
      banco: BANCO,
      saldo: saldoOk(),
      cuentasQavante: cuentasQavante(),
      links: links(),
      conexion,
      pendientes: null,
      hoy: HOY,
    });
    const tarjetas = tarjetasV03(BANCO, tarjetasOk(), saldoTarjetas(), conexion, HOY);
    const s = sumaPorMoneda([...cuentas, ...tarjetas]);
    expect(s.porMoneda).toEqual([
      { moneda: "CLP", total: 9_800_000, cuentas: 1 },
      { moneda: "USD", total: 1240, cuentas: 1 },
    ]);
    expect(s.sinSaldo).toBe(0);
    // Gemelo del negativo: NINGÚN bucket suma 9.801.240 (CLP + USD).
    expect(s.porMoneda.map((m) => m.total)).not.toContain(9_801_240);
  });

  it("filas sin saldo NO entran al total y se declaran", () => {
    const conexion = conexionBanco(sourcesError(), saldoSesionVencida());
    const cuentas = cuentasV03({
      banco: BANCO,
      saldo: saldoSesionVencida(),
      cuentasQavante: cuentasQavante(),
      links: null,
      conexion,
      pendientes: null,
      hoy: HOY,
    });
    const s = sumaPorMoneda(cuentas);
    expect(s.porMoneda).toEqual([]);
    expect(s.sinSaldo).toBe(2);
  });
});

describe("cuadreCajaHoy — Ley 1: Caja hoy es cajaHoy(); el banco es OTRO número con otro apellido", () => {
  function filas(saldo = saldoOk()) {
    return cuentasV03({
      banco: BANCO,
      saldo,
      cuentasQavante: cuentasQavante(),
      links: links(),
      conexion: conexionBanco(sourcesOk(), saldo),
      pendientes: null,
      hoy: HOY,
    });
  }

  it("cuando ambos existen y son iguales, lo dice", () => {
    const c = cuadreCajaHoy(cajaHoy(summary()), filas());
    expect(c).toEqual({
      cajaHoy: 9_800_000,
      sumaBancoClp: 9_800_000,
      coincide: true,
      diferencia: 0,
    });
  });

  it("cuando difieren, lo dice con la diferencia (banco − caja hoy); el número de la vista sigue siendo cajaHoy()", () => {
    const c = cuadreCajaHoy(
      cajaHoy(
        summary({
          cash_today: {
            total: "9500000",
            last_updated: "2026-08-30T00:12:00Z",
            data_state: "available",
          },
        }),
      ),
      filas(),
    );
    expect(c.coincide).toBe(false);
    expect(c.cajaHoy).toBe(9_500_000);
    expect(c.diferencia).toBe(300_000);
    // El cuadre compara SÓLO CLP: el USD (1.240) no contamina la diferencia.
    expect(c.diferencia).not.toBe(301_240);
  });

  it("sin uno de los dos NO afirma nada (coincide: null)", () => {
    expect(cuadreCajaHoy(cajaHoy(null), filas()).coincide).toBeNull();
    expect(cuadreCajaHoy(cajaHoy(summary()), filas(saldoSesionVencida())).coincide).toBeNull();
    expect(cuadreCajaHoy(cajaHoy(summary()), filas(saldoSesionVencida())).cajaHoy).toBe(9_800_000);
  });
});

describe("chipCajaHoy — la frescura del KPI", () => {
  it("available hoy → 'BICE · hoy ✓'; stale de hace dos días → sin ✓", () => {
    expect(chipCajaHoy(cajaHoy(summary()), BANCO, HOY)).toBe("BICE · hoy ✓");
    expect(chipCajaHoy(cajaHoy(SUMMARY_STALE), BANCO, HOY)).toBe("BICE · hace 2 días");
  });

  it("sin saldo → 'BICE · sin saldo' (nunca un ✓ sobre nada)", () => {
    expect(chipCajaHoy(cajaHoy(null), BANCO, HOY)).toBe("BICE · sin saldo");
  });
});

/* ── Movimientos ─────────────────────────────────────────────────────────────── */

describe("ciclo de vida de un movimiento (spec §V03)", () => {
  const porId = (id: string) => movimientos().find((m) => m.id === id)!;

  it("matched → conciliado (aunque también esté clasificado)", () => {
    expect(cicloDe(porId("m1"))).toBe("conciliado");
    expect(cicloDe(porId("m5"))).toBe("conciliado");
  });

  it("classified con categoría o cuenta de gestión → clasificado", () => {
    expect(cicloDe(porId("m2"))).toBe("clasificado"); // canonical + cuenta
    expect(cicloDe(porId("m4"))).toBe("clasificado"); // sólo cuenta de gestión
  });

  it("unclassified → por clasificar", () => {
    expect(cicloDe(porId("m3"))).toBe("por_clasificar");
    expect(cicloDe(porId("m6"))).toBe("por_clasificar");
  });

  it("'classified' SIN categoría ni cuenta de gestión NO se pinta Clasificado ✓: es por clasificar", () => {
    const m7 = porId("m7");
    expect(m7.classification_status).toBe("classified");
    expect(m7.canonical_category).toBeNull();
    expect(m7.management_account_id).toBeNull();
    expect(estaClasificado(m7)).toBe(false);
    expect(cicloDe(m7)).toBe("por_clasificar");
    expect(cicloDe(m7)).not.toBe("clasificado");
  });

  it("estados de conciliación: suggested/review/rejected/unmatched quedan por conciliar; excluded no", () => {
    for (const s of ["unmatched", "suggested", "review", "rejected", ""]) {
      expect(quedaPorConciliar({ reconciliation_status: s })).toBe(true);
    }
    for (const s of ["matched", "excluded", "prepago", "processor_batch"]) {
      expect(quedaPorConciliar({ reconciliation_status: s })).toBe(false);
    }
  });

  it("montoFirmado: el signo lo da direction; un amount no numérico es null, no 0", () => {
    expect(montoFirmado({ amount: "972231.00", direction: "credit" })).toBe(972_231);
    expect(montoFirmado({ amount: "972231.00", direction: "debit" })).toBe(-972_231);
    expect(montoFirmado({ amount: "-500", direction: "credit" })).toBe(-500);
    expect(montoFirmado({ amount: "", direction: "debit" })).toBeNull();
  });
});

describe("movimientosV03 — normalización", () => {
  it("firma, moneda (del movimiento o de la cuenta), etiqueta de cuenta, categoría humana; orden fecha desc", () => {
    const lista = movs();
    expect(lista).toHaveLength(8);
    expect(lista.map((m) => m.fecha)).toEqual([...lista.map((m) => m.fecha)].sort().reverse());
    const m1 = lista.find((m) => m.id === "m1")!;
    expect(m1.monto).toBe(6_000_000);
    expect(m1.esAbono).toBe(true);
    expect(m1.cuenta).toBe("CC CLP");
    expect(m1.categoria).toBe("Cobro de cliente");
    expect(subMovimiento(m1)).toBe("21 ago · CC CLP · Cobro de cliente");
    const m6 = lista.find((m) => m.id === "m6")!;
    expect(m6.moneda).toBe("USD");
    expect(m6.cuenta).toBe("CC USD");
    expect(subMovimiento(m6)).toBe("18 ago · CC USD · sin categoría");
  });

  it("la glosa va COMPLETA (Ley 7): ni se recorta ni se le extrae una contraparte", () => {
    const m1 = movs().find((m) => m.id === "m1")!;
    expect(m1.glosa).toBe("Abono por transferencia de Cliente Norte SpA 76.123.456-7");
  });

  it("sólo toma la etiqueta del documento conciliado publicado por API", () => {
    const linked = {
      ...movimientos()[0]!,
      reconciliation_document: {
        document_id: "doc-1",
        document_kind: "receivable",
        counterparty_label: " Cliente Norte SpA ",
      },
    } as BankMovement;
    const review = {
      ...movimientos()[1]!,
      reconciliation_status: "review",
      reconciliation_document: null,
    } as BankMovement;
    const rows = movimientosV03({
      items: [linked, review],
      cuentas: new Map(),
      categorias: new Map(),
    });
    const row = rows.find((movement) => movement.id === linked.id);
    const reviewRow = rows.find((movement) => movement.id === review.id);

    expect(row?.documentoConciliado).toBe("Cliente Norte SpA");
    expect(row && subMovimiento(row)).toContain("Documento conciliado · Cliente Norte SpA");
    expect(row?.glosa).toBe("Abono por transferencia de Cliente Norte SpA 76.123.456-7");
    expect(reviewRow?.documentoConciliado).toBeNull();
    expect(reviewRow && subMovimiento(reviewRow)).not.toContain("Documento conciliado");
    expect(documentoConciliadoDe({ reconciliation_document: null })).toBeNull();
  });

  it("un movimiento sin monto numérico se descarta (no se pinta como $0)", () => {
    const roto = { ...movimientos()[0]!, id: "x", amount: "" } as BankMovement;
    const lista = movimientosV03({ items: [roto], cuentas: new Map(), categorias: new Map() });
    expect(lista).toEqual([]);
  });

  it("usa el estado efectivo para vínculos especializados aunque el estado almacenado siga pendiente", () => {
    const linked = {
      ...movimientos()[0]!,
      reconciliation_status: "unmatched",
      effective_reconciliation_status: "matched",
    } as BankMovement;
    const [row] = movimientosV03({ items: [linked], cuentas: new Map(), categorias: new Map() });
    expect(row?.estadoConciliacion).toBe("conciliado");
    expect(row?.porConciliar).toBe(false);
  });

  it("declara moneda desconocida si no viene ni en el movimiento ni en su cuenta", () => {
    const unknown = { ...movimientos()[0]!, currency_code: null } as BankMovement;
    const [row] = movimientosV03({ items: [unknown], cuentas: new Map(), categorias: new Map() });
    expect(row?.moneda).toBe("Moneda no informada");
  });

  it("cuenta desconocida → 'Cuenta ····<últimos 4 del id>' y la moneda declarada del movimiento", () => {
    const lista = movimientosV03({
      items: movimientos(),
      cuentas: new Map(),
      categorias: new Map(),
    });
    expect(lista.find((m) => m.id === "m1")!.cuenta).toBe("Cuenta ····-clp");
    expect(lista.find((m) => m.id === "m1")!.moneda).toBe("CLP");
  });

  it("montoConSigno: +$ para abonos, −$ (U+2212) para cargos, US$ con decimales", () => {
    expect(montoConSigno({ monto: 6_000_000, moneda: "CLP" })).toBe("+$6.000.000");
    expect(montoConSigno({ monto: -66_222, moneda: "CLP" })).toBe("−$66.222");
    // El separador entre símbolo y número es NBSP (U+00A0), como lo rinde `formatMoney`.
    expect(montoConSigno({ monto: -184, moneda: "USD" })).toBe("−US$ 184,00");
  });

  it("pendientesPorCuenta: cuenta sólo lo que queda por conciliar", () => {
    const p = pendientesPorCuenta(movs());
    expect(p.get("acc-clp")).toBe(4); // m2, m3, m4, m7 (m1 y m5 matched; m8 excluded)
    expect(p.get("acc-usd")).toBe(1); // m6
  });
});

describe("filtros con conteo (spec §1.3: SIEMPRE con conteo)", () => {
  it("Todos · 8 / Abonos · 3 / Cargos · 5 / Por conciliar · 5", () => {
    expect(contarMovimientosV03(movs())).toEqual({
      todos: 8,
      abonos: 3,
      cargos: 5,
      porConciliar: 5,
    });
  });

  it("'Por conciliar · N' NO incluye conciliados ni excluidos — el conteo es el filtro", () => {
    const lista = movs();
    const porConciliar = filtrarMovimientosV03(lista, "todos", "", "pendiente");
    expect(porConciliar.map((m) => m.id).sort()).toEqual(["m2", "m3", "m4", "m6", "m7"]);
    expect(porConciliar.map((m) => m.id)).not.toContain("m1");
    expect(porConciliar.map((m) => m.id)).not.toContain("m5");
    expect(porConciliar.map((m) => m.id)).not.toContain("m8");
    expect(contarMovimientosV03(lista).porConciliar).toBe(porConciliar.length);
    // Gemelo positivo: "Todos" SÍ trae m1, m5 y m8.
    expect(filtrarMovimientosV03(lista, "todos", "").map((m) => m.id)).toEqual(
      expect.arrayContaining(["m1", "m5", "m8"]),
    );
  });

  it("abonos y cargos se reparten sin superposición", () => {
    const lista = movs();
    const a = filtrarMovimientosV03(lista, "abonos", "").map((m) => m.id);
    const c = filtrarMovimientosV03(lista, "cargos", "").map((m) => m.id);
    expect(a.sort()).toEqual(["m1", "m4", "m8"]);
    expect(c).toHaveLength(5);
    expect(a.filter((id) => c.includes(id))).toEqual([]);
  });

  it("los conteos siguen a la búsqueda: lo que dice el chip es lo que se ve al pulsarlo", () => {
    const lista = movs();
    const c = contarMovimientosV03(lista, "abono");
    expect(c).toEqual({ todos: 3, abonos: 3, cargos: 0, porConciliar: 1 });
    expect(filtrarMovimientosV03(lista, "todos", "abono", "pendiente").map((m) => m.id)).toEqual([
      "m4",
    ]);
  });

  it("filtra conciliación y clasificación como ejes independientes", () => {
    const lista = movs();
    expect(filtrarMovimientosV03(lista, "todos", "", "conciliado").map((m) => m.id)).toEqual([
      "m1",
      "m5",
    ]);
    expect(
      filtrarMovimientosV03(lista, "todos", "", "todos", "clasificado").map((m) => m.id),
    ).toEqual(["m1", "m4", "m2", "m5"]);
    expect(
      filtrarMovimientosV03(lista, "todos", "", "conciliado", "clasificado").map((m) => m.id),
    ).toEqual(["m1", "m5"]);
  });
});

describe("buscar por glosa, RUT o monto (aceptación §V03)", () => {
  const m1 = () => movs().find((m) => m.id === "m1")!;

  it("glosa: texto, sin distinguir mayúsculas", () => {
    expect(coincideBusqueda(m1(), "cliente norte")).toBe(true);
    expect(coincideBusqueda(m1(), "dattatec")).toBe(false);
  });

  it("RUT: con puntos, sin puntos, con o sin guion — encuentra lo mismo", () => {
    expect(coincideBusqueda(m1(), "76.123.456-7")).toBe(true);
    expect(coincideBusqueda(m1(), "76123456-7")).toBe(true);
    expect(coincideBusqueda(m1(), "761234567")).toBe(true);
    expect(coincideBusqueda(m1(), "76.999.999-9")).toBe(false);
  });

  it("monto: con o sin puntos de miles y símbolo", () => {
    expect(coincideBusqueda(m1(), "6.000.000")).toBe(true);
    expect(coincideBusqueda(m1(), "$6000000")).toBe(true);
    expect(coincideBusqueda(m1(), "6000")).toBe(true); // prefijo del monto
    expect(coincideBusqueda(m1(), "7450761")).toBe(false);
  });

  it("vacío → todo pasa; menos de 3 dígitos no matchea por número (evita ruido)", () => {
    expect(coincideBusqueda(m1(), "   ")).toBe(true);
    expect(coincideBusqueda(m1(), "60")).toBe(false);
  });
});

describe("totales del footer, por moneda (INV-FX-001)", () => {
  it("abonos, cargos y neto separados por moneda; n por moneda", () => {
    expect(totalesPorMoneda(movs())).toEqual([
      { moneda: "CLP", abonos: 7_120_000, cargos: -7_966_983, neto: -846_983, n: 7 },
      { moneda: "USD", abonos: 0, cargos: -184, neto: -184, n: 1 },
    ]);
  });
});

describe("CTA y export", () => {
  it("'Clasificar' abre la Bandeja de excepciones", () => {
    expect(hrefClasificar()).toBe("/bandeja");
    expect(hrefClasificar()).not.toContain("/caja/por-clasificar");
  });

  it("CSV con separador ';', cabecera y monto firmado crudo; escapa comillas", () => {
    const csv = csvMovimientos(movs().filter((m) => m.id === "m3" || m.id === "m1"));
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe("fecha;glosa;cuenta;categoria;conciliacion;clasificacion;moneda;monto");
    expect(lineas[1]).toBe(
      "2026-08-21;Abono por transferencia de Cliente Norte SpA 76.123.456-7;CC CLP;Cobro de cliente;Conciliado;Clasificado;CLP;6000000",
    );
    expect(lineas[2]).toBe(
      "2026-08-20;Transf. Dattatec.com hosting;CC CLP;;Pendiente;Sin clasificar;CLP;-66222",
    );
  });
});

describe("conexionBanco — un error SÓLO en tarjetas no tumba la conexión", () => {
  it("saldo con cuentas vivas + tarjetas con status error → sigue conectada (los saldos son reales)", () => {
    const c = conexionBanco(sourcesOk(), saldoOk(), tarjetasSesionVencida());
    expect(c.estado).toBe("conectada");
    expect(c.pill).not.toBe("Tu acción");
  });

  it("sin respuesta de saldo, el error de tarjetas sí es la señal disponible → Tu acción", () => {
    const c = conexionBanco(sourcesOk(), null, tarjetasSesionVencida());
    expect(c.estado).toBe("accion_requerida");
  });
});
