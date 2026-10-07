# BarTender .BTW Import Status Report

## Verified Actual-Template Status: 2026-10-02

One **partial native Location draft is implemented and UI-verified**, containing two editable non-printing lines from the 11 genuine source objects. Full Location conversion is **not complete**: seven text objects, one box and one barcode remain explicitly unresolved. The binary importer still rejects unverified proprietary BTW records. The historical decoder claims below do not describe the current importer.

### Text Workflow Verification: 2026-10-02

The native text implementation now supports raw ASCII controls, ordered source composition, physical paragraph width/tab stops/hanging indentation and source-specific font overrides. Actual Electron checks passed for caret HT/CR insertion, repeated Insert, both picker closing actions, draft Undo/Redo, four-source identity preservation, source-font inheritance, short/long/empty/Unicode/missing-field records, nonblank Print Preview, virtual PDF and cold native save/reopen. These are internal capabilities, not a verified full BarTender conversion.

- [release-evidence/desktop/built-paragraph-editable.bfl](release-evidence/desktop/built-paragraph-editable.bfl) is an editable synthetic fixture with width 95.3 mm, hanging indentation 25.4 mm and explicit 25.4 mm tabs. Its `qa_description` binding is deliberately synthetic, not the actual source binding.
- [release-evidence/desktop/built-paragraph-properties.png](release-evidence/desktop/built-paragraph-properties.png), [release-evidence/desktop/built-paragraph-preview.png](release-evidence/desktop/built-paragraph-preview.png) and [release-evidence/desktop/built-paragraph.pdf](release-evidence/desktop/built-paragraph.pdf) contain only synthetic QA data. Actual reference captures remain outside the repository.
- [release-evidence/desktop/built-results.json](release-evidence/desktop/built-results.json): 35 desktop checks passed, zero failures. Native file-dialog selection is hooked; the application controls, backend, actual filesystem writes, rendering and restart/reopen are real.
- `npm run test:regression`: passed, including 145 Node tests, serialization, data-source integration, VBScript, Excel and type checking. `npm run test:rendering`: passed. No current installer or packaged-application certification is claimed.
- UI testing found and fixed an SVG click-target regression, paragraph automatic-content sizing using a fixed fallback width, missing Paragraph/General/Spacing controls and stretched sample typography. Source-font tests now verify the unchanged point sizes in physical SVG units rather than obsolete CSS strings.

Fresh readable reference captures verify Text 5 Paragraph/left alignment, width 95.3 mm, hanging indentation 25.4 mm, Top Left anchor and zero rotation. Full API coordinates remain 3.175/22.225 mm; the Position page displays rounded 3.2/22.2 mm values. The first literal source's font is Arial, bold, 10 pt. The clipped description source is now independently verified as database field `subinventory_description`, named `SubDescription`. No reference settings were edited or saved, and sample/evaluated values were not turned into imported definitions.

**Text 5 remains unmapped.** Required evidence/access still includes all source definitions and content-changing transforms, remaining source-font settings, tabs/overflow/autosize behavior and a supported extraction route that supplies those definitions for actual BTW import. Object-level transformations, rich paragraph effects, non-Windows printer protocols and exact reference font/line-breaking parity are not fully verified by this sample. The application's default tab interval is not claimed as BarTender's default. Barcode/box fidelity, conditions and stacking remain unresolved.

### Inventory and Reference Observation

- The authorized BarTender documents directory contains 171 files: 99 BTW, 23 DAT, 25 TXT, 13 XML, 7 BTIN, and one each of ACCDB, XLSX, CSV and DTD. No image-extension files were found; embedded assets have not been ruled out.
- The supplied executable exists and the reference installation is BarTender 2016 R2 / 11.0.2.3056 x64. This is the application version, not a verified source-document format version.
- A hash-verified private copy of `Oracle/Location.btw` was opened in the reference. Its XML companion is runtime trigger data, not an editable design export. The comments identify an Oracle WMS/MSCA location label.
- Documented ActiveX `DesignObjects` enumeration found 11 genuine source objects: seven text objects, two lines, one box and one barcode. Source names, coordinates, applicable dimensions, fonts and shape properties were collected without reading data values or connection credentials.
- Explicit indexed `PageSetup` properties return a 101.651 x 152.4 mm template, 104.191 x 152.4 mm source media, one row/column and 1.27 mm left/right margins. The GUI instead shows Letter fallback media and warns that the current WPS PDF printer does not support the source stock. Automatic adjustment was not accepted.
- The original and private working copy still share their initial SHA256. No physical print, RFID, trigger execution or reference save was issued.

### Verified Route and Limits

[electron/bartenderImport.ts](electron/bartenderImport.ts) now connects actual File/Open and Import BarTender to a consent-gated private-copy extraction. It discloses the installed/licensed BarTender dependency and document-open risks, validates the BTW signature before consent, reports extraction/verification progress and preserves the active document on cancellation or failure. [scripts/bartender_snapshot.ps1](scripts/bartender_snapshot.ps1) uses documented ActiveX access, separate private JSON, owned-process cleanup and source/copy integrity checks. [src/services/barTenderObservationImporter.ts](src/services/barTenderObservationImporter.ts) strictly validates that observation before creating a partial draft. No evaluated `Value` is frozen into static text/barcode data.

### Implemented Partial Infrastructure

- Snapshot schema/version, source SHA256 identity, object count, names/indexes, explicit coordinate units and finite physical geometry are validated before a template is created. Filename dimensions and generic metadata strings are never used as object geometry.
- Source line endpoints are converted to centre-rotated native line objects in millimetres, without requiring an unknown reference-point anchor. Source identity and object names persist in native metadata.
- Both mapped Location lines retain `visible: true`, editable native properties and `printable: false`. Non-printing flags for unresolved objects remain in source evidence; those objects are not represented by fabricated native placeholders.
- The source property ledger records verified, unavailable and unsupported properties separately from whether a property was actually mapped. It is shown in the Import report and persists through BFL save/reopen. Transformed `Value` data is not copied into static text/barcode payloads.
- Imports start as unsaved native drafts, requiring separate Save As. The document name, status, tags, warnings and `productionReady: false` metadata identify the partial result. This is not a production label or a full-fidelity conversion.
- Native file detection no longer misclassifies JSON containing a BarTender format name as binary BTW. PowerShell's UTF-8 BOM is accepted at the actual Electron reader.
- Zero-height native lines have centred canvas hit areas without changing stored endpoints. An X-only keyboard nudge no longer rounds the untouched Y coordinate.
- Preview and PDF export now honor non-printing flags. PDF line rotation preserves endpoint geometry; a focused test checks source endpoints within 0.001 mm.

The public 2016 API exposes source objects but does not establish a faithful conversion by itself:

- X/Y locate an object's reference point; anchor definitions are not exposed by this API.
- Text `Width` only applies to paragraph-formatted text. Zero widths cannot be treated as reliable bounds for these single-line/multi-source objects. The GUI reports a rendered width of about 95.3 mm for `Text 5` while the API returns zero.
- `Value` is the result after transforms, including serialization and VBScript. Reading it and importing it as static text would lose source semantics; the probe deliberately does not read it.
- Barcode symbology, module width, HRT options, per-source font runs, object/data-source relationships, print conditions, groups, forms and transform/serialization settings are not resolved by this observation.
- Collection index is not verified stacking order. Non-printing flags must not be interpreted as designer visibility without checking the source print behavior.
- No public .NET SDK assembly was found in the inspected installed Seagull locations. That is not proof that a richer supported route does not exist.
- Earlier hidden/minimized property captures were unusable and are not evidence. Fresh owned-window captures are now readable and establish the Text 5 metadata listed above; no whole-desktop capture or proprietary binary interpretation was used.

### Actual-Template Results

| Template | Opened in reference | Imported | Editable objects | Visual comparison | Data behavior | Save/reopen | Output verification | Remaining gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Oracle/Location.btw | Yes, private copy | Partial observation-assisted draft only | 2 editable non-printing lines; 9 unresolved objects | Reopened native lines visible; full label/text layout not comparable yet | Trigger companion identified; source definitions/transforms not mapped; text/barcode editing blocked | Passed actual edit, BFL Save As, close and clean receiver-profile reopen for partial draft | Actual preview/PDF passed; blank output expected from two non-printing lines; barcode decoding blocked | Text/box anchors, per-source formatting, barcode configuration, bindings/transforms/forms, conditional print behavior, z-order, stroke details, source stock/DPI fidelity |

### Verification and Artifacts

- `npm run lint`: passed.
- `npx tsx --test test/barTenderImport.test.ts test/documentPersistence.test.ts`: 18 passed, 0 failed; extraction failures include injected tests and should not be confused with actual installed-license/timeout fault injection.
- [scripts/bartender_import_smoke.ts](scripts/bartender_import_smoke.ts): actual Import/Open report, line edit, native Save As, close, independent receiver-profile reopen, preview and virtual PDF passed. Text/barcode data steps are explicitly recorded as blocked.
- Latest actual consent/installed-BarTender extraction artifacts: `C:\Users\shiva\AppData\Local\BarcodeFlow\template-interop\20261002-105951\evidence\native-btw-import-1790940852498`. Five checks passed; text/barcode data conversion remains explicitly blocked. Only file-picker selection is hooked with explicit user approval; observation data is not substituted for BTW import.
- Native draft: `Location-partial.bfl`; evidence includes `imported-partial.png`, `receiver-reopened.png`, `nonprinting-preview.png`, `partial-nonprinting-output.pdf` and `checks.json`. None of these real-template artifacts are added to the repository.
- The receiver-profile test opened only native BFL from a temporary working directory and invoked no BarTender extraction or automation. BarTender remains installed on this machine; a physically separate machine without BarTender has not been tested.
- Original and working-copy SHA256 remain `AA4776A5E6515ACD0236F8E090CC13067FB6CFE79A843A6551EE2E6D3139D26E` after verification. No source save, physical print, trigger or RFID job was issued.
- Development bundles were refreshed for targeted UI fixes. No installer or packaged artifact was rebuilt. Full-template and packaged verification remain pending.

### Next Required Step

Complete the remaining Text 5 definitions/transforms/fonts/tab behavior and supported extraction access, plus Bar Code 1 Symbology, Size/module/HRT and Data Sources evidence, excluding credentials. Preserve the newly verified Top Left anchor and full `subinventory_description` binding. Then extend strict actual-BTW import and compare controlled records with the reference. Do not expand to the other 98 templates or claim full fidelity from the current two-line draft or synthetic paragraph sample.

## Historical Notes (Superseded)

The remaining sections record an earlier heuristic decoder experiment. They are retained as history, not current capabilities or evidence of editable BTW import.

## Objective
To import the real BarTender .BTW files into the 360Barcode product, preserve the label structure, and make the imported elements editable without visual guesswork or filename-specific hacks.

## Current Status

### Working
- The .BTW file is being recognized by the application.
- The document page dimensions are being read correctly.
- The parser is successfully decompressing the relevant raw BarTender stream.
- Page width and height are correctly resolved for the BMW fixture.

Observed runtime values:
- Width: 158.8 mm
- Height: 127 mm

### Not yet fully working
- The importer still creates false-positive objects.
- Metadata, sample strings, and default values are being interpreted as real design objects.
- The object classification layer is still not reliable enough for true editable fidelity.
- The imported layout is not yet structurally faithful to the original BarTender design.

## Actual Issue
The actual issue is that the importer is not doing a true BarTender object-record classification. It is scanning generic UTF-16 strings and treating metadata/sample/default values as if they were real visible objects.

This causes the software to import fake text and barcode objects, resulting in a layout that looks visually incorrect even though the page size and file recognition are working.

## Root Cause
The main problem is in the raw record parsing logic inside the BarTender parser.

The parser is scanning UTF-16 strings such as:
- "Text 1"
- "Barcode 1"
- "Line 1"
- "Box 1"
- "Picture 1"

It is also seeing generic metadata and sample strings such as:
- "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
- "Sample Prompt"
- "P"
- "V"
- "Q"

These values are not always actual visible design objects. They can be default values, metadata, sample/test data, or character set strings.

Because of that, the parser is still mixing:
1. actual BarTender object records,
2. metadata records,
3. default field values,
4. sample data,
5. non-rendering helper records.

This causes fake text and barcode elements to appear in the imported layout.

## Why this matters
The requirement is not just to open the file. The requirement is to import with geometric fidelity.

That means:
- same page size
- same object positions
- same lines and boxes
- same barcode placement
- same text placement
- no random strings
- no duplicate objects
- no metadata artifacts becoming visible objects
- objects remain individually editable
- layout matches BarTender structure correctly

## Technical Validation Evidence
The parser was re-run against the real BMW fixture:

- objectCount: 37
- but several values still appear as visible objects even though they are generic sample strings or default metadata
- this confirms that the issue is still in raw object classification logic, not in CSS or display styling

The issue is therefore in the importer itself, not in the frontend canvas rendering.

## Current Working Theory
The correct fix requires a true record-level classification pass before geometry conversion.

The flow should be:
1. Decompress the actual BarTender stream
2. Identify real object record markers
3. Separate visible objects from metadata/default/sample records
4. Detect geometry values from real object records only
5. Normalize source units to mm
6. Build the editable native object set
7. Validate against the actual BMW template structure

## What is already successful
- .BTW format detection works
- compression stream extraction works
- document page metadata is read
- the parser can find candidate object markers
- the import pipeline is connected and running

## What still needs to be fixed
- real object record validation
- metadata filtering
- duplicate object suppression
- geometry fidelity verification
- no fake text objects from default/sample fields
- proper barcode/text assignments without random values

## Conclusion
The BarTender import is partially progressing, but it is not yet truly production-ready for editable fidelity.

The current status is:
- File open: yes
- Data fetch: partially yes
- Proper design fidelity: not yet
- Final editable import for AIAG BMW fixture: not yet complete

This is a parser/record classification issue and must be fixed at the source level before the application can be considered correct.

## Next recommended action
Fix the BarTender decoder to classify records by actual structure and semantic meaning rather than by generic string scanning alone. Only then can the imported design match the real BarTender label geometry and remain editable in the 360Barcode application.
