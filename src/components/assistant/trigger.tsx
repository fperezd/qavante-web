"use client";

import { Sparkles } from "lucide-react";

export function AssistantTrigger() {
  return (
    <button
      type="button"
      className="bg-gradient-brand fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-surface shadow-brand transition-all hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
      aria-label="Preguntar a Qavante (CMD+J)"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Preguntar a Qavante</span>
      <kbd className="ml-1 hidden rounded border border-surface/30 bg-brand-primary-700/50 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        ⌘J
      </kbd>
    </button>
  );
}
