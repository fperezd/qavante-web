export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Sprint C0
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
        Qavante Web listo para arrancar
      </h1>
      <p className="max-w-2xl text-sm text-neutral-600 sm:text-base">
        Skeleton inicial creado con Next.js 15, TypeScript estricto, soporte Cloudflare y tipos
        OpenAPI del backend.
      </p>
    </main>
  );
}
