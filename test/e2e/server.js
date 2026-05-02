/**
 * Minimal Express server for Playwright E2E tests.
 *
 * Serves RecEdit library files and provides two HTML harness pages that load
 * jQuery, jQuery UI, and recedit.js so that tests can run without any
 * backend application.
 *
 *   GET /          — bare harness (used by recedit-dialog.spec.js)
 *   GET /orderdetail — harness with #orderdetail-editor and
 *                      window.orderdetailTVars.editor pre-initialised
 *                      (used by recedit-inline.spec.js)
 *
 * jQuery and jQuery UI are loaded from CDN.
 * jquery-inputmask is loaded from CDN.
 * jquery-timepicker is loaded from CDN.
 *
 * Start:  node test/e2e/server.js
 * Port:   4000 (override with PORT env var)
 */

'use strict';

const express = require('express');
const path    = require('path');

const app     = express();
const ROOT    = path.resolve(__dirname, '../..');   // repo root
const PORT    = process.env.PORT || 4000;

// ── Library assets ───────────────────────────────────────────────────────────
// Serve recedit.js and recedit.css directly from the repo root paths.
app.use('/recedit.js',  express.static(path.join(ROOT, 'src/recedit.js')));
app.use('/recedit.css', express.static(path.join(ROOT, 'css/recedit.css')));

// ── QUnit test runner ────────────────────────────────────────────────────────
// Serves test/unit/ at /qunit so recedit-tests.html can be opened at
// http://127.0.0.1:4000/qunit/recedit-tests.html
app.use('/qunit', express.static(path.join(ROOT, 'test/unit')));

// ── Shared HTML builder ──────────────────────────────────────────────────────
/**
 * Build a complete harness page.
 * @param {string} markup  - HTML markup placed before the library scripts
 * @param {string} script  - Inline <script> content placed after all libraries
 */
function harnessPage(markup = '', script = '') {
    const inlineScript = script
        ? `\n  <script>\n${script}\n  </script>` : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>RecEdit Test Harness</title>
  <link rel="stylesheet" href="https://code.jquery.com/ui/1.14.2/themes/base/jquery-ui.min.css">
  <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.css">
  <link rel="stylesheet" href="/recedit.css">
</head>
<body>
${markup}
  <script src="https://code.jquery.com/jquery-4.0.0.min.js"></script>
  <script src="https://code.jquery.com/ui/1.14.2/jquery-ui.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.inputmask/5.0.9/jquery.inputmask.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/timepicker/1.3.5/jquery.timepicker.min.js"></script>
  <script src="/recedit.js"></script>${inlineScript}
</body>
</html>`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** Bare harness — used by gotoCustomerPage() in both spec files */
app.get(['/', '/customer'], (_req, res) => {
    res.send(harnessPage());
});

/**
 * /orderdetail stub — used by the "Live /orderdetail page" tests in
 * recedit-inline.spec.js.  Creates window.orderdetailTVars.editor as a
 * RecEditInlineForm instance so that load() / getFieldValue() tests pass.
 */
app.get('/orderdetail', (_req, res) => {
    const fields = ['orderid', 'productid', 'productname', 'unitprice', 'quantity', 'discount'];

    const fieldDivs = fields
        .map(f => `  <div data-field="${f}"></div>`)
        .join('\n');

    const fieldDefs = fields
        .map(f => `        ${f}: { label: '${f}', type: 'text' }`)
        .join(',\n');

    const markup = `
  <div id="orderdetail-editor">
${fieldDivs}
  </div>`;

    const script = `
    window.orderdetailTVars = {};
    $(function () {
      orderdetailTVars.editor = new RecEditInlineForm({
        container: '#orderdetail-editor',
        effectDuration: 0,
        useJQueryUITheme: false,
        fields: {
${fieldDefs}
        },
        onSave: function (rec, done) { done(true, rec); }
      });
    });`;

    res.send(harnessPage(markup, script));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
    console.log(`RecEdit test server listening on http://127.0.0.1:${PORT}`);
});
