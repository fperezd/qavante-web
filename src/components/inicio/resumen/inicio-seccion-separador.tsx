import { cn } from "@/lib/utils";

/** Línea divisoria con sangría lateral (separación visual entre bloques de `/inicio`). */
export function InicioSeccionSeparador({ className }: { className?: string }) {
  return (
    <div className={cn("py-7", className)} role="separator" aria-hidden="true">
      <div className="mx-5 border-t border-border sm:mx-8 lg:mx-12" />
    </div>
  );
}
