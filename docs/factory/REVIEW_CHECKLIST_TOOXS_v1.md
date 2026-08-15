# Review checklist — Tooxs standard migration

- [ ] No runtime/UI code changed.
- [ ] No generated API types changed.
- [ ] No feature flags changed.
- [ ] No Cloudflare or CI/deploy workflow changed.
- [ ] `CLAUDE.md` is only a thin vendor adapter.
- [ ] `AGENTS.md` is vendor-neutral.
- [ ] OpenAPI remains the cross-repo contract.
- [ ] Data honesty and INV-FX-001 remain explicit.
- [ ] AI concurrency defaults to 1, max 2 when justified.
- [ ] Included subscription capacity is separated from incremental paid usage.
