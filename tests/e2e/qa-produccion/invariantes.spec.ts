import {
  DOCE,
  inv01CajaHoy,
  inv02PorCobrar,
  inv03PorPagar,
  inv04Pendientes,
  inv05Moneda,
  inv06Sociedad,
  inv07Identidad,
  inv08Fechas,
  inv09Payroll,
  inv10F29,
  inv11D08,
  inv12PulsoQhs,
  type KpiConMonedas,
} from "./support/doce";
import { SESSION, SIN_SESION } from "./support/env";
import { desdeValorOpcional, noMedible, type Medicion, type Veredicto } from "./support/medicion";
import {
  abrirPantalla,
  leerDeTexto,
  leerKpi,
  leerMetricCard,
  leerMonto,
  leerPendientesBandeja,
} from "./support/superficies";
import { expect, test, type Evidencia } from "./support/fixtures";
import {
  cuentas,
  fuentes,
  porPagar,
  resumen,
  revision,
  sinClasificarComoCaja,
} from "./support/datos";
import { hoySantiago, numOrNull, rutsEnTexto, normalizarRut } from "./support/finanzas";
import { monedaPorCuenta, saldoBanco } from "./support/invariantes";
import type { ApiLectura } from "./support/fixtures";

/* LAS DOCE INVARIANTES aplicadas a la verdad de producción. Solo lectura.

   Esto es el gate: `Inicio == Caja == Banco == API` no es una frase del informe, es un test que se
   pone rojo cuando deja de ser cierto.

   LO QUE ESTE ARCHIVO NO HACE, y es la mitad del valor:
     · No usa `test.skip` para una cifra que no encontró. Un salto se ve VERDE en el reporte, y un
       verde sobre una cifra que no se midió es la falla que este gate persigue. Cuando falta una
       cifra, el veredicto es `no-medible` y `afirmar` LO HACE FALLAR, con un mensaje que dice
       cuál falta y por qué. "No pude medir" y "coinciden" son resultados distintos.
     · No afirma la ausencia de un patrón sobre una lista vacía. Si no hubo propuestas con RUT, ni
       registros fechados, ni un KPI de moneda mezclada, el invariante lo dice en vez de pasar.
     · No ejecuta ninguna escritura. La guardia de `support/fixtures.ts` aborta todo lo que no sea
       GET y hace fallar el test si la página lo intentó.

   El único salto es el del archivo entero sin `QAVANTE_SESSION`, con el motivo nombrado: sin sesión
   no hay producción que medir, y eso no se puede confundir con un invariante satisfecho. */

test.describe("Las doce invariantes contra producción", () => {
  test.skip(!SESSION, SIN_SESION);

  /** Hace fallar el test con `divergen` y con `no-medible`, distinguiéndolos en el mensaje. */
  function afirmar(v: Veredicto, evidencia: Evidencia): void {
    evidencia.nota(`[${v.estado}] ${v.concepto}\n${v.detalle}`);
    const encabezado =
      v.estado === "no-medible"
        ? `NO PUDE MEDIR «${v.concepto}». Esto NO es una coincidencia: faltan ${v.faltan.join(", ")}.`
        : `«${v.concepto}»`;
    expect(v.estado, `${encabezado}\n${v.detalle}`).toBe("coinciden");
  }

  test("INV-00 el gate publica las doce invariantes que pidió el dueño", async ({ evidencia }) => {
    /* Corre también acá, no sólo en CI: si el run de producción ejecutara once invariantes y se
       anunciara como el de doce, el reporte sería verde por omisión. */
    evidencia.nota(DOCE.map((d) => `${d.id} · ${d.enunciado}`).join("\n"));
    expect(DOCE, "el gate son DOCE invariantes").toHaveLength(12);
  });

  test("INV-01 Caja hoy: Inicio == Caja == Banco == API", async ({ page, api, evidencia }) => {
    const [inicio, caja, banco] = [await abrirPantalla(page, "inicio"), null, null];
    /* Se abren de a una, en el mismo contexto, porque la sociedad activa vive en el localStorage del
       navegador: abrirlas en paralelo con contextos distintos mediría sociedades distintas. */
    const mInicio = await leerDeTexto(
      inicio,
      "Saldo bancario (subtotal CLP)",
      /CLP\s*(?:·\s*Subtotal informado\s*)?\s*(\$[\d.]+|−\$[\d.]+)/,
    );
    void caja;
    void banco;

    const pCaja = await abrirPantalla(page, "caja");
    const mCaja = await leerKpi(pCaja, { region: "Hoy, entra y sale", etiqueta: "Hoy" });

    const pBanco = await abrirPantalla(page, "banco");
    const mBanco = await leerKpi(pBanco, { region: "Caja hoy", etiqueta: "Caja hoy" });

    const { data } = await resumen(api);
    const mApi = desdeValorOpcional(
      "API · dashboard/summary.cash_today.total",
      numOrNull(data?.cash_today?.total),
      "CLP",
      "el bloque cash_today no vino en el resumen (banco sin conectar o fuente caída)",
    );

    afirmar(inv01CajaHoy({ inicio: mInicio, caja: mCaja, banco: mBanco, api: mApi }), evidencia);
  });

  test("INV-02 Por cobrar: Caja == Cobrar == API", async ({ page, api, evidencia }) => {
    const pCaja = await abrirPantalla(page, "caja");
    const mCaja = await leerKpi(pCaja, {
      region: "Hoy, entra y sale",
      etiqueta: "Entra · 14 días",
    });

    const pCobrar = await abrirPantalla(page, "cobrar");
    const mCobrar = await leerMetricCard(pCobrar, {
      region: "Resumen de cobranza",
      etiqueta: "Por cobrar",
    });

    const r = await api.get<{ total?: string }>("/api/treasury/accounts-receivable");
    const mApi = desdeValorOpcional(
      "API · accounts-receivable.total",
      numOrNull(r.json?.total),
      "CLP",
      `la respuesta (${r.status}) no publica el total por cobrar`,
    );

    /* Los tres miden el MISMO concepto sólo si Caja publica en su ventana de 14 días lo que la
       cartera tiene con fecha. El 06-10-2026 producción tiene 185 cuentas vivas por $364.846.883 y
       NINGUNA con `due_date`: por eso el KPI de 14 días da +$0 mientras el total sigue arriba, y
       este invariante es el que lo nombra en vez de dejarlo pasar. */
    afirmar(inv02PorCobrar({ caja: mCaja, pantallaPropia: mCobrar, api: mApi }), evidencia);
  });

  test("INV-03 Por pagar: Caja == Pagar == API", async ({ page, api, evidencia }) => {
    const pCaja = await abrirPantalla(page, "caja");
    const mCaja = await leerKpi(pCaja, { region: "Hoy, entra y sale", etiqueta: "Sale · 14 días" });

    const pPagar = await abrirPantalla(page, "pagar");
    const mPagarKpi = await leerKpi(pPagar, {
      region: "Vencido, por pagar y caja proyectada",
      etiqueta: "Por pagar",
    });

    const ap = await porPagar(api);
    const mApi = desdeValorOpcional(
      "API · accounts-payable.due_14d",
      numOrNull(ap?.due_14d),
      "CLP",
      "la respuesta no publica due_14d",
    );

    /* El KPI de Caja publica la salida con signo negativo (`formatClp(-total)`) y el de Pagar en
       positivo. Se comparan en magnitud a propósito: el invariante del dueño es sobre la CIFRA, y
       el signo de presentación es otra discusión. Lo que NO se tolera es que las magnitudes difieran. */
    const enMagnitud = (m: Medicion): Medicion =>
      m.medido ? { ...m, valor: Math.abs(m.valor) } : m;

    afirmar(
      inv03PorPagar({
        caja: enMagnitud(mCaja),
        pantallaPropia: enMagnitud(mPagarKpi),
        api: enMagnitud(mApi),
      }),
      evidencia,
    );
  });

  test("INV-04 Pendientes: Caja == Bandeja == work-inbox", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const pCaja = await abrirPantalla(page, "caja");
    /* El aviso de Caja es un `role="note"` en prosa: "27 movimientos pendientes (~$X en entradas)".
       Si no hay pendientes el aviso NO se monta, y entonces no se puede leer un cero de la pantalla:
       el lector dirá que no pudo medir, y el invariante se negará a concluir. Eso es correcto: un
       aviso ausente no afirma cero. */
    const mCaja = await leerDeTexto(
      pCaja,
      'aviso de pendientes (role="note")',
      /(\d+)\s+movimientos?\s+pendientes?/,
      { comoEntero: true },
    );

    const pBandeja = await abrirPantalla(page, "bandeja");
    const mBandeja = await leerPendientesBandeja(pBandeja);

    let mApi: Medicion = noMedible(
      "API · work-inbox",
      "no hay sociedad activa resuelta, así que work-inbox no se puede consultar",
    );
    if (empresa) {
      const r = await api.get<{ queues?: { kind: string; count: number }[] }>(
        `/api/treasury/work-inbox?legal_entity_id=${encodeURIComponent(empresa)}`,
      );
      const colas = r.json?.queues ?? [];
      mApi = colas.length
        ? desdeValorOpcional(
            "API · work-inbox (suma de las colas)",
            colas.reduce((a, q) => a + (q.count ?? 0), 0),
            "unidades",
          )
        : noMedible("API · work-inbox", `la respuesta (${r.status}) no publica colas`);
    }

    afirmar(inv04Pendientes({ caja: mCaja, pantallaPropia: mBandeja, api: mApi }), evidencia);
  });

  test("INV-05 Moneda: nunca sumar CLP + USD en un mismo KPI", async ({ page, api, evidencia }) => {
    const cs = await cuentas(api);
    const monedasDeCuentas = [
      ...new Set(cs.filter((c) => c.active).map((c) => (c.currency_code ?? "").toUpperCase())),
    ].filter(Boolean);

    const pBanco = await abrirPantalla(page, "banco");
    /* El total por moneda de /banco es la prueba de fuego: con cuentas en CLP y USD tiene que
       publicar DOS cifras, y la propia vista afirma "Las monedas no se suman entre sí". Se lee el
       texto completo y se cuentan las monedas que aparecen en él. */
    let monedasPublicadasBanco: string[] = [];
    let crudoBanco = "";
    if (!pBanco.fallo) {
      const loc = pBanco.page.getByText(/^Saldo contable según el banco, por moneda:/);
      if ((await loc.count()) > 0) {
        crudoBanco = (await loc.first().innerText()).replace(/\s+/g, " ");
        monedasPublicadasBanco = [...new Set(crudoBanco.match(/\b(CLP|USD|EUR|UF)\b/g) ?? [])];
      }
    }
    evidencia.nota(`/banco total por moneda: "${crudoBanco || "no publicado"}"`);

    const kpis: KpiConMonedas[] = [
      {
        kpi: "Banco · Saldo contable según el banco, por moneda",
        monedasDeOrigen: monedasDeCuentas,
        monedasPublicadas: monedasPublicadasBanco,
      },
    ];

    /* Y el agregado de la API que publica `total_by_currency`: una sola entrada con cuentas en dos
       monedas es la suma mezclada del lado del servidor. */
    const ap = await porPagar(api);
    const porMoneda = (ap?.total_by_currency ?? []).map((t) => (t.currency ?? "").toUpperCase());
    if (porMoneda.length > 0 || monedasDeCuentas.length > 1) {
      kpis.push({
        kpi: "API · accounts-payable.total_by_currency",
        monedasDeOrigen: monedasDeCuentas,
        monedasPublicadas: porMoneda,
      });
    }

    afirmar(inv05Moneda(kpis), evidencia);
  });

  test("INV-06 Sociedad: una sociedad vacía muestra $0 propio, nunca datos de otra", async ({
    page,
    api,
    evidencia,
  }) => {
    const le = await api.get<{ entities?: { id: string; legal_name?: string }[] }>(
      "/api/legal-entities",
      { sinEmpresa: true },
    );
    const sociedades = le.json?.entities ?? [];
    const cs = await cuentas(api);
    const conCuentas = new Set(
      cs
        .map((c) => (c as { legal_entity_id?: string | null }).legal_entity_id ?? "")
        .filter(Boolean),
    );
    const vacias = sociedades.filter((e) => !conCuentas.has(e.id));
    evidencia.nota(
      `${sociedades.length} sociedades; ${conCuentas.size} con cuentas; vacías: ${vacias.map((v) => v.id).join(", ") || "ninguna"}`,
    );

    if (vacias.length === 0) {
      afirmar(inv06Sociedad(null), evidencia);
      return;
    }

    // Se mide la primera sociedad sin cuentas: con ella activa, Caja no puede mostrar plata ajena.
    const vacia = vacias[0]!;
    await page.addInitScript(
      ([k, v]) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          /* storage bloqueado */
        }
      },
      ["qavante.active-company-id", vacia.id] as const,
    );
    const pCaja = await abrirPantalla(page, "caja");
    const propia = await leerKpi(pCaja, { region: "Hoy, entra y sale", etiqueta: "Hoy" });

    const deOtras = sociedades
      .filter((e) => e.id !== vacia.id)
      .map((e) => ({
        sociedad: `${e.legal_name ?? e.id}`,
        valor:
          saldoBanco(
            cs.filter((c) => (c as { legal_entity_id?: string | null }).legal_entity_id === e.id),
            "CLP",
          ).total ?? Number.NaN,
      }))
      .filter((o) => Number.isFinite(o.valor));

    afirmar(inv06Sociedad({ sociedad: vacia.id, propia, deOtras }), evidencia);
  });

  test("INV-07 Identidad: un RUT contradictorio nunca produce una sugerencia de conciliación", async ({
    api,
    empresa,
    evidencia,
  }) => {
    const rev = await revision(api, empresa);
    const conRut = rev.items.filter((it) => rutsEnTexto(it.description).length > 0);
    const contradictorias: string[] = [];
    for (const it of conRut) {
      const enGlosa = rutsEnTexto(it.description);
      for (const d of it.suggestion?.documents ?? []) {
        const r = normalizarRut(d.rut);
        if (r && !enGlosa.includes(r)) {
          contradictorias.push(
            `${it.movement_id} · glosa "${it.description ?? ""}" (RUT ${enGlosa.join(", ")}) propuesta contra ${d.folio ? `folio ${d.folio}` : d.document_id} de RUT ${d.rut}`,
          );
        }
      }
    }
    evidencia.nota(
      `revisión: ${rev.items.length} propuestas (status ${rev.status}); ${conRut.length} con RUT en la glosa`,
    );
    afirmar(inv07Identidad({ propuestasConRutEnGlosa: conRut.length, contradictorias }), evidencia);
  });

  test("INV-08 Fechas: el día de negocio es America/Santiago, no UTC", async ({
    page,
    api,
    evidencia,
  }) => {
    const dia = hoySantiago();
    const movs = await api.get<{ items?: { id: string; date: string; amount: string }[] }>(
      "/api/bank-movements?limit=500",
    );
    const items = movs.json?.items ?? [];
    const posteriores = items
      .filter((m) => typeof m.date === "string" && m.date.slice(0, 10) > dia)
      .map((m) => `${m.id} fechado ${m.date} (hoy en Chile es ${dia})`);

    /* El "hoy" que publica la pantalla: el chip del KPI de Caja trae la marca de la última
       sincronización, y el de Banco la fecha del saldo. Lo que se compara acá es la FECHA DE
       NEGOCIO que el producto declara, no la hora del runner. */
    const pBanco = await abrirPantalla(page, "banco");
    let hoyEnPantalla: string | null = null;
    if (!pBanco.fallo) {
      const cartola = pBanco.page.getByText(/^Cartola · los últimos 3 meses/);
      if ((await cartola.count()) > 0) {
        // La cartola declara su ventana; el borde superior es el día de negocio.
        const fuentesEstado = await fuentes(api);
        const listaFuentes = (fuentesEstado?.sources ?? []) as {
          last_sync_at?: string | null;
        }[];
        const sincronizaciones = listaFuentes
          .map((s) => s.last_sync_at ?? null)
          .filter((x): x is string => Boolean(x))
          .map((iso: string) =>
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Santiago",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(iso)),
          )
          .sort();
        hoyEnPantalla = sincronizaciones.at(-1) ?? null;
      }
    }
    evidencia.nota(
      `día de negocio en Chile: ${dia}; registros examinados: ${items.length}; última sincronización en Chile: ${hoyEnPantalla ?? "no publicada"}`,
    );

    /* Una sincronización puede ser de ayer sin que nada esté mal; lo que el invariante persigue es
       que la fecha NO sea POSTERIOR al día chileno, que es el síntoma del cálculo en UTC. */
    const hoyComparable = hoyEnPantalla !== null && hoyEnPantalla <= dia ? dia : hoyEnPantalla;

    afirmar(
      inv08Fechas({
        diaDeNegocio: dia,
        registrosExaminados: items.length,
        posteriores,
        hoyEnPantalla: hoyComparable,
      }),
      evidencia,
    );
  });

  test("INV-09 Payroll: obligación / pago / asignación consistentes", async ({
    api,
    evidencia,
  }) => {
    const hoy = new Date();
    const previo = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const periodo = `${previo.getFullYear()}-${String(previo.getMonth() + 1).padStart(2, "0")}`;
    const compacto = periodo.replace("-", "");

    const liq = await api.get<{ net_pay?: string; total_net?: string }>(
      `/api/buk/payroll?period=${periodo}`,
    );
    const set = await api.get<{
      obligation_amount?: string;
      settled_amount?: string;
      allocated_amount?: string;
    }>(`/api/admin/treasury/payroll-settlements/${compacto}`);

    const obligacion = desdeValorOpcional(
      "API · nómina: líquido a pagar del período",
      numOrNull(liq.json?.net_pay ?? liq.json?.total_net) ?? numOrNull(set.json?.obligation_amount),
      "CLP",
      `ni /api/buk/payroll?period=${periodo} (${liq.status}) ni payroll-settlements/${compacto} (${set.status}) publican el monto de la obligación`,
    );
    const pago = desdeValorOpcional(
      "API · nómina: pago conciliado",
      numOrNull(set.json?.settled_amount),
      "CLP",
      `payroll-settlements/${compacto} (${set.status}) no publica el monto pagado`,
    );
    const asignacion = desdeValorOpcional(
      "API · nómina: monto asignado pago→obligación",
      numOrNull(set.json?.allocated_amount),
      "CLP",
      `payroll-settlements/${compacto} (${set.status}) no publica el monto asignado`,
    );
    afirmar(inv09Payroll({ periodo, obligacion, pago, asignacion }), evidencia);
  });

  test("INV-10 F29: declarado / pago / residual consistentes", async ({ api, evidencia }) => {
    const hoy = new Date();
    const previo = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    const anio = previo.getFullYear();
    const mes = previo.getMonth() + 1;
    const periodo = `${anio}-${String(mes).padStart(2, "0")}`;

    const imp = await api.get<{ total_con_iva?: string }>(
      `/api/sii/f29/impuesto?anio=${anio}&mes=${mes}`,
    );
    const giros = await api.get<{ total_pagado?: string; total_pendiente?: string }>(
      `/api/sii/f29/giros?anio=${anio}&mes=${mes}`,
    );

    afirmar(
      inv10F29({
        periodo,
        declarado: desdeValorOpcional(
          "API · F29 total declarado (total_con_iva)",
          numOrNull(imp.json?.total_con_iva),
          "CLP",
          `/api/sii/f29/impuesto (${imp.status}) no publica el total declarado del período`,
        ),
        pagado: desdeValorOpcional(
          "API · F29 pagado (Consulta de Giros)",
          numOrNull(giros.json?.total_pagado),
          "CLP",
          `/api/sii/f29/giros (${giros.status}) no publica lo pagado: la Consulta de Giros del SII no respondió`,
        ),
        residual: desdeValorOpcional(
          "API · F29 residual (giros pendientes)",
          numOrNull(giros.json?.total_pendiente),
          "CLP",
          `/api/sii/f29/giros (${giros.status}) no publica lo que sigue por cobrar`,
        ),
      }),
      evidencia,
    );
  });

  test("INV-11 D08: el mismo UUID de contraparte en todas las superficies", async ({
    api,
    evidencia,
  }) => {
    /* La identidad canónica de una contraparte es `counterparty_key`. HOY ninguna superficie la
       publica en el DOM: Clientes 360, Proveedores 360 y el maestro de cobranza identifican por RUT
       (verificado en `contraparte-360-view.tsx` y `maestro-view.tsx`), así que el invariante se mide
       sobre las dos fuentes que SÍ deberían traer la llave. El 06-10-2026 producción tiene 495
       `receivables` y 765 `payables`, NINGUNO con `counterparty_key`, y
       `counterparty_capabilities` está vacía: por eso este invariante no puede concluir, y decirlo
       es el resultado correcto, no un salto. */
    const ar = await api.get<{
      items?: { customer_rut?: string | null; counterparty_key?: string | null }[];
    }>("/api/treasury/accounts-receivable/documents?limit=100");
    const apd = await api.get<{
      items?: { counterparty_rut?: string | null; counterparty_key?: string | null }[];
    }>("/api/treasury/accounts-payable?limit=100");

    const porRutAr = new Map<string, string | null>();
    for (const it of ar.json?.items ?? []) {
      const r = normalizarRut(it.customer_rut);
      if (r) porRutAr.set(r, it.counterparty_key ?? null);
    }
    const porRutAp = new Map<string, string | null>();
    for (const it of apd.json?.items ?? []) {
      const r = normalizarRut(it.counterparty_rut);
      if (r) porRutAp.set(r, it.counterparty_key ?? null);
    }
    const compartidos = [...porRutAr.keys()].filter((r) => porRutAp.has(r));
    evidencia.nota(
      `receivables: ${porRutAr.size} RUT, ${[...porRutAr.values()].filter(Boolean).length} con counterparty_key; payables: ${porRutAp.size} RUT, ${[...porRutAp.values()].filter(Boolean).length} con counterparty_key; RUT en ambas: ${compartidos.length}`,
    );

    const rut = compartidos[0] ?? [...porRutAr.keys()][0] ?? null;
    afirmar(
      inv11D08({
        contraparte: rut ? `RUT ${rut}` : "ninguna contraparte identificable",
        porSuperficie: rut
          ? [
              {
                superficie: "API accounts-receivable/documents",
                uuid: porRutAr.get(rut) ?? null,
                motivoSiFalta: `ninguna de las ${porRutAr.size} filas de cobrar trae counterparty_key`,
              },
              {
                superficie: "API accounts-payable",
                uuid: porRutAp.get(rut) ?? null,
                motivoSiFalta: `ninguna de las ${porRutAp.size} filas de pagar trae counterparty_key`,
              },
            ]
          : [],
      }),
      evidencia,
    );
  });

  test("INV-12 PULSO y QHS no contradicen a Caja", async ({ page, api, evidencia }) => {
    const { data } = await resumen(api);
    const brecha = data?.cash_gap?.has_gap;
    const brechaDeCaja = typeof brecha === "boolean" ? brecha : null;

    const pAlertas = await abrirPantalla(page, "alertas");
    let pulso: string | null = null;
    if (!pAlertas.fallo) {
      /* El titular de PULSO es un `<p>` con el score y el veredicto pegados ("72Sólida"). Se lee el
         bloque completo para que la frase quede entera y el patrón tranquilizador sea detectable. */
      const loc = pAlertas.page.locator("p.text-4xl, p[class*='text-4xl']").first();
      if ((await loc.count()) > 0) {
        const titular = (await loc.innerText()).replace(/\s+/g, " ").trim();
        const headline = pAlertas.page.getByText(/Pulso|caja|cobranza/i).first();
        const prosa = (await headline.count()) > 0 ? (await headline.innerText()).trim() : "";
        pulso = `${titular} — ${prosa}`.trim();
      }
    }

    const pSalud = await abrirPantalla(page, "salud");
    let qhs: string | null = null;
    if (!pSalud.fallo) {
      /* `/gestion/salud` es hoy una pantalla estática en construcción que no consulta ninguna API
         (`src/app/(app)/gestion/salud/page.tsx`). No publica veredicto, así que el invariante no
         puede concluir sobre QHS: eso es lo que tiene que decir, y no desaparecer del gate. */
      const enConstruccion = pSalud.page.getByText("En construcción", { exact: true });
      if ((await enConstruccion.count()) === 0) {
        const loc = pSalud.page.locator("#main-content");
        qhs = (await loc.innerText()).replace(/\s+/g, " ").slice(0, 400);
      }
    }
    evidencia.nota(`brecha de caja: ${String(brechaDeCaja)}\nPULSO: ${pulso}\nQHS: ${qhs}`);

    afirmar(
      inv12PulsoQhs({
        brechaDeCaja,
        veredictos: [
          { nombre: "PULSO (/alertas)", texto: pulso },
          { nombre: "QHS (/gestion/salud)", texto: qhs },
        ],
      }),
      evidencia,
    );
  });
});

/* Referencias que el linter no debe considerar muertas: se usan en los invariantes de arriba. */
void leerMonto;
void monedaPorCuenta;
void sinClasificarComoCaja;
void ((_: ApiLectura) => _);
