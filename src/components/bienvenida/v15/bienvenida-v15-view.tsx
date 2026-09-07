"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DataState } from "@/components/rediseno/data-state";
import { Pill, type PillProps } from "@/components/rediseno/pill";
import type { OnboardingSourceState, OnboardingSourceStates } from "@/lib/api/onboarding-sources";
import type { OnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import { SOURCE_STATE_LABEL } from "@/components/onboarding/onboarding-source-meta";
import {
  concordar,
  fuentesConectadas,
  fuentesPendientes,
  fuentesV15,
  fuentesRunV15,
  type FuenteV15,
} from "./bienvenida-v15-model";

/* V15 · Bienvenida — `/bienvenida` (ESPECIFICACION §V15, issue #76, R1).
 *
 * PRESENTACIONAL: entran los estados ya resueltos, sale la pantalla; el cableado vive en
 * `bienvenida-v15-live.tsx` (`useOnboardingSources`, el MISMO adaptador que el hub `/conexiones` y
 * el guard del onboarding — Ley 1).
 *
 * ── PROGRESO CONSULTABLE ─────────────────────────────────────────────────────────────────────
 * El paso 2 consume el run estable del contrato #351. En vez de simular avance con un número plausible,
 * spec: "sin eventos, nada de números inventados"), esta vista dice QUÉ hace el motor (los verbos
 * El run conserva explícitamente los `null`: la UI no los convierte en ceros ni calcula una ETA.
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
  run?: OnboardingSyncRun | null;
  cargandoRun?: boolean;
  errorRun?: boolean;
  onIniciarRun?: () => void;
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
  run = null,
  cargandoRun = false,
  errorRun = false,
  onIniciarRun,
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

  return (
    <div className="space-y-5">
      <p className={CRUMB}>Bienvenida</p>
      <h1 className="font-rediseno-sans text-[26px] leading-tight font-medium text-rediseno-tinta sm:text-[30px]">
        ¿Cómo va la construcción de tu primer parte?
      </h1>

      <PasoFuentes fuentes={fuentes} />
      <PasoProgreso
        fuentesActivas={fuentesConectadas(fuentes).length}
        run={run}
        cargando={cargandoRun}
        error={errorRun}
        onIniciar={onIniciarRun}
      />
      <PasoEstado />

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
        className="font-rediseno-sans text-[19px] font-medium text-rediseno-tinta"
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

/* ── Paso 2 — progreso del run consultable ───────────────────────────────────────────────────── */

function PasoProgreso({
  fuentesActivas,
  run,
  cargando,
  error,
  onIniciar,
}: {
  fuentesActivas: number;
  run: OnboardingSyncRun | null;
  cargando: boolean;
  error: boolean;
  onIniciar?: () => void;
}) {
  return (
    <section aria-labelledby="paso-2-titulo" className={cn(CARD, "space-y-3")}>
      <p className={EYEBROW}>Paso 2 de 3 · cómo se arma tu primer parte</p>

      {fuentesActivas === 0 ? (
        <DataState
          status="empty"
          what="algo que construir todavía"
          hint="Conecta al menos una fuente en el paso 1 para que el piloto empiece a leer tus datos."
          action={{ label: "Ir al paso 1", href: "#paso-1-titulo" }}
        />
      ) : !run ? (
        <>
          <h2
            id="paso-2-titulo"
            className="font-rediseno-sans text-[19px] font-medium text-rediseno-tinta"
          >
            Todo listo para iniciar la sincronización
          </h2>
          <p className="text-[12.5px] text-rediseno-tinta-2">
            Iniciaremos un run consultable para mostrar sólo el progreso que el motor publique.
          </p>
          {error && (
            <DataState
              status="error"
              what="el inicio de la sincronización"
              cause="No pudimos iniciar el run. Vuelve a intentarlo en un momento."
              action={onIniciar ? { label: "Reintentar", onClick: onIniciar } : undefined}
            />
          )}
          {cargando ? (
            <p role="status" className="text-[12.5px] text-rediseno-tinta-2">
              Iniciando la sincronización.
            </p>
          ) : (
            onIniciar && (
              <button type="button" className={BTN_PRIMARIO} onClick={onIniciar}>
                Iniciar sincronización
              </button>
            )
          )}
        </>
      ) : (
        <>
          <h2
            id="paso-2-titulo"
            className="font-rediseno-sans text-[19px] font-medium text-rediseno-tinta"
          >
            Sincronización: {run.status}
          </h2>
          {cargando && (
            <p className="text-[12.5px] text-rediseno-tinta-2">Consultando el progreso del run.</p>
          )}
          {error && (
            <p className="text-[12.5px] text-rediseno-tinta-2">
              No pudimos actualizar este run. Vuelve a intentar en un momento.
            </p>
          )}
          <ul className="space-y-2">
            {fuentesRunV15(run).map((fuente) => (
              <li key={fuente.id} className="text-[13px] text-rediseno-tinta-2">
                <b>{fuente.label}</b>: {fuente.estado}
                {fuente.etapa ? ` · ${fuente.etapa}` : ""}
                {fuente.conteo ? ` · ${fuente.conteo}` : ""}
                {` · ${fuente.eta}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ── Paso 3 — disponibilidad sin promesa horaria ───────────────────────────────────────────────── */

function PasoEstado() {
  return (
    <section
      aria-labelledby="paso-3-titulo"
      className={cn(CARD, "space-y-1 border-l-[3px] border-l-rediseno-verde")}
    >
      <p className={EYEBROW}>Paso 3 de 3 · tu primer parte</p>
      <h2
        id="paso-3-titulo"
        className="font-rediseno-sans text-[22px] leading-snug font-medium text-rediseno-tinta"
      >
        Tu primer parte estará disponible cuando termine la sincronización.
      </h2>
      <p className="pt-1 text-[12.5px] text-rediseno-tinta-2">
        No prometemos una hora de entrega: el backend no publica un calendario ni un scheduler para
        este proceso.
      </p>
    </section>
  );
}
