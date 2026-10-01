# Release local y estados `local-*` — retirados

> Histórico únicamente. Este procedimiento ya no existe como ruta operativa.

El release local de Azure y los estados `local-ci`, `local-change-evidence`,
`local-security` y `local-release-candidate` fueron retirados. No deben
publicarse, agregarse a branch protection ni usarse como condición de merge o
deploy.

La ruta vigente para CI y release es la definida por GitHub Actions:

- [Web CI](../../.github/workflows/ci.yml)
- [Deploy web to Azure PROD](../../.github/workflows/deploy-azure-prod.yml)

La validación local sigue siendo útil como feedback del desarrollador, pero no
crea estados remotos ni reemplaza los checks de GitHub Actions. Esta nota se
conserva para dejar explícita la decisión de retiro y evitar que una futura
automatización reconstruya accidentalmente el flujo anterior.
