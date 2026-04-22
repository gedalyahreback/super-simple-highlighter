# V2 Implementation Spec

## 1) Scope
This spec defines the first implementation pass for a distinct V2 highlighter:
- MV3 Chrome extension architecture,
- anchors-first highlight model,
- Canva-like custom color picker,
- overlapping highlight rendering with color blending,
- migration path from legacy export format.

Out of scope for Sprint 1:
- cloud sync,
- multi-user collaboration,
- full reader-mode parser for every website.

---

## 2) Architecture (MV3)

### Runtime components
1. **Service worker** (background):
   - command routing,
   - tab lifecycle events,
   - storage orchestration,
   - migration jobs.
2. **Content script**:
   - create/update/remove highlights in page,
   - anchor resolve/re-attach on load,
   - overlap layer rendering.
3. **Popup UI**:
   - quick style selection,
   - create/edit/delete highlights in current tab,
   - open options pages.
4. **Options UI**:
   - style management,
   - custom color picker,
   - import/migration controls.

### Storage
- **IndexedDB** via Dexie (primary).
- Optional lightweight cache in `chrome.storage.local` for quick settings.

---

## 3) Data schema (v2)

## 3.1 HighlightRecord
```ts
interface HighlightRecord {
  id: string;                    // uuid
  pageId: string;                // hash(url + canonical + title)
  url: string;
  createdAt: string;             // ISO
  updatedAt: string;             // ISO

  anchor: TextAnchor;
  styleRef: string;              // points to StyleRecord.id

  layerIndex: number;            // deterministic overlap ordering
  status: "active" | "deleted";

  note?: string;
  tags?: string[];

  migration?: {
    source: "v1" | "v2";
    sourceId?: string;
    confidence?: number;
  };
}
```

## 3.2 TextAnchor
```ts
interface TextAnchor {
  exact: string;                 // exact selected text
  prefix?: string;               // context before
  suffix?: string;               // context after

  startXPath?: string;           // structural fallback
  endXPath?: string;
  startOffset?: number;
  endOffset?: number;

  checksum?: string;             // optional integrity marker
}
```

## 3.3 StyleRecord
```ts
interface StyleRecord {
  id: string;                    // uuid or stable default id
  name: string;                  // e.g. "Yellow", "Custom #AABBCC"

  colorMode: "preset" | "custom";
  fill: {
    hex: string;                 // #RRGGBB
    alpha: number;               // 0..1
  };

  textColor?: string;            // optional for high contrast mode
  blendMode: "multiply" | "screen" | "overlay" | "normal";

  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 3.4 DB tables (Dexie)
- `highlights`: `id, pageId, url, status, createdAt, updatedAt, layerIndex`
- `styles`: `id, name, colorMode, isDefault, updatedAt`
- `pages`: `id, url, title?, canonical?, updatedAt`
- `meta`: key/value store for schema version + migration state

---

## 4) Anchor resolution algorithm

### Re-attach pipeline (on page load)
1. Fetch all active highlights for page URL/pageId.
2. For each highlight:
   1. Attempt exact text search for `anchor.exact`.
   2. Disambiguate using `prefix/suffix` context.
   3. If unresolved, try XPath + offsets fallback.
   4. Score match confidence (`1.0`, `0.8`, `0.5`, `0.0`).
3. Render resolved highlights in deterministic `layerIndex` order.
4. Mark unresolved highlights for repair UI.

### Confidence rules
- 1.0 = exact + context match.
- 0.8 = exact match, weak context.
- 0.5 = structural fallback only.
- 0.0 = unresolved.

---

## 5) Overlap rendering spec

### Goal
When highlights overlap, users see blended color (Acrobat-like behavior) with predictable output.

### Rendering rules
1. Each highlight is rendered as its own element wrapper.
2. Apply fill with alpha (`rgba`) from style.
3. Apply configured `blendMode` where possible.
4. Respect `layerIndex` ordering (ascending).

### CSS baseline
```css
.v2-highlight {
  border-radius: 2px;
  padding: 0 1px;
}

.v2-highlight[data-blend="multiply"] {
  mix-blend-mode: multiply;
}

.v2-highlight[data-blend="normal"] {
  mix-blend-mode: normal;
}
```

### Fallback strategy
If blend behavior is unstable due to host-page CSS:
- fallback to normal mode with alpha,
- preserve layer ordering,
- log telemetry flag (`blendFallback=true`) for debugging.

---

## 6) Custom color picker spec (Canva-like)

### Required controls
- 2D saturation/value panel,
- hue slider,
- alpha slider,
- hex input,
- optional RGB inputs,
- recent swatches row,
- “Save as style preset” action.

### UX states
- `Preview`: temporary style applied in picker.
- `Apply once`: apply custom style to selected highlight only.
- `Save preset`: create/update reusable style in `styles` table.

### Validation
- Hex must match `^#[0-9A-Fa-f]{6}$`.
- Alpha must clamp `[0,1]`.

---

## 7) Message/API contracts

## 7.1 Content script command messages
```ts
type CSCommand =
  | { type: "CREATE_HIGHLIGHT"; payload: { anchor: TextAnchor; styleRef: string } }
  | { type: "UPDATE_HIGHLIGHT_STYLE"; payload: { id: string; styleRef: string } }
  | { type: "DELETE_HIGHLIGHT"; payload: { id: string } }
  | { type: "REATTACH_PAGE_HIGHLIGHTS"; payload: { pageId: string; url: string } }
  | { type: "GET_SELECTION_ANCHOR"; payload: {} };
```

## 7.2 Service worker internal APIs
```ts
interface HighlightService {
  create(input: { url: string; anchor: TextAnchor; styleRef: string }): Promise<HighlightRecord>;
  updateStyle(id: string, styleRef: string): Promise<void>;
  delete(id: string): Promise<void>;
  listByPage(pageId: string): Promise<HighlightRecord[]>;
}

interface StyleService {
  list(): Promise<StyleRecord[]>;
  create(input: Partial<StyleRecord>): Promise<StyleRecord>;
  update(id: string, patch: Partial<StyleRecord>): Promise<void>;
}
```

---

## 8) Migration spec (v1 -> v2)

### Inputs
- legacy LDJSON export (existing format).

### Steps
1. Parse file header + storage payload + db stream.
2. For each legacy create-document:
   - extract text + range fields,
   - convert to `TextAnchor` best-effort,
   - map class/style into `StyleRecord`.
3. Generate `HighlightRecord` entries with migration metadata.
4. Write migration report:
   - total,
   - migrated,
   - unresolved,
   - confidence distribution.

### Failure handling
- Skip malformed entries,
- keep import transactional per batch,
- show user summary dialog with downloadable report JSON.

---

## 9) First sprint plan (10 working days)

## Sprint goal
Ship a usable vertical slice: create/re-attach/delete highlights with custom colors and basic overlap blending.

## Backlog (P0)
1. **Project bootstrap** (MV3 + TypeScript + Vite + Dexie).
2. **Schema + storage layer** (tables, repositories, schema versioning).
3. **Selection -> anchor capture** (content script).
4. **Re-attach engine v1** (exact + context + fallback).
5. **Renderer v1** (layer ordering + blend mode + fallback).
6. **Style manager UI** (preset + custom picker + save preset).
7. **Popup actions** (create, delete, list current page highlights).
8. **Migration importer skeleton** (parse + map + report, no full polish).

## Backlog (P1)
- Unresolved highlight repair panel.
- Additional blend modes + diagnostics.
- Keyboard shortcut customization UI.

## Acceptance criteria (Sprint 1)
- User can create highlight with preset or custom color.
- Overlapping highlights visibly blend on at least baseline supported pages.
- Highlights reattach on reload with confidence scoring.
- Basic delete/edit style works.
- Legacy import runs and outputs migration report.

---

## 10) Engineering tasks (ticket-ready)

1. `V2-001` Bootstrap MV3 TypeScript extension workspace.
2. `V2-002` Implement Dexie schema and repositories.
3. `V2-003` Build selection capture -> TextAnchor conversion.
4. `V2-004` Implement re-attach pipeline + confidence scoring.
5. `V2-005` Implement renderer with overlap layer ordering.
6. `V2-006` Add blend mode handling + fallback logic.
7. `V2-007` Build custom color picker component + validations.
8. `V2-008` Add style CRUD flows in options UI.
9. `V2-009` Add popup list/create/delete for current page.
10. `V2-010` Implement legacy import parser + migration report.
11. `V2-011` Add e2e smoke tests for create/reload/overlap/delete.
12. `V2-012` Write developer docs and troubleshooting notes.

---

## 11) Risks and mitigations
- **Risk:** Host-page CSS breaks blend behavior.
  - **Mitigation:** fallback mode + telemetry + optional overlay layer.
- **Risk:** Ambiguous text anchors on repeated strings.
  - **Mitigation:** prefix/suffix context + confidence scoring + repair UI.
- **Risk:** Migration quality varies by old range fidelity.
  - **Mitigation:** report unresolved items and keep reversible import logs.

---

## 12) Current readiness status

This codebase is now in a **feature-complete beta** state for the recently requested style UX work:
- palette-assisted color picking,
- per-style blend mode,
- per-style opacity,
- compatibility fallback mode,
- migration backfill for existing style records.

However, it should still be treated as **not fully production-final** until:
1. automated tests (unit + integration + e2e) are added and passing,
2. cross-site/manual QA is completed on a representative set of pages,
3. packaging/release validation is done against target Chrome versions.

Recommended release posture right now: **internal/limited rollout**, then promote after QA + test coverage.
