"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { normalizeVisibleText } from "@/lib/formatters/visible-text";
import type { SimulationRequest, SimuladorV14Model, Suggestion } from "./simulador-v14-model";

export interface SimuladorV14ViewProps {
  model: SimuladorV14Model | null;
  suggestions: Suggestion[];
  loading?: boolean;
  error?: string | null;
  onEvaluate: (question: string, assumption: SimulationRequest["assumptions"][number]) => void;
  onRetry?: () => void;
}

const CARD = "rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie p-[18px]";
const SECONDARY =
  "inline-flex items-center justify-center rounded-full border border-rediseno-hairline bg-white px-4 py-2 text-[13px] font-semibold text-rediseno-tinta hover:border-rediseno-azul focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul";

export function SimuladorV14View({
  model,
  suggestions,
  loading = false,
  error = null,
  onEvaluate,
  onRetry,
}: SimuladorV14ViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [dismissedHash, setDismissedHash] = useState<string | null>(null);
  const selected = useMemo(
    () => suggestions.find((item) => item.id === selectedId) ?? null,
    [selectedId, suggestions],
  );

  useEffect(() => {
    if (model?.evaluationHash !== dismissedHash) setDismissedHash(null);
  }, [model?.evaluationHash, dismissedHash]);

  const visibleModel = model && model.evaluationHash !== dismissedHash ? model : null;

  function choose(item: Suggestion) {
    setSelectedId(item.id);
    setQuestion(item.question);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !question.trim() || loading) return;
    onEvaluate(question, selected.assumption);
  }

  return (
    <div className="space-y-5 font-rediseno-sans text-rediseno-tinta">
      <header className="space-y-1">
        <p className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3">
          Hoy · Simular una decisión
        </p>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">
          Pregunta antes de decidir.
        </h1>
        <p className="max-w-3xl text-[13.5px] text-rediseno-tinta-2">
          Elige un supuesto verificable, ajusta la pregunta y Qavante lo evalúa contra el último
          corte disponible.
        </p>
      </header>

      <form className={CARD} onSubmit={submit} aria-label="Nueva simulación">
        <label htmlFor="simulation-question" className="text-[12px] font-semibold">
          ¿Qué quieres evaluar?
        </label>
        <textarea
          id="simulation-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Elige un supuesto para mantener la pregunta ligada a datos verificables."
          className="mt-2 w-full resize-y rounded-xl border border-rediseno-hairline px-4 py-3 text-[14px] outline-none focus:border-rediseno-azul focus:ring-2 focus:ring-rediseno-azul/20"
        />
        <fieldset className="mt-3">
          <legend className="text-[12px] text-rediseno-tinta-2">Supuestos sugeridos</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selectedId === item.id}
                onClick={() => choose(item)}
                className={
                  selectedId === item.id
                    ? "rounded-full bg-rediseno-tinta px-4 py-2 text-left text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul"
                    : SECONDARY
                }
              >
                {item.question}
              </button>
            ))}
          </div>
        </fieldset>
        {suggestions.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-rediseno-ambar" role="status">
            No hay una fecha de corte verificable para construir supuestos.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!selected || !question.trim() || loading}
            className="rounded-full bg-rediseno-azul px-5 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "Evaluando…" : "Evaluar supuesto"}
          </button>
          <span className="text-[12px] text-rediseno-tinta-3">Simulación · no ejecuta</span>
        </div>
      </form>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {!loading && !error && visibleModel ? (
        <Memo
          model={visibleModel}
          onDismiss={() => setDismissedHash(visibleModel.evaluationHash)}
        />
      ) : null}
      {!loading && !error && !visibleModel ? (
        <section className={CARD} aria-label="Sin simulación">
          <h2 className="text-[18px] font-semibold">Todavía no hay un memo.</h2>
          <p className="mt-1 text-[13px] text-rediseno-tinta-2">
            Elige una pregunta sugerida. No mostramos un resultado de ejemplo como si fuera tuyo.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <section className={CARD} role="status" aria-busy="true">
      <p className="font-semibold">Contrastando el supuesto con tu modelo financiero…</p>
      <p className="mt-1 text-[12.5px] text-rediseno-tinta-2">
        La fuente todavía no informa un tiempo estimado para esta evaluación.
      </p>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const visibleMessage =
    /(?:\/api\/|\b(?:backend|endpoint|schema|scope|tenant|token|trace|stack|contract)\b|\b[a-z][a-z0-9]*_[a-z0-9_]+\b)/i.test(
      message,
    )
      ? "La información necesaria no está disponible para esta evaluación."
      : normalizeVisibleText(message);
  return (
    <section
      className="rounded-[14px] border border-rediseno-rojo bg-rediseno-rojo-soft p-[18px]"
      role="alert"
      data-danger="true"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rediseno-rojo" aria-hidden />
        <div>
          <h2 className="font-semibold">No pudimos evaluar esta pregunta.</h2>
          <p className="mt-1 text-[13px] text-rediseno-tinta-2">{visibleMessage}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className={`${SECONDARY} mt-3`}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Memo({ model, onDismiss }: { model: SimuladorV14Model; onDismiss: () => void }) {
  const incomplete = !model.structurallyComplete;
  return (
    <article
      className={`${CARD} border-l-[3px] ${incomplete ? "border-l-rediseno-ambar" : "border-l-rediseno-verde"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3">
          Memo ·{" "}
          {model.structurallyComplete
            ? "Evaluación completa"
            : model.state === "abstained"
              ? "No fue posible evaluar"
              : "Evaluación parcial"}
        </p>
        <span className="rounded-full bg-rediseno-neutro-bg px-3 py-1 text-[11.5px] font-semibold text-rediseno-neutro-text">
          {model.freshnessLabel}
        </span>
      </div>
      <h2 className="mt-3 text-[22px] leading-snug font-semibold">
        {normalizeVisibleText(model.verdict)}
      </h2>
      <p className="mt-2 text-[13.5px] text-rediseno-tinta-2">
        {normalizeVisibleText(model.interpretation)}
      </p>
      <p className="mt-3 rounded-xl bg-rediseno-porcelana px-4 py-3 text-[13px]">
        <b>Condición</b> · {normalizeVisibleText(model.condition)}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {model.impacts.map((impact) => (
          <section
            key={impact.id}
            className="min-w-0 rounded-xl border border-rediseno-hairline p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold">{impact.label}</h3>
              <span className="text-[11px] text-rediseno-tinta-3">
                {impact.state === "known" ? "Con dato" : "Sin dato"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-rediseno-tinta-3">Actual</dt>
                <dd className="mt-1 break-words font-semibold tabular-nums">{impact.before}</dd>
              </div>
              <div>
                <dt className="text-rediseno-tinta-3">Propuesto</dt>
                <dd className="mt-1 break-words font-semibold tabular-nums">{impact.after}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] text-rediseno-tinta-2">
              Variación · <b className="tabular-nums text-rediseno-tinta">{impact.delta}</b>
            </p>
            {impact.reasons.map((reason) => (
              <p key={reason} className="mt-2 text-[11.5px] text-rediseno-tinta-3">
                {normalizeVisibleText(reason)}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Evidence title="Supuestos usados" items={model.assumptions} empty="Supuestos sin dato" />
        <Evidence
          title="Antecedentes de la evaluación"
          items={model.evidence}
          empty="Antecedentes sin dato"
        />
      </div>
      {model.sources.length > 0 ? <Sources model={model} /> : null}
      {model.limitations.length > 0 ? (
        <Evidence title="Qué limita esta respuesta" items={model.limitations} empty="" />
      ) : null}
      <p className="mt-3 text-[11.5px] text-rediseno-tinta-3">
        Contexto evaluado · {normalizeVisibleText(model.scopeLabel)}
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-rediseno-hairline pt-4">
        <button type="button" disabled className={`${SECONDARY} cursor-not-allowed opacity-55`}>
          Guardar en memoria · aún no disponible
        </button>
        <Link href="/financiamiento" className={SECONDARY}>
          Ver alternativa
        </Link>
        <button type="button" onClick={onDismiss} className={SECONDARY}>
          Descartar
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-rediseno-tinta-3">
        {model.saveAdvertisedByApi
          ? "El guardado está disponible por separado; esta pantalla no lo ejecuta."
          : "El guardado sigue separado de evaluar y aún no está disponible en esta pantalla."}
      </p>
      {model.saveReasons.length > 0 ? (
        <p className="mt-1 text-[11.5px] text-rediseno-tinta-3">
          {normalizeVisibleText(model.saveReasons.join(" · "))}
        </p>
      ) : null}
    </article>
  );
}

function Sources({ model }: { model: SimuladorV14Model }) {
  return (
    <section className="mt-3 rounded-xl bg-rediseno-porcelana p-4">
      <h3 className="text-[12px] font-semibold">Fuentes del contexto</h3>
      <ul className="mt-2 space-y-2 text-[12px] text-rediseno-tinta-2">
        {model.sources.map((source) => (
          <li
            key={source.block}
            className="min-w-0 border-t border-rediseno-hairline pt-2 first:border-0 first:pt-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-rediseno-tinta">{source.label}</span>
              <span>{source.stateLabel}</span>
            </div>
            {source.reasons.map((reason) => (
              <p key={reason} className="mt-1 break-words text-rediseno-tinta-3">
                {normalizeVisibleText(reason)}
              </p>
            ))}
            {source.evidence.map((reference) => (
              <p key={reference} className="mt-1 break-all text-rediseno-tinta-3">
                {normalizeVisibleText(reference)}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Evidence({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="mt-3 rounded-xl bg-rediseno-porcelana p-4">
      <h3 className="text-[12px] font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[12px] text-rediseno-tinta-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 break-all">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rediseno-verde"
                aria-hidden
              />
              <span>{normalizeVisibleText(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] text-rediseno-tinta-3">{empty}</p>
      )}
    </section>
  );
}
