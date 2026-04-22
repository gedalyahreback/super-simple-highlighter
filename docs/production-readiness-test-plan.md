# Production Readiness Test Plan

## Goal
Validate that the recent highlight-style enhancements (palette, per-style alpha, blend mode, safe fallback mode, and migration backfill) are stable enough for production rollout.

## Scope
- Style creation/edit in Options.
- Overlap rendering settings persistence.
- Backward compatibility for existing stored styles.
- Localization coverage for newly added UI labels.

## Automated checks (minimal baseline)
Run:

```bash
node tests/minimal_automated_checks.js
```

Checks included:
1. `ChromeStorage` defines `FORCE_SAFE_BLEND_MODE` key and default.
2. `HighlightDefinitionFactory` defaults include `mix-blend-mode` and `background-alpha`.
3. `ChromeHighlightStorage.migrateHighlightDefinitions()` backfills missing fields.
4. New i18n keys exist in `en` and `en_GB` locale files.

## Manual smoke checklist

### A) Style modal UX
- [ ] Open Options → Styles → edit/create style.
- [ ] Palette swatch click updates background color.
- [ ] Blend mode selector persists after save/reopen.
- [ ] Per-style opacity slider persists after save/reopen.

### B) Rendering behavior
- [ ] Create two overlapping highlights using different styles.
- [ ] Verify overlap visually blends when blend mode is not `normal`.
- [ ] Enable **Prefer stable overlap rendering** option.
- [ ] Verify overlap falls back to stable non-blended rendering.

### C) Compatibility/migration
- [ ] Start with an old profile (styles missing blend/alpha fields).
- [ ] Open extension and trigger style read path.
- [ ] Confirm records are backfilled with blend + alpha fields.

### D) Localization
- [ ] Verify new labels render in `en`.
- [ ] Verify new labels render in `en_GB` fallback file.

## Release gate (minimum)
Ship only if:
- Automated checks pass.
- Manual smoke checklist passes on at least 3 representative sites (static page, dynamic page, long article page).
- No critical/high-severity defects remain open.

## Rollout strategy
1. Internal dogfood.
2. Small % rollout.
3. Full rollout after no regressions for 48–72 hours.
