/**
 * Playwright E2E tests — RecEdit dialog (RecEdit class)
 * ======================================================
 * Tests navigate to the Express test-harness page (/) which loads jQuery 4,
 * jQuery UI, and recedit.js from the repo's static-file tree.  No Northwind
 * app or database is required.
 *
 * Each test builds a self-contained editor with a synthetic record and
 * a mock onSave handler so no server data is ever written.
 */

// @ts-check
const { test, expect } = require('@playwright/test');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Navigate to the test harness, wait for jQuery and RecEdit to load, then
 * inject a sandbox <div> that the test editors will be appended to.
 */
async function gotoCustomerPage(page) {
    await page.goto('/');
    // Wait until RecEdit class is available in page context
    await page.waitForFunction(() => typeof RecEdit !== 'undefined', { timeout: 15_000 });
    // Inject an off-screen sandbox div for test dialogs
    await page.evaluate(() => {
        if (!document.getElementById('pw-test-sandbox')) {
            const div = document.createElement('div');
            div.id = 'pw-test-sandbox';
            div.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px';
            document.body.appendChild(div);
        }
    });
}

/** Standard test-editor options injected via page.evaluate() */
const EDITOR_DEFAULTS = {
    modal: false,
    effectDuration: 0,
    showEffect: null,
    hideEffect: null,
    appendTo: '#pw-test-sandbox',
    useJQueryUITheme: false,
};

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('RecEdit — dialog lifecycle', () => {

    test.beforeEach(async ({ page }) => {
        await gotoCustomerPage(page);
    });

    // ── Construction ────────────────────────────────────────────────────────

    test('RecEdit class is defined in page', async ({ page }) => {
        const defined = await page.evaluate(() => typeof RecEdit === 'function');
        expect(defined).toBe(true);
    });

    test('RecEditInlineForm class is defined in page', async ({ page }) => {
        const defined = await page.evaluate(() => typeof RecEditInlineForm === 'function');
        expect(defined).toBe(true);
    });

    test('RecEditCustomDialog class is defined in page', async ({ page }) => {
        const defined = await page.evaluate(() => typeof RecEditCustomDialog === 'function');
        expect(defined).toBe(true);
    });

    // ── Text field open / getFieldValue ─────────────────────────────────────

    test('open(): text field value matches record', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: 'Alice' } });
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('Alice');
    });

    test('open(): empty string record value', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: '' } });
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('');
    });

    test('setFieldValue(): updates field and formdata', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: 'Alice' } });
            await ed.setFieldValue('name', 'Bob');
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('Bob');
    });

    // ── Checkbox ─────────────────────────────────────────────────────────────

    test('Checkbox: true value sets checked state', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } } });
            await ed.open({ record: { active: true } });
            const v = ed.getFieldValue('active');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe(true);
    });

    test('Checkbox: false value leaves unchecked', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } } });
            await ed.open({ record: { active: false } });
            const v = ed.getFieldValue('active');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe(false);
    });

    // ── Select ───────────────────────────────────────────────────────────────

    test('Select: array options — value populated from record', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { s: { label: 'S', type: 'select',
                options: [{ Value: 'new', DisplayText: 'New' }, { Value: 'active', DisplayText: 'Active' }] } } });
            await ed.open({ record: { s: 'active' } });
            const v = ed.getFieldValue('s');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('active');
    });

    test('Select: setFieldValue() changes selection', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { s: { label: 'S', type: 'select',
                options: [{ Value: 'new', DisplayText: 'New' }, { Value: 'active', DisplayText: 'Active' }, { Value: 'closed', DisplayText: 'Closed' }] } } });
            await ed.open({ record: { s: 'new' } });
            await ed.setFieldValue('s', 'closed');
            const v = ed.getFieldValue('s');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('closed');
    });

    // ── _getFormData ─────────────────────────────────────────────────────────

    test('_getFormData(): returns all visible field values', async ({ page }) => {
        const data = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: {
                name:   { label: 'Name',   type: 'text' },
                active: { label: 'Active', type: 'checkbox', checkboxLabel: 'A' },
                id:     { type: 'hidden' }
            }});
            await ed.open({ record: { name: 'Alice', active: true, id: 7 } });
            const d = ed._getFormData();
            ed.destroy();
            return d;
        }, EDITOR_DEFAULTS);
        expect(data.name).toBe('Alice');
        expect(data.active).toBe(true);
        expect(data.id).toBe('7');
    });

    // ── Field errors ─────────────────────────────────────────────────────────

    test('displayFieldErrors(): field-error text visible in DOM', async ({ page }) => {
        // Build editor, display error, snapshot error text via DOM query
        await page.evaluate(async (defaults) => {
            window.__testEd = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await window.__testEd.open({ record: { name: '' } });
            window.__testEd.displayFieldErrors({ fieldErrors: [{ name: 'name', status: 'Value is required' }] });
        }, EDITOR_DEFAULTS);

        const errorText = await page.evaluate(() => {
            const $err = window.__testEd.$form.find('[data-field="name"] .field-error');
            return $err.text();
        });
        expect(errorText).toBe('Value is required');

        await page.evaluate(() => { window.__testEd.destroy(); delete window.__testEd; });
    });

    test('clearFieldErrors(): hides error elements', async ({ page }) => {
        await page.evaluate(async (defaults) => {
            window.__testEd = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await window.__testEd.open({ record: { name: '' } });
            window.__testEd.displayFieldErrors({ fieldErrors: [{ name: 'name', status: 'Required' }] });
            window.__testEd.clearFieldErrors();
        }, EDITOR_DEFAULTS);

        const hidden = await page.evaluate(() => {
            return window.__testEd.$form.find('[data-field="name"] .field-error').is(':hidden');
        });
        expect(hidden).toBe(true);

        await page.evaluate(() => { window.__testEd.destroy(); delete window.__testEd; });
    });

    // ── Show / hide fields ───────────────────────────────────────────────────

    test('hideField(): field-group hidden in DOM', async ({ page }) => {
        await page.evaluate(async (defaults) => {
            window.__testEd = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await window.__testEd.open({ record: { name: 'Alice' } });
            window.__testEd.hideField('name');
        }, EDITOR_DEFAULTS);

        const hidden = await page.evaluate(() => {
            return window.__testEd.$form.find('[data-field="name"]').is(':hidden');
        });
        expect(hidden).toBe(true);

        await page.evaluate(() => { window.__testEd.destroy(); delete window.__testEd; });
    });

    test('showField(): hidden field becomes visible', async ({ page }) => {
        await page.evaluate(async (defaults) => {
            window.__testEd = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text', hidden: true } } });
            await window.__testEd.open({ record: { name: 'Alice' } });
            window.__testEd.showField('name');
        }, EDITOR_DEFAULTS);

        const visible = await page.evaluate(() => {
            return window.__testEd.$form.find('[data-field="name"]').is(':visible');
        });
        expect(visible).toBe(true);

        await page.evaluate(() => { window.__testEd.destroy(); delete window.__testEd; });
    });

    // ── Lifecycle callbacks ──────────────────────────────────────────────────

    test('onBeforeShow: fires after form populated', async ({ page }) => {
        const captured = await page.evaluate(async (defaults) => {
            let val = null;
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } },
                onBeforeShow: (editor) => { val = editor.getFieldValue('name'); }
            });
            await ed.open({ record: { name: 'Alice' } });
            ed.destroy();
            return val;
        }, EDITOR_DEFAULTS);
        expect(captured).toBe('Alice');
    });

    test('onSave: called with edpak containing formdata', async ({ page }) => {
        const formdata = await page.evaluate(async (defaults) => {
            let saved = null;
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } },
                onSave: async (edpak) => { saved = edpak.formdata; }
            });
            await ed.open({ record: { name: 'Alice' } });
            await ed._handleSave();
            ed.destroy();
            return saved;
        }, EDITOR_DEFAULTS);
        expect(formdata).not.toBeNull();
        expect(formdata.name).toBe('Alice');
    });

    test('validateForm: prevents onSave when errors returned', async ({ page }) => {
        const saveCalled = await page.evaluate(async (defaults) => {
            let called = false;
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } },
                validateForm: () => [{ name: 'name', status: 'Required' }],
                onSave: async () => { called = true; }
            });
            await ed.open({ record: { name: '' } });
            await ed._handleSave();
            ed.destroy();
            return called;
        }, EDITOR_DEFAULTS);
        expect(saveCalled).toBe(false);
    });

    test('onCancel: fires on close() without save', async ({ page }) => {
        const cancelled = await page.evaluate(async (defaults) => {
            let fired = false;
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } },
                onCancel: () => { fired = true; }
            });
            await ed.open({ record: { name: 'Alice' } });
            ed.close();
            ed.destroy();
            return fired;
        }, EDITOR_DEFAULTS);
        expect(cancelled).toBe(true);
    });

    // ── Tabs ─────────────────────────────────────────────────────────────────

    test('Tab layout: tab panels created', async ({ page }) => {
        const panelCount = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                tabs: ['Info', 'Address'],
                fields: {
                    name:    { label: 'Name',    type: 'text', tab: 'Info'    },
                    address: { label: 'Address', type: 'text', tab: 'Address' }
                }
            });
            await ed.open({ record: { name: 'Alice', address: '1 Main St' } });
            await new Promise(r => setTimeout(r, 100));
            const count = ed.$form.find('.tab-panel').length;
            ed.destroy();
            return count;
        }, EDITOR_DEFAULTS);
        expect(panelCount).toBe(2);
    });

    test('Tab layout: fields in correct panels', async ({ page }) => {
        const result = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                tabs: ['Info', 'Address'],
                fields: {
                    name:    { label: 'Name',    type: 'text', tab: 'Info'    },
                    address: { label: 'Address', type: 'text', tab: 'Address' }
                }
            });
            await ed.open({ record: { name: 'Alice', address: '1 Main St' } });
            await new Promise(r => setTimeout(r, 100));
            const nameInInfo    = ed.$form.find('#tab-info    [data-field="name"]').length === 1;
            const addrInAddress = ed.$form.find('#tab-address [data-field="address"]').length === 1;
            ed.destroy();
            return { nameInInfo, addrInAddress };
        }, EDITOR_DEFAULTS);
        expect(result.nameInInfo).toBe(true);
        expect(result.addrInAddress).toBe(true);
    });

    // ── Horizontal layout ────────────────────────────────────────────────────

    test('formLayout:horizontal applies field-group-horizontal class', async ({ page }) => {
        const hasClass = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                formLayout: 'horizontal',
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: 'Alice' } });
            const result = ed.$form.find('[data-field="name"]').hasClass('field-group-horizontal');
            ed.destroy();
            return result;
        }, EDITOR_DEFAULTS);
        expect(hasClass).toBe(true);
    });

    // ── Dynamic field props ───────────────────────────────────────────────────

    test('maxFieldLengths dynamic prop overrides maxlength', async ({ page }) => {
        const maxLen = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text', maxLength: 100 } }
            });
            await ed.open({ record: { name: '' } }, null, null, { maxFieldLengths: { name: 25 } });
            const v = ed.fieldInputs.get('name').attr('maxlength');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(maxLen).toBe('25');
    });

    test('requiredFields dynamic prop adds field-required class', async ({ page }) => {
        const hasClass = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: '' } }, null, null, { requiredFields: ['name'] });
            const v = ed.$form.find('[data-field="name"]').hasClass('field-required');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(hasClass).toBe(true);
    });

    // ── Destroy ───────────────────────────────────────────────────────────────

    test('destroy(): $dialog and $form are null after destroy', async ({ page }) => {
        const result = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: 'Alice' } });
            ed.destroy();
            return { dialog: ed.$dialog, form: ed.$form };
        }, EDITOR_DEFAULTS);
        expect(result.dialog).toBeNull();
        expect(result.form).toBeNull();
    });

    test('destroy(): fieldInputs Map is empty', async ({ page }) => {
        const size = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: 'Alice' } });
            ed.destroy();
            return ed.fieldInputs.size;
        }, EDITOR_DEFAULTS);
        expect(size).toBe(0);
    });

    // ── Multiple open() calls ─────────────────────────────────────────────────

    test('Second open() repopulates with new record', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { name: { label: 'Name', type: 'text' } } });
            await ed.open({ record: { name: 'Alice' } });
            await ed.open({ record: { name: 'Bob' } });
            const v = ed.getFieldValue('name');
            ed.destroy();
            return v;
        }, EDITOR_DEFAULTS);
        expect(value).toBe('Bob');
    });

    // ── _formatDate ───────────────────────────────────────────────────────────

    test('_formatDate: yyyy-mm-dd format', async ({ page }) => {
        const result = await page.evaluate(() => {
            const ed = new RecEdit();
            const v = ed._formatDate(new Date(2024, 0, 15), 'yyyy-mm-dd');
            ed.destroy();
            return v;
        });
        expect(result).toBe('2024-01-15');
    });

    test('_formatDate: dd/mm/yyyy format', async ({ page }) => {
        const result = await page.evaluate(() => {
            const ed = new RecEdit();
            const v = ed._formatDate(new Date(2024, 11, 5), 'dd/mm/yyyy');
            ed.destroy();
            return v;
        });
        expect(result).toBe('05/12/2024');
    });

    // ── _normalizeTabs ────────────────────────────────────────────────────────

    test('_normalizeTabs: string array normalised correctly', async ({ page }) => {
        const result = await page.evaluate(() => {
            const ed = new RecEdit();
            const tabs = ed._normalizeTabs(['Info', 'Address', 'Contact Info']);
            ed.destroy();
            return tabs;
        });
        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('info');
        expect(result[2].id).toBe('contact-info');
    });

    // ── _triggerNotice ────────────────────────────────────────────────────────

    test('_triggerNotice: fires recedit-notice jQuery event', async ({ page }) => {
        const received = await page.evaluate(() => {
            let captured = null;
            $(document).one('recedit-notice', (e, notice) => { captured = notice; });
            const ed = new RecEdit();
            ed._triggerNotice({ type: 'error', title: 'Test', message: 'msg' });
            ed.destroy();
            return captured;
        });
        expect(received).toMatchObject({ type: 'error', title: 'Test', message: 'msg' });
    });
});


test.describe('RecEdit — jQuery UI theme enabled', () => {

    test.beforeEach(async ({ page }) => {
        await gotoCustomerPage(page);
    });

    const JQ_DEFAULTS = {
        modal: false,
        effectDuration: 0,
        showEffect: null,
        hideEffect: null,
        appendTo: '#pw-test-sandbox',
        useJQueryUITheme: true,  // enables selectmenu, spinner, etc.
    };

    test('Select with jQuery UI theme: value populated', async ({ page }) => {
        const value = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: { s: { label: 'S', type: 'select',
                options: [{ Value: 'a', DisplayText: 'Alpha' }, { Value: 'b', DisplayText: 'Beta' }] } } });
            await ed.open({ record: { s: 'b' } });
            await new Promise(r => setTimeout(r, 200));  // wait for selectmenu init
            const v = ed.getFieldValue('s');
            ed.destroy();
            return v;
        }, JQ_DEFAULTS);
        expect(value).toBe('b');
    });

    test('Dialog title applied when useJQueryUITheme=true', async ({ page }) => {
        const title = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults,
                dialogTitle: 'My Editor',
                fields: { name: { label: 'Name', type: 'text' } }
            });
            await ed.open({ record: { name: 'Alice' } });
            const t = ed.$dialog.dialog('option', 'title');
            ed.destroy();
            return t;
        }, JQ_DEFAULTS);
        expect(title).toBe('My Editor');
    });

    test('Checkbox: theme uses checkboxradio and clicking the row label toggles it', async ({ page }) => {
        const result = await page.evaluate(async (defaults) => {
            const ed = new RecEdit({ ...defaults, fields: {
                active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' }
            } });
            await ed.open({ record: { active: false } });
            await new Promise(r => setTimeout(r, 100));
            const $w = ed.fieldInputs.get('active');
            const $input = $w.find('input[type="checkbox"]');
            const $label = $w.find('label');
            const before = {
                widget: !!$input.data('ui-checkboxradio'),
                labelThemed: $label.hasClass('ui-checkboxradio-label'),
                labelActive: $label.hasClass('ui-state-active')
            };
            $label[0].click();
            await new Promise(r => setTimeout(r, 50));
            const after = {
                checked: $input.prop('checked'),
                labelActive: $label.hasClass('ui-state-active'),
                value: ed.getFieldValue('active')
            };
            ed.destroy();
            return { before, after };
        }, JQ_DEFAULTS);
        expect(result.before.widget).toBe(true);
        expect(result.before.labelThemed).toBe(true);
        expect(result.before.labelActive).toBe(false);
        expect(result.after.checked).toBe(true);
        expect(result.after.labelActive).toBe(true);
        expect(result.after.value).toBe(true);
    });

    test('Save button: label becomes Saving... during the save and is restored', async ({ page }) => {
        await page.evaluate(async (defaults) => {
            window.__resolveSave = null;
            const ed = new RecEdit({ ...defaults,
                fields: { name: { label: 'Name', type: 'text' } },
                onSave: () => new Promise((resolve) => { window.__resolveSave = resolve; })
            });
            await ed.open({ record: { name: 'Alice' } });
            window.__saveEditor = ed;
            ed._handleSave();   // intentionally not awaited — onSave stays pending
        }, JQ_DEFAULTS);

        const saveBtn = page.locator('.ui-dialog-buttonpane button.ui-button-primary');
        await expect(saveBtn).toContainText('Saving...');
        await expect(saveBtn).toBeDisabled();
        expect(await saveBtn.locator('.ui-icon-check').count()).toBe(1);

        await page.evaluate(() => window.__resolveSave('saved'));
        await page.waitForFunction(() => {
            const b = document.querySelector('.ui-dialog-buttonpane button.ui-button-primary');
            return b && b.textContent.trim() === 'Save' && !b.disabled;
        });
        await page.evaluate(() => { window.__saveEditor.destroy(); delete window.__saveEditor; delete window.__resolveSave; });
    });
});
