import { Banner } from "@/components/rediseno/banner";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import type {
  SaludAusenciaVista,
  SaludIdentificadorVista,
  SaludInstrumentoVista,
  SaludVista,
} from "./salud-contrato-model";

/* Vista de Salud sobre el contrato canónico. Presenta lo que el contrato publica y nada más.

   Es una vista NUEVA, no una adaptación del prototipo de UX: el prototipo habla de cuadrantes,
   curva de caja, día de quiebre y decisiones, y el contrato no publica ninguna de esas cosas.
   Mapear su vocabulario sobre estos datos sería fabricarlo, así que el prototipo se queda donde
   sirve —el catálogo de diseño— y esta vista se escribe contra el contrato. */

const TONO_PILL = { ok: "ok", warn: "warn", bad: "bad" } as const;

function Identificadores({
  titulo,
  glosa,
  items,
}: {
  titulo: string;
  glosa: string;
  items: SaludIdentificadorVista[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-[12px] border border-rediseno-hairline bg-rediseno-porcelana px-4 py-3">
      <p className="text-[13px] font-medium text-rediseno-tinta">{titulo}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-rediseno-tinta-2">{glosa}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.identificador}
            className="rounded-md bg-rediseno-superficie px-2 py-0.5 font-rediseno-mono text-[11.5px] text-rediseno-tinta-3"
          >
            {item.identificador}
            {item.detalle ? ` · ${item.detalle}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tendencia({ instrumento }: { instrumento: SaludInstrumentoVista }) {
  if (instrumento.tendencia.length === 0) return null;
  return (
    <section>
      <h4 className="font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
        Cortes anteriores
      </h4>
      <p className="mt-1 text-[12.5px] text-rediseno-tinta-2">
        {`La serie trae ${instrumento.tendencia.length} ${instrumento.tendencia.length === 1 ? "corte" : "cortes"}, del ${instrumento.tendencia[0]?.fecha} al ${instrumento.tendencia[instrumento.tendencia.length - 1]?.fecha}.`}
      </p>
      <ul className="mt-2 flex items-end gap-1.5">
        {instrumento.tendencia.map((punto) => (
          <li key={punto.clave} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="flex h-16 w-full items-end" title={`${punto.fecha}: ${punto.valor}`}>
              <span
                className="w-full rounded-t-sm bg-rediseno-azul/70"
                style={{ height: `${punto.alturaRelativa}%` }}
              />
            </span>
            <span className="truncate font-rediseno-mono text-[10.5px] text-rediseno-tinta-3-light">
              {punto.fecha}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Subindices({ instrumento }: { instrumento: SaludInstrumentoVista }) {
  if (instrumento.subindices.length === 0) return null;
  return (
    <section>
      <h4 className="font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
        Partes que lo componen
      </h4>
      <ul className="mt-2 divide-y divide-rediseno-hairline">
        {instrumento.subindices.map((parte) => (
          <li key={parte.clave} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1 text-[13.5px] text-rediseno-tinta">
              {parte.etiqueta ? (
                parte.etiqueta
              ) : (
                <span className="font-rediseno-mono text-[12px] text-rediseno-tinta-3">
                  {parte.identificador}
                </span>
              )}
            </span>
            {parte.banda && <Pill variant="mut">{parte.banda}</Pill>}
            <span className="font-rediseno-sans text-[14px] font-medium text-rediseno-tinta tabular-nums">
              {parte.valor}
            </span>
            <span className="w-24 text-right text-[12.5px] text-rediseno-tinta-3 tabular-nums">
              {`pesa ${parte.peso}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Motivos({ instrumento }: { instrumento: SaludInstrumentoVista }) {
  const hallazgos = instrumento.motivos.filter((motivo) => motivo.tipo === "hallazgo");
  const limites = instrumento.motivos.filter((motivo) => motivo.tipo === "limite");

  return (
    <div className="space-y-4">
      {hallazgos.length > 0 && (
        <section>
          <h4 className="font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
            Qué le pasa a tu empresa
          </h4>
          <ul className="mt-2 space-y-2">
            {hallazgos.map((motivo) => (
              <li key={motivo.clave} className="text-[13.5px] leading-relaxed text-rediseno-tinta">
                {motivo.texto}
                {(motivo.impacto || motivo.parte) && (
                  <span className="mt-0.5 block text-[12.5px] text-rediseno-tinta-3">
                    {[motivo.parte, motivo.impacto].filter(Boolean).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {limites.length > 0 && (
        <section>
          <h4 className="font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
            Qué quedó fuera de la medición
          </h4>
          <p className="mt-1 text-[12.5px] text-rediseno-tinta-2">
            Esto califica la medición, no la salud de tu empresa.
          </p>
          <ul className="mt-2 space-y-2">
            {limites.map((motivo) => (
              <li
                key={motivo.clave}
                className="text-[13.5px] leading-relaxed text-rediseno-tinta-2"
              >
                {motivo.texto}
                {(motivo.impacto || motivo.parte) && (
                  <span className="mt-0.5 block text-[12.5px] text-rediseno-tinta-3">
                    {[motivo.parte, motivo.impacto].filter(Boolean).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Identificadores
        titulo="Motivos que esta pantalla todavía no redacta"
        glosa="Llegaron con la lectura y se cuentan acá con su identificador, tal cual: ponerles una frase nuestra sería decidir por el modelo qué significan."
        items={instrumento.motivosPorNombrar}
      />
    </div>
  );
}

function Respaldo({ instrumento }: { instrumento: SaludInstrumentoVista }) {
  const respaldo = instrumento.respaldo;
  if (!respaldo) return null;
  return (
    <section>
      <h4 className="font-rediseno-mono text-[12px] tracking-[.1em] text-rediseno-tinta-3-light uppercase">
        Respaldo del dato
      </h4>
      <p className="mt-1 text-[13.5px] text-rediseno-tinta">
        <span className="font-medium tabular-nums">{respaldo.valor}</span>
        {` · ${respaldo.resumen}`}
      </p>
      <p className="mt-0.5 text-[12.5px] text-rediseno-tinta-2">
        Mide cuánto se pudo mirar para armar este puntaje, no cómo está tu empresa.
      </p>
      {respaldo.componentes.length > 0 && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {respaldo.componentes.map((componente) => (
            <li
              key={componente.etiqueta}
              className="flex items-baseline justify-between gap-2 text-[12.5px] text-rediseno-tinta-2"
            >
              <span className="min-w-0 truncate">{componente.etiqueta}</span>
              <span className="tabular-nums">{componente.valor}</span>
            </li>
          ))}
        </ul>
      )}
      {respaldo.verificaciones.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {respaldo.verificaciones.map((verificacion) => (
            <li key={verificacion.etiqueta}>
              <Pill variant={verificacion.acreditada ? "ok" : "mut"}>{verificacion.etiqueta}</Pill>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <Identificadores
          titulo="Respaldos que esta pantalla todavía no nombra"
          glosa="Entran al cálculo con el peso que se indica; su identificador queda a la vista en vez de traducirse a un nombre que nadie ratificó."
          items={respaldo.porNombrar}
        />
      </div>
    </section>
  );
}

function Instrumento({ instrumento }: { instrumento: SaludInstrumentoVista }) {
  return (
    <article className="space-y-5 rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-5">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-rediseno-sans text-[17px] font-medium text-rediseno-tinta">
              {instrumento.titulo}
            </h3>
            {instrumento.banda ? (
              <Pill variant={TONO_PILL[instrumento.bandaTono]}>{instrumento.banda}</Pill>
            ) : (
              <span className="rounded-md bg-rediseno-porcelana px-2 py-0.5 font-rediseno-mono text-[11.5px] text-rediseno-tinta-3">
                {instrumento.bandaIdentificador}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-rediseno-tinta-2">
            {instrumento.cobertura}
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard
          label="Puntaje"
          value={instrumento.score}
          period={instrumento.corte}
          detail={instrumento.variacion ?? `Modelo ${instrumento.version}.`}
        />
        <KpiCard
          label="Modelo que lo calculó"
          value={instrumento.version}
          detail={`Corte del ${instrumento.corte}.`}
        />
      </div>

      {instrumento.tope && (
        <Banner variant="warn">
          <span className="font-medium text-rediseno-tinta">Este puntaje está topado. </span>
          {instrumento.tope.texto}
        </Banner>
      )}

      <Subindices instrumento={instrumento} />
      <Tendencia instrumento={instrumento} />
      <Motivos instrumento={instrumento} />
      <Respaldo instrumento={instrumento} />
    </article>
  );
}

function Ausencia({ ausencia }: { ausencia: SaludAusenciaVista }) {
  return (
    <article className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie p-5">
      <h3 className="font-rediseno-sans text-[17px] font-medium text-rediseno-tinta">
        {ausencia.titulo}
      </h3>
      <p className="mt-1 max-w-[46rem] text-[13.5px] leading-relaxed text-rediseno-tinta-2">
        {ausencia.cobertura}
      </p>
    </article>
  );
}

export function SaludContratoView({ model }: { model: SaludVista }) {
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-rediseno-tinta-2">
        {`Corte del ${model.corte}, en ${model.moneda}. Lectura armada el ${model.sello}.`}
      </p>
      {model.instrumentos.map((instrumento) => (
        <Instrumento key={instrumento.instrumento} instrumento={instrumento} />
      ))}
      {model.ausencias.map((ausencia) => (
        <Ausencia key={ausencia.instrumento} ausencia={ausencia} />
      ))}
    </div>
  );
}
