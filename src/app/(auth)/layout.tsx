import type { ReactNode } from "react";
import { QavanteLogo } from "@/components/qavante";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <header className="mb-8 flex flex-col items-center">
          <QavanteLogo variant="hero" />
        </header>
        {children}
      </div>
    </div>
  );
}
