# recedit.js — Test Suite

> **Goal**: verify that `recedit.js` (`RecEdit`, `RecEditInlineForm`, `RecEditCustomDialog`) works correctly.

---

## Architecture

| Layer | Tool | What it tests |
|---|---|---|
| Unit / logic | **QUnit 2.21** (browser, via Express) | Class behaviour — field population, callbacks, layout, tab normalisation, date formatting, etc. |
| End-to-end | **Playwright** (Chromium, headless) | RecEdit running in an Express-served harness page; DOM visibility, real jQuery UI widget interaction. |

The Playwright suite also drives the QUnit page and reports any QUnit failures as a single Playwright test, so `npm test` covers both layers.

---

## Requirements

| Requirement | Notes |
|---|---|
| **Node.js >= 18** | <https://nodejs.org/> |
| **npm** (ships with Node.js) | |
| **Internet access** | CDN assets (jQuery, jQuery UI, QUnit, Inputmask) |

---

## Installation

Run once from the **repo root**:

```powershell
npm install
npx playwright install chromium
```

---

## Running all tests

From the **repo root**:

```powershell
npm test
```

This runs all 97 tests (96 Playwright E2E tests + 1 QUnit runner test). The QUnit runner test covers 234 QUnit tests. The Express test server is started and stopped automatically.

---

## Individual npm scripts

| Script | What it does |
|---|---|
| `npm test` | All tests, headless Chromium |
| `npm run test:e2e:headed` | All tests, visible browser window |
| `npm run test:e2e:debug` | Step-through Playwright debugger |
| `npm run serve` | Start the test server only (port 54400) — note: `serve`, not `server` |

To run a single spec file:

```powershell
npx playwright test --config playwright.config.js tests/recedit-dialog.spec.js
npx playwright test --config playwright.config.js tests/recedit-inline.spec.js
npx playwright test --config playwright.config.js tests/recedit-file.spec.js
npx playwright test --config playwright.config.js tests/recedit-qunit.spec.js
```

---

## Viewing the QUnit page manually

Start the server (the script is `serve`, not `server`), then open the runner in a browser:

```powershell
npm run serve
# then navigate to:
# http://127.0.0.1:54400/qunit/recedit-tests.html
```

- Green bar = all passing.
- Red bar = failures. Click any test name to expand the assertion diff.
- Use the filter box to run a single module or test by name.

---

## Test file reference

| File | Purpose |
|---|---|
| playwright.config.js | Playwright config (base URL, web server, reporters) |
| server.js | Express test server (auto-started by Playwright) |
| recedit-dialog.spec.js | E2E tests for `RecEdit` dialog mode |
| recedit-inline.spec.js | E2E tests for `RecEditInlineForm` and `RecEditCustomDialog` |
| recedit-file.spec.js | E2E tests for the `file` field type (upload, remove, replace, progress bar, abort, drag and drop) in all three editor classes |
| fixtures/ | Small PNG, PDF and wrong-type files used by `recedit-file.spec.js` |
| recedit-qunit.spec.js | Playwright runner for the QUnit unit tests |
| recedit-tests.html | QUnit HTML harness page |
| recedit-tests.js | 234 QUnit tests across 26 modules (module 26 covers the `file` field) |

---

## Notes

- Dialogs are appended to an off-screen `#test-sandbox` element so they do not affect the visible page during testing.
- The `.ui-widget-overlay` CSS rule (`pointer-events: none`) prevents the jQuery UI modal backdrop from blocking the QUnit toolbar.
- No backend application or database is required — the Express server serves static assets, the HTML harness pages (including `/file-harness`) and a small in-memory multipart endpoint (`/api/save-with-file`) for the file-upload tests.
- The test suite is designed to run in any modern browser, but is currently configured to run headless Chromium via Playwright.