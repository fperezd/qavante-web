const links = [
  "inicio",
  "caja",
  "cobrar",
  "pagar",
  "gestion",
  "administracion",
];

export function AppSidebar() {
  return (
    <aside className="rounded-lg border border-neutral-200 bg-white p-4">
      <nav className="space-y-2 text-sm text-neutral-700">
        {links.map((link) => (
          <div key={link} className="rounded px-2 py-1 hover:bg-neutral-100">
            {link}
          </div>
        ))}
      </nav>
    </aside>
  );
}
