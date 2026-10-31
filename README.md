# RecEdit

A jQuery UI-based record editor dialog component.

Supports multiple field types, tabbed form layouts, inline editing, custom dialogs, field validation, and deep customisation via callbacks.

## Features

- **Multiple field types**: text, textarea, checkbox, radiogroup, select, date/datetime, password, autocomplete, spinner, slider, htmldiv
- **Tabbed layouts**: group fields into tabs with the `tabs` option and automatic tab normalisation
- **Vertical layout**: label above input (default)
- **Horizontal layout**: label and input on the same row, with optional field grouping
- **RecEditInlineForm**: render fields inline inside an existing container element rather than a dialog
- **RecEditCustomDialog**: use a pre-built hidden container as the dialog body
- **Validation**: built-in required/maxlength checks plus a custom `validateForm` callback
- **Lifecycle callbacks**: `onInit`, `onBeforeShow`, `onAfterShow`, `onSave`, `onCancel`
- **jQuery UI theme compatible**: inherits colours and typography from any jQuery UI theme
- **Input masking**: via [jQuery Inputmask](https://github.com/RobinHerbots/Inputmask)
- **Time picking**: via [jquery-timepicker](https://timepicker.co/)

## Dependencies

| Dependency | Version | Notes |
|---|---|---|
| jQuery | ≥ 3.5 | Required |
| jQuery UI | ≥ 1.13 | Required (dialog, widget, datepicker, spinner, slider, autocomplete, selectmenu) |
| [jQuery Inputmask](https://github.com/RobinHerbots/Inputmask) | 5.x | Optional — for masked text fields |
| [jquery-timepicker](https://timepicker.co/) | 1.x | Optional — for time/datetime fields |

## Quick Start

### Include assets

```html
<link rel="stylesheet" href="https://code.jquery.com/ui/1.14.2/themes/base/jquery-ui.min.css">
<link rel="stylesheet" href="css/recedit.css">

<script src="https://code.jquery.com/jquery-4.0.0.min.js"></script>
<script src="https://code.jquery.com/ui/1.14.2/jquery-ui.min.js"></script>
<script src="src/recedit.js"></script>
```

Or use the pre-built minified file:

```html
<script src="dist/recedit.min.js"></script>
```

### Basic usage

```javascript
const editor = new RecEdit({
    fields: {
        id:    { key: true, label: 'ID',    type: 'text', readonly: true },
        name:  { label: 'Name',  type: 'text', maxLength: 100 },
        email: { label: 'Email', type: 'text' },
    },
    onSave: async (edpak) => {
        const res = await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata),
        });
        return res.json();
    },
});

// Pass a record object to pre-populate the form
editor.open({ record: { id: 1, name: 'Alice', email: 'alice@example.com' } });
```

See [docs/recedit.md](docs/recedit.md) for the full API reference including all constructor options, field types, callbacks, and examples.

## CDN Quick Start

Use pinned, tagged release assets from jsDelivr for production/stable usage.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/tjr50/recedit@v0.1.0-preview/css/recedit.css">

<script src="https://code.jquery.com/jquery-4.0.0.min.js"></script>
<script src="https://code.jquery.com/ui/1.14.2/jquery-ui.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/tjr50/recedit@v0.1.0-preview/dist/recedit.min.js"></script>
```

Optional plugins:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.inputmask/5.0.9/jquery.inputmask.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.js"></script>
```

Notes:
- Prefer `@vX.Y.Z` or `@vX.Y.Z-preview` tags instead of `@main` for predictable caching and immutable assets.
- Update only the version part of the URL when publishing a new release.

## Release Checklist

Use this flow for each public release:

1. Update version in `package.json` (for example `0.1.1` or `0.1.1-preview`).
2. Build minified output: `npm run build`.
3. Run tests: `npm test`.
4. Commit release changes (including `dist/recedit.min.js`).
5. Create and push tag:
  - `git tag v0.1.1`
  - `git push origin main --tags`
6. Create a GitHub Release from the tag and mark as pre-release when applicable.
7. Update CDN examples in docs/README to the new tag version.

## Installation

```bash
npm install
npx playwright install chromium   # for E2E tests
```

## Development

### Build minified dist

```bash
npm run build
```

### Run E2E tests (Playwright)

```bash
npm test
# or with a visible browser:
npm run test:e2e:headed
```

### Run unit tests (QUnit)

Start the test server, then open the QUnit runner in your browser:

```bash
npm run serve
# open http://127.0.0.1:54400/qunit/recedit-tests.html
```

## Project Structure

```
src/
  recedit.js              Main library source
dist/
  recedit.min.js          Minified build output
css/
  recedit.css             Stylesheet
docs/
  recedit.md              Full API reference
test/
  unit/
    recedit-tests.html    QUnit test runner page
    recedit-tests.js      QUnit test suite
  e2e/
    playwright.config.js  Playwright configuration
    server.js             Express test harness server
    tests/
      recedit-dialog.spec.js   E2E tests for RecEdit dialog
      recedit-inline.spec.js   E2E tests for RecEditInlineForm / RecEditCustomDialog
```

## License

MIT License

Copyright (c) 2026 Ozmx Internet Services

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Support

For issues or questions, refer to the project documentation or contact recedit@ozmx.com.au (we will answer your questions as best we can, but please understand that this is a free open-source project and we do not have the resources to provide dedicated support).

