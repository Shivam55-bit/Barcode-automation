# DATA_CONNECTION_AUDIT.md

**Project:** 360Barcode / BarcodeFlow Enterprise Suite
**Stack (actual):** React 19 + Vite + Electron 33 + TypeScript (not C#/Avalonia — the master prompt described a different stack; work was applied to this real React/Electron codebase).
**Scope:** Data Connection / Data Sources / Field Binding / Transform / Script / Serialization / Record Navigation / Print Data pipeline.
**Build status:** `npm run build` ✅ passes · `npm run lint` (tsc --noEmit) ✅ clean · 41 unit tests ✅ pass.

Status legend: `WORKING` (already correct, verified) · `FIXED` (was broken/partial, now repaired) · `IMPLEMENTED` (new) · `PARTIAL` (usable, follow-up noted) · `BLOCKED`.

---

## 0. Architectural finding — Single Source of Truth (spec 13/40/43)
**Status: WORKING (verified).**
`evaluateElementData()` in [src/services/dataSourceEngine.ts](src/services/dataSourceEngine.ts) is the one authoritative resolver, and it is genuinely shared by:
- Canvas: `CanvasElement`, `UnifiedLabelCanvas`, `RecordNavigationBar`
- Preview: `PrintCenterDialog`, `PrintPreviewWorkspace`, `printPlanService`
- Every print renderer: ZPL, TSPL, EPL, CPCL, SBPL, Windows driver, PDF export.

Because canvas, preview and print all call the same resolver, `CanvasValue == PrintPreviewValue == PrintResolvedValue` holds by construction. The fixes below plug records/derived-values/images into this same resolver so consistency is preserved.

---

## 1. Filter + Sort + Record Selection (spec 23, 24, 25)
- **Previous issue:** The visible record set (`App.visibleRecordSet`) only did a naïve free-text search. Structured filters (operators + AND/OR) did not exist and multi-field sorting in `RecordBrowserModal` was **local to the modal only** — it never changed the record set used by the canvas or the printer.
- **Root cause:** No centralized query engine; filter/sort state was not persisted on the connection and not fed into the resolver's record source.
- **Implementation:**
  - New [src/services/recordSetEngine.ts](src/services/recordSetEngine.ts): pure `applyRecordFilters` (14 operators incl. `between`, `isEmpty`, AND/OR), `applyRecordSort` (multi-field, numeric-aware, empties last), `applyRecordSearch`, and `buildVisibleRecordSet` which **preserves source identity** (`sourceRecordIndex`, `sourceRowNumber`) through filtering + reordering.
  - Added `RecordFilterCondition` / `RecordSortCondition` types and `recordFilters` / `recordSort` on `DatabaseConnectionConfig` ([src/types/index.ts](src/types/index.ts)) so the query persists in the saved document.
  - `App.visibleRecordSet` now delegates to `buildVisibleRecordSet`.
  - `RecordBrowserModal` gained a **Filter & Sort query builder** (add/remove filters, operators, AND/OR, multi-field sort, Apply/Clear) that persists to the connection via `onApplyQuery` → drives canvas **and** print globally.
- **Files changed:** `src/services/recordSetEngine.ts` (new), `src/types/index.ts`, `src/App.tsx`, `src/components/dialogs/RecordBrowserModal.tsx`, `src/components/dialogs/PrintCenterDialog.tsx`.
- **Tests:** [test/recordSetEngine.test.ts](test/recordSetEngine.test.ts) — 18 pass.
- **Status: FIXED / IMPLEMENTED.**

## 2. Print record consistency (spec 40)
- **Previous issue:** `PrintCenterDialog` and the preview fallback used **raw** `template.databaseConnection.records`, while selection indices came from the filtered/sorted visible set — a mismatch that could print the wrong rows when a filter/sort was active.
- **Implementation:** `PrintCenterDialog` now takes a `visibleRecords` prop (= `activeDatasetRecords`) and uses it as the authoritative dataset for selection, range and quantity. Preview fallback in `App` also uses `activeDatasetRecords`.
- **Status: FIXED.**

## 3. Calculated Fields + dependency tracking (spec 11, 17)
- **Previous issue:** No calculated/derived fields; no circular-dependency detection.
- **Implementation:** New [src/services/calculatedFieldEngine.ts](src/services/calculatedFieldEngine.ts):
  - `resolveCalculatedFields` evaluates derived fields (`Total = Price * Quantity`, `FinalPrice = Total + GSTAmount`) in **topological dependency order**; numeric results stay numeric so chained arithmetic doesn't string-concatenate.
  - `detectCircularDependencies` (DFS colouring) flags cycles; cyclic fields resolve to `[Circular: X]` instead of hanging.
  - `validateCalculatedField` for editor validation.
  - New type `CalculatedFieldDefinition` + `template.calculatedFields` + `EvaluationContext.calculatedFields`.
  - Wired so derived fields behave like real columns everywhere: `App` augments `currentRecordData` (canvas) and `activeDatasetRecords` (browser/print); `printPlanService` augments each record at print time (idempotent) so print == canvas.
- **Files changed:** `src/services/calculatedFieldEngine.ts` (new), `src/types/index.ts`, `src/App.tsx`, `src/services/printPlanService.ts`.
- **Tests:** [test/calculatedFieldEngine.test.ts](test/calculatedFieldEngine.test.ts) — 11 pass.
- **Status: IMPLEMENTED.** Follow-up: a dedicated Calculated Fields manager dialog (fields can currently be defined programmatically / via the Named Data Sources formula type).

## 4. Serialization — preview vs committed print (spec 20, 39)
- **Audit result:** Preview uses deterministic index math (`printIndex` in `printPlanService`) and `generatePreviewSequence` (non-destructive). Persistent state advances **only** on confirmed print/PDF via `advanceTemplateSerialState`, guarded by `AtomicSerialReservationService` (reserve → commit/rollback/markPartial + startup orphan recovery).
- **Conclusion:** Previewing does **not** consume serial numbers; only the commit point advances state.
- **Status: WORKING (verified, no change required).**

## 5. Database-driven print quantity (spec 26)
- **Audit result:** `printPlanService.createPrintPlan` honours `quantitySource='database_field'` + `selectedQtyColumn`; `PrintCenterDialog` defaults to it when `quantityColumn` is set and computes total labels. Blank/zero/negative quantities safely fall back to 1; decimals truncate via `parseInt`.
- **Status: WORKING (verified).** Minor follow-up: optional upper cap for excessively large quantities.

## 6. Dynamic image binding (spec 27)
- **Previous issue:** Image objects rendered a static `element.src` only — no data binding, no fallback.
- **Implementation:** `ImageElement` extended with `imageSourceType`, `imageField`, `imageBaseFolder`, `fallbackSrc`. New `resolveImageElementSrc` + `normalizeImageSource` in `dataSourceEngine` resolve a record field (e.g. `ImagePath`) to a loadable src (data:/http/file:// with relative-folder support) and fall back gracefully when missing/empty. Wired into `CanvasElement`, `UnifiedLabelCanvas`, `PrintPreviewWorkspace`, `windowsDriverRenderer`, `pdfExportService`, all with `onError` → fallback.
- **Files changed:** `src/types/index.ts`, `src/services/dataSourceEngine.ts`, `src/components/canvas/CanvasElement.tsx`, `src/components/canvas/UnifiedLabelCanvas.tsx`, `src/components/views/PrintPreviewWorkspace.tsx`, `src/printing/renderers/windowsDriverRenderer.ts`, `src/services/pdfExportService.ts`.
- **Tests:** [test/imageAndBarcodeValidation.test.ts](test/imageAndBarcodeValidation.test.ts) — pass.
- **Status: IMPLEMENTED.** Follow-up: image-object property-panel toggle to set the bound field from the UI; PDF export of `file://` images needs main-process base64 loading.

## 7. Barcode data validation before print (spec 28, 34)
- **Previous issue:** `validateBarcodeValue` existed but ran only in the UI inspector — the **print flow never validated**, so invalid data could be printed silently.
- **Implementation:** New [src/services/printValidationService.ts](src/services/printValidationService.ts) `validatePrintDataBarcodes` resolves every barcode element across the records-to-print (via the central resolver) and validates against symbology (GS1 payloads checked for non-empty). `PrintCenterDialog.handleExecutePrint` runs this preflight before dispatch and shows a **blocking issue dialog** listing record #, object, value and problem, with a deliberate "Print Anyway" operator override. Scan is capped (5000 records / 50 issues) for performance.
- **Files changed:** `src/services/printValidationService.ts` (new), `src/components/dialogs/PrintCenterDialog.tsx`.
- **Tests:** [test/imageAndBarcodeValidation.test.ts](test/imageAndBarcodeValidation.test.ts) — pass.
- **Status: IMPLEMENTED.**

## 8. Script Editor (spec 15)
- **Previous state:** `DocumentEventScriptsModal` had event selection + Test Script + error output, but no line numbers, field browser or explicit Validate.
- **Implementation:** Added a **line-number gutter** (scroll-synced), a **Field & Named-Source reference browser** (clickable chips insert `record.Field` / `namedSubStrings("X").Value` at the caret), and a **Validate** button (syntax/runtime check with a coloured success/error panel). `App` supplies `availableFields` + `namedSources`.
- **Files changed:** `src/components/dialogs/DocumentEventScriptsModal.tsx`, `src/App.tsx`.
- **Status: IMPLEMENTED (PARTIAL).** Follow-up: token-colour syntax highlighting and "did you mean" field suggestions.

## 9. Script Engine (spec 14) & Transform Engine (spec 12/13)
- **Audit result:** `vbscriptEngine.ts` provides a broad sandboxed VBScript/JS subset (string/number/date/logic builtins, record/named-source proxies) with no OS access. `transformEngine.ts` implements the full ordered pipeline (data-type formatting, suppression, character filter, truncation, padding, template mask, search/replace, script, serialization, prefix/suffix) already invoked by the central resolver.
- **Status: WORKING (verified).**

## 10. Pre-existing build errors (unrelated) — cleaned up
- Fixed 14 pre-existing TypeScript errors that were blocking `npm run lint` (`el.ratio` typed `string|number` in `tsplRenderer`/`zplRenderer`; extended data-source `switch` labels in `propertyTreeService`). The project now type-checks cleanly.

---

## Summary table
| # | Feature | Status |
|---|---------|--------|
| 0 | Single-source resolver | WORKING |
| 1 | Structured Filter + multi-field Sort drive record set | FIXED / IMPLEMENTED |
| 2 | Print uses same filtered/sorted set as canvas | FIXED |
| 3 | Calculated fields + circular detection | IMPLEMENTED |
| 4 | Serialization preview vs commit | WORKING |
| 5 | DB-driven print quantity | WORKING |
| 6 | Dynamic image binding | IMPLEMENTED |
| 7 | Pre-print barcode validation | IMPLEMENTED |
| 8 | Script editor (line numbers, field browser, validate) | IMPLEMENTED (PARTIAL) |
| 9 | Script + transform engines | WORKING |
| 10 | Pre-existing tsc errors | FIXED |

## Known follow-ups (honest)
- Calculated Fields manager dialog (engine + wiring done; no dedicated editor UI yet).
- Image data-binding property-panel toggle (type + resolver + rendering done).
- Script editor token-colour syntax highlighting + field suggestions.
- PDF export of `file://` dynamic images requires Electron main-process base64 loading.
