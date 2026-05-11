import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-primary">Qavante</h1>
          <p className="mt-1 text-sm text-neutral-mid">Gestión financiera para PYMEs chilenas</p>
        </header>
        {children}
      </div>
    </div>
  );
}
