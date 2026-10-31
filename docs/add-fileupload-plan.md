# Plan: `file` Field Type (FilePond)

## Decisions

| Topic | Decision |
|---|---|
| Library | [FilePond](https://pqina.nl/filepond/) + `filepond-plugin-image-preview` (thumbnails) |
| Loading | Host page loads FilePond and plugins (optional dependency, same as inputmask). Test harness uses CDN. |
| Cardinality | `multiple` option, default `false`. Single → ID string (`''` when empty). Multiple → array of ID strings. |
| FilePond missing | Field renders a clear "FilePond required" message and logs a `console.warn`. No fallback input. |
| Upload model | Files upload immediately to the server; the record stores only server file IDs. `edpak.formdata` stays JSON. |
| Server | Specification only (documented below). No reference Flask code ships in the repo. |

## Phase 1 — Core field type (`src/recedit.js`)

1. `_createInput()`: add `case 'file'` → new `_createFileInput(fieldName, fieldConfig)`.
2. `_createFileInput()`:
   - Render a wrapper div holding an `<input type="file" name="{fieldName}">`.
   - If `typeof FilePond === 'undefined'`, render the "FilePond required" message, warn once, and stop.
   - Register `FilePondPluginImagePreview` once if present (guard against double registration).
   - Call `FilePond.create()` with `server` built from field config, `allowMultiple` from `multiple`, plus `acceptedFileTypes`, `maxFileSize`, `maxFiles`, `labelIdle`.
   - Store the pond instance in `$input.data('filepond')`.
3. `_populateForm()` / `setFieldValue()` (`case 'file'`): normalise value (string, array or empty) and call `pond.setOptions({ files: [{ source: id, options: { type: 'local' } }] })`. Empty value → `pond.removeFiles()`.
4. `_getFormData()` and `getFieldValue()` (`case 'file'`): map `pond.getFiles()` to `serverId`, skipping files not yet processed. Return string (single) or array (multiple).
5. Lifecycle: call `pond.destroy()` wherever other widgets are destroyed or the form is rebuilt, in all three classes (`destroy()`, `fieldInputs.clear()` paths).
6. Saving: block save while uploads are in progress (`pond.getFiles()` has a status of `PROCESSING`) and show a message via `messages` (new `uploading` key).
7. Honour existing common properties: `readonly`/`disabled` (`pond.disabled`), `hidden`, `transient`, `required` (validation error if empty), `dynamicFieldProps`.
8. Field config properties to add:

   | Property | Default | Purpose |
   |---|---|---|
   | `multiple` | `false` | Allow several files |
   | `server` | none (required) | `{ process, revert, load, remove? }` URL strings or FilePond server objects |
   | `acceptedFileTypes` | none | MIME list, e.g. `['image/*', 'application/pdf']` |
   | `maxFileSize` | none | e.g. `'5MB'` |
   | `maxFiles` | none | Only used when `multiple: true` |
   | `filepondOptions` | `{}` | Pass-through overrides for FilePond |

## Phase 2 — Styling (`css/recedit.css`)

- Make FilePond fill the field width, consistent with `defaultInputWidth` and horizontal/vertical layouts.
- Check it renders correctly inside jQuery UI dialog, inline form and tabs (z-index, overflow, hidden tabs sizing).
- Style the "FilePond required" message and the validation-error state.

## Phase 3 — Test infrastructure

1. `test/e2e/server.js`: add FilePond CSS/JS (and image-preview plugin) from CDN to `harnessPage()`.
2. Add in-memory mock upload endpoints to the Express test server:
   - `POST /api/files` returns a generated ID as `text/plain`.
   - `DELETE /api/files` removes the ID.
   - `GET /api/files/:id` returns a small PNG with `Content-Type: image/png` and `Content-Disposition`.
3. Add a small fixture PNG and a PDF under `test/e2e/fixtures/`.

## Phase 4 — Tests

**QUnit** (`test/unit/recedit-tests.js`)
- `file` field renders a FilePond instance; `multiple` maps to `allowMultiple`.
- Without FilePond: message shown, `console.warn` called, no exception, `_getFormData()` returns an empty value.
- `_populateForm()`/`setFieldValue()` with a string, array and empty value (single and multiple).
- `_getFormData()`/`getFieldValue()` return the correct shape; unprocessed files are excluded.
- `transient`, `hidden`, `readonly` and `required` behave as for other field types.
- `destroy()` and form rebuild destroy the pond (no leaks on repeated `open()`).

**Playwright** (`test/e2e/tests/`, new `recedit-file.spec.js`)
- Upload a fixture image in a dialog and see a thumbnail; save sends the returned ID in `edpak.formdata`.
- Open an existing record whose ID is set; the thumbnail loads from `GET /api/files/:id` and no re-upload occurs.
- Remove a file added in the same session: `DELETE /api/files` is called. Remove a file already on the record: **no** `DELETE` is sent, and the saved value omits the ID. Cancel after removing: the record value is unchanged.
- Replace a file; the saved value is the new ID.
- Multiple mode: add, remove and save an array of IDs.
- `acceptedFileTypes` and `maxFileSize` rejection shows an error and does not add the file.
- Save is blocked while an upload is pending.
- Works in `RecEditInlineForm` and in a tabbed form (field on a non-initial tab).
- Update test counts in `test/test.md`.

## Phase 5 — Documentation

- `docs/recedit.md`:
  - Add `file` to the Supported Field Types table and Table of Contents.
  - New "File Field Properties" section (table above, examples for single, multiple and images-only).
  - New "File Uploads — Server Requirements" section (summary of the next section, link to it).
  - Add FilePond and image-preview plugin to Dependencies as optional.
  - Note the `uploading` message in Messages Object.
- `README.md`: mention the file field type and optional dependency.
- `CHANGELOG.md`: add entry.
- `package.json`: add `filepond` keyword only. No runtime dependency (host page loads it).
- Rebuild `dist/recedit.min.js` (`npm run build`).

## Server-side requirements (Python / Flask)

RecEdit and FilePond make three requests; the server must implement them. This is a specification only.

| Endpoint | FilePond role | Behaviour |
|---|---|---|
| `POST /api/files` | `process` | Multipart upload. File is under the input's `name` (the field name). Validate, save, return a new opaque **file ID** as a `text/plain` body (HTTP 200). On failure return 4xx with a short message. |
| `DELETE /api/files` | `revert` | Request body is the file ID. Delete the file only if it is still **unattached** (pending), then return 204. |
| `GET /api/files/<id>` | `load` | Return the file bytes with the correct `Content-Type` and `Content-Disposition` (original filename). Used for thumbnails when editing an existing record. |

**Required behaviour**
1. **Storage:** save files under a random ID (for example `uuid4().hex`), never the client filename. Keep a DB table `files(id, original_name, mimetype, size, owner_id, status, created_at, record_ref)`.
2. **Two-state lifecycle:** see [File lifecycle](#file-lifecycle-pending-vs-attached) below.
3. **Orphan cleanup:** a scheduled job (cron, Celery or APScheduler) deletes `pending` files older than N hours.
4. **Record save endpoint:** accepts file ID string or array in the JSON body. Verify each ID exists, is owned by the user and is either pending or already attached to this record. Then reconcile (see below).
5. **Validation:** set `MAX_CONTENT_LENGTH`. Check the file type server-side by sniffing content (for example `filetype` or `python-magic`), not the extension or client MIME. Enforce the same limits as `acceptedFileTypes`/`maxFileSize` in the field config.
6. **Authorisation:** all three endpoints require the user session. `GET` checks the user may see the file or its record. `DELETE` checks ownership.
7. **Path safety:** validate the ID format (hex) and use `send_from_directory` or a storage backend. Never build paths from request input.
8. **Responses for thumbnails:** serve with the correct MIME type. Optionally return a resized thumbnail (Pillow) for large images via a query parameter or a separate route, which also avoids downloading originals.
9. **Security headers:** serve non-image files with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to prevent stored XSS (for example uploaded HTML or SVG).
10. **CSRF/CORS:** keep uploads same-origin where possible. If the endpoints sit on another origin, enable CORS with credentials and expose `Content-Disposition`; send the CSRF token via FilePond `server.process.headers`.
11. **Deployment:** reverse proxy body-size limit (for example nginx `client_max_body_size`) must be at least `MAX_CONTENT_LENGTH`.

### File lifecycle (pending vs attached)

Rule: **the editor never deletes an attached file directly. Only saving the record changes what is attached.** Cancelling an edit therefore can never lose data.

| State | Meaning | Created by | Deleted by |
|---|---|---|---|
| `pending` | Uploaded, not yet linked to a saved record | `POST /api/files` | `DELETE /api/files` (user removed it before saving), or the cleanup job |
| `attached` | Linked to a record field after a successful save | Record save | Record save (file omitted from the submitted IDs), or record deletion |

| User action | Client behaviour | Server behaviour |
|---|---|---|
| Add a file | `process` uploads it; the field holds the returned ID | File stored as `pending` |
| Remove a file added in this session (before saving) | FilePond calls `revert` | `DELETE /api/files`: file is `pending`, so it is deleted |
| **Remove a file already saved on the record** (X on its thumbnail) | The file leaves the field only. `server.remove` is not configured, so no request is sent. | Nothing yet; the file stays `attached` |
| Save after removing a saved file | Submitted value omits that ID | Reconcile: IDs previously attached to this record field but missing from the payload are **detached and deleted** |
| Cancel or close without saving | Nothing is sent | Saved files are untouched. Files uploaded this session stay `pending` until cleanup. |
| Replace a file (single mode: remove old, add new) | New file uploads and gets an ID; old one leaves the field | Save attaches the new ID and deletes the old one |
| Save fails validation, user retries | IDs are kept in the field | Files remain `pending`, so the retry works |
| `DELETE /api/files` for an `attached` file | n/a (client never does this) | Refuse with 409 |

**Reconcile on save**, per file field present in the payload:
1. `submitted` = IDs in the payload; `current` = IDs attached to this record field.
2. Attach `submitted - current` (each must be `pending`, owned by the user).
3. Detach and delete `current - submitted`. Use a soft delete if you need an undo or audit trail.
4. Only reconcile fields that are present in the payload, so partial saves and `transient` fields never wipe files.

Deleting a record should delete its attached files.

Client implication: `_createFileInput()` must not set `server.remove`, and `revert` must only be wired for files uploaded in the current session.

**Server tests (in the Flask project)**: upload returns an ID; oversized and wrong-type rejected; revert only works on pending files; `GET` enforces authorisation and returns correct headers; save attaches IDs; the cleanup job removes only stale pending files.

## Out of scope

- Reference Flask implementation, chunked or resumable uploads, image editing/cropping, cloud storage adapters.

Yes. This is a standard FilePond feature, and Flask handles the server side well.

## How it works

1. Register the `filepond-plugin-image-preview` plugin. It draws a thumbnail inside the field for any image file.
2. When RecEdit opens an existing record, pass the stored file ID to FilePond as a **local** file:
   ```js
   FilePond.create(input, {
       server: {
           process: '/api/files',            // POST
           revert:  '/api/files',            // DELETE
           load:    '/api/files/'            // GET <id>
       },
       files: [{ source: record.logo_id, options: { type: 'local' } }]
   });
   ```
3. FilePond calls `GET /api/files/<id>`, receives the image as a blob and renders the thumbnail. It does not re-upload that file on save.
4. In `_getFormData()`, return `pond.getFiles().map(f => f.serverId)`. For local files, `serverId` is the `source` you passed in.

## Flask endpoints (sketch)

```python
import os, uuid
from flask import Flask, request, send_from_directory, abort

UPLOAD_DIR = "uploads"

@app.post("/api/files")
def upload():
    f = request.files.get("logo")            # key is the input's name
    if not f: abort(400)
    file_id = uuid.uuid4().hex
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    f.save(os.path.join(UPLOAD_DIR, file_id))
    # store file_id -> original filename and content type in your DB
    return file_id, 200, {"Content-Type": "text/plain"}

@app.delete("/api/files")
def revert():
    file_id = request.get_data(as_text=True)
    # validate it's a hex uuid, then delete
    return "", 204

@app.get("/api/files/<file_id>")
def load(file_id):
    # look up name and mimetype in the DB; never build paths from user input
    return send_from_directory(UPLOAD_DIR, file_id,
                               mimetype=mimetype, download_name=orig_name)
```

## Things to get right

- **Content type:** the `load` response needs the correct `Content-Type` (for example `image/png`). The preview plugin relies on it to decide whether the file is an image. FilePond takes the filename from `Content-Disposition`, which `download_name` sets.
- **Large images:** FilePond downloads the full file to render the preview. If originals are big, have `load` return a resized thumbnail (for example with Pillow). It's safe because local files aren't re-uploaded.
- **Non-image files** (PDF, DOCX) get no thumbnail, only a filename and size. For those you'd need server-generated preview images or an icon.
- **Same origin:** serve the files from the same origin as the page. Otherwise you need CORS and must expose `Content-Disposition`.
- **Security:** use random IDs, not client filenames. Limit size with Flask's `MAX_CONTENT_LENGTH`. Check type server-side (don't trust the extension). Also check the user is allowed to see the file in `load`.
- **Orphans:** files uploaded but never saved with a record stay behind if the dialog is cancelled. A periodic cleanup of unreferenced uploads handles that.
- **Plugin load order:** call `FilePond.registerPlugin(FilePondPluginImagePreview)` before creating the field. In RecEdit this belongs in the `typeof FilePond` guard from the earlier design.

If you want a lighter option for read-only display, you can skip FilePond's preview and render a plain `<img src="/api/files/<id>?thumb=1">` next to the field. The FilePond route is neater because the preview, remove button and replace flow all live in one control.
