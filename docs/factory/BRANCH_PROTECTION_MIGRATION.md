# Estados `local-*` — migración cancelada

La migración que proponía exigir `local-ci`, `local-change-evidence` y
`local-security` queda cancelada y no debe ejecutarse.

La protección vigente de `main` usa exclusivamente los checks publicados por
GitHub Actions. Los estados `local-*` no se publican y no forman parte de
branch protection. Los scripts que los generaban y el release local asociado
fueron retirados del repositorio.

Este archivo se conserva como registro histórico para evitar reintroducir la
migración antigua por copia de documentación o automatización.
