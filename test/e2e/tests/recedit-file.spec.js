/**
 * Playwright E2E tests — `file` field type
 * =========================================
 * Drives the /file-harness page (see test/e2e/server.js), which defines
 * window.createFileEditor(mode, cfg) for the three editor classes and wires onSave to
 * editor.submit('/api/save-with-file' + window.fileSaveQuery, ...).
 *
 * The server logs every save request (GET /api/request-log?kind=save), so tests assert on what
 * was actually sent: the multipart `data` part and the file parts.
 *
 *   mode 'dialog' → RecEdit            (jQuery UI dialog)
 *   mode 'inline' → RecEditInlineForm  (form stays on the page)
 *   mode 'custom' → RecEditCustomDialog
 */

// @ts-check
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURES = path.resolve(__dirname, '../fixtures');
const PNG = path.join(FIXTURES, 'sample.png');
const PDF = path.join(FIXTURES, 'sample.pdf');
const TXT = path.join(FIXTURES, 'wrong-type.txt');

const EXISTING = { id: 7, name: 'Acme', logo: 'acme.png' };

// ─── helpers ────────────────────────────────────────────────────────────────

async function gotoHarness(page, request) {
    await request.post('/api/reset');
    await page.goto('/file-harness');
    await page.waitForFunction(() => typeof window.createFileEditor === 'function' && typeof RecEdit !== 'undefined', null, { timeout: 15_000 });
}

/** Creates and opens an editor. `cfg` is passed to createFileEditor (record, twoFiles, logo, options). */
async function openEditor(page, mode, cfg = {}) {
    await page.evaluate(([m, c]) => createFileEditor(m, c), [mode, cfg]);
    await expect(page.locator('.file-field').first()).toBeVisible();
}

/** Server-side log of save requests. */
async function saveLog(request) {
    return (await request.get('/api/request-log?kind=save')).json();
}

async function thumbLog(request) {
    return (await request.get('/api/request-log?kind=thumb')).json();
}

const saveButton = (page) => page.getByRole('button', { name: 'Save', exact: true });
const cancelButton = (page) => page.getByRole('button', { name: 'Cancel', exact: true });
const inlineResetButton = (page) => page.locator('.recedit-reset-btn');   // inline form's Cancel/restore button

async function setSaveQuery(page, query) {
    await page.evaluate((q) => { window.fileSaveQuery = q; }, query);
}

/** Waits until n 'save' events have been recorded by the harness onSave wrapper. */
async function waitForSaveEvents(page, n) {
    await page.waitForFunction((count) => window.fileEvents.filter(e => e.type === 'save').length >= count, n, { timeout: 15_000 });
}

function bigFile(name, bytes) {
    return { name, mimeType: 'image/png', buffer: Buffer.alloc(bytes, 1) };
}

/** The element that should host the progress bar for each mode. */
function progressHost(page, mode) {
    return mode === 'inline'
        ? page.locator('.recedit-button-bar')
        : page.locator('.ui-dialog-buttonpane');
}

/** Dispatches a synthetic file drag event on a field wrapper (Playwright cannot drag from the OS). */
async function dispatchDrag(page, type, fieldName, file) {
    return page.evaluate(([t, name, f]) => {
        const dt = new DataTransfer();
        if (f) {
            const bytes = f.size ? new Uint8Array(f.size) : new Uint8Array([1, 2, 3, 4]);
            dt.items.add(new File([bytes], f.name, { type: f.type }));
        }
        const ev = new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt });
        document.querySelector('input[name="' + name + '"]').closest('.file-field').dispatchEvent(ev);
        return ev.defaultPrevented;
    }, [type, fieldName, file]);
}

// ─── upload, remove, replace — all three editor classes ─────────────────────

for (const mode of ['dialog', 'inline', 'custom']) {

    test.describe(`file field: save cycle (${mode})`, () => {

        test.beforeEach(async ({ page, request }) => { await gotoHarness(page, request); });

        test('choose an image, Save: one multipart request with data + file; nothing sent before Save', async ({ page, request }) => {
            await openEditor(page, mode);
            await page.locator('input[name="name"]').fill('Acme');
            await page.setInputFiles('input[name="logo"]', PNG);

            // Selecting a file only stores it in memory
            await page.waitForTimeout(300);
            expect(await saveLog(request)).toHaveLength(0);
            await expect(page.locator('.file-current-name')).toHaveText('sample.png');

            await saveButton(page).click();
            await waitForSaveEvents(page, 1);

            const log = await saveLog(request);
            expect(log).toHaveLength(1);
            expect(log[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
            expect(log[0].headers['x-test']).toBe('recedit');
            expect(log[0].data.name).toBe('Acme');
            expect(log[0].data.logo).toBe('sample.png');
            expect(log[0].files).toHaveLength(1);
            expect(log[0].files[0]).toMatchObject({ field: 'logo', name: 'sample.png' });
            expect(log[0].files[0].size).toBeGreaterThan(0);

            const saved = await page.evaluate(() => fileEvents.find(e => e.type === 'save').record);
            expect(saved.logo).toBe('sample.png');
            expect(saved.id).toBeTruthy();
        });

        test('existing record: thumbnail loads from thumbnailUrl; Save unchanged sends no file part and the same filename', async ({ page, request }) => {
            await openEditor(page, mode, { record: EXISTING });
            await expect(page.locator('.file-current-name')).toHaveText('acme.png');
            const thumb = page.locator('.file-thumb');
            await expect(thumb).toBeVisible();
            await expect.poll(() => thumb.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
            await expect(thumb).toHaveAttribute('src', '/api/thumb/7');
            expect((await thumbLog(request)).some(e => e.url === '/api/thumb/7')).toBe(true);

            await saveButton(page).click();
            await waitForSaveEvents(page, 1);

            const log = await saveLog(request);
            expect(log).toHaveLength(1);
            expect(log[0].files).toHaveLength(0);
            expect(log[0].data.logo).toBe('acme.png');
            const saved = await page.evaluate(() => fileEvents.find(e => e.type === 'save').record);
            expect(saved.logo).toBe('acme.png');
        });

        test('Remove then Save: formdata[field] === "" and no file part', async ({ page, request }) => {
            await openEditor(page, mode, { record: EXISTING });
            await page.locator('.file-remove-btn').click();
            await expect(page.locator('.file-current')).toBeHidden();
            await expect(page.locator('.file-thumb')).toBeHidden();

            await saveButton(page).click();
            await waitForSaveEvents(page, 1);

            const log = await saveLog(request);
            expect(log[0].data.logo).toBe('');
            expect(log[0].files).toHaveLength(0);
            const saved = await page.evaluate(() => fileEvents.find(e => e.type === 'save').record);
            expect(saved.logo).toBe('');
        });

        test('replace an existing file: the new file part is sent', async ({ page, request }) => {
            await openEditor(page, mode, { record: EXISTING });
            await page.setInputFiles('input[name="logo"]', PDF);
            await expect(page.locator('.file-current-name')).toHaveText('sample.pdf');

            await saveButton(page).click();
            await waitForSaveEvents(page, 1);

            const log = await saveLog(request);
            expect(log[0].files).toHaveLength(1);
            expect(log[0].files[0]).toMatchObject({ field: 'logo', name: 'sample.pdf' });
            expect(log[0].data.logo).toBe('sample.pdf');
            const saved = await page.evaluate(() => fileEvents.find(e => e.type === 'save').record);
            expect(saved.logo).toBe('sample.pdf');
        });

        test('choose a file, Remove: selection discarded, original thumbnail restored, no file part sent', async ({ page, request }) => {
            await openEditor(page, mode, { record: EXISTING });
            await page.setInputFiles('input[name="logo"]', PNG);
            await expect(page.locator('.file-current-name')).toHaveText('sample.png');
            await expect(page.locator('.file-thumb')).toHaveAttribute('src', /^blob:/);

            await page.locator('.file-remove-btn').click();
            await expect(page.locator('.file-current-name')).toHaveText('acme.png');
            await expect(page.locator('.file-thumb')).toHaveAttribute('src', '/api/thumb/7');
            expect(await page.locator('input[name="logo"]').evaluate(i => i.files.length)).toBe(0);

            await saveButton(page).click();
            await waitForSaveEvents(page, 1);
            const log = await saveLog(request);
            expect(log[0].files).toHaveLength(0);
            expect(log[0].data.logo).toBe('acme.png');
        });

        test('large file with a delayed response: the single progress bar shows in the button area, then hides', async ({ page }) => {
            await openEditor(page, mode, { options: { fileProgressMinSize: 1024 * 1024 } });
            await setSaveQuery(page, '?delay=1500');
            await page.setInputFiles('input[name="logo"]', bigFile('large.png', 2 * 1024 * 1024));

            await saveButton(page).click();

            const host = progressHost(page, mode);
            const bar = host.locator('.recedit-upload-progress');
            await expect(bar).toBeVisible();
            await expect(page.locator('.recedit-upload-progress')).toHaveCount(1);
            await expect(bar.locator('progress')).toBeVisible();
            await expect(bar.locator('.recedit-upload-label')).toContainText('Uploading...');
            // sits at the left of the button area (before the button set)
            expect(await bar.evaluate(el => el.parentElement.firstElementChild === el)).toBe(true);

            await waitForSaveEvents(page, 1);
            await expect(bar).toBeHidden();
        });

        test('small file never shows the progress bar', async ({ page }) => {
            await openEditor(page, mode);
            await setSaveQuery(page, '?delay=800');
            await page.setInputFiles('input[name="logo"]', PNG);
            await saveButton(page).click();
            await page.waitForTimeout(400);
            await expect(page.locator('.recedit-upload-progress:visible')).toHaveCount(0);
            await waitForSaveEvents(page, 1);
            await expect(page.locator('.recedit-upload-progress:visible')).toHaveCount(0);
        });

        test('bar hides after a failed save and shows again on a second save', async ({ page, request }) => {
            await openEditor(page, mode, { options: { fileProgressMinSize: 0, clearFormOnSave: false } });
            await page.setInputFiles('input[name="logo"]', bigFile('large.png', 200 * 1024));

            // 1st save: server rejects with 422 after a delay
            await setSaveQuery(page, '?fail=422&delay=1000');
            await saveButton(page).click();
            const bar = progressHost(page, mode).locator('.recedit-upload-progress');
            await expect(bar).toBeVisible();
            await expect(bar).toBeHidden({ timeout: 10_000 });
            await expect(page.locator('.field-error').filter({ hasText: 'Rejected by server' })).toBeVisible();
            await expect(page.locator('.recedit-upload-progress')).toHaveCount(1);

            // 2nd save on the same editor: the bar appears again, then hides
            await setSaveQuery(page, '?delay=1000');
            await saveButton(page).click();
            await expect(bar).toBeVisible();
            await expect(page.locator('.recedit-upload-progress')).toHaveCount(1);
            await waitForSaveEvents(page, 1);
            await expect(bar).toBeHidden();
            expect(await saveLog(request)).toHaveLength(2);
        });

        test('server returns 422 field errors: error shown, selection kept, retry succeeds', async ({ page, request }) => {
            await openEditor(page, mode, { options: { clearFormOnSave: false } });
            await page.setInputFiles('input[name="logo"]', PNG);

            await setSaveQuery(page, '?fail=422');
            await saveButton(page).click();
            const error = page.locator('.field-group[data-field="logo"] .field-error');
            await expect(error).toHaveText('Rejected by server');
            await expect(page.locator('.file-field')).toHaveClass(/field-invalid/);
            await expect(page.locator('.file-current-name')).toHaveText('sample.png');   // selection kept
            await expect(saveButton(page)).toBeEnabled();                                // can retry

            await setSaveQuery(page, '');
            await saveButton(page).click();
            await waitForSaveEvents(page, 1);

            const log = await saveLog(request);
            expect(log).toHaveLength(2);
            expect(log[1].files[0]).toMatchObject({ field: 'logo', name: 'sample.png' });
            await expect(error).toHaveText('');   // cleared by the retry
        });

        test('server returns 413 (HTML body): the "file too large" message is raised', async ({ page }) => {
            await openEditor(page, mode, { options: { clearFormOnSave: false } });
            await page.setInputFiles('input[name="logo"]', PNG);
            await setSaveQuery(page, '?fail=413');
            await saveButton(page).click();
            await page.waitForFunction(() => window.fileNotices.length > 0, null, { timeout: 10_000 });
            const notice = await page.evaluate(() => window.fileNotices[0]);
            expect(notice.type).toBe('error');
            expect(notice.message).toBe('File is too large');
            await expect(saveButton(page)).toBeEnabled();
        });
    });
}

// ─── dialog / inline specifics ──────────────────────────────────────────────

test.describe('file field: dialog behaviour', () => {

    test.beforeEach(async ({ page, request }) => { await gotoHarness(page, request); });

    test('Cancel after choosing a file: no request is made', async ({ page, request }) => {
        await openEditor(page, 'dialog');
        await page.setInputFiles('input[name="logo"]', PNG);
        await cancelButton(page).click();
        await expect(page.locator('.ui-dialog')).toBeHidden();
        await page.waitForTimeout(300);
        expect(await saveLog(request)).toHaveLength(0);
        expect(await page.evaluate(() => fileEvents.map(e => e.type))).toEqual(['cancel']);
    });

    test('Escape during a delayed upload: request aborted, nothing committed, reopening shows a clean form', async ({ page, request }) => {
        test.setTimeout(45_000);
        // ?pre keeps the server from reading the body, so the large upload stays in flight
        await openEditor(page, 'dialog', {
            record: EXISTING,
            logo: { maxFileSize: 200 * 1024 * 1024 },
            options: { fileProgressMinSize: 0 }
        });
        await setSaveQuery(page, '?pre=3000');
        await page.setInputFiles('input[name="logo"]', bigFile('large.png', 40 * 1024 * 1024));
        await page.locator('input[name="name"]').focus();

        // count XMLHttpRequest.abort() calls so the abort is observed directly
        await page.evaluate(() => {
            const orig = XMLHttpRequest.prototype.abort;
            window.__aborts = 0;
            XMLHttpRequest.prototype.abort = function () { window.__aborts++; return orig.apply(this, arguments); };
        });

        await saveButton(page).click();
        const bar = page.locator('.ui-dialog-buttonpane .recedit-upload-progress');
        await expect(bar).toBeVisible();
        expect(await page.evaluate(() => !!fileEditor._activeUpload)).toBe(true);

        // Clicking Save rebuilds the button pane, so focus falls back to <body> and jQuery UI's
        // closeOnEscape (bound to the dialog element) would not see the key. Put focus back inside.
        await page.locator('input[name="name"]').focus();
        await page.keyboard.press('Escape');
        await expect(page.locator('.ui-dialog')).toBeHidden({ timeout: 1500 });   // well before the server's 3 s delay

        // the XHR was aborted by the close handler
        expect(await page.evaluate(() => window.__aborts)).toBe(1);
        expect(await page.evaluate(() => fileEditor._activeUpload)).toBeNull();
        expect(await page.evaluate(() => fileEvents.map(e => e.type))).toEqual(['cancel']);

        // nothing is stored, even after the server's delay has elapsed
        await page.waitForTimeout(3500);
        const log = await saveLog(request);
        expect(log.filter(e => e.status === 200)).toHaveLength(0);

        // reopening shows a clean form
        await setSaveQuery(page, '');
        await page.evaluate(() => fileEditor.open({ record: { id: 7, name: 'Acme', logo: 'acme.png' } }));
        await expect(page.locator('.file-current-name')).toHaveText('acme.png');
        expect(await page.locator('input[name="logo"]').evaluate(i => i.files.length)).toBe(0);
        await expect(page.locator('.recedit-upload-progress:visible')).toHaveCount(0);
        expect(await page.evaluate(() => fileEvents.filter(e => e.type === 'save').length)).toBe(0);
    });

    test('two file fields in one form: one bar, one request containing both files', async ({ page, request }) => {
        await openEditor(page, 'dialog', { twoFiles: true });   // default threshold: 1 MB total
        await setSaveQuery(page, '?delay=1200');
        // each file is below 1 MB, together they are above
        await page.setInputFiles('input[name="logo"]', bigFile('a.png', 600 * 1024));
        await page.setInputFiles('input[name="attachment"]', { name: 'b.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(600 * 1024, 2) });

        await saveButton(page).click();
        await expect(page.locator('.recedit-upload-progress:visible')).toHaveCount(1);
        await waitForSaveEvents(page, 1);

        const log = await saveLog(request);
        expect(log).toHaveLength(1);
        expect(log[0].files.map(f => f.field).sort()).toEqual(['attachment', 'logo']);
        expect(log[0].data.logo).toBe('a.png');
        expect(log[0].data.attachment).toBe('b.bin');
        await expect(page.locator('.recedit-upload-progress:visible')).toHaveCount(0);
    });
});

test.describe('file field: inline form', () => {

    test.beforeEach(async ({ page, request }) => { await gotoHarness(page, request); });

    test('save: state, filename and thumbnail reflect the returned record; form stays open', async ({ page, request }) => {
        await openEditor(page, 'inline', { record: EXISTING, options: { clearFormOnSave: false } });
        await page.setInputFiles('input[name="logo"]', PDF);
        await expect(page.locator('.file-thumb')).toBeHidden();   // a PDF has no local preview

        await saveButton(page).click();
        await waitForSaveEvents(page, 1);

        await expect(page.locator('#file-inline')).toBeVisible();
        await expect(page.locator('.file-current-name')).toHaveText('sample.pdf');
        expect(await page.locator('input[name="logo"]').evaluate(i => i.files.length)).toBe(0);
        const state = await page.evaluate(() => {
            const s = fileEditor.fieldInputs.get('logo').data('fileState');
            return { original: s.original, hasFile: !!s.file, cleared: s.cleared, files: Object.keys(fileEditor.edpak.files) };
        });
        expect(state).toEqual({ original: 'sample.pdf', hasFile: false, cleared: false, files: [] });
        // thumbnail comes from thumbnailUrl again (not the local preview) and is re-requested for the stored file
        await expect(page.locator('.file-thumb')).toHaveAttribute('src', '/api/thumb/7');
        expect((await saveLog(request))).toHaveLength(1);
    });

    test('default clearFormOnSave: the file field is emptied after a save', async ({ page }) => {
        await openEditor(page, 'inline', { record: EXISTING });
        await page.setInputFiles('input[name="logo"]', PNG);
        await saveButton(page).click();
        await waitForSaveEvents(page, 1);
        await expect(page.locator('.file-current')).toBeHidden();
        expect(await page.evaluate(() => fileEditor.getFieldValue('logo'))).toBe('');
    });

    test('Cancel (restoreForm) after choosing a file: no request, original restored', async ({ page, request }) => {
        await openEditor(page, 'inline', { record: EXISTING });
        await page.setInputFiles('input[name="logo"]', PNG);
        await inlineResetButton(page).click();
        await expect(page.locator('.file-current-name')).toHaveText('acme.png');
        expect(await page.locator('input[name="logo"]').evaluate(i => i.files.length)).toBe(0);
        expect(await saveLog(request)).toHaveLength(0);
    });
});

// ─── selection validation and read-only ─────────────────────────────────────

test.describe('file field: validation and read-only', () => {

    test.beforeEach(async ({ page, request }) => { await gotoHarness(page, request); });

    test('disallowed type is rejected on selection: field error, nothing queued', async ({ page, request }) => {
        await openEditor(page, 'dialog');
        await page.setInputFiles('input[name="logo"]', TXT);
        await expect(page.locator('.field-group[data-field="logo"] .field-error')).toHaveText('File type not allowed');
        expect(await page.locator('input[name="logo"]').evaluate(i => i.files.length)).toBe(0);
        expect(await page.evaluate(() => Object.keys(fileEditor._getFileUploads()))).toEqual([]);
        expect(await saveLog(request)).toHaveLength(0);

        // a valid choice clears the message
        await page.setInputFiles('input[name="logo"]', PNG);
        await expect(page.locator('.field-group[data-field="logo"] .field-error')).toHaveText('');
    });

    test('readonly field cannot be changed, and a drop on it is ignored', async ({ page }) => {
        await openEditor(page, 'dialog', { record: EXISTING, logo: { readonly: true } });
        await expect(page.locator('input[name="logo"]')).toBeDisabled();
        await expect(page.locator('.file-remove-btn')).toBeHidden();
        await expect(page.locator('.file-drop-hint')).toHaveCount(0);

        const prevented = await dispatchDrag(page, 'drop', 'logo', { name: 'x.png', type: 'image/png' });
        expect(prevented).toBe(false);
        expect(await page.evaluate(() => fileEditor.getFieldValue('logo'))).toBe('acme.png');
        expect(await page.evaluate(() => Object.keys(fileEditor._getFileUploads()))).toEqual([]);
    });
});

// ─── drag and drop ──────────────────────────────────────────────────────────

test.describe('file field: drag and drop', () => {

    test.beforeEach(async ({ page, request }) => { await gotoHarness(page, request); });

    test('drop highlight, then the dropped file is selected and sent on Save', async ({ page, request }) => {
        await openEditor(page, 'dialog');
        const field = page.locator('.file-field');
        await expect(page.locator('.file-drop-hint')).toHaveText('or drop a file here (image/*, .pdf max size 5M)');

        expect(await dispatchDrag(page, 'dragenter', 'logo', { name: 'dropped.png', type: 'image/png' })).toBe(true);
        await expect(field).toHaveClass(/file-drop-active/);
        await dispatchDrag(page, 'dragover', 'logo', { name: 'dropped.png', type: 'image/png' });
        await dispatchDrag(page, 'dragleave', 'logo', { name: 'dropped.png', type: 'image/png' });
        await expect(field).not.toHaveClass(/file-drop-active/);

        await dispatchDrag(page, 'dragenter', 'logo', { name: 'dropped.png', type: 'image/png' });
        await dispatchDrag(page, 'drop', 'logo', { name: 'dropped.png', type: 'image/png' });
        await expect(field).not.toHaveClass(/file-drop-active/);
        await expect(page.locator('.file-current-name')).toHaveText('dropped.png');
        expect(await page.locator('input[name="logo"]').evaluate(i => i.files[0] && i.files[0].name)).toBe('dropped.png');
        expect(await saveLog(request)).toHaveLength(0);   // still nothing sent

        await saveButton(page).click();
        await waitForSaveEvents(page, 1);
        const log = await saveLog(request);
        expect(log[0].files).toHaveLength(1);
        expect(log[0].files[0]).toMatchObject({ field: 'logo', name: 'dropped.png' });
        expect(log[0].data.logo).toBe('dropped.png');
    });

    test('dropping a disallowed type or an oversized file shows the field error and sends nothing', async ({ page, request }) => {
        await openEditor(page, 'dialog');
        const error = page.locator('.field-group[data-field="logo"] .field-error');

        await dispatchDrag(page, 'drop', 'logo', { name: 'notes.txt', type: 'text/plain' });
        await expect(error).toHaveText('File type not allowed');
        expect(await page.evaluate(() => Object.keys(fileEditor._getFileUploads()))).toEqual([]);

        await dispatchDrag(page, 'drop', 'logo', { name: 'big.png', type: 'image/png', size: 6 * 1024 * 1024 });
        await expect(error).toHaveText('File is too large');
        expect(await page.evaluate(() => Object.keys(fileEditor._getFileUploads()))).toEqual([]);
        await expect(page.locator('.file-field')).toHaveClass(/field-invalid/);

        expect(await saveLog(request)).toHaveLength(0);
    });

    test('drop works in the inline form too', async ({ page }) => {
        await openEditor(page, 'inline');
        await dispatchDrag(page, 'drop', 'logo', { name: 'dropped.pdf', type: 'application/pdf' });
        await expect(page.locator('.file-current-name')).toHaveText('dropped.pdf');
    });
});
