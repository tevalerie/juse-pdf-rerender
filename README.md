# J-USE PDF Re-Render Tool

Internal tool to regenerate camera-ready J-USE REOI 2026 PDFs from raw form data.

**Live URL (once deployed):** `https://tevalerie.github.io/juse-pdf-rerender/`

## Why this exists

Some applicant PDFs were rendered with bugs in earlier versions of the form's labelize logic (raw codes appearing in place of friendly labels, "Not provided" appearing for pathway, etc.). This tool re-renders any application from its stored raw data using the latest renderer + label dictionary, producing a clean camera-ready PDF.

Also useful for:
- Re-issuing a corrected PDF when an applicant emails in a fix
- EFJ archive maintenance
- Migrating legacy PocketBase records

## Hard guarantees — what this tool does NOT do

- ❌ Does **not** call the production Apps Script backend
- ❌ Does **not** read or write the production Submissions Sheet
- ❌ Does **not** increment the production reference-number counter
- ❌ Does **not** write anything to Drive
- ❌ Does **not** send any email

It is a pure browser tool. You paste JSON, it renders, you save the PDF locally.

## How to use

1. Open https://tevalerie.github.io/juse-pdf-rerender/
2. Get the application's raw form data:
   - **From the Sheet** (current submissions): open the Submissions Sheet, find the row for the application, copy the value in the rightmost column **"Full Form Data (JSON)"**.
   - **From a PocketBase export** (legacy submissions): open the export file, copy a single record's JSON.
3. Paste into the textarea (or drop a `.json` file).
4. Click **Render PDF**.
5. The print dialog opens. Choose **Save as PDF** → save to your machine.
6. (Optional) Re-attach the saved PDF to the application's Drive folder manually.

## Files

| File | Purpose |
|---|---|
| `index.html` | UI — paste/drop JSON, render button, status |
| `labelize.js` | Standalone labelize logic (mirrors `enrichDataForRenderer` in the form) |
| `labelDict.json` | Label dictionary (~291 mappings) extracted from the form HTML at build time |
| `renderer.html` | Snapshot of the production PDF renderer (frozen at build time) |
| `pdf-core.js`, `pdf-sections.js`, `pdf-tables.js` | Renderer support modules (snapshot) |

## Refreshing the snapshot

If the production form's renderer or label dictionary changes substantially, refresh the snapshot:

```bash
# 1. Re-extract the label dictionary from the latest form HTML
python3 scripts/extract-label-dict.py > labelDict.json

# 2. Copy the latest renderer files
cp ../juse-form-repo/juse-full-pdf-renderer.html ./renderer.html
cp ../juse-form-repo/pdf-core.js ./
cp ../juse-form-repo/pdf-sections.js ./
cp ../juse-form-repo/pdf-tables.js ./

# 3. Commit + push
git commit -am "Refresh renderer + label dictionary snapshot"
git push
```

## Excluded fields (intentional)

`pathway` and `housingVulnerability` are **not** labelized by this tool. The renderer (`pdf-sections.js`) has its own labelizer for both that expects raw codes (`market`/`hybrid`/`public` and `direct`/`partial`/`no`). Sending labels would break those branches and render "Not provided".

## Sample data

`sample-application-data.json` contains a complete sample application that demonstrates the tool. Drop it in to verify the tool works end-to-end.
