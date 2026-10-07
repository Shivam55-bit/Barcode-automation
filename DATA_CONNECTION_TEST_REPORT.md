# DATA_CONNECTION_TEST_REPORT.md

**Project:** 360Barcode / BarcodeFlow Enterprise Suite (React + Electron + TypeScript)
**Build:** `npm run build` ✅ succeeded (Vite + esbuild, ~45s) · `npm run lint` (tsc --noEmit) ✅ clean.
**Automated suites:** run with `npx tsx test/<file>.ts`.

| Suite | File | Result |
|-------|------|--------|
| Record Set Engine | `test/recordSetEngine.test.ts` | ✅ 18/18 |
| Calculated Field Engine | `test/calculatedFieldEngine.test.ts` | ✅ 11/11 |
| Image Binding + Barcode Validation | `test/imageAndBarcodeValidation.test.ts` | ✅ 12/12 |
| **Total** | | **✅ 41/41** |

---

## A. Record Set Engine (filters / sort / search) — spec 23, 24, 40

| # | Test case | Input | Expected | Actual | Result |
|---|-----------|-------|----------|--------|--------|
| A1 | Equals (text) | Category = "Food" | match | match | PASS |
| A2 | Numeric greaterThan | Price > 100 | numeric compare | numeric compare | PASS |
| A3 | greaterThan false | Price(50) > 100 | false | false | PASS |
| A4 | startsWith | Name starts "Sha" | match | match | PASS |
| A5 | isEmpty on blank | Qty = "" | true | true | PASS |
| A6 | between (numeric) | Price ∈ [200,300] | Oil(250) matches | matches | PASS |
| A7 | Leading-zero SKU equals | SKU = "00012" | preserved string equals | equals | PASS |
| A8 | AND filter | Food AND Price>100 | 2 records | 2 | PASS |
| A9 | OR filter | Home OR Price<100 | 2 records | 2 | PASS |
| A10 | Sort Price desc | — | Oil first | Oil | PASS |
| A11 | Empty sorts last | Qty asc | Rice (blank) last | last | PASS |
| A12 | Search "oil" | — | 1 record | 1 | PASS |
| A13 | Search "food" | — | 3 records | 3 | PASS |
| A14 | Visible set count | filter Food | 3 | 3 | PASS |
| A15 | Visible set order | +sort Price desc | Oil first | Oil | PASS |
| A16 | Renumber displayed | — | #1,2,3 | correct | PASS |
| A17 | Source index preserved | Oil orig idx 2 | 2 after sort | 2 | PASS |
| A18 | Source row number | header offset | row 4 | 4 | PASS |

## B. Calculated Field Engine — spec 11, 17

| # | Test case | Input | Expected | Actual | Result |
|---|-----------|-------|----------|--------|--------|
| B1 | Simple product | Total = Price*Quantity (100*3) | 300 | 300 | PASS |
| B2 | Percentage | GSTAmount = Price*GST/100 (100*18/100) | 18 | 18 | PASS |
| B3 | Dependent chain | FinalPrice = Total + GSTAmount | 318 (arithmetic, not "30018") | 318 | PASS |
| B4 | Immutability | resolve does not mutate original record | original clean | clean | PASS |
| B5 | Cycle detected | A=B+1, B=A+1 | hasCycle true | true | PASS |
| B6 | Both flagged | A↔B | A & B affected | both | PASS |
| B7 | Cyclic marker | resolve cyclic | `[Circular:...]` | marker | PASS |
| B8 | No false positive | X=Price+1, Y=X*2 | no cycle | no cycle | PASS |
| B9 | Reject bad name | "Bad Name" | error | error | PASS |
| B10 | Accept valid | "Price * 2" | null (ok) | null | PASS |
| B11 | Reject empty | "" | error | error | PASS |

## C. Dynamic Image Binding — spec 27

| # | Test case | Input | Expected | Actual | Result |
|---|-----------|-------|----------|--------|--------|
| C1 | data: passthrough | data URL | unchanged | unchanged | PASS |
| C2 | http passthrough | https URL | unchanged | unchanged | PASS |
| C3 | Windows path | `C:\Products\shampoo.png` | `file:///C:/Products/shampoo.png` | file URL | PASS |
| C4 | Relative + base folder | `shampoo.png` + `C:\Products` | joined path | joined | PASS |
| C5 | Static image | element.src only | unchanged | unchanged | PASS |
| C6 | Bound resolves field | ImagePath = C:\...\oil.png | file URL | file URL | PASS |
| C7 | Empty value fallback | ImagePath = "" | fallbackSrc | fallback | PASS |
| C8 | Missing field fallback | no ImagePath | fallbackSrc | fallback | PASS |

## D. Pre-print Barcode Validation — spec 28, 34

| # | Test case | Input | Expected | Actual | Result |
|---|-----------|-------|----------|--------|--------|
| D1 | Valid EAN-13 | "4006381333931" | valid | valid | PASS |
| D2 | Invalid EAN-13 flagged | "ABC", "" | invalid | invalid | PASS |
| D3 | Issue count | 2 bad records | 2 issues | 2 | PASS |
| D4 | 1-based record number | first record | recordNumber = 1 | 1 | PASS |

---

## E. Manual / integration verification (spec 38, 45)

The following were verified by code path tracing (single-resolver architecture guarantees the value identity):

| Check | Method | Result |
|-------|--------|--------|
| Filter/sort in Record Browser changes canvas record set | `onApplyQuery` persists to `connection.recordFilters/recordSort` → `buildVisibleRecordSet` feeds `currentRecordData` | PASS |
| Print uses the same filtered/sorted set | `activeDatasetRecords` → `PrintCenterDialog.visibleRecords` → `recordsToPrint` → `printPlanService` | PASS |
| Calculated fields visible on canvas & print | augmented at `currentRecordData` and inside `printPlanService` | PASS |
| Preview does not consume serials | `advanceTemplateSerialState` only in commit branches of `PrintCenterDialog` / preview `onPrint` | PASS |
| CanvasValue == PreviewValue == PrintValue | all call `evaluateElementData` | PASS (by construction) |
| Invalid barcode blocks print | `validatePrintDataBarcodes` gate in `handleExecutePrint` | PASS |
| Full build | `npm run build` | PASS |

## F. Recommended live E2E (requires a real `TestProducts.xlsx` + `npm run electron:dev`)
1. Connect Excel → select sheet → confirm fields/records load.
2. Record Browser → add filter `Category = Food` + sort `Price desc` → Apply → confirm canvas record navigator now shows only Food, Oil first.
3. Add a Calculated Field `Total = Price * Quantity`; bind a text object to `{{Total}}`; navigate records → value updates live.
4. Bind an image object's field to `ImagePath`; navigate → image changes; point one row at a missing file → fallback shown.
5. Put invalid data in a barcode field → Print → confirm the blocking validation dialog appears.
6. Set quantity source = `PrintQty` column (10/5/20) → Print Preview → confirm 35 labels.
7. Save `.bfl` → close → reopen → confirm connection, filters, sort, calculated fields and bindings are restored.
