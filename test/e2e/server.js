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
 *   GET /file-harness — harness for the `file` field type: defines
 *                      window.createFileEditor(mode, cfg) for dialog / inline /
 *                      custom-dialog editors wired to POST /api/save-with-file
 *                      (used by recedit-file.spec.js)
 *
 * File-upload test API (see the "File upload test API" section below):
 *   POST /api/save-with-file   multipart save (?delay=, ?pre=, ?fail=)
 *   GET  /api/thumb/:id        small PNG, or 404
 *   GET  /api/request-log      requests seen by the endpoints above
 *   POST /api/reset            clear the request log and saved records
 *
 * jQuery and jQuery UI are loaded from CDN.
 * jquery-inputmask is loaded from CDN.
 * jquery-timepicker is loaded from CDN.
 *
 * Start:  node test/e2e/server.js
 * Port:   54400 (override with PORT env var)
 */

'use strict';

const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app     = express();
const ROOT    = path.resolve(__dirname, '../..');   // repo root
const PORT    = process.env.PORT || 54400;

// ── Library assets ───────────────────────────────────────────────────────────
// Serve recedit.js and recedit.css directly from the repo root paths.
app.use('/recedit.js',  express.static(path.join(ROOT, 'src/recedit.js')));
app.use('/recedit.css', express.static(path.join(ROOT, 'css/recedit.css')));

// ── QUnit test runner ────────────────────────────────────────────────────────
// Serves test/unit/ at /qunit so recedit-tests.html can be opened at
// http://127.0.0.1:54400/qunit/recedit-tests.html
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

/**
 * /file-harness — editors for the `file` field type.
 *
 * window.createFileEditor(mode, cfg) builds an editor, opens/loads it and returns it
 * (also stored in window.fileEditor).
 *   mode: 'dialog' (RecEdit) | 'inline' (RecEditInlineForm) | 'custom' (RecEditCustomDialog)
 *   cfg.record     record to edit (default: a new, empty record)
 *   cfg.twoFiles   true → add a second file field, `attachment`
 *   cfg.logo       extra/override options for the `logo` field
 *   cfg.options    extra/override RecEdit options (e.g. { fileProgressMinSize: 0 })
 *
 * Fields: id (key), name (text), logo (file; accept 'image/*,.pdf', maxFileSize 5 MB,
 * thumbnailUrl '/api/thumb/{id}').
 *
 * Set window.fileSaveQuery (e.g. '?delay=500') before saving to pass the server's
 * ?delay / ?pre / ?fail options. It is read on every save.
 *
 * window.fileEvents records 'save' (with the returned record) and 'cancel' entries.
 * window.fileNotices records `recedit-notice` events (e.g. a failed save's error message).
 */
app.get('/file-harness', (_req, res) => {
    const markup = `
  <div id="file-inline" style="width:560px">
    <div data-field="name"></div>
    <div data-field="logo"></div>
    <div data-field="attachment"></div>
  </div>
  <div id="file-custom" style="display:none">
    <div data-field="name"></div>
    <div data-field="logo"></div>
    <div data-field="attachment"></div>
  </div>`;

    const script = `
    window.fileSaveQuery = '';
    window.fileEvents = [];
    window.fileNotices = [];   // recedit-notice events (e.g. the error shown for a failed save)
    window.fileEditor = null;
    $(document).on('recedit-notice', function (e, n) { e.preventDefault(); window.fileNotices.push(n); });
    window.createFileEditor = async function (mode, cfg) {
      cfg = cfg || {};
      const fields = {
        id:   { type: 'text', key: true },
        name: { type: 'text', label: 'Name' },
        logo: Object.assign({
          type: 'file', label: 'Logo',
          accept: 'image/*,.pdf', maxFileSize: 5 * 1024 * 1024,
          thumbnailUrl: '/api/thumb/{id}'
        }, cfg.logo || {})
      };
      if (cfg.twoFiles) {
        fields.attachment = { type: 'file', label: 'Attachment', maxFileSize: 5 * 1024 * 1024 };
      }
      const options = Object.assign({
        fields: fields,
        effectDuration: 0,
        showEffect: null,
        hideEffect: null,
        modal: false,
        onSave: function (edpak) {
          return window.fileEditor.submit('/api/save-with-file' + window.fileSaveQuery, edpak, {
            headers: { 'X-Test': 'recedit' }
          }).then(function (rec) {
            window.fileEvents.push({ type: 'save', record: rec });
            return rec;
          });
        },
        onCancel: function () { window.fileEvents.push({ type: 'cancel' }); }
      }, cfg.options || {});

      const record = cfg.record || { id: '', name: '', logo: '' };
      if (mode === 'inline') {
        options.container = '#file-inline';
        window.fileEditor = new RecEditInlineForm(options);
        await window.fileEditor.load({ record: record });
      } else if (mode === 'custom') {
        options.container = '#file-custom';
        window.fileEditor = new RecEditCustomDialog(options);
        await window.fileEditor.open({ record: record });
      } else {
        window.fileEditor = new RecEdit(options);
        await window.fileEditor.open({ record: record });
      }
      return window.fileEditor;
    };`;

    res.send(harnessPage(markup, script));
});

// ── File upload test API ──────────────────────────────────────────────────────
// A stand-in for a host application's multipart save endpoint (see the server contract
// in docs/add-fileupload-simple-plan.md). Records live in memory only.

const FILE_FIELDS    = ['logo', 'attachment'];
const THUMB_PNG     = fs.readFileSync(path.join(__dirname, 'fixtures/sample.png'));
const upload        = multer({ storage: multer.memoryStorage() }).any();

let requestLog = [];      // one entry per request seen by the endpoints below
let savedRecords = {};    // id → record
let nextId = 1;

/** Holds the request for `ms` milliseconds (no-op when ms is not a positive number). */
const sleep = (ms) => new Promise(r => setTimeout(r, Number(ms) > 0 ? Number(ms) : 0));

/** Removes any directory part (either slash style) from a client-supplied filename. */
const baseName = (n) => String(n || '').split(/[\\/]/).pop();

/**
 * POST /api/save-with-file
 *   ?pre=<ms>    wait before reading the request body (keeps a large upload in flight
 *                so tests can abort it; the body stalls in socket buffers)
 *   ?delay=<ms>  hold the response after the body has been read and the record saved
 *   ?fail=<n>    respond with status n instead of saving:
 *                  422 → JSON [{ name, status }] (field `?failField=`, default 'logo')
 *                  413 → plain HTML body (as from MAX_CONTENT_LENGTH or a proxy)
 *                  other → JSON { message }
 */
app.post('/api/save-with-file',
    async (req, _res, next) => { await sleep(req.query.pre); next(); },
    upload,
    async (req, res) => {
        const entry = {
            kind: 'save',
            url: req.originalUrl,
            contentType: req.headers['content-type'] || '',
            headers: { 'x-test': req.headers['x-test'] || null },
            data: null,
            files: (req.files || []).map(f => ({
                field: f.fieldname, name: f.originalname, type: f.mimetype, size: f.size
            })),
            status: null
        };
        requestLog.push(entry);

        const fail = Number(req.query.fail) || 0;
        const respond = async (status, body, isHtml) => {
            await sleep(req.query.delay);
            entry.status = status;
            if (isHtml) return res.status(status).type('html').send(body);
            res.status(status).json(body);
        };

        try {
            entry.data = JSON.parse(req.body.data);
        } catch (e) {
            return respond(400, { message: 'Missing or invalid "data" part' });
        }

        if (fail === 422) {
            return respond(422, [{ name: req.query.failField || 'logo', status: 'Rejected by server' }]);
        }
        if (fail === 413) {
            return respond(413, '<html><body><h1>413 Request Entity Too Large</h1></body></html>', true);
        }
        if (fail) {
            return respond(fail, { message: 'Simulated server error ' + fail });
        }

        // Per-field rules from the server contract
        const data     = entry.data;
        const existing = savedRecords[data.id];
        const record   = { ...data };
        if (!record.id) record.id = nextId++;

        for (const field of FILE_FIELDS) {
            const part = (req.files || []).find(f => f.fieldname === field);
            // The test server has no seeded database, so for a record it has not saved before the
            // client-supplied value stands in for "the record's current filename".
            const current = existing ? (existing[field] || '') : (data[field] || '');
            if (part) {
                record[field] = baseName(part.originalname) || 'file';   // 1. replace
            } else if (field in data && data[field] === '' && current) {
                record[field] = '';                                      // 2. delete
            } else if (field in data || existing) {
                record[field] = current;                                 // 3. unchanged
            }
        }

        savedRecords[record.id] = record;
        return respond(200, record);
    }
);

// Aborted uploads (client closed the dialog mid-request) make multer fail while parsing the
// body, so the handler above never runs and nothing is saved. Record the fact for tests.
app.use('/api/save-with-file', (err, req, res, _next) => {
    requestLog.push({ kind: 'save', url: req.originalUrl, aborted: true, error: String(err && err.message) });
    if (!res.headersSent) res.status(400).json({ message: 'Upload failed' });
});

/**
 * GET /api/thumb/:id — a small PNG. 404 for id 'none' and for a saved record that has no
 * logo, so tests can exercise the thumbnail `onerror` path. Cached never (no-cache).
 */
app.get('/api/thumb/:id', (req, res) => {
    requestLog.push({ kind: 'thumb', url: req.originalUrl });
    const rec = savedRecords[req.params.id];
    if (req.params.id === 'none' || (rec && !rec.logo)) return res.sendStatus(404);
    res.set('Cache-Control', 'no-cache').type('png').send(THUMB_PNG);
});

/** GET /api/request-log[?kind=save|thumb] — the logged requests, oldest first. */
app.get('/api/request-log', (req, res) => {
    res.json(req.query.kind ? requestLog.filter(e => e.kind === req.query.kind) : requestLog);
});

/** POST /api/reset — clears the request log and the saved records. */
app.post('/api/reset', (_req, res) => {
    requestLog = [];
    savedRecords = {};
    nextId = 1;
    res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
    console.log(`RecEdit test server listening on http://127.0.0.1:${PORT}`);
});
