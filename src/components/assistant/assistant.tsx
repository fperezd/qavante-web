"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, X, ArrowUp, Search, ExternalLink, AlertCircle } from "lucide-react";
import {
  useAssistantChat,
  type AssistantSource,
  type AssistantMessageInput,
} from "@/lib/api/assistant";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { toolLabel } from "./assistant-format";

/* Asistente Qavante (Sprint C9, Anexo G): "Preguntar a Qavante". Botón flotante
   → drawer con chat read-only (Fase 1). Renderiza SOLO `content` + `tools_used`
   + `sources` (ADR-0004); ignora el resto. NUNCA llama al LLM directo — solo vía
   `POST /api/assistant/chat`. Gated: el shell monta esto solo si `assistant` ON. */

type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tools_used: string[]; sources: AssistantSource[] };

const SUGGESTIONS = [
  "¿Cómo está mi caja este mes?",
  "¿Qué cobranzas tengo vencidas?",
  "¿Cuánto puedo pagar esta semana?",
];

export function Assistant() {
  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const chat = useAssistantChat();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listEndRef = React.useRef<HTMLDivElement>(null);

  // Foco al input al abrir; Esc cierra.
  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-scroll al último mensaje.
  React.useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns, chat.isPending]);

  function send(text: string) {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content }];
    setTurns(nextTurns);
    setInput("");
    const messages: AssistantMessageInput[] = nextTurns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    chat.mutate(
      { messages, language: "es-CL" },
      {
        onSuccess: (res) => {
          setTurns((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.content,
              tools_used: res.tools_used ?? [],
              sources: res.sources ?? [],
            },
          ]);
        },
      },
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-surface shadow-lg transition-colors hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          aria-label="Preguntar a Qavante"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Preguntar a Qavante</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Asistente Qavante"
          className="fixed inset-0 z-40 flex justify-end"
        >
          {/* Backdrop. */}
          <button
            type="button"
            aria-label="Cerrar asistente"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-dark/30"
          />

          {/* Panel. */}
          <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
            <header className="flex items-center justify-between gap-2 border-b border-neutral-light/40 px-4 py-3">
              <span className="flex items-center gap-2 font-semibold text-neutral-dark">
                <Sparkles className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                Preguntar a Qavante
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-neutral-mid hover:bg-neutral-light/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            {/* Mensajes. */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {turns.length === 0 && !chat.isPending && (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-mid">
                    Pregúntame sobre tu caja, cobranzas, pagos o resultado. Respondo en base a tus
                    datos.
                  </p>
                  <ul className="space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => send(s)}
                          className="w-full rounded-md border border-brand-primary/30 px-3 py-2 text-left text-sm text-brand-primary hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {turns.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-primary px-3 py-2 text-sm text-surface">
                      {t.content}
                    </p>
                  </div>
                ) : (
                  <AssistantBubble key={i} turn={t} />
                ),
              )}

              {chat.isPending && (
                <p className="text-sm text-neutral-mid" role="status">
                  Qavante está pensando…
                </p>
              )}

              {chat.isError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-danger-500/30 bg-danger-500/5 p-3 text-sm text-neutral-dark"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger-500"
                    aria-hidden="true"
                  />
                  <p>
                    {chat.error instanceof ApiError
                      ? apiErrorToUserMessage(chat.error)
                      : "No pudimos responder. Intenta nuevamente."}
                  </p>
                </div>
              )}
              <div ref={listEndRef} />
            </div>

            {/* Input. */}
            <form
              className="flex items-center gap-2 border-t border-neutral-light/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta…"
                aria-label="Tu pregunta"
                className="min-w-0 flex-1 rounded-full border border-neutral-light/60 px-4 py-2 text-sm text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
              <button
                type="submit"
                disabled={!input.trim() || chat.isPending}
                aria-label="Enviar"
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary text-surface transition-colors hover:bg-brand-primary-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function AssistantBubble({
  turn,
}: {
  turn: { content: string; tools_used: string[]; sources: AssistantSource[] };
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {turn.tools_used.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {turn.tools_used.map((tool) => (
            <li
              key={tool}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-light/40 px-2 py-0.5 text-[11px] text-neutral-mid"
            >
              <Search className="h-3 w-3" aria-hidden="true" />
              Consultando {toolLabel(tool)}
            </li>
          ))}
        </ul>
      )}
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-light/30 px-3 py-2 text-sm text-neutral-dark">
        {turn.content}
      </p>
      {turn.sources.length > 0 && (
        <ul className="flex flex-wrap gap-2 pl-1">
          {turn.sources.map((s) => (
            <li key={s.url}>
              <Link
                href={s.url}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                {s.label ?? s.url}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
