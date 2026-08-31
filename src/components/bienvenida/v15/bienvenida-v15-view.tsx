"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/formatters/date";
import { DataState } from "@/components/rediseno/data-state";
import { Pill, type PillProps } from "@/components/rediseno/pill";
import type { OnboardingSourceState, OnboardingSourceStates } from "@/lib/api/onboarding-sources";
import { SOURCE_STATE_LABEL } from "@/components/onboarding/onboarding-source-meta";
import {
  concordar,
  fuentesConectadas,
  fuentesPendientes,
  fuentesV15,
  progresoModeloV15,
  promesaPrimerParte,
  type FuenteV15,
  type ProgresoModeloV15,
  type PromesaV15,
} from "./bienvenida-v15-model";

/* V15 · Bienvenida — `/bienvenida` (ESPECIFICACION §V15, issue #76, R1).
 *
 * PRESENTACIONAL: entran los estados ya resueltos, sale la pantalla; el cableado vive en
 * `bienvenida-v15-live.tsx` (`useOnboardingSources`, el MISMO adaptador que el hub `/conexiones` y
 * el guard del onboarding — Ley 1).
 *
 * ── EL HUECO DE ESTA ENTREGA, DECLARADO DONDE SE PUEDE VERIFICAR ────────────────────────────
 * El paso 2 ("progreso de construcción del modelo") NO tiene un contador ni una barra que avance:
 * no existe ningún evento de progreso consultable del sync (el issue lo marca 🔧 — "exponer lo que
 * el sync ya sabe"). En vez de simular avance con un número plausible (prohibido explícito de la
 * spec: "sin eventos, nada de números inventados"), esta vista dice QUÉ hace el motor (los verbos
 * de `ETAPAS_MODELO_V15`) y CUÁNTO SUELE tardar (`DURACION_TIPICA_MODELO`, declarado, no medido).
 * Cuando el evento exista, esta sección se reemplaza por el conteo real — el punto de extensión es
 * `PasoProgreso` de este archivo.
 *
 * ── LAS LEYES, Y DÓNDE ──────────────────────────────────────────────────────────────────────
 * LEY 1 — el estado de cada fuente y su descripción son el MISMO dato y la MISMA frase que ya usa
 * el hub `/conexiones` (`fuentesV15` reusa `sourceStateDescription`/`sourceActionLabel`), no una
 * segunda fuente de verdad que pueda divergir.
 * LEY 2 — cero rojo: una fuente sin conectar es "pendiente" (ámbar, progreso administrativo), no
 * una alarma; el único acento fuerte de la pantalla es el borde verde de la promesa del paso 3.
 * LEY 6 — ningún botón primario deshabilitado: "Conectar ahora" e "Ir a mi panel" son links que
 * SIEMPRE navegan a algún lado.
 * LEY 7 — el nombre de la fuente y su monto (si lo hubiera) no se truncan; acá el dato primario es
 * el LABEL de la fuente y la frase de estado, que envuelven (`break-words`), nunca `truncate`.
 * LEY 8 — el estado de carga dice qué se está trayendo y cuánto tarda (~2 s); el error dice la
 * causa y ofrece Reintentar; el paso 2 sin fuentes conectadas dice qué falta (conectar el paso 1)
 * con su acción.
 * LEY 10 — una pantalla, una pregunta: "¿cómo va la construcción de tu primer parte?".
 *
 * MULTIEMPRESA: nada acá asume una sola empresa — `states` ya viene scopeado a la empresa activa
 * de la sesión (la resuelve el backend por la cookie), igual que el resto de `(app)`. */

export interface BienvenidaV15ViewProps {
  /** `null` = todavía no sabemos el estado (cargando, o falló y no hay dato). */
  states: OnboardingSourceStates | null;
  /** Está en vuelo la primera consulta (distingue "cargando" de "falló"). */
  cargando?: boolean;
  /** Por qué no llegó el estado, en lenguaje de dueño. */
  motivo?: string | null;
  onReintentar?: () => void;
  hoy?: Date;
  /** Issue que va a exponer los eventos de progreso reales del paso 2 (el hueco declarado). */
  issueSucesor?: string;
}

const EYEBROW =
  "font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3";
const CRUMB = "font-rediseno-mono text-[11px] tracking-[.12em] text-rediseno-tinta-3 uppercase";
const CARD = "rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-[18px]";
const LINK =
  "rounded font-semibold text-rediseno-azul hover:underline focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none";
const BTN_PRIMARIO =
  "inline-flex shrink-0 items-center gap-2 rounded-full bg-rediseno-tinta px-[15px] py-[7px] text-[12.5px] font-bold whitespace-nowrap text-white focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none";

export function BienvenidaV15View({
  states,
  cargando = false,
  motivo,
  onReintentar,
  hoy = new Date(),
  issueSucesor,
}: BienvenidaV15ViewProps) {
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <p className="text-[13.5px] text-rediseno-tinta-2">
          Estamos revisando el estado de tus conexiones (~2 s).
        </p>
        <div className="h-40 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden />
        <div className="h-32 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden />
      </div>
    );
  }

  if (!states) {
    return (
      <DataState
        status="error"
        what="el estado de tus conexiones"
        cause={motivo ?? "No pudimos consultar tus fuentes. Vuelve a intentar en un momento."}
        action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }

  const fuentes = fuentesV15(states);
  const progreso = progresoModeloV15(fuentes);
  const promesa = promesaPrimerParte(hoy);

  return (
    <div className="space-y-5">
      <p className={CRUMB}>Bienvenida</p>
      <h1 className="font-rediseno-serif text-[26px] leading-tight font-medium text-rediseno-tinta sm:text-[30px]">
        ¿Cómo va la construcción de tu primer parte?
      </h1>

      <PasoFuentes fuentes={fuentes} />
      <PasoProgreso progreso={progreso} issueSucesor={issueSucesor} />
      <PasoPromesa promesa={promesa} />

      <div className="flex justify-end">
        <Link href="/inicio" className={BTN_PRIMARIO}>
          Ir a mi panel
        </Link>
      </div>
    </div>
  );
}

/* ── Paso 1 — fuentes con estado y tiempo estimado por conexión ─────────────────────────────── */

const PILL_VARIANT: Record<OnboardingSourceState, PillProps["variant"]> = {
  connected: "ok",
  deferred: "blue",
  pending: "warn",
};

function PasoFuentes({ fuentes }: { fuentes: FuenteV15[] }) {
  const pendientes = fuentesPendientes(fuentes);

  return (
    <section aria-labelledby="paso-1-titulo" className={cn(CARD, "space-y-3")}>
      <p className={EYEBROW}>Paso 1 de 3 · tus fuentes</p>
      <h2
        id="paso-1-titulo"
        className="font-rediseno-serif text-[19px] font-medium text-rediseno-tinta"
      >
        {fuentesConectadas(fuentes).length} de {fuentes.length} conectadas
      </h2>
      <ul className="divide-y divide-rediseno-hairline-row">
        {fuentes.map((f) => (
          <FuenteRow key={f.id} fuente={f} />
        ))}
      </ul>
      {pendientes.length > 0 && (
        <p className="text-[12.5px] text-rediseno-tinta-2">
          Te {concordar(pendientes.length, "queda", "quedan")}{" "}
          <b className="tabular-nums">{pendientes.length}</b>{" "}
          {concordar(pendientes.length, "fuente", "fuentes")} por conectar.
        </p>
      )}
    </section>
  );
}

function FuenteRow({ fuente }: { fuente: FuenteV15 }) {
  const conectada = fuente.estado === "connected";
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold break-words text-rediseno-tinta">
          {fuente.label}
          <Pill variant={PILL_VARIANT[fuente.estado]}>{SOURCE_STATE_LABEL[fuente.estado]}</Pill>
        </p>
        <p className="mt-0.5 text-[12.5px] break-words text-rediseno-tinta-2">
          {fuente.descripcion}
        </p>
        {fuente.tiempoConexion && (
          <p className="mt-0.5 text-[12px] text-rediseno-tinta-3">
            Conectarla toma {fuente.tiempoConexion}.
          </p>
        )}
      </div>
      <Link href={fuente.href} className={conectada ? cn(LINK, "shrink-0") : BTN_PRIMARIO}>
        {fuente.accion}
      </Link>
    </li>
  );
}

/* ── Paso 2 — progreso de construcción del modelo (EL HUECO) ─────────────────────────────────── */

function PasoProgreso({
  progreso,
  issueSucesor,
}: {
  progreso: ProgresoModeloV15;
  issueSucesor?: string;
}) {
  return (
    <section aria-labelledby="paso-2-titulo" className={cn(CARD, "space-y-3")}>
      <p className={EYEBROW}>Paso 2 de 3 · cómo se arma tu primer parte</p>

      {!progreso.hayAlgoQueConstruir ? (
        <DataState
          status="empty"
          what="algo que construir todavía"
          hint="Conecta al menos una fuente en el paso 1 para que el piloto empiece a leer tus datos."
          action={{ label: "Ir al paso 1", href: "#paso-1-titulo" }}
        />
      ) : (
        <>
          <h2
            id="paso-2-titulo"
            className="font-rediseno-serif text-[19px] font-medium text-rediseno-tinta"
          >
            Con <b className="tabular-nums">{progreso.fuentesActivas}</b>{" "}
            {concordar(progreso.fuentesActivas, "fuente conectada", "fuentes conectadas")}, así se
            arma:
          </h2>
          <ol className="space-y-1.5">
            {progreso.etapas.map((etapa, i) => (
              <li
                key={etapa.id}
                className="flex items-start gap-2 text-[13px] break-words text-rediseno-tinta-2"
              >
                <span className={cn(EYEBROW, "mt-px shrink-0")}>{i + 1}</span>
                <span>{etapa.verbo}</span>
              </li>
            ))}
          </ol>
          <p className="text-[12.5px] text-rediseno-tinta-2">
            <b>{progreso.duracionTipica}</b>.
          </p>
          {/* EL HUECO — declarado en pantalla, no escondido en un comentario. Ver la cabecera del
              archivo y `ETAPAS_MODELO_V15`/`DURACION_TIPICA_MODELO` en el modelo. */}
          <p className="text-[12px] leading-relaxed text-rediseno-tinta-3">
            Todavía no podemos decirte en qué etapa exacta va ni cuántos documentos llevamos: eso
            necesita eventos de progreso que el motor no expone todavía
            {issueSucesor ? ` (${issueSucesor})` : ""}. No inventamos un número ni una barra que
            simule avance — cuando el evento exista, esta sección lo muestra de verdad.
          </p>
        </>
      )}
    </section>
  );
}

/* ── Paso 3 — promesa final CON HORA ──────────────────────────────────────────────────────────── */

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function PasoPromesa({ promesa }: { promesa: PromesaV15 }) {
  return (
    <section
      aria-labelledby="paso-3-titulo"
      className={cn(CARD, "space-y-1 border-l-[3px] border-l-rediseno-verde")}
    >
      <p className={EYEBROW}>Paso 3 de 3 · cuándo llega</p>
      <h2
        id="paso-3-titulo"
        className="font-rediseno-serif text-[22px] leading-snug font-medium text-rediseno-tinta"
      >
        {capitalizar(promesa.frase)} llega tu primer parte.
      </h2>
      <p className="text-[12.5px] text-rediseno-tinta-3">{formatDateLong(promesa.fecha)}</p>
      <p className="pt-1 text-[12.5px] text-rediseno-tinta-2">
        Mientras tanto no necesitas hacer nada más: si te falta conectar alguna fuente, hazlo en el
        paso 1 — el resto lo hace el piloto solo.
      </p>
    </section>
  );
}
