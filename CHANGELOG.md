# Changelog

## 1.3.0 - 2026-05-14

- Added Worker-side consultation of ReceitaWS and API Publica CNPJ.ws in parallel.
- Added normalized merge rules by data block, preferring the most recently updated source and filling gaps from the other source.
- Added Worker cache with `nocache=1` bypass and partial-failure fallback when only one source is available.
- Added state registration display, Markdown/PDF export support, and source diagnostics.
- Added unit tests for normalization, merge priority, gap filling, state registrations, partial failure, and full failure.

## 1.2.0 - 2026-05-11

- Added automatic light/dark mode with manual theme override.
- Reworked the interface palette, spacing, shadows, typography, and controls to follow the consolidated UX guide.
- Removed gradients and emoji font fallbacks from the product UI.
- Refined the A4 print/PDF report with a compact professional layout and readable minimum font sizes.

## 1.1.0 - 2026-05-07

- Added visible app versioning.
- Added PIN gate and Worker-side PIN validation.
- Added local Wrangler development setup.
- Moved public assets to `public/`.
- Improved CNPJ validation on the Worker.
- Reworked PDF/print output as a polished A4 report.

## 1.0.0 - 2026-03-18

- Initial Cloudflare Worker version for CNPJ consultation through ReceitaWS.
