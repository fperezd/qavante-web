/* Código canónico de la fuente bancaria en `core.sources`.
 *
 * El conector vivo es Fintoc (widget). El `source_code` del catálogo sigue
 * siendo `bank_bice` — consent, sources/status y el wizard lo usan igual.
 * Confundir ese código con el provider `bice` (scrape legado) fue un bug real. */

export const BANK_SOURCE_CODE = "bank_bice";
