import type { ReactNode } from "react";
import { QavanteLogo } from "@/components/qavante";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <header className="mb-8 flex flex-col items-center">
          {/* h1 sr-only para heading hierarchy a11y + e2e smoke en mobile.
              Visual: el logo (imagen) provee la presencia de marca. */}
          <h1 className="sr-only">Qavante</h1>
          <QavanteLogo variant="hero" alt="Qavante" />
        </header>
        {children}
      </div>
    </div>
  );
}
