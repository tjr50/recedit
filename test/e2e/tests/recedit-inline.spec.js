/**
 * Playwright E2E tests — RecEditInlineForm & RecEditCustomDialog
 * ==============================================================
 * Tests navigate to the Express test-harness page (/) which loads jQuery 4,
 * jQuery UI, and recedit.js from the repo's static-file tree.  No Northwind
 * app or database is required.
 *
 * The "Live /orderdetail page" tests use a stub /orderdetail route served by
 * the same Express server that pre-initialises window.orderdetailTVars.editor
 * as a RecEditInlineForm instance.
 */

// @ts-check
const { test, expect } = require('@playwright/test');

// ─── helpers ────────────────────────────────────────────────────────────────

async function gotoCustomerPage(page) {
    await page.goto('/');
    await page.waitForFunction(() => typeof RecEdit !== 'undefined', { timeout: 15_000 });
    await page.evaluate(() => {
        if (!document.getElementById('pw-test-sandbox')) {
            const div = document.createElement('div');
            div.id = 'pw-test-sandbox';
            div.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px';
            document.body.appendChild(div);
        }
    });
}

/** Create a container with data-field placeholders inside #pw-test-sandbox */
async function createContainer(page, fieldNames) {
    return page.evaluate((names) => {
        const sandbox = document.getElementById('pw-test-sandbox');
        const c = document.createElement('div');
        c.id = 'pw-inline-' + Date.now();
        names.forEach(name => {
            const p = document.createElement('div');
            p.dataset.field = name;
            c.appendChild(p);
        });
        sandbox.appendChild(c);
        return c.id;
    }, fieldNames);
}

/** Create a hidden container for RecEditCustomDialog */
async function createHiddenContainer(page, fieldNames) {
    return page.evaluate((names) => {
        const sandbox = document.getElementById('pw-test-sandbox');
        const c = document.createElement('div');
        c.id = 'pw-custom-' + Date.now();
        c.style.display = 'none';
        names.forEach(name => {
            const p = document.createElement('div');
            p.dataset.field = name;
            c.appendChild(p);
        });
        sandbox.appendChild(c);
        return c.id;
    }, fieldNames);
}

const INLINE_DEFAULTS = {
    effectDuration: 0,
    useJQueryUITheme: false,
};

const DIALOG_DEFAULTS = {
    modal: false,
    effectDuration: 0,
    showEffect: null,
    hideEffect: null,
    appendTo: '#pw-test-sandbox',
    useJQueryUITheme: false,
};

// ─── RecEditInlineForm ───────────────────────────────────────────────────────

test.describe('RecEditInlineForm', () => {

    test.beforeEach(async ({ page }) => {
        await gotoCustomerPage(page);
    });

    test('Constructor: isInitialized = true immediately', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const result = await page.evaluate(({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            const v = ed.isInitialized;
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(result).toBe(true);
    });

    test('Constructor: fieldInputs populated without load()', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const size = await page.evaluate(({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            const s = ed.fieldInputs.size;
            ed.destroy();
            return s;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(size).toBe(1);
    });

    test('Constructor: throws without container option', async ({ page }) => {
        const threw = await page.evaluate(() => {
            try { new RecEditInlineForm({ fields: {} }); return false; }
            catch (e) { return /container.*required/i.test(e.message); }
        });
        expect(threw).toBe(true);
    });

    test('load(): populates text field from record', async ({ page }) => {
        const containerId = await createContainer(page, ['name', 'notes']);
        const values = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: {
                    name:  { label: 'Name',  type: 'text'     },
                    notes: { label: 'Notes', type: 'textarea' }
                }
            });
            await ed.load({ record: { name: 'Alice', notes: 'Hi there' } });
            const v = { name: ed.getFieldValue('name'), notes: ed.getFieldValue('notes') };
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(values.name).toBe('Alice');
        expect(values.notes).toBe('Hi there');
    });

    test('load(): second call repopulates with new record', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const value = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.load({ record: { name: 'Alice' } });
            await ed.load({ record: { name: 'Bob'   } });
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(value).toBe('Bob');
    });

    test('load(): onBeforeShow fires with populated form', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const captured = await page.evaluate(async ({ cid, defaults }) => {
            let val = null;
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } },
                onBeforeShow: (editor) => { val = editor.getFieldValue('name'); }
            });
            await ed.load({ record: { name: 'Alice' } });
            ed.destroy();
            return val;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(captured).toBe('Alice');
    });

    test('Save and Reset buttons injected into container', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const counts = await page.evaluate(({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            const save  = document.querySelector('#' + cid + ' .recedit-save-btn')  ? 1 : 0;
            const reset = document.querySelector('#' + cid + ' .recedit-reset-btn') ? 1 : 0;
            ed.destroy();
            return { save, reset };
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(counts.save).toBe(1);
        expect(counts.reset).toBe(1);
    });

    test('Theme: checkbox gets the checkboxradio widget in the inline form', async ({ page }) => {
        const containerId = await createContainer(page, ['active']);
        const result = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                useJQueryUITheme: true,
                fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } }
            });
            await ed.load({ record: { active: true } });
            await new Promise(r => setTimeout(r, 100));
            const $w = ed.fieldInputs.get('active');
            const r = {
                widget: !!$w.find('input[type="checkbox"]').data('ui-checkboxradio'),
                labelActive: $w.find('label').hasClass('ui-state-active')
            };
            ed.destroy();
            return r;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(result.widget).toBe(true);
        expect(result.labelActive).toBe(true);
    });

    test('_setButtonsSaving: label changes to Saving... and the check icon survives', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const result = await page.evaluate(({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            ed._setButtonsSaving();
            const during = {
                text: ed.$saveBtn.text().trim(),
                disabled: ed.$saveBtn.prop('disabled'),
                icon: ed.$saveBtn.find('.ui-icon-check').length
            };
            ed._setButtonsNormal();
            const after = {
                text: ed.$saveBtn.text().trim(),
                disabled: ed.$saveBtn.prop('disabled'),
                icon: ed.$saveBtn.find('.ui-icon-check').length
            };
            ed.destroy();
            return { during, after };
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(result.during.text).toBe('Saving...');
        expect(result.during.disabled).toBe(true);
        expect(result.during.icon).toBe(1);
        expect(result.after.text).toBe('Save');
        expect(result.after.disabled).toBe(false);
        expect(result.after.icon).toBe(1);
    });

    test('close(): container element remains visible', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        await page.evaluate(async ({ cid, defaults }) => {
            window.__inlineEd = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await window.__inlineEd.load({ record: { name: 'Alice' } });
            window.__inlineEd.close();
        }, { cid: containerId, defaults: INLINE_DEFAULTS });

        const isHidden = await page.evaluate((cid) => {
            const el = document.getElementById(cid);
            return el ? (el.style.display === 'none' || !el.offsetParent) : true;
        }, containerId);
        expect(isHidden).toBe(false);

        await page.evaluate(() => { window.__inlineEd.destroy(); delete window.__inlineEd; });
    });

    test('displayFieldErrors(): error shown inside inline container', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        await page.evaluate(async ({ cid, defaults }) => {
            window.__inlineEd = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await window.__inlineEd.load({ record: { name: '' } });
            window.__inlineEd.displayFieldErrors({ fieldErrors: [{ name: 'name', status: 'Name is required' }] });
        }, { cid: containerId, defaults: INLINE_DEFAULTS });

        const errorText = await page.evaluate(() => {
            const $err = window.__inlineEd.$form.find('[data-field="name"] .field-error');
            return $err.text();
        });
        expect(errorText).toBe('Name is required');

        await page.evaluate(() => { window.__inlineEd.destroy(); delete window.__inlineEd; });
    });

    test('clearFormOnSave=true: fields cleared after _afterSave()', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const value = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                clearFormOnSave: true,
                fields: { name: { label: 'Name', type: 'text', defaultValue: '' } }
            });
            await ed.load({ record: { name: 'Alice' } });
            await ed._afterSave();
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(value).toBe('');
    });

    test('clearFormOnSave=false: fields retained after _afterSave()', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const value = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                clearFormOnSave: false,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.load({ record: { name: 'Alice' } });
            await ed._afterSave();
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(value).toBe('Alice');
    });

    test('destroy(): placeholder contents cleared', async ({ page }) => {
        const containerId = await createContainer(page, ['name']);
        const childCount = await page.evaluate(({ cid, defaults }) => {
            const ed = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            ed.destroy();
            const placeholder = document.querySelector('#' + cid + ' [data-field="name"]');
            return placeholder ? placeholder.children.length : -1;
        }, { cid: containerId, defaults: INLINE_DEFAULTS });
        expect(childCount).toBe(0);
    });

    test('titleSelector: title element text updated by load()', async ({ page }) => {
        // Add a title element to the container
        const containerId = await createContainer(page, ['name']);
        await page.evaluate((cid) => {
            const h3 = document.createElement('h3');
            h3.className = 'pw-test-title';
            document.getElementById(cid).prepend(h3);
        }, containerId);

        await page.evaluate(async ({ cid, defaults }) => {
            window.__inlineEd = new RecEditInlineForm({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } },
                titleSelector: '.pw-test-title',
                dialogTitle: 'My Inline Form'
            });
            await window.__inlineEd.load({ record: { name: '' } });
        }, { cid: containerId, defaults: INLINE_DEFAULTS });

        const titleText = await page.evaluate((cid) => {
            return document.querySelector('#' + cid + ' .pw-test-title').textContent;
        }, containerId);
        expect(titleText).toBe('My Inline Form');

        await page.evaluate(() => { window.__inlineEd.destroy(); delete window.__inlineEd; });
    });

    // ── Live /orderdetail page ─────────────────────────────────────────────

    test.describe('Live /orderdetail page — RecEditInlineForm from app', () => {

        test('RecEditInlineForm container #orderdetail-editor exists in DOM', async ({ page }) => {
            await page.goto('/orderdetail');
            await page.waitForFunction(() => typeof RecEditInlineForm !== 'undefined', { timeout: 15_000 });
            const exists = await page.locator('#orderdetail-editor').count();
            expect(exists).toBe(1);
        });

        test('orderdetailTVars.editor is a RecEditInlineForm instance', async ({ page }) => {
            await page.goto('/orderdetail');
            // Wait for the initTable → load_orderdetail_TableAndEditor sequence to complete
            await page.waitForFunction(
                () => typeof orderdetailTVars !== 'undefined' && orderdetailTVars.editor instanceof RecEditInlineForm,
                { timeout: 20_000 }
            );
            const isInstance = await page.evaluate(
                () => orderdetailTVars.editor instanceof RecEditInlineForm
            );
            expect(isInstance).toBe(true);
        });

        test('App editor: load() populates fields from synthetic record', async ({ page }) => {
            await page.goto('/orderdetail');
            await page.waitForFunction(
                () => typeof orderdetailTVars !== 'undefined' && orderdetailTVars.editor instanceof RecEditInlineForm,
                { timeout: 20_000 }
            );
            const values = await page.evaluate(async () => {
                const ed = orderdetailTVars.editor;
                await ed.load({ record: { orderid: 10248, productid: 11, productname: 'Queso Cabrales', unitprice: 14, quantity: 12, discount: 0, pkid: '10248-11' } });
                return {
                    orderid: ed.getFieldValue('orderid'),
                    unitprice: ed.getFieldValue('unitprice'),
                    quantity: ed.getFieldValue('quantity')
                };
            });
            expect(values.orderid).toBe('10248');
            expect(values.unitprice).toBe('14');
            expect(values.quantity).toBe('12');
        });
    });
});


// ─── RecEditCustomDialog ─────────────────────────────────────────────────────

test.describe('RecEditCustomDialog', () => {

    test.beforeEach(async ({ page }) => {
        await gotoCustomerPage(page);
    });

    test('Constructor: throws without container', async ({ page }) => {
        const threw = await page.evaluate(() => {
            try { new RecEditCustomDialog({ fields: {} }); return false; }
            catch (e) { return /container.*required/i.test(e.message); }
        });
        expect(threw).toBe(true);
    });

    test('open(): injects inputs into data-field placeholders', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['name', 'email']);
        const values = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                fields: {
                    name:  { label: 'Name',  type: 'text' },
                    email: { label: 'Email', type: 'text' }
                }
            });
            await ed.open({ record: { name: 'Alice', email: 'alice@example.com' } });
            const v = { name: ed.getFieldValue('name'), email: ed.getFieldValue('email') };
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(values.name).toBe('Alice');
        expect(values.email).toBe('alice@example.com');
    });

    test('open(): placeholder has field-group CSS class', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['name']);
        const hasClass = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: 'Alice' } });
            const result = ed.$form.find('[data-field="name"]').hasClass('field-group');
            ed.destroy();
            return result;
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(hasClass).toBe(true);
    });

    test('displayFieldErrors(): shown inside custom layout', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['name']);
        const errorText = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: '' } });
            ed.displayFieldErrors({ fieldErrors: [{ name: 'name', status: 'Required' }] });
            const text = ed.$form.find('[data-field="name"] .field-error').text();
            ed.destroy();
            return text;
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(errorText).toBe('Required');
    });

    test('second open(): re-injects updated values', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['name']);
        const value = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: 'Alice' } });
            await ed.open({ record: { name: 'Bob' } });
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(value).toBe('Bob');
    });

    test('warning logged for unknown data-field placeholder', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['name']); // no 'extra' placeholder
        const warned = await page.evaluate(async ({ cid, defaults }) => {
            const warnings = [];
            const origWarn = console.warn;
            console.warn = (msg) => warnings.push(msg);
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                fields: {
                    name:  { label: 'Name',  type: 'text' },
                    extra: { label: 'Extra', type: 'text' }
                }
            });
            await ed.open({ record: { name: 'Alice', extra: 'x' } });
            console.warn = origWarn;
            ed.destroy();
            return warnings.some(w => /extra/i.test(w));
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(warned).toBe(true);
    });

    test('Theme: checkbox gets the checkboxradio widget in the custom dialog', async ({ page }) => {
        const containerId = await createHiddenContainer(page, ['active']);
        const result = await page.evaluate(async ({ cid, defaults }) => {
            const ed = new RecEditCustomDialog({ ...defaults,
                container: '#' + cid,
                useJQueryUITheme: true,
                fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } }
            });
            await ed.open({ record: { active: true } });
            await new Promise(r => setTimeout(r, 100));
            const $w = ed.fieldInputs.get('active');
            const r = {
                widget: !!$w.find('input[type="checkbox"]').data('ui-checkboxradio'),
                labelActive: $w.find('label').hasClass('ui-state-active')
            };
            ed.destroy();
            return r;
        }, { cid: containerId, defaults: DIALOG_DEFAULTS });
        expect(result.widget).toBe(true);
        expect(result.labelActive).toBe(true);
    });
});
