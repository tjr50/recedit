# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `file` field type: native `<input type="file">` (one file per field) with `accept` and `maxFileSize` checks, an optional `thumbnailUrl` / `thumbnailSize` thumbnail, a Remove button, and drag-and-drop (`dropZone`). The record value is the filename string.
- `edpak.files` (`{ fieldName: File }`) is set before `validateForm` and `onSave`.
- `editor.submit(url, edpak, opts)`: sends the record JSON and file parts in a single multipart XHR request, maps 422 field-error arrays, 413 and network errors, and drives a form-level upload progress bar.
- Form-level upload progress bar, shown in the dialog button pane or the inline form's button bar when the total upload size is at least the new `fileProgressMinSize` option (default 1 MB). Public `showUploadProgress()` / `hideUploadProgress()` for custom transports.
- Closing the dialog during an upload aborts the request; no post-save work runs.
- New `messages` keys: `removeFile`, `dropHint`, `fileTooLarge`, `fileTypeNotAllowed`, `uploadFailed`, `uploading`.
- `multer` dev dependency for the E2E test server.

## [0.1.0-preview] - 2026-05-01

### Added
- `RecEdit` — jQuery UI dialog-based record editor with support for text,
  textarea, checkbox, radiogroup, select, date, datetime, password,
  autocomplete, spinner, slider, and htmldiv field types.
- `RecEditInlineForm` — inline (non-dialog) variant that renders fields inside
  an existing container element.
- `RecEditCustomDialog` — variant that uses a pre-built hidden container as the
  dialog body.
- Tabbed form layout via `normalizeTabs`.
- Horizontal form layout with optional field grouping (`fieldGroup`).
- Field validation: required, maxLength, and custom `validateForm` callback.
- Lifecycle callbacks: `onInit`, `onBeforeShow`, `onAfterShow`, `onSave`, `onCancel`.
- jQuery UI theme compatibility.
- Input masking via [jQuery Inputmask](https://github.com/RobinHerbots/Inputmask).
- Time/datetime picking via [jquery-timepicker](https://timepicker.co/).
- QUnit unit test suite (`test/unit/`).
- Playwright E2E test suite (`test/e2e/`).
- Standalone Express test server with CDN-sourced jQuery / jQuery UI and optional dependencies.

## [0.1.1-preview] - 2026-10-31

### Changes
- added _initializeAutoComplete() and _attachAutocompleteChange() methods for correctly handling tabs and value selection in autocomplete fields
- Changed test server to runon port 54400 instead of the original 4000.
- Updated documentation and test instructions to reflect the new default test server port (54400).
- Updated Playwright configuration to use the new default test server port (54400).
- Updated playwright to latest version.

## [0.1.2-preview] - 2026-11-04
### Changes
- Added new file field type support for file uploads in the record editor.
- Added tests for the new file field type support in the record editor.

## [0.1.3-preview] - 2026-11-17
### Changes
- Added a `sourceParams` option to `autocomplete` fields: extra query parameters (an object, or `function(request) → object`) appended to every URL `source` request.
- Fixed checkbox and `checkboxradio` fields not getting the jQuery UI theme: both types are now themed with `ui.checkboxradio()` (replacing `ui.button()`), initialised deterministically once the label is in the DOM — including async `radiogroup` option sources, inline forms and custom dialogs.
- Fixed form label/`id` binding for compound fields (checkbox, radiogroup, slider, file) and applied `aria-required` to the real controls inside a wrapper.
- Fixed the Save button never showing "Saving...": the label is now updated through the jQuery UI button `label` option (or the trailing text node for inline buttons), preserving the check icon.
- Fixed `readonly` / `readOnly` / `disabled` not being honoured by every field type (checkbox, radiogroup, select, date, time, spinner, slider); read-only values are still submitted.
- Updated documentation (read-only behaviour, `sourceParams`, checkbox theming, label/id binding, CSS classes) and added QUnit/E2E coverage for the changes above; rebuilt `dist/recedit.min.js`.



