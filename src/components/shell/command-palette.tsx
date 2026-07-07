"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/types";
import { matches, visibleCommands, type Command } from "./command-palette-commands";

/* Command palette (⌘K / Ctrl+K) — navegación y acciones desde el teclado, como
   Linear/Mercury. Se abre con ⌘K, con la barra de búsqueda del header, y se
   maneja 100% con teclado (↑↓ mover, ↵ abrir, esc cerrar). Base UI Dialog aporta
   focus-trap, scroll-lock y Esc; la lista + filtrado + navegación son propias.
   Premium: popup glass navy, grupos, fila activa con acento, hints al pie.
   El catálogo + el filtrado viven en `command-palette-commands` (puro/testeable). */

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: UserRole;
}

export function CommandPalette({ open, onOpenChange, userRole }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const available = React.useMemo(() => visibleCommands(userRole), [userRole]);
  const results = React.useMemo(
    () => available.filter((c) => matches(c, query)),
    [available, query],
  );

  // Reset al abrir; clamp del índice activo cuando cambian los resultados.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  const go = React.useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      onOpenChange(false);
      router.push(cmd.href);
    },
    [onOpenChange, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Home") {
      e.preventDefault(); // que no salte también el cursor de texto del input
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    }
  }

  // Mantener la fila activa a la vista.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Índices globales por grupo (para el resaltado activo a través de grupos).
  let flatIdx = -1;
  const groups = results.reduce<Record<string, { cmd: Command; idx: number }[]>>((acc, cmd) => {
    flatIdx += 1;
    (acc[cmd.group] ??= []).push({ cmd, idx: flatIdx });
    return acc;
  }, {});

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-brand-deep/50 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out" />
        <Dialog.Popup
          className="glass fixed left-1/2 top-[14vh] z-50 w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border-strong bg-surface/95 shadow-xl data-[open]:animate-in data-[closed]:animate-out"
          aria-label="Buscar y navegar"
        >
          <Dialog.Title className="sr-only">Buscar y navegar</Dialog.Title>

          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar pantalla o acción…"
              className="w-full bg-transparent py-3.5 text-sm text-neutral-dark placeholder:text-neutral-mid focus:outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={results[active] ? `cmdk-opt-${results[active].id}` : undefined}
            />
            <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-neutral-mid sm:block">
              esc
            </kbd>
          </div>

          {/* Resultados */}
          <div
            ref={listRef}
            id="cmdk-list"
            role="listbox"
            className="max-h-[52vh] overflow-y-auto p-2"
          >
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-neutral-mid">
                Nada para “{query}”. Prueba con otra palabra.
              </p>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                    {group}
                  </p>
                  {items.map(({ cmd, idx }) => {
                    const isActive = idx === active;
                    return (
                      <button
                        key={cmd.id}
                        id={`cmdk-opt-${cmd.id}`}
                        data-idx={idx}
                        role="option"
                        aria-selected={isActive}
                        type="button"
                        onMouseMove={() => setActive(idx)}
                        onClick={() => go(cmd)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          isActive ? "bg-brand-primary-50 text-brand-deep" : "text-neutral-dark",
                        )}
                      >
                        <cmd.Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-brand-primary" : "text-neutral-mid",
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{cmd.label}</span>
                        {isActive && (
                          <CornerDownLeft
                            className="h-3.5 w-3.5 text-brand-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Hints */}
          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-neutral-mid">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface px-1 font-mono">↑</kbd>
              <kbd className="rounded border border-border bg-surface px-1 font-mono">↓</kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface px-1 font-mono">↵</kbd>
              abrir
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface px-1 font-mono">⌘K</kbd>
              en cualquier momento
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
