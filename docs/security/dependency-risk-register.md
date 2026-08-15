# Dependency security risk register

Last reviewed: 2026-08-15  
Owner: Tooxs Engineering  
Review by: 2026-08-29

## Migration baseline

The corporate migration enabled Dependabot and ran `npm audit` without `--force`.

- Before safe updates: 38 vulnerable dependency nodes (4 critical, 24 high, 5 moderate, 5 low).
- After safe updates: 29 vulnerable dependency nodes (0 critical, 20 high, 4 moderate, 5 low).
- Critical Vitest Browser advisories were removed by aligning Vitest packages to 4.1.10.
- Vite was updated within its existing major range and Next.js was moved to the latest 15.5 patch.

The CI job `dependency-audit` now blocks any critical advisory. Dependabot remains enabled for continuous visibility.

## High residuals

| Dependency path                 | Runtime exposure             | Disposition                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                          | Production framework         | The available complete remediation is Next 16.3.1, a major upgrade requiring OpenNext/Cloudflare compatibility, full E2E, Lighthouse and production verification. Track as a dedicated R1 change; do not force during migration. |
| `@lhci/cli` and Lighthouse tree | CI-only tooling              | npm proposes an invalid functional downgrade to 0.1.0. Not shipped in the Worker. Keep isolated to CI and upgrade when the upstream tree resolves.                                                                               |
| `@storybook/nextjs-vite` tree   | Development/CI-only          | npm reports no safe fix. Storybook is not deployed as the production Worker. Monitor Dependabot/upstream and retain the test gate.                                                                                               |
| Remaining transitive findings   | Primarily build/test tooling | Do not add overrides blindly. Resolve through reviewed parent-package releases and execute the complete suite.                                                                                                                   |

No residual is silently accepted: each remains visible in Dependabot and the full `npm audit` output. A critical regression fails CI. The production Next.js major upgrade is the highest-priority residual security item after the migration control plane is operational.
