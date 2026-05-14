"use client";

/* Skip-to-content link — primer foco al cargar la página. Permite a
   usuarios de teclado / screen reader saltar el header + sidebar e ir
   directo al contenido principal de la ruta. WCAG 2.1 SC 2.4.1.

   El link queda invisible visualmente (sr-only) hasta que recibe foco
   (focus-visible). Sigue siendo navegable por Tab desde el inicio. */

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only fixed left-2 top-2 z-50 rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-surface shadow-md focus-visible:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      Saltar al contenido principal
    </a>
  );
}
