/**
 * RecEdit QUnit Test Suite
 * ========================
 * Covers RecEdit, RecEditInlineForm and RecEditCustomDialog defined in recedit.js.
 *
 * Test organisation
 * -----------------
 *  1.  Constructor & Defaults
 *  2.  Text & Textarea Fields
 *  3.  Checkbox & RadioGroup Fields
 *  4.  Select / Dropdown Fields
 *  5.  Date Fields & _formatDate()
 *  6.  Hidden Fields
 *  7.  Slider & Spinner Fields
 *  8.  Password, htmldiv & Autocomplete
 *  9.  Form Data (_getFormData / setFieldValues)
 * 10.  Field Errors (displayFieldErrors / clearFieldErrors)
 * 11.  Show / Hide Fields
 * 12.  Lifecycle Callbacks (onBeforeShow, onAfterShow, onCancel, onSave, validateForm, onInit)
 * 13.  Dynamic Field Props (maxFieldLengths, requiredFields, fieldLabels)
 * 14.  defaultValue & getValue / dataFunction
 * 15.  Label, Required & omitLabel config
 * 16.  Character Counter (showCounter)
 * 17.  Tab Layout (_normalizeTabs, field placement, activateTab)
 * 18.  Horizontal Layout & Field Grouping
 * 19.  Dialog Title (dialogTitle / customTitle)
 * 20.  Custom Buttons
 * 21.  _triggerNotice
 * 22.  Multiple open() calls (re-use)
 * 23.  Destroy
 * 24.  RecEditInlineForm
 * 25.  RecEditCustomDialog
 * 26.  File Field (type: 'file') - rendering, state, validation, progress bar, submit(), abort, drag and drop
 * 27.  Read-only fields (all field types, readonly / readOnly / disabled)
 */

'use strict';

// ============================================================
// Global helpers
// ============================================================

/**
 * Build a RecEdit instance with test-friendly defaults:
 *   modal:          false  – no overlay blocking QUnit UI
 *   effectDuration: 0      – instant show/hide, no animation
 *   showEffect:     null   – skip jQuery UI fade
 *   hideEffect:     null
 *   appendTo:  '#test-sandbox' – dialogs are rendered off-screen
 *   useJQueryUITheme: false – avoids selectmenu/spinner setTimeout races
 *                            (set to true in tests that specifically need widgets)
 */
function makeEditor(options) {
    return new RecEdit(Object.assign({
        modal: false,
        effectDuration: 0,
        showEffect: null,
        hideEffect: null,
        appendTo: '#test-sandbox',
        useJQueryUITheme: false
    }, options || {}));
}

/** Silently destroy an editor, swallowing any cleanup errors. */
function safeDestroy(editor) {
    try { if (editor) editor.destroy(); } catch (_) { /* ignore */ }
}

/** Promisified setTimeout — waits `ms` milliseconds. */
function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Standard select options array used across multiple tests. */
var SELECT_OPTIONS = [
    { Value: 'new',    DisplayText: 'New'    },
    { Value: 'active', DisplayText: 'Active' },
    { Value: 'closed', DisplayText: 'Closed' }
];


// ============================================================
// 1. Constructor & Defaults
// ============================================================
QUnit.module('1. Constructor & Defaults', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('RecEdit is a class (constructor creates instance)', function (assert) {
        ed = new RecEdit();
        assert.ok(ed instanceof RecEdit, 'instance of RecEdit');
    });

    QUnit.test('Default modal = true', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.modal, true, 'modal defaults to true');
    });

    QUnit.test('Default formLayout = vertical', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.formLayout, 'vertical', 'formLayout = vertical');
    });

    QUnit.test('Default dialogWidth = 600', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.dialogWidth, 600, 'dialogWidth = 600');
    });

    QUnit.test('Default effectDuration = 200', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.effectDuration, 200, 'effectDuration = 200');
    });

    QUnit.test('Default labelWidth = 150px', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.labelWidth, '150px', 'labelWidth = 150px');
    });

    QUnit.test('Default useJQueryUITheme = true', function (assert) {
        ed = new RecEdit();
        assert.equal(ed.options.useJQueryUITheme, true, 'useJQueryUITheme = true');
    });

    QUnit.test('Options merged with defaults', function (assert) {
        ed = new RecEdit({ dialogWidth: 800, modal: false });
        assert.equal(ed.options.dialogWidth, 800, 'dialogWidth overridden to 800');
        assert.equal(ed.options.modal, false, 'modal overridden to false');
        assert.equal(ed.options.formLayout, 'vertical', 'formLayout still at default');
    });

    QUnit.test('Custom messages option', function (assert) {
        ed = new RecEdit({ messages: { save: 'Submit', cancel: 'Discard' } });
        assert.equal(ed.options.messages.save,   'Submit',  'save label overridden');
        assert.equal(ed.options.messages.cancel, 'Discard', 'cancel label overridden');
    });

    QUnit.test('isInitialized is false before open()', function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        assert.equal(ed.isInitialized, false, 'isInitialized = false before open');
    });

    QUnit.test('isInitialized is true after open()', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'x' } });
        assert.equal(ed.isInitialized, true, 'isInitialized = true after open');
    });

    QUnit.test('fieldInputs is an empty Map on construction', function (assert) {
        ed = new RecEdit();
        assert.ok(ed.fieldInputs instanceof Map, 'fieldInputs is a Map');
        assert.equal(ed.fieldInputs.size, 0, 'fieldInputs is empty');
    });
});


// ============================================================
// 2. Text & Textarea Fields
// ============================================================
QUnit.module('2. Text & Textarea Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Text: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.getFieldValue('name'), 'Alice', 'value = Alice');
    });

    QUnit.test('Text: empty string record value', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.getFieldValue('name'), '', 'value = empty string');
    });

    QUnit.test('Text: undefined record key yields empty string', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: {} });
        assert.equal(ed.getFieldValue('name'), '', 'value = empty string for missing key');
    });

    QUnit.test('Text: maxLength attribute applied', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', maxLength: 50 } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.fieldInputs.get('name').attr('maxlength'), '50', 'maxlength = 50');
    });

    QUnit.test('Text: setFieldValue() updates value', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        await ed.setFieldValue('name', 'Bob');
        assert.equal(ed.getFieldValue('name'), 'Bob', 'value updated to Bob');
    });

    QUnit.test('Text: readonly attribute applied', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', readonly: true } } });
        await ed.open({ record: { name: 'Alice' } });
        var $i = ed.fieldInputs.get('name');
        assert.ok($i.is('[readonly]'), 'readonly attribute present');
        assert.ok($i.hasClass('readonly-field'), 'readonly-field class present');
    });

    QUnit.test('Textarea: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { notes: { label: 'Notes', type: 'textarea', rows: 3 } } });
        await ed.open({ record: { notes: 'Some notes' } });
        assert.equal(ed.getFieldValue('notes'), 'Some notes', 'textarea value = Some notes');
    });

    QUnit.test('Textarea: rows attribute applied', async function (assert) {
        ed = makeEditor({ fields: { notes: { label: 'Notes', type: 'textarea', rows: 5 } } });
        await ed.open({ record: { notes: '' } });
        assert.equal(ed.fieldInputs.get('notes').attr('rows'), '5', 'rows = 5');
    });

    QUnit.test('Textarea: setFieldValue() updates value', async function (assert) {
        ed = makeEditor({ fields: { notes: { label: 'Notes', type: 'textarea' } } });
        await ed.open({ record: { notes: 'Original' } });
        await ed.setFieldValue('notes', 'Updated');
        assert.equal(ed.getFieldValue('notes'), 'Updated', 'textarea updated');
    });

    QUnit.test('Text: placeholder attribute applied', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', placeholder: 'Enter name' } } });
        await ed.open({ record: {} });
        assert.equal(ed.fieldInputs.get('name').attr('placeholder'), 'Enter name', 'placeholder set');
    });
});


// ============================================================
// 3. Checkbox & RadioGroup Fields
// ============================================================
QUnit.module('3. Checkbox & RadioGroup Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    function checkboxEditor() {
        return makeEditor({ fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } } });
    }

    QUnit.test('Checkbox: true value sets checked state', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: true } });
        assert.equal(ed.getFieldValue('active'), true, 'checkbox = true');
    });

    QUnit.test('Checkbox: false value unsets checked state', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: false } });
        assert.equal(ed.getFieldValue('active'), false, 'checkbox = false');
    });

    QUnit.test('Checkbox: falsy 0 value yields false', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: 0 } });
        assert.equal(ed.getFieldValue('active'), false, 'checkbox = false for 0');
    });

    QUnit.test('Checkbox: setFieldValue(true) checks the box', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: false } });
        await ed.setFieldValue('active', true);
        assert.equal(ed.getFieldValue('active'), true, 'checked after setFieldValue(true)');
    });

    QUnit.test('Checkbox: container element has checkbox-container class', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: false } });
        assert.ok(ed.fieldInputs.get('active').hasClass('checkbox-container'), 'checkbox-container class');
    });

    QUnit.test('RadioGroup: correct radio checked from record value', async function (assert) {
        ed = makeEditor({ fields: { role: {
            label: 'Role', type: 'radiogroup',
            options: [{ Value: 'admin', DisplayText: 'Admin' }, { Value: 'user', DisplayText: 'User' }]
        }}});
        await ed.open({ record: { role: 'user' } });
        await wait(60);  // buildRadios() is async
        assert.equal(ed.getFieldValue('role'), 'user', 'radiogroup = user');
    });

    QUnit.test('RadioGroup: undefined value yields null', async function (assert) {
        ed = makeEditor({ fields: { role: {
            label: 'Role', type: 'radiogroup',
            options: [{ Value: 'admin', DisplayText: 'Admin' }, { Value: 'user', DisplayText: 'User' }]
        }}});
        await ed.open({ record: {} });
        await wait(60);
        assert.equal(ed.getFieldValue('role'), null, 'radiogroup = null when nothing selected');
    });

    // ---- jQuery UI checkboxradio theming (0.1.3) ---------------------------

    QUnit.test('Theme: checkbox and checkboxradio both get the ui.checkboxradio widget', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: {
            a: { label: 'A', type: 'checkbox',      checkboxLabel: 'A' },
            b: { label: 'B', type: 'checkboxradio', checkboxLabel: 'B' }
        }});
        await ed.open({ record: { a: true, b: false } });
        await wait(50);
        var $a = ed.fieldInputs.get('a').find('input[type="checkbox"]');
        var $b = ed.fieldInputs.get('b').find('input[type="checkbox"]');
        assert.ok($a.data('ui-checkboxradio'), 'checkbox themed with checkboxradio');
        assert.ok($b.data('ui-checkboxradio'), 'checkboxradio themed with checkboxradio');
        assert.ok($a.next('label').hasClass('ui-checkboxradio-label'), 'label carries checkboxradio classes');
    });

    QUnit.test('Theme: checked state adds ui-state-active and ui-icon-check; refresh syncs', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { a: { label: 'A', type: 'checkbox', checkboxLabel: 'A' } } });
        await ed.open({ record: { a: true } });
        await wait(50);
        var $label = ed.fieldInputs.get('a').find('label');
        assert.ok($label.hasClass('ui-state-active'), 'checked label is active');
        assert.ok($label.find('.ui-checkboxradio-icon').hasClass('ui-icon-check'), 'check icon shown');
        await ed.setFieldValue('a', false);
        assert.notOk($label.hasClass('ui-state-active'), 'unchecked label is not active');
        assert.ok($label.find('.ui-checkboxradio-icon').hasClass('ui-icon-blank'), 'blank icon shown');
    });

    QUnit.test('Theme: radiogroup radios (async function options) are themed and checked label active', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { role: {
            label: 'Role', type: 'radiogroup',
            options: function () {
                return Promise.resolve([
                    { Value: 'admin', DisplayText: 'Admin' },
                    { Value: 'user',  DisplayText: 'User'  }
                ]);
            }
        }}});
        await ed.open({ record: { role: 'user' } });
        await wait(120);
        var $radios = ed.fieldInputs.get('role').find('input[type="radio"]');
        assert.equal($radios.length, 2, 'two radios rendered');
        assert.ok($radios.eq(0).data('ui-checkboxradio') && $radios.eq(1).data('ui-checkboxradio'), 'both radios themed');
        await ed.setFieldValue('role', 'user');
        assert.ok($radios.eq(1).next('label').hasClass('ui-state-active'), 'checked radio label is active');
    });

    QUnit.test('Theme: _initializeCheckboxRadios is idempotent and skips inputs without a label', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { a: { label: 'A', type: 'checkbox', checkboxLabel: 'A' } } });
        await ed.open({ record: { a: false } });
        await wait(50);
        var $label = ed.fieldInputs.get('a').find('label');
        var iconCount = $label.find('.ui-checkboxradio-icon').length;
        ed._initializeCheckboxRadios();
        assert.equal($label.find('.ui-checkboxradio-icon').length, iconCount, 'no duplicate widget markup');
        var $orphan = $('<input>', { type: 'checkbox' }).appendTo(ed.$form);
        ed._initializeCheckboxRadios();
        assert.notOk($orphan.data('ui-checkboxradio'), 'input without a label skipped');
        $orphan.remove();
    });

    QUnit.test('Theme: useJQueryUITheme:false leaves checkboxes unthemed', async function (assert) {
        ed = checkboxEditor();
        await ed.open({ record: { active: true } });
        assert.notOk(ed.fieldInputs.get('active').find('input').data('ui-checkboxradio'), 'no checkboxradio widget');
        assert.equal(ed.fieldInputs.get('active').find('.ui-checkboxradio-icon').length, 0, 'no widget markup');
    });
});


// ============================================================
// 4. Select / Dropdown Fields
// ============================================================
QUnit.module('4. Select / Dropdown Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Select: array options rendered (+1 blank)', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'new' } });
        assert.equal(ed.fieldInputs.get('s').find('option').length, 4, '3 + 1 blank = 4 options');
    });

    QUnit.test('Select: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'active' } });
        assert.equal(ed.getFieldValue('s'), 'active', 'selected = active');
    });

    QUnit.test('Select: setFieldValue() changes selection', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'new' } });
        await ed.setFieldValue('s', 'closed');
        assert.equal(ed.getFieldValue('s'), 'closed', 'selected = closed');
    });

    QUnit.test('Select: object options format (key-value pairs)', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: { new: 'New', active: 'Active' } } } });
        await ed.open({ record: { s: 'new' } });
        assert.equal(ed.getFieldValue('s'), 'new', 'object options: selected = new');
    });

    QUnit.test('Select: function options format', async function (assert) {
        var getOpts = function () { return [{ Value: 'a', DisplayText: 'Alpha' }, { Value: 'b', DisplayText: 'Beta' }]; };
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: getOpts } } });
        await ed.open({ record: { s: 'b' } });
        await wait(100);
        assert.equal(ed.getFieldValue('s'), 'b', 'function options: selected = b');
    });

    QUnit.test('Select: blank/unrecognised value yields empty string', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'select', options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'unknown' } });
        assert.equal(ed.getFieldValue('s'), '', 'unrecognised value selects blank');
    });

    QUnit.test('Dropdown alias: same behaviour as select', async function (assert) {
        ed = makeEditor({ fields: { s: { label: 'S', type: 'dropdown', options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'closed' } });
        assert.equal(ed.getFieldValue('s'), 'closed', 'dropdown alias works');
    });
});


// ============================================================
// 5. Date Fields & _formatDate()
// ============================================================
QUnit.module('5. Date Fields & _formatDate()', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('_formatDate: yyyy-mm-dd', function (assert) {
        ed = makeEditor();
        assert.equal(ed._formatDate(new Date(2024, 0, 15), 'yyyy-mm-dd'), '2024-01-15');
    });

    QUnit.test('_formatDate: dd/mm/yyyy', function (assert) {
        ed = makeEditor();
        assert.equal(ed._formatDate(new Date(2024, 11, 5), 'dd/mm/yyyy'), '05/12/2024');
    });

    QUnit.test('_formatDate: yy-mm-dd (2-digit year)', function (assert) {
        ed = makeEditor();
        assert.equal(ed._formatDate(new Date(2024, 5, 20), 'yy-mm-dd'), '24-06-20');
    });

    QUnit.test('_formatDate: single-digit day and month padded', function (assert) {
        ed = makeEditor();
        assert.equal(ed._formatDate(new Date(2024, 2, 3), 'yyyy-mm-dd'), '2024-03-03');
    });

    QUnit.test('Date field: input has datepicker CSS class', async function (assert) {
        ed = makeEditor({ fields: { d: { label: 'Date', type: 'date' } } });
        await ed.open({ record: { d: '' } });
        assert.ok(ed.fieldInputs.get('d').hasClass('datepicker'), 'datepicker class applied');
    });

    QUnit.test('Date field: dateDisplayFormat placeholder applied', async function (assert) {
        ed = makeEditor({ fields: { d: { label: 'Date', type: 'date', dateDisplayFormat: 'yy-mm-dd' } } });
        await ed.open({ record: { d: '' } });
        assert.equal(ed.fieldInputs.get('d').attr('placeholder'), 'yy-mm-dd', 'placeholder = format');
    });
});


// ============================================================
// 6. Hidden Fields
// ============================================================
QUnit.module('6. Hidden Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Hidden: input type = hidden', async function (assert) {
        ed = makeEditor({ fields: { id: { type: 'hidden' } } });
        await ed.open({ record: { id: 99 } });
        assert.equal(ed.fieldInputs.get('id').attr('type'), 'hidden', 'type = hidden');
    });

    QUnit.test('Hidden: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { id: { type: 'hidden' } } });
        await ed.open({ record: { id: 42 } });
        assert.equal(ed.fieldInputs.get('id').val(), '42', 'value = 42');
    });

    QUnit.test('Hidden: no field-group wrapper rendered', async function (assert) {
        ed = makeEditor({ fields: { id: { type: 'hidden' } } });
        await ed.open({ record: { id: 1 } });
        assert.equal(ed.$form.find('.field-group[data-field="id"]').length, 0, 'no field-group for hidden');
    });

    QUnit.test('Hidden: included in _getFormData()', async function (assert) {
        ed = makeEditor({ fields: { id: { type: 'hidden' } } });
        await ed.open({ record: { id: 7 } });
        assert.equal(ed._getFormData().id, '7', 'hidden field in formdata');
    });
});


// ============================================================
// 7. Slider & Spinner Fields
// ============================================================
QUnit.module('7. Slider & Spinner Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Slider: container has slider-widget and slider-value children', async function (assert) {
        ed = makeEditor({ fields: { r: { label: 'Rating', type: 'slider', min: 0, max: 5 } } });
        await ed.open({ record: { r: 3 } });
        var $c = ed.fieldInputs.get('r');
        assert.equal($c.find('.slider-widget').length, 1, 'slider-widget present');
        assert.equal($c.find('.slider-value').length,  1, 'slider-value present');
    });

    QUnit.test('Slider: defaultValue=0 when record has no value', async function (assert) {
        ed = makeEditor({ fields: { r: { label: 'Rating', type: 'slider', min: 0, max: 5, defaultValue: 0 } } });
        await ed.open({ record: {} });
        await wait(150);
        assert.equal(ed.getFieldValue('r'), '0', 'slider-value = 0 for undefined record key');
    });

    QUnit.test('Spinner: input type = text', async function (assert) {
        ed = makeEditor({ fields: { p: { label: 'Priority', type: 'spinner', min: 1, max: 10 } } });
        await ed.open({ record: { p: 5 } });
        assert.equal(ed.fieldInputs.get('p').attr('type'), 'text', 'spinner input type = text');
    });
});


// ============================================================
// 8. Password, htmldiv & Autocomplete
// ============================================================
QUnit.module('8. Password, htmldiv & Autocomplete', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Password: input type = password', async function (assert) {
        ed = makeEditor({ fields: { pwd: { label: 'Pwd', type: 'password' } } });
        await ed.open({ record: { pwd: 'secret' } });
        assert.equal(ed.fieldInputs.get('pwd').attr('type'), 'password', 'type = password');
    });

    QUnit.test('Password: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { pwd: { label: 'Pwd', type: 'password' } } });
        await ed.open({ record: { pwd: 'myPass123' } });
        assert.equal(ed.getFieldValue('pwd'), 'myPass123', 'password value set');
    });

    QUnit.test('htmldiv: content rendered as HTML', async function (assert) {
        ed = makeEditor({ fields: { info: { type: 'htmldiv', content: '<strong>Hello</strong>' } } });
        await ed.open({ record: {} });
        assert.equal(ed.$form.find('.htmldiv-content strong').text(), 'Hello', 'HTML content rendered');
    });

    QUnit.test('htmldiv: custom id attribute applied', async function (assert) {
        ed = makeEditor({ fields: { info: { type: 'htmldiv', id: 'my-info', content: '' } } });
        await ed.open({ record: {} });
        assert.equal(ed.$form.find('#my-info').length, 1, 'custom id applied');
    });

    QUnit.test('Autocomplete: input is text type with form-control class', async function (assert) {
        ed = makeEditor({ fields: { city: { label: 'City', type: 'autocomplete', source: ['London', 'Paris'] } } });
        await ed.open({ record: { city: 'Paris' } });
        var $i = ed.fieldInputs.get('city');
        assert.equal($i.attr('type'), 'text', 'autocomplete input type = text');
        assert.ok($i.hasClass('form-control'), 'form-control class');
    });

    QUnit.test('Autocomplete: value populated from record', async function (assert) {
        ed = makeEditor({ fields: { city: { label: 'City', type: 'autocomplete', source: ['London', 'Paris'] } } });
        await ed.open({ record: { city: 'Paris' } });
        assert.equal(ed.getFieldValue('city'), 'Paris', 'autocomplete value = Paris');
    });

    // ---- sourceParams (0.1.3) ----------------------------------------------

    QUnit.test('Autocomplete: sourceParams object is merged into a URL source request', async function (assert) {
        var realGetJSON = $.getJSON;
        var calls = [];
        $.getJSON = function (url, data, cb) { calls.push({ url: url, data: data }); cb([]); };
        try {
            ed = makeEditor({ fields: { city: { type: 'autocomplete', source: '/api/cities', sourceParams: { country: 'AU' } } } });
            await ed.open({ record: { city: '' } });
            await wait(100);
            ed.fieldInputs.get('city').val('Syd').autocomplete('search', 'Syd');
            await wait(30);
            assert.equal(calls.length, 1, 'one request');
            assert.equal(calls[0].url, '/api/cities', 'URL used');
            assert.equal(calls[0].data.term, 'Syd', 'term passed');
            assert.equal(calls[0].data.country, 'AU', 'sourceParams merged');
        } finally {
            $.getJSON = realGetJSON;
        }
    });

    QUnit.test('Autocomplete: sourceParams function receives the request and its result is merged', async function (assert) {
        var realGetJSON = $.getJSON;
        var calls = [];
        var seen = [];
        $.getJSON = function (url, data, cb) { calls.push(data); cb([]); };
        try {
            ed = makeEditor({ fields: { city: {
                type: 'autocomplete',
                source: '/api/cities',
                sourceParams: function (request) { seen.push(request); return { q: request.term + '*' }; }
            } } });
            await ed.open({ record: { city: '' } });
            await wait(100);
            ed.fieldInputs.get('city').val('Mel').autocomplete('search', 'Mel');
            await wait(30);
            assert.equal(seen.length, 1, 'sourceParams called once');
            assert.equal(seen[0].term, 'Mel', 'request object passed');
            assert.equal(calls[0].term, 'Mel', 'term preserved');
            assert.equal(calls[0].q, 'Mel*', 'function result merged');
        } finally {
            $.getJSON = realGetJSON;
        }
    });

    QUnit.test('Autocomplete: sourceParams can override term', async function (assert) {
        var realGetJSON = $.getJSON;
        var data = null;
        $.getJSON = function (url, d, cb) { data = d; cb([]); };
        try {
            ed = makeEditor({ fields: { city: { type: 'autocomplete', source: '/api/cities', sourceParams: { term: 'fixed' } } } });
            await ed.open({ record: { city: '' } });
            await wait(100);
            ed.fieldInputs.get('city').val('Syd').autocomplete('search', 'Syd');
            await wait(30);
            assert.equal(data.term, 'fixed', 'sourceParams wins over request.term');
        } finally {
            $.getJSON = realGetJSON;
        }
    });

    QUnit.test('Autocomplete: sourceParams is ignored for array and function sources', async function (assert) {
        var called = false;
        ed = makeEditor({ fields: {
            a: { type: 'autocomplete', source: ['London'], sourceParams: function () { called = true; return {}; } },
            b: { type: 'autocomplete', source: function (req, res) { res(['Paris']); }, sourceParams: function () { called = true; return {}; } }
        }});
        await ed.open({ record: { a: '', b: '' } });
        await wait(100);
        ed.fieldInputs.get('a').val('Lon').autocomplete('search', 'Lon');
        ed.fieldInputs.get('b').val('Par').autocomplete('search', 'Par');
        await wait(30);
        assert.notOk(called, 'sourceParams not evaluated');
    });
});


// ============================================================
// 9. Form Data (_getFormData / setFieldValues)
// ============================================================
QUnit.module('9. Form Data', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('_getFormData: returns all field values', async function (assert) {
        ed = makeEditor({ fields: {
            name:   { label: 'Name',   type: 'text' },
            notes:  { label: 'Notes',  type: 'textarea' },
            active: { label: 'Active', type: 'checkbox', checkboxLabel: 'A' },
            status: { label: 'Status', type: 'select', options: SELECT_OPTIONS },
            id:     { type: 'hidden' }
        }});
        await ed.open({ record: { name: 'Alice', notes: 'hi', active: true, status: 'active', id: 7 } });
        var d = ed._getFormData();
        assert.equal(d.name,   'Alice',  'name in formdata');
        assert.equal(d.notes,  'hi',     'notes in formdata');
        assert.equal(d.active, true,     'active in formdata');
        assert.equal(d.status, 'active', 'status in formdata');
        assert.equal(d.id,     '7',      'hidden id in formdata');
    });

    QUnit.test('_getFormData: reflects setFieldValue() change', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        await ed.setFieldValue('name', 'Bob');
        assert.equal(ed._getFormData().name, 'Bob', 'formdata.name = Bob after setFieldValue');
    });

    QUnit.test('setFieldValues: batch-sets multiple fields', async function (assert) {
        ed = makeEditor({ fields: {
            name:   { label: 'Name',   type: 'text' },
            status: { label: 'Status', type: 'text' }
        }});
        await ed.open({ record: { name: 'A', status: 'x' } });
        await ed.setFieldValues({ name: 'Bob', status: 'ok' });
        assert.equal(ed.getFieldValue('name'),   'Bob', 'name = Bob');
        assert.equal(ed.getFieldValue('status'), 'ok',  'status = ok');
    });

    QUnit.test('getFieldValue: returns null for unknown field', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.getFieldValue('no_such_field'), null, 'null for unknown field');
    });
});


// ============================================================
// 10. Field Errors
// ============================================================
QUnit.module('10. Field Errors', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('displayFieldErrors: error text shown in field-error div', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Value is required' }]);
        var $err = ed.$form.find('[data-field="name"] .field-error');
        assert.equal($err.text(), 'Value is required', 'error text shown');
        assert.ok($err.is(':visible'), 'error div visible');
    });

    QUnit.test('displayFieldErrors: adds field-invalid class to input', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Required' }]);
        assert.ok(ed.fieldInputs.get('name').hasClass('field-invalid'), 'field-invalid class added');
    });

    QUnit.test('clearFieldErrors: hides error div', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Required' }]);
        ed.clearFieldErrors();
        assert.ok(ed.$form.find('[data-field="name"] .field-error').is(':hidden'), 'error hidden');
    });

    QUnit.test('clearFieldErrors: removes field-invalid class', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Required' }]);
        ed.clearFieldErrors();
        assert.notOk(ed.fieldInputs.get('name').hasClass('field-invalid'), 'field-invalid removed');
    });

    QUnit.test('displayFieldErrors: multiple fields simultaneously', async function (assert) {
        ed = makeEditor({ fields: {
            name:  { label: 'Name',  type: 'text' },
            email: { label: 'Email', type: 'text' }
        }});
        await ed.open({ record: { name: '', email: '' } });
        ed.displayFieldErrors([
            { name: 'name',  status: 'Name required'  },
            { name: 'email', status: 'Email invalid' }
        ]);
        assert.equal(ed.$form.find('[data-field="name"]  .field-error').text(), 'Name required',  'name error');
        assert.equal(ed.$form.find('[data-field="email"] .field-error').text(), 'Email invalid', 'email error');
    });
});


// ============================================================
// 11. Show / Hide Fields
// ============================================================
QUnit.module('11. Show / Hide Fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('hidden:true in config hides field on open', async function (assert) {
        ed = makeEditor({ fields: { secret: { label: 'Secret', type: 'text', hidden: true } } });
        await ed.open({ record: { secret: 'x' } });
        assert.ok(ed.$form.find('[data-field="secret"]').is(':hidden'), 'field hidden');
    });

    QUnit.test('showField: reveals a hidden field', async function (assert) {
        ed = makeEditor({ fields: { secret: { label: 'Secret', type: 'text', hidden: true } } });
        await ed.open({ record: { secret: 'x' } });
        ed.showField('secret');
        assert.ok(ed.$form.find('[data-field="secret"]').is(':visible'), 'field now visible');
    });

    QUnit.test('hideField: hides a visible field', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        ed.hideField('name');
        assert.ok(ed.$form.find('[data-field="name"]').is(':hidden'), 'field hidden after hideField');
    });

    QUnit.test('hideField: persists across re-open', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        ed.hideField('name');
        await ed.open({ record: { name: 'Bob' } });
        assert.ok(ed.$form.find('[data-field="name"]').is(':hidden'), 'field still hidden on re-open');
    });

    QUnit.test('showField: persists across re-open', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', hidden: true } } });
        await ed.open({ record: { name: 'Alice' } });
        ed.showField('name');
        await ed.open({ record: { name: 'Bob' } });
        assert.ok(ed.$form.find('[data-field="name"]').is(':visible'), 'field visible on re-open');
    });
});


// ============================================================
// 12. Lifecycle Callbacks
// ============================================================
QUnit.module('12. Lifecycle Callbacks', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('onBeforeShow: fires with populated form value', async function (assert) {
        var captured = null;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onBeforeShow: function (editor) { captured = editor.getFieldValue('name'); }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(captured, 'Alice', 'onBeforeShow received Alice');
    });

    QUnit.test('onBeforeShow: async callback is awaited before open() resolves', async function (assert) {
        var seq = [];
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onBeforeShow: async function () { await wait(20); seq.push('before'); }
        });
        await ed.open({ record: { name: 'x' } });
        seq.push('after');
        assert.deepEqual(seq, ['before', 'after'], 'async onBeforeShow awaited');
    });

    QUnit.test('onBeforeShow: can modify field values', async function (assert) {
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onBeforeShow: async function (editor) { await editor.setFieldValue('name', 'Modified'); }
        });
        await ed.open({ record: { name: 'Original' } });
        assert.equal(ed.getFieldValue('name'), 'Modified', 'value modified in onBeforeShow');
    });

    QUnit.test('edpak.currentRecord: shallow copy of original record', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        var record = { name: 'Alice' };
        await ed.open({ record: record });
        assert.deepEqual(ed.edpak.currentRecord, { name: 'Alice' }, 'currentRecord copied');
        ed.edpak.currentRecord.name = 'Mutated';
        assert.equal(record.name, 'Alice', 'original record unaffected');
    });

    QUnit.test('onCancel: fires on close() without save', async function (assert) {
        var cancelled = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onCancel: function () { cancelled = true; }
        });
        await ed.open({ record: { name: 'Alice' } });
        ed.close();
        assert.ok(cancelled, 'onCancel fired');
    });

    QUnit.test('onCancel: does NOT fire after successful save', async function (assert) {
        var cancelled = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onSave: async function () {},
            onCancel: function () { cancelled = true; }
        });
        await ed.open({ record: { name: 'Alice' } });
        await ed._handleSave();
        assert.notOk(cancelled, 'onCancel NOT fired after save');
    });

    QUnit.test('onSave: called with edpak containing formdata', async function (assert) {
        var savedEdpak = null;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onSave: async function (edpak) { savedEdpak = edpak; }
        });
        await ed.open({ record: { name: 'Alice' } });
        await ed._handleSave();
        assert.ok(savedEdpak, 'onSave received edpak');
        assert.equal(savedEdpak.formdata.name, 'Alice', 'formdata.name = Alice');
    });

    QUnit.test('validateForm: returning errors prevents onSave', async function (assert) {
        var saveCalled = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            validateForm: function () { return [{ name: 'name', status: 'Required' }]; },
            onSave: async function () { saveCalled = true; }
        });
        await ed.open({ record: { name: '' } });
        await ed._handleSave();
        assert.notOk(saveCalled, 'onSave not called when validation fails');
    });

    QUnit.test('validateForm: errors displayed when validation fails', async function (assert) {
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            validateForm: function () { return [{ name: 'name', status: 'Required' }]; },
            onSave: async function () {}
        });
        await ed.open({ record: { name: '' } });
        await ed._handleSave();
        assert.ok(ed.fieldInputs.get('name').hasClass('field-invalid'), 'field-invalid after failed validation');
    });

    QUnit.test('validateForm: returning null/empty allows onSave', async function (assert) {
        var saveCalled = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            validateForm: function () { return null; },
            onSave: async function () { saveCalled = true; }
        });
        await ed.open({ record: { name: 'Alice' } });
        await ed._handleSave();
        assert.ok(saveCalled, 'onSave called when validation returns null');
    });

    QUnit.test('onSave: server error response shown via _showError', async function (assert) {
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onSave: async function () { return { error: 'DB error', errmsg: 'Connection failed' }; }
        });
        await ed.open({ record: { name: 'Alice' } });
        // _handleSave should complete without throwing
        await ed._handleSave();
        assert.ok(true, '_handleSave handled server error without throwing');
    });

    // --- onInit ---

    QUnit.test('onInit: fires on first open()', async function (assert) {
        var called = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onInit: function () { called = true; }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(called, 'onInit fired on first open()');
    });

    QUnit.test('onInit: receives editor instance', async function (assert) {
        var received = null;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onInit: function (editor) { received = editor; }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.strictEqual(received, ed, 'onInit received the editor instance');
    });

    QUnit.test('onInit: form elements exist when onInit fires (fieldInputs populated)', async function (assert) {
        var sizeAtInit = null;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onInit: function (editor) { sizeAtInit = editor.fieldInputs.size; }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(sizeAtInit, 1, 'fieldInputs.size = 1 inside onInit');
    });

    QUnit.test('onInit: does NOT fire on second open()', async function (assert) {
        var callCount = 0;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onInit: function () { callCount++; }
        });
        await ed.open({ record: { name: 'Alice' } });
        await ed.open({ record: { name: 'Bob' } });
        assert.equal(callCount, 1, 'onInit called exactly once across two open() calls');
    });

    QUnit.test('onInit: fires before onBeforeShow on first open()', async function (assert) {
        var seq = [];
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            onInit:       function ()       { seq.push('init'); },
            onBeforeShow: function ()       { seq.push('beforeShow'); }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.deepEqual(seq, ['init', 'beforeShow'], 'onInit before onBeforeShow');
    });
});


// ============================================================
// 13. Dynamic Field Props
// ============================================================
QUnit.module('13. Dynamic Field Props', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('maxFieldLengths: overrides maxlength attribute', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', maxLength: 100 } } });
        await ed.open({ record: { name: 'Alice' } }, null, null, { maxFieldLengths: { name: 25 } });
        assert.equal(ed.fieldInputs.get('name').attr('maxlength'), '25', 'maxlength = 25');
    });

    QUnit.test('requiredFields: adds field-required class', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } }, null, null, { requiredFields: ['name'] });
        assert.ok(ed.$form.find('[data-field="name"]').hasClass('field-required'), 'field-required class added');
    });

    QUnit.test('requiredFields: adds aria-required to input', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } }, null, null, { requiredFields: ['name'] });
        assert.equal(ed.fieldInputs.get('name').attr('aria-required'), 'true', 'aria-required = true');
    });

    QUnit.test('fieldLabels: updates displayed label text', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } }, null, null, { fieldLabels: { name: 'Full Name' } });
        assert.equal(ed.$form.find('[data-field="name"] .field-label').text(), 'Full Name', 'label = Full Name');
    });

    QUnit.test('requiredFields: does NOT apply to readonly fields', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', readonly: true } } });
        await ed.open({ record: { name: 'Alice' } }, null, null, { requiredFields: ['name'] });
        assert.notOk(ed.$form.find('[data-field="name"]').hasClass('field-required'), 'readonly field not marked required');
    });
});


// ============================================================
// 14. defaultValue & getValue / dataFunction
// ============================================================
QUnit.module('14. defaultValue & Field Data Functions', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('defaultValue: applied when record key is missing', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', defaultValue: 'Default' } } });
        await ed.open({ record: {} });
        assert.equal(ed.getFieldValue('name'), 'Default', 'defaultValue applied');
    });

    QUnit.test('defaultValue: not applied when record has a value', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', defaultValue: 'Default' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.getFieldValue('name'), 'Alice', 'record value takes precedence');
    });

    QUnit.test('defaultValue: function form is invoked', async function (assert) {
        ed = makeEditor({ fields: { created: { label: 'Created', type: 'text', defaultValue: function () { return '2024-01-01'; } } } });
        await ed.open({ record: {} });
        assert.equal(ed.getFieldValue('created'), '2024-01-01', 'defaultValue function called');
    });

    QUnit.test('getValue: function overrides record value', async function (assert) {
        ed = makeEditor({ fields: { display: {
            label: 'Display', type: 'text',
            getValue: function (record) { return record.first + ' ' + record.last; }
        }}});
        await ed.open({ record: { first: 'John', last: 'Doe' } });
        assert.equal(ed.getFieldValue('display'), 'John Doe', 'getValue function applied');
    });
});


// ============================================================
// 15. Label, Required & omitLabel
// ============================================================
QUnit.module('15. Label, Required & omitLabel', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('omitLabel:true suppresses label element', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', omitLabel: true } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.$form.find('[data-field="name"] .field-label').length, 0, 'no label element');
    });

    QUnit.test('required:true adds field-required class', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', required: true } } });
        await ed.open({ record: { name: '' } });
        assert.ok(ed.$form.find('[data-field="name"]').hasClass('field-required'), 'field-required class');
    });

    QUnit.test('required:true adds aria-required attribute', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', required: true } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.fieldInputs.get('name').attr('aria-required'), 'true', 'aria-required = true');
    });

    QUnit.test('required on readonly: no field-required class', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', required: true, readonly: true } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.notOk(ed.$form.find('[data-field="name"]').hasClass('field-required'), 'readonly skips required marking');
    });

    QUnit.test('label falls back to title if label is absent', async function (assert) {
        ed = makeEditor({ fields: { name: { title: 'My Title', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.$form.find('[data-field="name"] .field-label').text(), 'My Title', 'title used as label');
    });

    // ---- Label/id binding for compound fields (0.1.3) ----------------------

    QUnit.test('label: simple control keeps for="field-<name>"', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.$form.find('[data-field="name"] .field-label').attr('for'), 'field-name', 'for = field-name');
        assert.ok(ed.fieldInputs.get('name').is('#field-name'), 'control carries field-name id');
    });

    QUnit.test('label: checkbox label targets check-<name> and clicking it toggles the box', async function (assert) {
        ed = makeEditor({ fields: { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } } });
        await ed.open({ record: { active: false } });
        var $label = ed.$form.find('[data-field="active"] .field-label');
        var $wrapper = ed.fieldInputs.get('active');
        assert.equal($label.attr('for'), 'check-active', 'for = check-active');
        assert.equal($wrapper.attr('id'), 'field-active', 'wrapper keeps field-active id');
        assert.strictEqual(document.getElementById('check-active'), $wrapper.find('input[type="checkbox"]')[0], 'for points at the checkbox');
        $label[0].click();
        assert.equal(ed.getFieldValue('active'), true, 'clicking the row label checks the box');
    });

    QUnit.test('label: slider and file labels target the generated field-<name>-input ids', async function (assert) {
        ed = makeEditor({ fields: {
            rating: { label: 'Rating', type: 'slider' },
            logo:   { label: 'Logo',   type: 'file'   }
        }});
        await ed.open({ record: { rating: 1, logo: '' } });
        await wait(60);
        assert.equal(ed.$form.find('[data-field="rating"] .field-label').attr('for'), 'field-rating-input', 'slider label for');
        assert.ok(ed.fieldInputs.get('rating').find('.slider-value').is('#field-rating-input'), 'slider value input got the id');
        assert.equal(ed.$form.find('[data-field="logo"] .field-label').attr('for'), 'field-logo-input', 'file label for');
        assert.ok(ed.fieldInputs.get('logo').find('input[type="file"]').is('#field-logo-input'), 'file input got the id');
    });

    QUnit.test('label: radiogroup uses role=group + aria-labelledby instead of for', async function (assert) {
        ed = makeEditor({ fields: { role: {
            label: 'Role', type: 'radiogroup',
            options: [{ Value: 'a', DisplayText: 'A' }]
        }}});
        await ed.open({ record: { role: 'a' } });
        await wait(60);
        var $label = ed.$form.find('[data-field="role"] .field-label');
        var $group = ed.fieldInputs.get('role');
        assert.equal($label.attr('for'), undefined, 'no for attribute');
        assert.equal($label.attr('id'), 'field-role-label', 'label gets field-role-label id');
        assert.equal($group.attr('role'), 'group', 'role = group');
        assert.equal($group.attr('aria-labelledby'), 'field-role-label', 'aria-labelledby points at the label');
    });

    QUnit.test('required: aria-required is applied to controls inside a compound wrapper', async function (assert) {
        ed = makeEditor({ fields: {
            active: { label: 'A', type: 'checkbox', checkboxLabel: 'A', required: true },
            role:   { label: 'R', type: 'radiogroup', required: true,
                      options: [{ Value: 'a', DisplayText: 'A' }] }
        }});
        await ed.open({ record: { active: false, role: 'a' } });
        await wait(60);
        assert.equal(ed.fieldInputs.get('active').attr('aria-required'), 'true', 'checkbox wrapper marked');
        assert.equal(ed.fieldInputs.get('active').find('input[type="checkbox"]').attr('aria-required'), 'true', 'checkbox marked');
        assert.equal(ed.fieldInputs.get('role').find('input[type="radio"]').attr('aria-required'), 'true', 'radio marked');
    });
});


// ============================================================
// 16. Character Counter
// ============================================================
QUnit.module('16. Character Counter', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('showCounter:true + maxLength: counter div rendered', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', maxLength: 50, showCounter: true } } });
        await ed.open({ record: { name: '' } });
        var $counter = ed.$form.find('[data-field="name"] .char-counter');
        assert.equal($counter.length, 1, 'char-counter div present');
    });

    QUnit.test('showCounter:true: max span shows correct value', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', maxLength: 50, showCounter: true } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.$form.find('[data-field="name"] .char-counter .max').text(), '50', 'max = 50');
    });

    QUnit.test('showCounter:false: no counter div rendered', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text', maxLength: 50, showCounter: false } } });
        await ed.open({ record: { name: '' } });
        assert.equal(ed.$form.find('[data-field="name"] .char-counter').length, 0, 'no counter');
    });
});


// ============================================================
// 17. Tab Layout
// ============================================================
QUnit.module('17. Tab Layout', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('_normalizeTabs: string array → id/title/icon objects', function (assert) {
        ed = makeEditor();
        var r = ed._normalizeTabs(['Info', 'Address', 'Contact Info']);
        assert.equal(r.length, 3, '3 tabs');
        assert.equal(r[0].id,    'info',         'id = info');
        assert.equal(r[0].title, 'Info',         'title = Info');
        assert.equal(r[2].id,    'contact-info', 'spaces converted to hyphens');
        assert.equal(r[0].icon,  null,           'icon = null');
    });

    QUnit.test('_normalizeTabs: object array preserved', function (assert) {
        ed = makeEditor();
        var r = ed._normalizeTabs([{ id: 'tab-a', title: 'Tab A', icon: 'ui-icon-home' }]);
        assert.equal(r[0].id,   'tab-a',        'id preserved');
        assert.equal(r[0].title,'Tab A',         'title preserved');
        assert.equal(r[0].icon, 'ui-icon-home', 'icon preserved');
    });

    QUnit.test('_normalizeTabs: empty array returns []', function (assert) {
        ed = makeEditor();
        assert.deepEqual(ed._normalizeTabs([]),   [], 'empty array → []');
        assert.deepEqual(ed._normalizeTabs(null), [], 'null → []');
    });

    QUnit.test('Tab form: correct number of tab panels created', async function (assert) {
        ed = makeEditor({
            tabs: ['Info', 'Address'],
            fields: {
                name:    { label: 'Name',    type: 'text', tab: 'Info'    },
                address: { label: 'Address', type: 'text', tab: 'Address' }
            }
        });
        await ed.open({ record: { name: 'Alice', address: '1 Main St' } });
        await wait(100);
        assert.equal(ed.$form.find('.tab-panel').length, 2, '2 tab panels');
    });

    QUnit.test('Tab form: fields placed in correct panels', async function (assert) {
        ed = makeEditor({
            tabs: ['Info', 'Address'],
            fields: {
                name:    { label: 'Name',    type: 'text', tab: 'Info'    },
                address: { label: 'Address', type: 'text', tab: 'Address' }
            }
        });
        await ed.open({ record: { name: 'Alice', address: '1 Main St' } });
        await wait(100);
        assert.equal(ed.$form.find('#tab-info    [data-field="name"]').length,    1, 'name in Info tab');
        assert.equal(ed.$form.find('#tab-address [data-field="address"]').length, 1, 'address in Address tab');
    });

    QUnit.test('Tab form: field with no tab goes to first tab', async function (assert) {
        ed = makeEditor({
            tabs: ['Info', 'Address'],
            fields: {
                name: { label: 'Name', type: 'text' }  // no tab property
            }
        });
        await ed.open({ record: { name: 'Alice' } });
        await wait(100);
        assert.equal(ed.$form.find('#tab-info [data-field="name"]').length, 1, 'unassigned field goes to first tab');
    });

    QUnit.test('activateTab: function exists and accepts index', async function (assert) {
        ed = makeEditor({
            tabs: ['Info', 'Address'],
            fields: {
                name:    { label: 'Name',    type: 'text', tab: 'Info'    },
                address: { label: 'Address', type: 'text', tab: 'Address' }
            }
        });
        await ed.open({ record: { name: 'Alice', address: '1 Main St' } });
        await wait(100);
        assert.ok(typeof ed.activateTab === 'function', 'activateTab is a function');
        // Should not throw
        ed.activateTab(1);
        assert.ok(true, 'activateTab(1) did not throw');
    });
});


// ============================================================
// 18. Horizontal Layout & Field Grouping
// ============================================================
QUnit.module('18. Horizontal Layout & Field Grouping', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('formLayout:horizontal → field-group-horizontal class', async function (assert) {
        ed = makeEditor({ formLayout: 'horizontal', fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(ed.$form.find('[data-field="name"]').hasClass('field-group-horizontal'), 'horizontal class');
    });

    QUnit.test('formLayout:vertical → field-group-vertical class', async function (assert) {
        ed = makeEditor({ formLayout: 'vertical', fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(ed.$form.find('[data-field="name"]').hasClass('field-group-vertical'), 'vertical class');
    });

    QUnit.test('fieldGroup: grouped fields share a .field-row wrapper', async function (assert) {
        ed = makeEditor({
            formLayout: 'horizontal',
            fields: {
                firstName: { label: 'First', type: 'text', fieldGroup: 'name' },
                lastName:  { label: 'Last',  type: 'text', fieldGroup: 'name' }
            }
        });
        await ed.open({ record: { firstName: 'John', lastName: 'Doe' } });
        var $row = ed.$form.find('.field-row');
        assert.equal($row.length, 1, 'one field-row created');
        assert.equal($row.find('.field-group').length, 2, 'two field-groups inside');
    });

    QUnit.test('field-level layout overrides global formLayout', async function (assert) {
        ed = makeEditor({
            formLayout: 'horizontal',
            fields: {
                name:  { label: 'Name',  type: 'text' },
                notes: { label: 'Notes', type: 'textarea', layout: 'vertical' }
            }
        });
        await ed.open({ record: { name: 'A', notes: 'B' } });
        assert.ok(ed.$form.find('[data-field="name"]' ).hasClass('field-group-horizontal'), 'name = horizontal');
        assert.ok(ed.$form.find('[data-field="notes"]').hasClass('field-group-vertical'),   'notes = vertical (override)');
    });
});


// ============================================================
// 19. Dialog Title
// ============================================================
QUnit.module('19. Dialog Title', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('dialogTitle option applied to dialog', async function (assert) {
        ed = makeEditor({
            dialogTitle: 'My Editor',
            fields: { name: { label: 'Name', type: 'text' } }
        });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.$dialog.dialog('option', 'title'), 'My Editor', 'title = My Editor');
    });

    QUnit.test('customTitle arg overrides dialogTitle for one open()', async function (assert) {
        ed = makeEditor({
            dialogTitle: 'Default Title',
            fields: { name: { label: 'Name', type: 'text' } }
        });
        await ed.open({ record: { name: 'Alice' } }, null, 'Override Title');
        assert.equal(ed.$dialog.dialog('option', 'title'), 'Override Title', 'title overridden');
    });

    QUnit.test('default title falls back to messages.editRecord', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.$dialog.dialog('option', 'title'), ed.options.messages.editRecord, 'default title used');
    });
});


// ============================================================
// 20. Custom Buttons
// ============================================================
QUnit.module('20. Custom Buttons', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('customButtons: click handler is invoked', async function (assert) {
        var clicked = false;
        ed = makeEditor({
            fields: { name: { label: 'Name', type: 'text' } },
            customButtons: [{ text: 'Extra Action', click: function () { clicked = true; }, align: 'left' }]
        });
        await ed.open({ record: { name: 'Alice' } });
        ed.$dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane button:contains("Extra Action")').trigger('click');
        assert.ok(clicked, 'custom button click handler called');
    });

    // ---- "Saving..." button label (0.1.3) ----------------------------------

    QUnit.test('_setButtonsSaving: label becomes Saving... and the check icon survives', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        ed._setButtonsSaving();
        var $save = ed.$saveBtn;
        assert.ok($save.length, 'Save button found');
        assert.equal($save.text().trim(), 'Saving...', 'label = Saving...');
        assert.ok($save.prop('disabled'), 'Save disabled');
        assert.ok(ed.$cancelBtn.prop('disabled'), 'Cancel disabled');
        assert.equal($save.find('.ui-icon-check').length, 1, 'check icon preserved');

        ed._setButtonsNormal();
        assert.equal($save.text().trim(), 'Save', 'label restored');
        assert.notOk($save.prop('disabled'), 'Save re-enabled');
        assert.notOk(ed.$cancelBtn.prop('disabled'), 'Cancel re-enabled');
        assert.equal($save.find('.ui-icon-check').length, 1, 'check icon still present');
    });

    QUnit.test('_setButtonsSaving: restores a custom saveButton text', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } }, saveButton: { text: 'Apply' } });
        await ed.open({ record: { name: '' } });
        ed._setButtonsSaving();
        assert.equal(ed.$saveBtn.text().trim(), 'Saving...', 'saving label');
        ed._setButtonsNormal();
        assert.equal(ed.$saveBtn.text().trim(), 'Apply', 'custom label restored');
    });
});


// ============================================================
// 21. _triggerNotice
// ============================================================
QUnit.module('21. _triggerNotice', function (hooks) {
    var ed;
    hooks.afterEach(function () {
        $(document).off('recedit-notice.test');
        safeDestroy(ed);
    });

    QUnit.test('fires recedit-notice event on document', function (assert) {
        ed = makeEditor();
        var received = null;
        $(document).on('recedit-notice.test', function (e, notice) { received = notice; });
        ed._triggerNotice({ type: 'error', title: 'Test error', message: 'oops' });
        assert.deepEqual(received, { type: 'error', title: 'Test error', message: 'oops' }, 'notice received');
    });

    QUnit.test('event.preventDefault() suppresses console.error fallback', function (assert) {
        ed = makeEditor();
        var consoleCalled = false;
        var origError = console.error;
        console.error = function () { consoleCalled = true; };
        $(document).on('recedit-notice.test', function (e) { e.preventDefault(); });
        ed._triggerNotice({ type: 'error', title: 'Test' });
        console.error = origError;
        assert.notOk(consoleCalled, 'console.error not called when default prevented');
    });
});


// ============================================================
// 22. Multiple open() calls (re-use)
// ============================================================
QUnit.module('22. Multiple open() calls', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('Second open() repopulates with new record', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.equal(ed.getFieldValue('name'), 'Alice', 'first open: Alice');
        await ed.open({ record: { name: 'Bob' } });
        assert.equal(ed.getFieldValue('name'), 'Bob', 'second open: Bob');
    });

    QUnit.test('Second open() with new fieldDefinitions replaces field set', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        await ed.open({ record: { email: 'alice@example.com' } }, { email: { label: 'Email', type: 'text' } });
        assert.equal(ed.getFieldValue('email'), 'alice@example.com', 'email field populated');
        assert.equal(ed.getFieldValue('name'),  null,                'old name field gone');
    });

    QUnit.test('open() without record property triggers notice and returns early', async function (assert) {
        var noticed = false;
        ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        $(document).one('recedit-notice', function () { noticed = true; });
        await ed.open({});  // missing record
        assert.ok(noticed, 'recedit-notice fired for missing record');
    });
});


// ============================================================
// 23. Destroy
// ============================================================
QUnit.module('23. Destroy', function (hooks) {
    // afterEach not used — tests manage lifecycle themselves

    QUnit.test('destroy: $dialog and $form set to null', async function (assert) {
        var ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        ed.destroy();
        assert.equal(ed.$dialog, null, '$dialog = null');
        assert.equal(ed.$form,   null, '$form = null');
    });

    QUnit.test('destroy: fieldInputs Map cleared', async function (assert) {
        var ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(ed.fieldInputs.size > 0, 'fieldInputs has entries before destroy');
        ed.destroy();
        assert.equal(ed.fieldInputs.size, 0, 'fieldInputs cleared');
    });

    QUnit.test('destroy: isInitialized = false', async function (assert) {
        var ed = makeEditor({ fields: { name: { label: 'Name', type: 'text' } } });
        await ed.open({ record: { name: 'Alice' } });
        ed.destroy();
        assert.equal(ed.isInitialized, false, 'isInitialized = false');
    });
});


// ============================================================
// 24. RecEditInlineForm
// ============================================================
QUnit.module('24. RecEditInlineForm', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    /** Create a container in #qunit-fixture with data-field placeholders. */
    function makeContainer(fields) {
        var $c = $('<div>').appendTo('#qunit-fixture');
        Object.keys(fields).forEach(function (name) {
            $c.append($('<div>', { 'data-field': name }));
        });
        var id = 'inline-test-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        $c.attr('id', id);
        return id;
    }

    function makeInline(fields, extra) {
        var id = makeContainer(fields);
        return new RecEditInlineForm(Object.assign({
            container: '#' + id,
            fields: fields,
            effectDuration: 0,
            useJQueryUITheme: false
        }, extra || {}));
    }

    QUnit.test('Constructor: throws without container', function (assert) {
        assert.throws(function () { new RecEditInlineForm({ fields: {} }); }, /container.*required/i);
    });

    QUnit.test('Constructor: throws when container not found', function (assert) {
        assert.throws(
            function () { new RecEditInlineForm({ container: '#no-exist', fields: {} }); },
            /not found in DOM/i
        );
    });

    QUnit.test('Constructor: isInitialized = true immediately', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        assert.equal(ed.isInitialized, true, 'isInitialized = true after construction');
    });

    QUnit.test('Constructor: fieldInputs populated without load()', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        assert.equal(ed.fieldInputs.size, 1, 'fieldInputs has 1 entry');
    });

    QUnit.test('load(): populates fields from record', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' }, notes: { label: 'Notes', type: 'textarea' } });
        await ed.load({ record: { name: 'Alice', notes: 'Hi' } });
        assert.equal(ed.getFieldValue('name'),  'Alice', 'name = Alice');
        assert.equal(ed.getFieldValue('notes'), 'Hi',    'notes = Hi');
    });

    QUnit.test('load(): second call repopulates with new record', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        await ed.load({ record: { name: 'Alice' } });
        await ed.load({ record: { name: 'Bob'   } });
        assert.equal(ed.getFieldValue('name'), 'Bob', 'second load: Bob');
    });

    QUnit.test('load(): onBeforeShow fires with populated form', async function (assert) {
        var captured = null;
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { onBeforeShow: function (editor) { captured = editor.getFieldValue('name'); } }
        );
        await ed.load({ record: { name: 'Alice' } });
        assert.equal(captured, 'Alice', 'onBeforeShow received Alice');
    });

    QUnit.test('close(): does NOT hide container', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        await ed.load({ record: { name: 'Alice' } });
        ed.close();
        assert.ok(ed._$container.is(':visible'), 'container remains visible after close()');
    });

    QUnit.test('Save button injected into container', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        assert.equal(ed._$container.find('.recedit-save-btn').length, 1, 'save button present');
    });

    QUnit.test('Reset button injected into container', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        assert.equal(ed._$container.find('.recedit-reset-btn').length, 1, 'reset button present');
    });

    QUnit.test('Reset button: default label is "Reset"', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        var $btn = ed._$container.find('.recedit-reset-btn');
        assert.ok($btn.text().indexOf('Reset') !== -1, 'reset button label contains "Reset"');
    });

    QUnit.test('Reset button: restores original record values', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        await ed.load({ record: { name: 'Alice' } });
        await ed.setFieldValue('name', 'Modified');
        assert.equal(ed.getFieldValue('name'), 'Modified', 'value changed to Modified');
        ed._$container.find('.recedit-reset-btn').trigger('click');
        // restoreForm is async; flush the full microtask/macrotask queue
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
        assert.equal(ed.getFieldValue('name'), 'Alice', 'value restored to Alice after reset');
    });

    QUnit.test('Reset button: cancelButton option overrides label', function (assert) {
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { cancelButton: { text: 'Undo' } }
        );
        var $btn = ed._$container.find('.recedit-reset-btn');
        assert.ok($btn.text().indexOf('Undo') !== -1, 'reset button label overridden to "Undo"');
    });

    QUnit.test('clearFormOnSave=true: fields reset after _afterSave()', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text', defaultValue: '' } }, { clearFormOnSave: true });
        await ed.load({ record: { name: 'Alice' } });
        await ed._afterSave();
        assert.equal(ed.getFieldValue('name'), '', 'name cleared after save');
    });

    QUnit.test('clearFormOnSave=false: fields retained after _afterSave()', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } }, { clearFormOnSave: false });
        await ed.load({ record: { name: 'Alice' } });
        await ed._afterSave();
        assert.equal(ed.getFieldValue('name'), 'Alice', 'name retained after save');
    });

    QUnit.test('destroy(): clears placeholder contents', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        var $placeholder = ed._$container.find('[data-field="name"]');
        assert.ok($placeholder.children().length > 0, 'placeholder has content before destroy');
        ed.destroy();
        assert.equal($placeholder.children().length, 0, 'placeholder cleared after destroy');
    });

    QUnit.test('displayFieldErrors: error shown inside container', async function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        await ed.load({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Required' }]);
        assert.ok(
            ed._$container.find('[data-field="name"] .field-error').is(':visible'),
            'error visible in inline form'
        );
    });

    QUnit.test('titleSelector: title element updated by load()', async function (assert) {
        var id = makeContainer({ name: { label: 'Name', type: 'text' } });
        $('#' + id).prepend($('<h3>', { class: 'ed-title' }));
        ed = new RecEditInlineForm({
            container: '#' + id,
            fields: { name: { label: 'Name', type: 'text' } },
            titleSelector: '.ed-title',
            dialogTitle: 'My Form',
            effectDuration: 0,
            useJQueryUITheme: false
        });
        await ed.load({ record: { name: '' } });
        assert.equal($('#' + id + ' .ed-title').text(), 'My Form', 'title element updated');
    });

    // --- onInit ---

    QUnit.test('onInit: fires during construction (before any load())', function (assert) {
        var called = false;
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function () { called = true; } }
        );
        assert.ok(called, 'onInit fired in constructor');
    });

    QUnit.test('onInit: receives editor instance', function (assert) {
        var received = null;
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function (editor) { received = editor; } }
        );
        assert.strictEqual(received, ed, 'onInit received the editor instance');
    });

    QUnit.test('onInit: form elements exist when onInit fires (fieldInputs populated)', function (assert) {
        var sizeAtInit = null;
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function (editor) { sizeAtInit = editor.fieldInputs.size; } }
        );
        assert.equal(sizeAtInit, 1, 'fieldInputs.size = 1 inside onInit');
    });

    QUnit.test('onInit: does NOT fire again on load()', async function (assert) {
        var callCount = 0;
        ed = makeInline(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function () { callCount++; } }
        );
        await ed.load({ record: { name: 'Alice' } });
        await ed.load({ record: { name: 'Bob'   } });
        assert.equal(callCount, 1, 'onInit called exactly once across two load() calls');
    });

    // ---- jQuery UI checkboxradio theming (0.1.3) ---------------------------

    QUnit.test('Theme: checkbox gets the checkboxradio widget in the inline form', async function (assert) {
        ed = makeInline(
            { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } },
            { useJQueryUITheme: true }
        );
        await ed.load({ record: { active: true } });
        await wait(50);
        var $w = ed.fieldInputs.get('active');
        assert.ok($w.find('input[type="checkbox"]').data('ui-checkboxradio'), 'checkbox themed');
        assert.ok($w.find('label').hasClass('ui-state-active'), 'checked label active');
    });

    // ---- "Saving..." button label (0.1.3) ----------------------------------

    QUnit.test('_setButtonsSaving: label changes to Saving... and the check icon survives', function (assert) {
        ed = makeInline({ name: { label: 'Name', type: 'text' } });
        var $save = ed.$saveBtn;
        assert.equal($save.text().trim(), 'Save', 'initial label = Save');

        ed._setButtonsSaving();
        assert.equal($save.text().trim(), 'Saving...', 'label = Saving...');
        assert.ok($save.prop('disabled'), 'Save disabled');
        assert.equal($save.find('.ui-icon-check').length, 1, 'check icon preserved');

        ed._setButtonsNormal();
        assert.equal($save.text().trim(), 'Save', 'label restored');
        assert.notOk($save.prop('disabled'), 'Save re-enabled');
        assert.equal($save.find('.ui-icon-check').length, 1, 'check icon still present');
    });
});


// ============================================================
// 25. RecEditCustomDialog
// ============================================================
QUnit.module('25. RecEditCustomDialog', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    function makeCustomContainer(fields) {
        var $c = $('<div>').css('display', 'none').appendTo('#qunit-fixture');
        Object.keys(fields).forEach(function (name) {
            $c.append($('<div>', { 'data-field': name }));
        });
        var id = 'custom-test-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        $c.attr('id', id);
        return id;
    }

    function makeCustomEditor(fields, extra) {
        var id = makeCustomContainer(fields);
        return new RecEditCustomDialog(Object.assign({
            container: '#' + id,
            fields: fields,
            modal: false,
            effectDuration: 0,
            showEffect: null,
            hideEffect: null,
            appendTo: '#test-sandbox',
            useJQueryUITheme: false
        }, extra || {}));
    }

    QUnit.test('Constructor: throws without container', function (assert) {
        assert.throws(function () { new RecEditCustomDialog({ fields: {} }); }, /container.*required/i);
    });

    QUnit.test('Constructor: throws when container not found', function (assert) {
        assert.throws(
            function () { new RecEditCustomDialog({ container: '#no-exist', fields: {} }); },
            /not found/i
        );
    });

    QUnit.test('open(): injects field inputs into data-field placeholders', async function (assert) {
        ed = makeCustomEditor({
            name:  { label: 'Name',  type: 'text' },
            email: { label: 'Email', type: 'text' }
        });
        await ed.open({ record: { name: 'Alice', email: 'alice@example.com' } });
        assert.equal(ed.getFieldValue('name'),  'Alice',             'name populated');
        assert.equal(ed.getFieldValue('email'), 'alice@example.com', 'email populated');
    });

    QUnit.test('open(): placeholder carries field-group CSS class', async function (assert) {
        ed = makeCustomEditor({ name: { label: 'Name', type: 'text' } });
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(ed.$form.find('[data-field="name"]').hasClass('field-group'), 'field-group class on placeholder');
    });

    QUnit.test('displayFieldErrors: shown in custom layout placeholder', async function (assert) {
        ed = makeCustomEditor({ name: { label: 'Name', type: 'text' } });
        await ed.open({ record: { name: '' } });
        ed.displayFieldErrors([{ name: 'name', status: 'Required' }]);
        assert.equal(ed.$form.find('[data-field="name"] .field-error').text(), 'Required', 'error in custom layout');
    });

    QUnit.test('second open(): re-injects updated field values', async function (assert) {
        ed = makeCustomEditor({ name: { label: 'Name', type: 'text' } });
        await ed.open({ record: { name: 'Alice' } });
        await ed.open({ record: { name: 'Bob' } });
        assert.equal(ed.getFieldValue('name'), 'Bob', 'name = Bob on second open');
    });

    QUnit.test('warn (no throw) for unknown data-field placeholder', async function (assert) {
        // field 'extra' has no placeholder in the container — should warn, not throw
        var id = makeCustomContainer({ name: { label: 'Name', type: 'text' } });
        var warnings = [];
        var origWarn = console.warn;
        console.warn = function (msg) { warnings.push(msg); };
        ed = new RecEditCustomDialog({
            container: '#' + id,
            fields: {
                name:  { label: 'Name',  type: 'text' },
                extra: { label: 'Extra', type: 'text' }  // no placeholder for this
            },
            modal: false, effectDuration: 0, showEffect: null, hideEffect: null,
            appendTo: '#test-sandbox', useJQueryUITheme: false
        });
        await ed.open({ record: { name: 'Alice', extra: 'x' } });
        console.warn = origWarn;
        assert.ok(warnings.some(function (w) { return /extra/.test(w); }), 'warning logged for missing placeholder');
    });

    // --- onInit ---

    QUnit.test('onInit: fires on first open()', async function (assert) {
        var called = false;
        ed = makeCustomEditor(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function () { called = true; } }
        );
        await ed.open({ record: { name: 'Alice' } });
        assert.ok(called, 'onInit fired on first open()');
    });

    QUnit.test('onInit: does NOT fire on second open()', async function (assert) {
        var callCount = 0;
        ed = makeCustomEditor(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function () { callCount++; } }
        );
        await ed.open({ record: { name: 'Alice' } });
        await ed.open({ record: { name: 'Bob' } });
        assert.equal(callCount, 1, 'onInit called exactly once across two open() calls');
    });

    QUnit.test('onInit: receives editor instance', async function (assert) {
        var received = null;
        ed = makeCustomEditor(
            { name: { label: 'Name', type: 'text' } },
            { onInit: function (editor) { received = editor; } }
        );
        await ed.open({ record: { name: 'Alice' } });
        assert.strictEqual(received, ed, 'onInit received the editor instance');
    });

    // ---- jQuery UI checkboxradio theming (0.1.3) ---------------------------

    QUnit.test('Theme: checkbox gets the checkboxradio widget in the custom dialog', async function (assert) {
        ed = makeCustomEditor(
            { active: { label: 'Active', type: 'checkbox', checkboxLabel: 'Active' } },
            { useJQueryUITheme: true }
        );
        await ed.open({ record: { active: true } });
        await wait(50);
        var $w = ed.fieldInputs.get('active');
        assert.ok($w.find('input[type="checkbox"]').data('ui-checkboxradio'), 'checkbox themed');
        assert.ok($w.find('label').hasClass('ui-state-active'), 'checked label active');
    });
});


// ============================================================
// 26. File Field (type: 'file')
// ============================================================
QUnit.module('26. File Field', function (hooks) {
    var ed;
    var realXHR = window.XMLHttpRequest;
    var xhrs = [];

    hooks.afterEach(function () {
        window.XMLHttpRequest = realXHR;
        xhrs = [];
        safeDestroy(ed);
        ed = null;
    });

    // ---- helpers ------------------------------------------------------------

    var PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAGxklEQVR4nBXVn7vGIBjG8XAYDsMwHIbDMAyH4TAchsMvDodhGIbD4XA4POftD3iurufH/RFCMAikYBQogRYYwSSwglngBF4QBIsgClZBEmyCLNgFCA7BKSiCKmiCLrgEt+ARvIJPIMTAMCAHxgE1oAfMwDRgB+YBN+AHwsAyEAfWgTSwDeSBfYCBY+AcKAN1oA30gWvgHngG3oFvQAjJIJGSUaIkWmIkk8RKZomTeEmQLJIoWSVJskmyZJcgOSSnpEiqpEm65JLckkfySj6JECPDiBwZR9SIHjEj04gdmUfciB8JI8tIHFlH0sg2kkf2EUaOkXOkjNSRNtJHrpF75Bl5R74RIRSDQipGhVJohVFMCquYFU7hFUGxKKJiVSTFpsiKXYHiUJyKoqiKpuiKS3ErHsWr+BRCaAaN1IwapdEao5k0VjNrnMZrgmbRRM2qSZpNkzW7Bs2hOTVFUzVN0zWX5tY8mlfzaYQwDAZpGA3KoA3GMBmsYTY4gzcEw2KIhtWQDJshG3YDhsNwGoqhGpqhGy7DbXgMr+EzCDExTMiJcUJN6AkzMU3YiXnCTfiJMLFMxIl1Ik1sE3lin2DimDgnykSdaBN94pq4J56Jd+KbEMIyWKRltCiLthjLZLGW2eIs3hIsiyVaVkuybJZs2S1YDstpKZZqaZZuuSy35bG8ls8ixMwwI2fGGTWjZ8zMNGNn5hk342fCzDITZ9aZNLPN5Jl9hplj5pwpM3WmzfSZa+aeeWbemW9GCMfgkI7RoRzaYRyTwzpmh3N4R3AsjuhYHcmxObJjd+A4HKejOKqjObrjctyOx/E6PocQnsEjPaNHebTHeCaP9cwe5/Ge4Fk80bN6kmfzZM/uwXN4Tk/xVE/zdM/luT2P5/V8HiECQ0AGxoAK6IAJTAEbmAMu4AMhsARiYA2kwBbIgT1A4AicgRKogRbogStwB57AG/gCQiwMC3JhXFALesEsTAt2YV5wC34hLCwLcWFdSAvbQl7YF1g4Fs6FslAX2kJfuBbuhWfhXfgWhIgMERkZIyqiIyYyRWxkjriIj4TIEomRNZIiWyRH9giRI3JGSqRGWqRHrsgdeSJv5IsIsTKsyJVxRa3oFbMyrdiVecWt+JWwsqzElXUlrWwreWVfYeVYOVfKSl1pK33lWrlXnpV35VsRIjEkZGJMqIROmMSUsIk54RI+ERJLIibWREpsiZzYEySOxJkoiZpoiZ64EnfiSbyJL/17sDFsyI1xQ23oDbMxbdiNecNt+I2wsWzEjXUjbWwbeWPfYOPYODfKRt1oG33j2rg3no1349v+PcgMGZkZMyqjMyYzZWxmzriMz4TMkomZNZMyWyZn9gyZI3NmSqZmWqZnrsydeTJv5sv/HuwMO3Jn3FE7esfsTDt2Z95xO34n7Cw7cWfdSTvbTt7Zd9g5ds6dslN32k7fuXbunWfn3fn2fw9+8CF/eKB+AYz5hRj2FwS43zERfgtJ/A2V9GsM+Vf89w44oUCFBh0uuOGBFz7+PTgYDuTBeKAO9IE5mA7swXzgDvxBOFgO4sF6kA62g3ywH7/yx8F5UA7qQTvoB9fBffAcvAff8e/ByXAiT8YTdaJPzMl0Yk/mE3fiT8LJchJP1pN0sp3kk/38ff44OU/KST1pJ/3kOrlPnpP35Dv/PSgMBVkYC6qgC6YwFWxhLriCL4TCUoiFtZAKWyEX9vJrzVE4C6VQC63QC1fhLjyFt/CVfw8qQ0VWxoqq6IqpTBVbmSuu4iuhslRiZa2kylbJlb3+Gn9Uzkqp1Eqr9MpVuStP5a189d+DxtCQjbGhGrphGlPDNuaGa/hGaCyN2FgbqbE1cmNvv7EejbNRGrXRGr1xNe7G03gbX/v3oDN0ZGfsqI7umM7UsZ254zq+EzpLJ3bWTupsndzZ+29pjs7ZKZ3aaZ3euTp35+m8na//e3AxXMiL8UJd6AtzMV3Yi/nCXfiLcLFcxIv1Il1sF/liv34reVycF+WiXrSLfnFd3BfPxXvxXf8e3Aw38ma8UTf6xtxMN/ZmvnE3/ibcLDfxZr1JN9tNvtnv38IfN+dNuak37abfXDf3zXPz3nz3vwcPw4N8GB/Ug34wD9ODfZgf3IN/CA/LQ3xYH9LD9pAf9ud3TsfD+VAe6kN76A/Xw/3wPLwP3/PvwcvwIl/GF/WiX8zL9GJf5hf34l/Cy/ISX9aX9LK95Jf9/R3r8XK+lJf60l76y/Vyvzwv78v3/nvwMXzIj/FDfegP8zF92I/5w334j/CxfMSP9SN9bB/5Y/9+UXB8nB/lo360j/5xfdwfz8f78X38AeFzYFvqzsFiAAAAAElFTkSuQmCC';

    function makeFile(name, type, size) {
        return new File([new Uint8Array(size || 4)], name, { type: type === undefined ? 'image/png' : type });
    }

    /** A File whose reported `size` is overridden (avoids allocating megabytes). */
    function fakeSizeFile(name, size) {
        var f = makeFile(name, 'application/octet-stream', 1);
        Object.defineProperty(f, 'size', { value: size });
        return f;
    }

    /** Assigns `file` to the wrapper's native input and fires a native, bubbling 'change'. */
    function pickFile($wrapper, file) {
        var input = $wrapper.find('input[type="file"]')[0];
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function isShown($el) { return $el.css('display') !== 'none'; }

    function wrapperOf(editor, name) { return editor.fieldInputs.get(name || 'logo'); }

    function errorOf(editor, name) {
        return editor.$form.find('.field-group[data-field="' + (name || 'logo') + '"] .field-error');
    }

    function clickRemove($wrapper) { $wrapper.find('.file-remove-btn')[0].click(); }

    /** Installs a recording XMLHttpRequest mock. */
    function mockXHR() {
        function Mock() {
            this.headers = {};
            this.upload = {};
            this.aborted = false;
            xhrs.push(this);
        }
        Mock.prototype.open = function (m, u) { this.method = m; this.url = u; };
        Mock.prototype.setRequestHeader = function (k, v) { this.headers[k] = v; };
        Mock.prototype.send = function (body) { this.body = body; };
        Mock.prototype.abort = function () { this.aborted = true; if (this.onabort) this.onabort(); };
        Mock.prototype.respond = function (status, text) { this.status = status; this.responseText = text; this.onload(); };
        Mock.prototype.fail = function () { this.onerror(); };
        window.XMLHttpRequest = Mock;
        return xhrs;
    }

    var FILE_FIELD = { label: 'Logo', type: 'file', accept: 'image/*,.pdf' };

    /** Opens a dialog editor with a `logo` file field (plus any extra fields / options). */
    async function openFileEditor(record, extraFields, extraOptions) {
        var fields = Object.assign({ logo: Object.assign({}, FILE_FIELD) }, extraFields || {});
        ed = makeEditor(Object.assign({ fields: fields }, extraOptions || {}));
        await ed.open({ record: record || { logo: '' } });
        return ed;
    }

    function makeFileContainer(fields, hidden) {
        var $c = $('<div>').appendTo('#qunit-fixture');
        if (hidden) $c.css('display', 'none');
        Object.keys(fields).forEach(function (name) {
            $c.append($('<div>', { 'data-field': name }));
        });
        var id = 'file-test-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        $c.attr('id', id);
        return id;
    }

    async function openInlineFileEditor(record, extraOptions, extraFields) {
        var fields = Object.assign({ logo: Object.assign({}, FILE_FIELD) }, extraFields || {});
        var id = makeFileContainer(fields);
        ed = new RecEditInlineForm(Object.assign({
            container: '#' + id, fields: fields, effectDuration: 0, useJQueryUITheme: false
        }, extraOptions || {}));
        await ed.load({ record: record || { logo: '' } });
        return ed;
    }

    async function openCustomFileEditor(record, extraOptions) {
        var fields = { logo: Object.assign({}, FILE_FIELD) };
        var id = makeFileContainer(fields, true);
        ed = new RecEditCustomDialog(Object.assign({
            container: '#' + id, fields: fields, modal: false, effectDuration: 0,
            showEffect: null, hideEffect: null, appendTo: '#test-sandbox', useJQueryUITheme: false
        }, extraOptions || {}));
        await ed.open({ record: record || { logo: '' } });
        return ed;
    }

    function dragEvent(type, files, extra) {
        var dt = new DataTransfer();
        (files || []).forEach(function (f) { dt.items.add(f); });
        if (extra && extra.text) dt.setData('text/plain', extra.text);
        return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    }

    /** A drop event with a hand-built dataTransfer (for directory entries, which can't be synthesised). */
    function fakeDrop(items) {
        var ev = new Event('drop', { bubbles: true, cancelable: true });
        ev.dataTransfer = {
            types: ['Files'],
            items: items.map(function (it) {
                return {
                    kind: 'file',
                    webkitGetAsEntry: function () { return { isDirectory: !!it.dir }; },
                    getAsFile: function () { return it.file; }
                };
            }),
            files: items.map(function (it) { return it.file; })
        };
        return ev;
    }

    // =========================================================================
    // Rendering
    // =========================================================================

    QUnit.test('renders wrapper, native input, thumbnail slot, Remove button and drop hint', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        assert.ok($w.hasClass('file-field'), 'wrapper is div.file-field');
        assert.equal($w.find('input[type="file"]').length, 1, 'one native file input');
        assert.equal($w.find('input[type="file"]').attr('name'), 'logo', 'input named after the field');
        assert.equal($w.find('.file-thumb').length, 1, 'thumbnail slot present');
        assert.notOk(isShown($w.find('.file-thumb')), 'thumbnail hidden when there is no value');
        assert.equal($w.find('.file-remove-btn').attr('type'), 'button', 'Remove is type=button');
        assert.equal($w.find('.file-remove-btn').text(), 'Remove', 'Remove label from messages.removeFile');
        assert.equal($w.find('.file-drop-hint').text(), 'or drop a file here (image/*, .pdf)', 'drop hint from messages.dropHint, plus accepted types');
        assert.equal($w.find('progress').length, 0, 'no per-field progress element');
    });

    QUnit.test('accept is passed to the native input', async function (assert) {
        await openFileEditor({ logo: '' });
        assert.equal(wrapperOf(ed).find('input[type="file"]').attr('accept'), 'image/*,.pdf', 'accept attribute set');
    });

    QUnit.test('custom messages: removeFile and dropHint', async function (assert) {
        await openFileEditor({ logo: 'a.png' }, null, { messages: { removeFile: 'Delete', dropHint: 'Drop here' } });
        var $w = wrapperOf(ed);
        assert.equal($w.find('.file-remove-btn').text(), 'Delete', 'removeFile overridden');
        assert.equal($w.find('.file-drop-hint').text(), 'Drop here (image/*, .pdf)', 'dropHint overridden');
    });

    QUnit.test('drop hint restrictions: none, accept + max size, custom fileMaxSize message', async function (assert) {
        await openFileEditor({ logo: '' }, { logo: { label: 'Logo', type: 'file' } });
        assert.equal(wrapperOf(ed).find('.file-drop-hint').text(), 'or drop a file here', 'no restrictions -> bare hint');
        safeDestroy(ed);

        await openFileEditor({ logo: '' }, { logo: { label: 'Logo', type: 'file', accept: '.jpg', maxFileSize: 150 * 1024 } });
        assert.equal(wrapperOf(ed).find('.file-drop-hint').text(), 'or drop a file here (.jpg max size 150K)', 'accept + max size');
        safeDestroy(ed);

        await openFileEditor({ logo: '' }, { logo: { label: 'Logo', type: 'file', maxFileSize: 5 * 1024 * 1024 } },
            { messages: { fileMaxSize: 'limit {size}' } });
        assert.equal(wrapperOf(ed).find('.file-drop-hint').text(), 'or drop a file here (limit 5M)', 'custom fileMaxSize message');
    });

    QUnit.test('Remove button does not submit the form', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var submitted = false;
        ed.$form.on('submit', function (e) { submitted = true; e.preventDefault(); });
        clickRemove(wrapperOf(ed));
        assert.notOk(submitted, 'no form submit on Remove click');
    });

    // =========================================================================
    // _setInputValue via open() / setFieldValue() / restoreForm()
    // =========================================================================

    QUnit.test('open(): existing filename is shown with the Remove button', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        assert.ok(isShown($w.find('.file-current')), 'filename line visible');
        assert.equal($w.find('.file-current-name').text(), 'a.png', 'filename text');
        assert.ok(isShown($w.find('.file-remove-btn')), 'Remove visible');
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'getFieldValue = existing name');
    });

    QUnit.test('open(): empty, null and undefined values show no file', async function (assert) {
        var values = ['', null, undefined];
        for (var i = 0; i < values.length; i++) {
            safeDestroy(ed);
            await openFileEditor({ logo: values[i] }, { name: { type: 'text' } });
            var $w = wrapperOf(ed);
            assert.notOk(isShown($w.find('.file-current')), 'no filename line for ' + String(values[i]));
            assert.notOk(isShown($w.find('.file-thumb')), 'no thumbnail for ' + String(values[i]));
            assert.strictEqual(ed.getFieldValue('logo'), '', 'value is "" for ' + String(values[i]));
        }
    });

    QUnit.test('thumbnailUrl function: called with (record, fieldName); src applied', async function (assert) {
        var calls = [];
        await openFileEditor({ logo: 'a.png', id: 7 }, null, null);
        ed.options.fields.logo.thumbnailUrl = function (rec, name) { calls.push([rec, name]); return PX; };
        await ed.setFieldValue('logo', 'b.png');
        var $thumb = wrapperOf(ed).find('.file-thumb');
        assert.equal($thumb.attr('src'), PX, 'src from function');
        assert.ok(isShown($thumb), 'thumbnail visible');
        assert.equal(calls[0][1], 'logo', 'fieldName passed');
        assert.equal(calls[0][0].logo, 'b.png', 'record merged with the candidate value');
        assert.equal(calls[0][0].id, 7, 'record carries other current fields');
    });

    QUnit.test('thumbnailUrl string template: tokens replaced with URL-encoded record values', async function (assert) {
        await openFileEditor({ logo: 'a.png', id: 7 });
        var cfg = { type: 'file', thumbnailUrl: '/files/{id}/{logo}?x={missing}' };
        assert.equal(ed._resolveThumbnailUrl(cfg, 'logo', 'a b&c.png'), '/files/7/a%20b%26c.png?x=', 'tokens encoded, unknown token empty');
        assert.strictEqual(ed._resolveThumbnailUrl(cfg, 'logo', ''), null, 'empty value gives no URL');
        assert.strictEqual(ed._resolveThumbnailUrl({ type: 'file' }, 'logo', 'a.png'), null, 'no thumbnailUrl gives no URL');
    });

    QUnit.test('thumbnail error handler hides the image', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        ed.options.fields.logo.thumbnailUrl = function () { return PX; };
        await ed.setFieldValue('logo', 'a.png');
        var $thumb = wrapperOf(ed).find('.file-thumb');
        assert.ok(isShown($thumb), 'shown before error');
        $thumb[0].dispatchEvent(new Event('error'));   // native, non-bubbling (jQuery trigger('error') would reach window.onerror)
        assert.notOk(isShown($thumb), 'hidden after error');
        assert.equal($thumb.attr('src'), '', 'src cleared');
    });

    QUnit.test('setFieldValue(): updates state, filename line and currentRecord', async function (assert) {
        await openFileEditor({ logo: '' });
        await ed.setFieldValue('logo', 'new.pdf');
        assert.equal(ed.getFieldValue('logo'), 'new.pdf', 'value set');
        assert.equal(wrapperOf(ed).find('.file-current-name').text(), 'new.pdf', 'filename shown');
        assert.equal(ed.edpak.currentRecord.logo, 'new.pdf', 'currentRecord updated');
    });

    QUnit.test('setFieldValue(): discards a pending selection and resets the input', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('x.png'));
        await ed.setFieldValue('logo', 'b.png');
        assert.strictEqual($w.data('fileState').file, null, 'pending file discarded');
        assert.equal($w.find('input[type="file"]')[0].files.length, 0, 'native input cleared');
        assert.equal(ed.getFieldValue('logo'), 'b.png', 'value = b.png');
    });

    QUnit.test('restoreForm(): returns to the original record state', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('x.png'));
        assert.equal(ed.getFieldValue('logo'), 'x.png', 'new file chosen');
        await ed.restoreForm();
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'back to a.png');
        assert.deepEqual(ed._getFileUploads(), {}, 'no pending upload');
        clickRemove($w);
        assert.equal(ed.getFieldValue('logo'), '', 'removed');
        await ed.restoreForm();
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'removal undone by restoreForm');
    });

    QUnit.test('_setInputValue(): still works with three arguments', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        await ed._setInputValue($w, 'x.png', ed.options.fields.logo);
        assert.equal(ed.getFieldValue('logo'), 'x.png', 'value set without fieldName');
        assert.notOk(isShown($w.find('.file-thumb')), 'no thumbnail (none configured)');
    });

    // =========================================================================
    // State table: _getFormData / getFieldValue / _getFileUploads
    // =========================================================================

    QUnit.test('state: existing file, untouched', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        assert.equal(ed._getFormData().logo, 'a.png', 'formdata keeps the existing name');
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'getFieldValue');
        assert.deepEqual(ed._getFileUploads(), {}, 'no file part');
    });

    QUnit.test('state: new file chosen', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        var f = makeFile('new.png', 'image/png');
        pickFile($w, f);
        assert.equal(ed._getFormData().logo, 'new.png', 'formdata = chosen name');
        assert.equal(ed.getFieldValue('logo'), 'new.png', 'getFieldValue = chosen name');
        assert.strictEqual(ed._getFileUploads().logo, f, 'File returned for upload');
        assert.equal($w.find('.file-current-name').text(), 'new.png', 'filename line shows chosen name');
        assert.ok(isShown($w.find('.file-remove-btn')), 'Remove visible');
        assert.ok(/^blob:/.test($w.find('.file-thumb').attr('src')), 'local preview for an image');
        assert.ok($w.data('fileState').previewUrl, 'preview URL tracked');
    });

    QUnit.test('state: non-image selection shows no preview', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('doc.pdf', 'application/pdf'));
        assert.notOk(isShown($w.find('.file-thumb')), 'thumbnail hidden for a PDF');
        assert.equal(ed.getFieldValue('logo'), 'doc.pdf', 'value = doc.pdf');
    });

    QUnit.test('state: Remove with no new file selected clears the value', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        clickRemove($w);
        assert.equal(ed._getFormData().logo, '', 'formdata = ""');
        assert.equal(ed.getFieldValue('logo'), '', 'getFieldValue = ""');
        assert.deepEqual(ed._getFileUploads(), {}, 'no file part');
        assert.notOk(isShown($w.find('.file-current')), 'filename hidden');
        assert.notOk(isShown($w.find('.file-thumb')), 'thumbnail hidden');
    });

    QUnit.test('state: Remove with a new file selected reverts to the original; second Remove clears', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        ed.options.fields.logo.thumbnailUrl = function () { return PX; };
        await ed.restoreForm();
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('new.png'));
        var previewUrl = $w.data('fileState').previewUrl;
        assert.ok(previewUrl, 'preview active');

        clickRemove($w);
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'reverted to the original value');
        assert.deepEqual(ed._getFileUploads(), {}, 'selection discarded');
        assert.equal($w.find('input[type="file"]')[0].files.length, 0, 'native input cleared');
        assert.equal($w.find('.file-current-name').text(), 'a.png', 'original filename shown again');
        assert.equal($w.find('.file-thumb').attr('src'), PX, 'original thumbnail restored');
        assert.strictEqual($w.data('fileState').previewUrl, null, 'preview URL released');
        assert.strictEqual($w.data('fileState').cleared, false, 'not cleared');

        clickRemove($w);
        assert.equal(ed.getFieldValue('logo'), '', 'second Remove clears the value');
    });

    QUnit.test('state: choosing a file after Remove replaces the cleared state', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        clickRemove($w);
        pickFile($w, makeFile('new.png'));
        assert.strictEqual($w.data('fileState').cleared, false, 'cleared reset');
        assert.equal(ed.getFieldValue('logo'), 'new.png', 'value = new.png');
        assert.ok(ed._getFileUploads().logo, 'file queued for upload');
    });

    QUnit.test('state: no original file, choose then Remove returns to empty', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('new.png'));
        clickRemove($w);
        assert.equal(ed.getFieldValue('logo'), '', 'value empty');
        assert.notOk(isShown($w.find('.file-current')), 'filename line (with Remove) hidden');
    });

    QUnit.test('_getFileUploads(): excludes transient fields and fields with no new file', async function (assert) {
        await openFileEditor({ logo: '', doc: '', extra: '' }, {
            doc:   { type: 'file', transient: true },
            extra: { type: 'file' }
        });
        var f1 = makeFile('a.png'), f2 = makeFile('b.png');
        pickFile(wrapperOf(ed, 'logo'), f1);
        pickFile(wrapperOf(ed, 'doc'), f2);
        var uploads = ed._getFileUploads();
        assert.deepEqual(Object.keys(uploads), ['logo'], 'only logo is uploaded');
        assert.strictEqual(uploads.logo, f1, 'File object returned');
        assert.notOk('doc' in ed._getFormData(), 'transient field excluded from formdata');
    });

    // =========================================================================
    // Selection validation
    // =========================================================================

    QUnit.test('accept: a disallowed type is rejected with a field error', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('notes.txt', 'text/plain'));
        assert.equal($w.find('input[type="file"]')[0].files.length, 0, 'input cleared');
        assert.strictEqual($w.data('fileState').file, null, 'state.file null');
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'value unchanged');
        assert.equal(errorOf(ed).text(), 'File type not allowed', 'error text');
        assert.ok(errorOf(ed).is(':visible'), '.field-error visible');
        assert.ok($w.hasClass('field-invalid'), 'wrapper marked invalid');
    });

    QUnit.test('accept: MIME wildcard and extension both match; empty MIME accepts on extension', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('a.png', 'image/png'));
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'image/* matches image/png');
        pickFile($w, makeFile('b.pdf', 'application/pdf'));
        assert.equal(ed.getFieldValue('logo'), 'b.pdf', '.pdf matches by extension');
        pickFile($w, makeFile('c.PDF', ''));
        assert.equal(ed.getFieldValue('logo'), 'c.PDF', 'empty MIME + matching extension accepted (case-insensitive)');
        pickFile($w, makeFile('d.xyz', ''));
        assert.equal(ed.getFieldValue('logo'), '', 'empty MIME + unknown extension rejected (selection discarded)');
        assert.equal(errorOf(ed).text(), 'File type not allowed', 'error shown');
    });

    QUnit.test('maxFileSize: an oversized file is rejected', async function (assert) {
        await openFileEditor({ logo: '' }, null, null);
        ed.options.fields.logo.maxFileSize = 10;
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('big.png', 'image/png', 20));
        assert.strictEqual($w.data('fileState').file, null, 'not stored');
        assert.equal($w.find('input[type="file"]')[0].files.length, 0, 'input cleared');
        assert.equal(errorOf(ed).text(), 'File is too large', 'error text from messages.fileTooLarge');
        assert.ok($w.hasClass('field-invalid'), 'wrapper invalid');
        pickFile($w, makeFile('ok.png', 'image/png', 10));
        assert.equal(ed.getFieldValue('logo'), 'ok.png', 'a file at the limit is accepted');
    });

    QUnit.test('rejection messages are overridable', async function (assert) {
        await openFileEditor({ logo: '' }, null, { messages: { fileTypeNotAllowed: 'Nope' } });
        pickFile(wrapperOf(ed), makeFile('x.txt', 'text/plain'));
        assert.equal(errorOf(ed).text(), 'Nope', 'custom message used');
    });

    QUnit.test('field error clears on the next selection and on Remove, leaving other fields alone', async function (assert) {
        await openFileEditor({ logo: 'a.png', name: '' }, { name: { type: 'text' } });
        var $w = wrapperOf(ed);
        ed.displayFieldErrors([{ name: 'name', status: 'Name problem' }]);

        pickFile($w, makeFile('x.txt', 'text/plain'));
        assert.equal(errorOf(ed).text(), 'File type not allowed', 'file error shown');
        pickFile($w, makeFile('ok.png'));
        assert.equal(errorOf(ed).text(), '', 'cleared by next selection');
        assert.notOk($w.hasClass('field-invalid'), 'field-invalid removed');

        pickFile($w, makeFile('x.txt', 'text/plain'));
        clickRemove($w);
        assert.equal(errorOf(ed).text(), '', 'cleared by Remove');
        assert.equal(errorOf(ed, 'name').text(), 'Name problem', "other field's error left alone");
    });

    QUnit.test('displayFieldErrors() from a server response marks the file field; clearFieldErrors() removes it', async function (assert) {
        await openFileEditor({ logo: '' });
        ed.displayFieldErrors([{ name: 'logo', status: 'Rejected by server' }]);
        assert.equal(errorOf(ed).text(), 'Rejected by server', 'message under the file field');
        assert.ok(errorOf(ed).is(':visible'), 'visible');
        assert.ok(wrapperOf(ed).hasClass('field-invalid'), 'wrapper marked invalid');
        ed.clearFieldErrors();
        assert.equal(errorOf(ed).text(), '', 'message cleared');
        assert.notOk(wrapperOf(ed).hasClass('field-invalid'), 'invalid marker cleared');
    });

    // =========================================================================
    // Field flags and callbacks
    // =========================================================================

    QUnit.test('readonly / readOnly / disabled: input disabled, no Remove, no hint, readonly-field class', async function (assert) {
        var flags = ['readonly', 'readOnly', 'disabled'];
        for (var i = 0; i < flags.length; i++) {
            safeDestroy(ed);
            var cfg = { type: 'file' };
            cfg[flags[i]] = true;
            ed = makeEditor({ fields: { logo: cfg } });
            await ed.open({ record: { logo: 'a.png' } });
            var $w = wrapperOf(ed);
            assert.ok($w.hasClass('readonly-field'), flags[i] + ': readonly-field class');
            assert.ok($w.find('input[type="file"]').prop('disabled'), flags[i] + ': input disabled');
            assert.notOk(isShown($w.find('.file-remove-btn')), flags[i] + ': Remove hidden even with a file');
            assert.equal($w.find('.file-drop-hint').length, 0, flags[i] + ': no drop hint');
            assert.equal(ed.getFieldValue('logo'), 'a.png', flags[i] + ': value still reported');
        }
    });

    QUnit.test('hidden: the field group is hidden but still contributes its value', async function (assert) {
        await openFileEditor({ logo: 'a.png' }, null, null);
        ed.hideField('logo');
        assert.notOk(isShown(ed.$form.find('[data-field="logo"]')), 'group hidden');
        assert.equal(ed._getFormData().logo, 'a.png', 'value still in formdata');

        safeDestroy(ed);
        ed = makeEditor({ fields: { logo: { type: 'file', hidden: true } } });
        await ed.open({ record: { logo: 'a.png' } });
        assert.notOk(isShown(ed.$form.find('[data-field="logo"]')), 'hidden:true in config hides the group');
    });

    QUnit.test('transient: excluded from formdata and uploads', async function (assert) {
        await openFileEditor({ logo: 'a.png' }, null, null);
        ed.options.fields.logo.transient = true;
        pickFile(wrapperOf(ed), makeFile('x.png'));
        assert.notOk('logo' in ed._getFormData(), 'not in formdata');
        assert.deepEqual(ed._getFileUploads(), {}, 'not in uploads');
    });

    QUnit.test('required: marker only (asterisk class and aria-required), nothing enforced', async function (assert) {
        await openFileEditor({ logo: '' }, null, null);
        safeDestroy(ed);
        ed = makeEditor({ fields: { logo: { type: 'file', required: true } } });
        await ed.open({ record: { logo: '' } });
        assert.ok(ed.$form.find('[data-field="logo"]').hasClass('field-required'), 'field-required class');
        assert.equal(wrapperOf(ed).attr('aria-required'), 'true', 'aria-required on the wrapper');
        var saved = false;
        ed.options.onSave = function () { saved = true; };
        await ed._handleSave();
        assert.ok(saved, 'save proceeds with no file (host validates via validateForm)');
        assert.strictEqual(ed.edpak.formdata.logo, '', 'formdata.logo === "" is what a host checks');
    });

    QUnit.test('onChange: fires on select and on Remove with (value, fieldName, editor)', async function (assert) {
        var calls = [];
        await openFileEditor({ logo: 'a.png' }, null, null);
        safeDestroy(ed);
        ed = makeEditor({ fields: { logo: { type: 'file', onChange: function (v, n, e) { calls.push([v, n, e]); } } } });
        await ed.open({ record: { logo: 'a.png' } });
        pickFile(wrapperOf(ed), makeFile('new.png', 'image/png'));
        assert.equal(calls.length, 1, 'fired on select');
        assert.equal(calls[0][0], 'new.png', 'value passed');
        assert.equal(calls[0][1], 'logo', 'fieldName passed');
        assert.strictEqual(calls[0][2], ed, 'editor passed');
        clickRemove(wrapperOf(ed));
        assert.equal(calls.length, 2, 'fired on Remove');
        assert.equal(calls[1][0], 'a.png', 'value after Remove reflects the revert');
    });

    // =========================================================================
    // Focus and autocomplete
    // =========================================================================

    QUnit.test('focus: a file field placed first does not take initial focus (dialog)', async function (assert) {
        ed = makeEditor({ fields: { logo: { type: 'file' }, name: { type: 'text' } } });
        await ed.open({ record: { logo: '', name: '' } });
        await wait(200);
        assert.equal($(document.activeElement).attr('name'), 'name', 'text field focused instead');
    });

    QUnit.test('focus: a file field placed first does not take initial focus (inline)', async function (assert) {
        await openInlineFileEditor({ logo: '', name: '' }, null, { name: { type: 'text' } });
        await wait(200);
        assert.notEqual($(document.activeElement).attr('type'), 'file', 'file input not focused');
    });

    QUnit.test('autocomplete nextfield skips file fields', async function (assert) {
        var captured = {};
        ed = makeEditor({
            fields: {
                city: { type: 'autocomplete', source: ['London'] },
                logo: { type: 'file' },
                name: { type: 'text' }
            }
        });
        ed._attachAutocompleteChange = function ($f, cur, next) { captured[cur] = next; };
        await ed.open({ record: { city: '', logo: '', name: '' } });
        assert.equal(captured.city, 'name', 'next field after city is name, not the file field');
    });

    // =========================================================================
    // Upload progress bar (form-level)
    // =========================================================================

    QUnit.test('progress: created once in the dialog button pane, updated, hidden', async function (assert) {
        await openFileEditor({ logo: '' });
        var $pane = ed.$dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane');
        assert.equal($pane.find('.recedit-upload-progress').length, 0, 'not created until needed');

        ed._showUploadProgress(0);
        ed._showUploadProgress(42.4);
        assert.equal($pane.find('.recedit-upload-progress').length, 1, 'exactly one element in the button pane');
        assert.equal($pane.children().first()[0], ed._$uploadProgress[0], 'prepended (left side)');
        assert.equal($pane.find('progress').attr('max'), '100', 'max = 100');
        assert.equal($pane.find('progress').val(), 42, 'value rounded');
        assert.equal($pane.find('.recedit-upload-label').text(), 'Uploading... 42%', 'label');
        assert.ok(ed._$uploadProgress.is(':visible'), 'visible');

        ed._showUploadProgress(250);
        assert.equal($pane.find('progress').val(), 100, 'clamped to 100');

        ed._hideUploadProgress();
        assert.notOk(ed._$uploadProgress.is(':visible'), 'hidden');
        assert.equal($pane.find('progress').val(), 0, 'reset to 0');
    });

    QUnit.test('progress: label uses messages.uploading', async function (assert) {
        await openFileEditor({ logo: '' }, null, { messages: { uploading: 'Sending {pct} percent' } });
        ed._showUploadProgress(7);
        assert.equal(ed._$uploadProgress.find('.recedit-upload-label').text(), 'Sending 7 percent', 'custom label');
    });

    QUnit.test('progress: repeated open() does not create duplicates', async function (assert) {
        await openFileEditor({ logo: '' });
        ed._showUploadProgress(10);
        await ed.open({ record: { logo: 'a.png' } });
        ed._showUploadProgress(20);
        assert.equal(ed.$dialog.closest('.ui-dialog').find('.recedit-upload-progress').length, 1, 'still one');
    });

    QUnit.test('progress: survives a button-pane rebuild (_setButtonsSaving) and reappears', async function (assert) {
        await openFileEditor({ logo: '' });
        ed._showUploadProgress(10);
        ed._setButtonsSaving();   // dialog('option','buttons',...) rebuilds the pane
        ed._showUploadProgress(30);
        var $pane = ed.$dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane');
        assert.equal($pane.find('.recedit-upload-progress').length, 1, 'one bar in the rebuilt pane');
        assert.ok($.contains(document.documentElement, ed._$uploadProgress[0]), 'attached to the DOM');
        assert.equal($pane.find('progress').val(), 30, 'value updated');
    });

    QUnit.test('progress: inline form uses .recedit-button-bar', async function (assert) {
        await openInlineFileEditor({ logo: '' });
        ed._showUploadProgress(10);
        ed._showUploadProgress(55);
        var $bar = ed._$container.find('.recedit-button-bar');
        assert.equal($bar.find('.recedit-upload-progress').length, 1, 'one bar in the button bar');
        assert.equal($bar.find('progress').val(), 55, 'value');
        ed._hideUploadProgress();
        assert.notOk(ed._$uploadProgress.is(':visible'), 'hidden');
    });

    QUnit.test('progress: custom dialog uses the dialog button pane', async function (assert) {
        await openCustomFileEditor({ logo: '' });
        ed._showUploadProgress(10);
        var $pane = ed.$dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane');
        assert.equal($pane.find('.recedit-upload-progress').length, 1, 'one bar in the button pane');
    });

    QUnit.test('progress: hide is safe before creation and after destroy', async function (assert) {
        await openFileEditor({ logo: '' });
        ed._hideUploadProgress();
        ed._showUploadProgress(10);
        ed.destroy();
        ed._hideUploadProgress();
        ed._showUploadProgress(10);
        assert.ok(true, 'no exception');
        ed = null;
    });

    QUnit.test('progress: public showUploadProgress / hideUploadProgress delegate to the private methods', async function (assert) {
        await openFileEditor({ logo: '' });
        var calls = [];
        ed._showUploadProgress = function (p) { calls.push(['show', p]); };
        ed._hideUploadProgress = function () { calls.push(['hide']); };
        ed.showUploadProgress(12);
        ed.hideUploadProgress();
        assert.deepEqual(calls, [['show', 12], ['hide']], 'delegated');
    });

    // =========================================================================
    // submit()
    // =========================================================================

    function edpakWith(files, formdata) {
        return { formdata: formdata || { name: 'Acme', logo: 'a.png' }, files: files || {} };
    }

    QUnit.test('submit(): multipart body, method, URL, header passthrough, credentials', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var f = makeFile('a.png');
        var p = ed.submit('/api/save', edpakWith({ logo: f }), {
            headers: { 'X-CSRFToken': 'tok' }, withCredentials: true
        });
        var x = xhrs[0];
        assert.equal(x.method, 'POST', 'default method POST');
        assert.equal(x.url, '/api/save', 'url');
        assert.ok(x.body instanceof FormData, 'FormData body');
        assert.deepEqual(JSON.parse(x.body.get('data')), { name: 'Acme', logo: 'a.png' }, 'data part holds the JSON');
        assert.equal(x.body.get('logo').name, 'a.png', 'file part under the field name');
        assert.equal(x.headers['X-CSRFToken'], 'tok', 'header passed through');
        assert.strictEqual(x.withCredentials, true, 'withCredentials');
        assert.strictEqual(ed._activeUpload, x, 'in-flight XHR stored');
        x.respond(200, '{"ok":1}');
        await p;
        assert.strictEqual(ed._activeUpload, null, 'cleared after completion');
    });

    QUnit.test('submit(): custom method and dataField; no files sends only the data part', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var p = ed.submit('/api/save', edpakWith({}), { method: 'PUT', dataField: 'json' });
        var x = xhrs[0];
        assert.equal(x.method, 'PUT', 'method');
        assert.ok(x.body.has('json'), 'custom data field');
        assert.notOk(x.body.has('data'), 'default data field absent');
        assert.equal(Array.from(x.body.keys()).length, 1, 'no file parts');
        x.respond(204, '');
        assert.strictEqual(await p, null, 'empty body resolves null');
    });

    QUnit.test('submit(): a Content-Type header is ignored with a warning', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var warned = [];
        var origWarn = console.warn;
        console.warn = function (m) { warned.push(m); };
        var p = ed.submit('/api/save', edpakWith({}), { headers: { 'content-type': 'application/json', 'X-A': '1' } });
        console.warn = origWarn;
        var x = xhrs[0];
        assert.notOk(Object.keys(x.headers).some(function (k) { return k.toLowerCase() === 'content-type'; }), 'Content-Type not set');
        assert.equal(x.headers['X-A'], '1', 'other headers kept');
        assert.ok(warned.some(function (w) { return /Content-Type/i.test(w); }), 'warning logged');
        x.respond(200, '{}');
        await p;
    });

    QUnit.test('submit(): 2xx resolves with the parsed JSON body', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        xhrs[0].respond(201, '{"id":5,"logo":"stored.png"}');
        assert.deepEqual(await p, { id: 5, logo: 'stored.png' }, 'parsed record');
    });

    QUnit.test('submit(): field-error array calls displayFieldErrors and rejects with an empty message', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        xhrs[0].respond(422, '[{"name":"logo","status":"Bad file"}]');
        try { await p; assert.ok(false, 'should reject'); }
        catch (e) { assert.strictEqual(e.message, '', 'empty message (already handled)'); assert.notOk(e.aborted, 'not an abort'); }
        assert.equal(errorOf(ed).text(), 'Bad file', 'error shown under the field');
        assert.ok(wrapperOf(ed).hasClass('field-invalid'), 'field invalid');
    });

    QUnit.test('submit(): HTTP 413 (HTML body) maps to messages.fileTooLarge', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, null, { messages: { fileTooLarge: 'Way too big' } });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        xhrs[0].respond(413, '<html><body>Request Entity Too Large</body></html>');
        try { await p; assert.ok(false, 'should reject'); }
        catch (e) { assert.equal(e.message, 'Way too big', 'mapped message'); }
    });

    QUnit.test('submit(): other errors use the server message or a generic text', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var p = ed.submit('/api/save', edpakWith({}));
        xhrs[0].respond(500, '{"message":"Database down"}');
        try { await p; } catch (e) { assert.equal(e.message, 'Database down', 'server message'); }

        p = ed.submit('/api/save', edpakWith({}));
        xhrs[1].respond(502, '<html>Bad gateway</html>');
        try { await p; } catch (e) { assert.ok(/502/.test(e.message), 'generic text mentions the status'); }
    });

    QUnit.test('submit(): network error rejects with messages.uploadFailed', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        xhrs[0].fail();
        try { await p; assert.ok(false, 'should reject'); }
        catch (e) { assert.equal(e.message, 'Upload failed', 'uploadFailed message'); }
        assert.strictEqual(ed._activeUpload, null, 'cleared');
    });

    QUnit.test('submit(): abort rejects with aborted = true and hides the bar', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, null, { fileProgressMinSize: 0 });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        assert.ok(ed._$uploadProgress.is(':visible'), 'bar visible while in flight');
        ed._abortUpload();
        try { await p; assert.ok(false, 'should reject'); }
        catch (e) { assert.strictEqual(e.aborted, true, 'aborted flag'); assert.strictEqual(e.message, '', 'empty message'); }
        assert.ok(xhrs[0].aborted, 'xhr.abort() called');
        assert.notOk(ed._$uploadProgress.is(':visible'), 'bar hidden');
        assert.strictEqual(ed._activeUpload, null, 'cleared');
    });

    QUnit.test('submit(): progress uses event.total (not the file sizes) and drives the form-level bar', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, null, { fileProgressMinSize: 0 });
        var p = ed.submit('/api/save', edpakWith({ logo: fakeSizeFile('big.bin', 1000) }));
        var x = xhrs[0];
        assert.equal(ed._$uploadProgress.find('progress').val(), 0, 'starts at 0');
        x.upload.onprogress({ lengthComputable: true, loaded: 500, total: 2000 });
        assert.equal(ed._$uploadProgress.find('progress').val(), 25, '500 of event.total 2000 = 25%');
        assert.equal(ed._$uploadProgress.find('.recedit-upload-label').text(), 'Uploading... 25%', 'label');
        x.upload.onprogress({ lengthComputable: false, loaded: 1, total: 0 });
        assert.equal(ed._$uploadProgress.find('progress').val(), 25, 'ignored when length is not computable');
        x.respond(200, '{}');
        await p;
        assert.notOk(ed._$uploadProgress.is(':visible'), 'bar hidden on success');
    });

    QUnit.test('submit(): bar hidden after an error response', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, null, { fileProgressMinSize: 0 });
        var p = ed.submit('/api/save', edpakWith({ logo: makeFile('a.png') }));
        assert.ok(ed._$uploadProgress.is(':visible'), 'visible in flight');
        xhrs[0].respond(500, '{"message":"x"}');
        try { await p; } catch (e) { /* expected */ }
        assert.notOk(ed._$uploadProgress.is(':visible'), 'hidden after error');
    });

    QUnit.test('fileProgressMinSize: default threshold is 1 MB', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' });
        assert.equal(ed.options.fileProgressMinSize, 1048576, 'default 1 MB');
        var p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('small.bin', 1048575) }));
        assert.notOk(ed._$uploadProgress, 'just below: no bar');
        xhrs[0].respond(200, '{}'); await p;
        p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('exact.bin', 1048576) }));
        assert.ok(ed._$uploadProgress && ed._$uploadProgress.is(':visible'), 'at the threshold: bar shown');
        xhrs[1].respond(200, '{}'); await p;
    });

    QUnit.test('fileProgressMinSize: threshold applies to the TOTAL size of all files', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, { doc: { type: 'file' } }, { fileProgressMinSize: 1000 });
        var p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('a.bin', 600) }));
        assert.notOk(ed._$uploadProgress, 'one file below the threshold: no bar');
        xhrs[0].respond(200, '{}'); await p;
        p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('a.bin', 600), doc: fakeSizeFile('b.bin', 600) }));
        assert.ok(ed._$uploadProgress && ed._$uploadProgress.is(':visible'), 'two files each below, together above: bar shown');
        xhrs[1].respond(200, '{}'); await p;
    });

    QUnit.test('fileProgressMinSize: 0 always shows (with files), false never shows, no files never shows', async function (assert) {
        mockXHR();
        await openFileEditor({ logo: '' }, null, { fileProgressMinSize: 0 });
        var p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('tiny.bin', 1) }));
        assert.ok(ed._$uploadProgress.is(':visible'), '0: shown for a tiny file');
        xhrs[0].respond(200, '{}'); await p;
        ed._$uploadProgress = null;

        p = ed.submit('/s', edpakWith({}));
        assert.notOk(ed._$uploadProgress, '0 but no files: not shown');
        xhrs[1].respond(200, '{}'); await p;

        ed.options.fileProgressMinSize = false;
        p = ed.submit('/s', edpakWith({ logo: fakeSizeFile('huge.bin', 1e9) }));
        assert.notOk(ed._$uploadProgress, 'false: never shown');
        xhrs[2].respond(200, '{}'); await p;
    });

    // =========================================================================
    // _handleSave() integration
    // =========================================================================

    QUnit.test('_handleSave(): edpak.files and formdata are available to validateForm and onSave', async function (assert) {
        var seen = {};
        await openFileEditor({ logo: 'a.png' }, null, {
            validateForm: function (edpak) { seen.validate = { files: edpak.files, data: edpak.formdata }; return null; },
            onSave: function (edpak) { seen.save = { files: edpak.files, data: edpak.formdata }; return null; }
        });
        var f = makeFile('new.png');
        pickFile(wrapperOf(ed), f);
        await ed._handleSave();
        assert.strictEqual(seen.validate.files.logo, f, 'validateForm sees edpak.files');
        assert.equal(seen.validate.data.logo, 'new.png', 'validateForm sees formdata filename');
        assert.strictEqual(seen.save.files.logo, f, 'onSave sees edpak.files');
    });

    QUnit.test('_handleSave(): validateForm can use formdata[field] === "" for "required"', async function (assert) {
        var saved = false;
        await openFileEditor({ logo: '' }, null, {
            validateForm: function (edpak) {
                return edpak.formdata.logo === '' ? [{ name: 'logo', status: 'A logo is required' }] : null;
            },
            onSave: function () { saved = true; }
        });
        await ed._handleSave();
        assert.notOk(saved, 'save blocked');
        assert.equal(errorOf(ed).text(), 'A logo is required', 'error shown under the file field');
    });

    QUnit.test('post-save commit (inline): state, thumbnail and filename follow the returned record', async function (assert) {
        await openInlineFileEditor({ id: 1, logo: 'old.png' }, {
            clearFormOnSave: false,
            onSave: function () { return { id: 1, logo: 'stored.png' }; }
        });
        var urls = [];
        ed.options.fields.logo.thumbnailUrl = function (rec) { urls.push(rec.logo); return PX; };
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('chosen.png'));
        await ed._handleSave();
        var st = $w.data('fileState');
        assert.equal(st.original, 'stored.png', 'original = stored filename from the server');
        assert.strictEqual(st.file, null, 'file cleared');
        assert.strictEqual(st.cleared, false, 'cleared reset');
        assert.equal($w.find('.file-current-name').text(), 'stored.png', 'filename line updated');
        assert.equal(urls[urls.length - 1], 'stored.png', 'thumbnail resolved for the stored name');
        assert.equal($w.find('input[type="file"]')[0].files.length, 0, 'native input reset');
        assert.deepEqual(ed.edpak.files, {}, 'edpak.files cleared');
        assert.equal(ed.edpak.currentRecord.logo, 'stored.png', 'currentRecord updated');
        assert.ok(ed._$container.is(':visible'), 'inline form stays open');
    });

    QUnit.test('post-save (inline, default clearFormOnSave): file field is reset to empty', async function (assert) {
        await openInlineFileEditor({ id: 1, logo: 'old.png' }, { onSave: function () { return { id: 1, logo: 'stored.png' }; } });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('chosen.png'));
        await ed._handleSave();
        assert.equal(ed.getFieldValue('logo'), '', 'form cleared after save');
        assert.strictEqual($w.data('fileState').file, null, 'no pending file');
        assert.deepEqual(ed.edpak.files, {}, 'edpak.files cleared');
    });

    QUnit.test('post-save commit: onSave returning nothing falls back to formdata', async function (assert) {
        await openInlineFileEditor({ id: 1, logo: 'old.png' }, { clearFormOnSave: false, onSave: function () { return undefined; } });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('chosen.png'));
        await ed._handleSave();
        assert.equal($w.data('fileState').original, 'chosen.png', 'chosen filename becomes the original');
        assert.equal(ed.edpak.currentRecord.logo, 'chosen.png', 'currentRecord consistent');

        clickRemove($w);
        await ed._handleSave();
        assert.equal($w.data('fileState').original, '', 'removal committed as ""');
        assert.notOk(isShown($w.find('.file-current')), 'filename hidden');
        assert.equal(ed.getFieldValue('logo'), '', 'value ""');
    });

    QUnit.test('post-save commit: result without the field also falls back to formdata', async function (assert) {
        await openInlineFileEditor({ id: 1, logo: 'old.png' }, { clearFormOnSave: false, onSave: function () { return { id: 1 }; } });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('chosen.png'));
        await ed._handleSave();
        assert.equal($w.data('fileState').original, 'chosen.png', 'fell back to formdata');
    });

    QUnit.test('failed save keeps the selection so the user can retry', async function (assert) {
        var attempts = 0;
        await openInlineFileEditor({ logo: '' }, {
            clearFormOnSave: false,
            onSave: function () { attempts++; if (attempts === 1) throw new Error(''); return { logo: 'ok.png' }; }
        });
        var $w = wrapperOf(ed);
        var f = makeFile('chosen.png');
        pickFile($w, f);
        await ed._handleSave();
        assert.strictEqual($w.data('fileState').file, f, 'selection kept after failure');
        assert.strictEqual(ed.edpak.files.logo, f, 'edpak.files retained');
        await ed._handleSave();
        assert.strictEqual($w.data('fileState').file, null, 'committed after the retry succeeds');
        assert.equal($w.data('fileState').original, 'ok.png', 'stored name');
    });

    QUnit.test('progress bar is hidden after both successful and failed saves, and shown again on a second save', async function (assert) {
        mockXHR();
        await openInlineFileEditor({ logo: '' }, { clearFormOnSave: false, fileProgressMinSize: 0, onSave: function (edpak) { return ed.submit('/s', edpak); } });
        var $w = wrapperOf(ed);

        pickFile($w, makeFile('a.png'));
        var p = ed._handleSave();
        assert.ok(ed._$uploadProgress.is(':visible'), 'save 1: bar visible in flight');
        xhrs[0].respond(422, '[{"name":"logo","status":"nope"}]');
        await p;
        assert.notOk(ed._$uploadProgress.is(':visible'), 'bar hidden after a failed save');

        p = ed._handleSave();
        assert.ok(ed._$uploadProgress.is(':visible'), 'save 2: bar visible again');
        xhrs[1].respond(200, '{"logo":"a.png"}');
        await p;
        assert.notOk(ed._$uploadProgress.is(':visible'), 'bar hidden after a successful save');
        assert.equal(ed._$container.find('.recedit-upload-progress').length, 1, 'still a single bar');
    });

    // =========================================================================
    // Abort on close / destroy
    // =========================================================================

    QUnit.test('closing the dialog mid-upload aborts the XHR, skips commit and _afterSave, fires onCancel; reopening is clean', async function (assert) {
        mockXHR();
        var cancelled = 0, afterSave = 0, notices = 0;
        await openFileEditor({ logo: 'a.png' }, null, {
            fileProgressMinSize: 0,
            onCancel: function () { cancelled++; },
            onSave: function (edpak) { return ed.submit('/s', edpak); }
        });
        ed._afterSave = async function () { afterSave++; };
        ed._triggerNotice = function () { notices++; };
        var $w = wrapperOf(ed);
        var f = makeFile('new.png');
        pickFile($w, f);

        var p = ed._handleSave();
        assert.equal(xhrs.length, 1, 'request in flight');
        ed.$dialog.dialog('close');
        await p;

        assert.ok(xhrs[0].aborted, 'xhr aborted by the close handler');
        assert.equal(cancelled, 1, 'onCancel fired');
        assert.equal(afterSave, 0, '_afterSave skipped');
        assert.equal(notices, 0, 'no error notice');
        assert.strictEqual($w.data('fileState').file, f, 'commit skipped (selection untouched)');
        assert.notOk(ed._$uploadProgress.is(':visible'), 'bar hidden');

        await ed.open({ record: { logo: 'a.png' } });
        var $w2 = wrapperOf(ed);
        assert.strictEqual($w2.data('fileState').file, null, 'reopened form has no stale selection');
        assert.equal(ed.getFieldValue('logo'), 'a.png', 'reopened with the record value');
        assert.deepEqual(ed._getFileUploads(), {}, 'no pending files');

        pickFile($w2, makeFile('second.png'));
        var p2 = ed._handleSave();
        xhrs[1].respond(200, '{"logo":"second.png"}');
        await p2;
        assert.equal(afterSave, 1, 'a later save on the reopened dialog completes normally');
    });

    QUnit.test('destroy() aborts an in-flight upload and the aborted save does nothing further', async function (assert) {
        mockXHR();
        var notices = 0;
        await openInlineFileEditor({ logo: '' }, { onSave: function (edpak) { return ed.submit('/s', edpak); } });
        ed._triggerNotice = function () { notices++; };
        pickFile(wrapperOf(ed), makeFile('a.png'));
        var p = ed._handleSave();
        var editor = ed;
        editor.destroy();
        await p;
        assert.ok(xhrs[0].aborted, 'xhr aborted by destroy()');
        assert.equal(notices, 0, 'no notice');
        ed = null;
    });

    QUnit.test('destroy() revokes an active preview object URL', async function (assert) {
        await openFileEditor({ logo: '' });
        pickFile(wrapperOf(ed), makeFile('a.png'));
        var url = wrapperOf(ed).data('fileState').previewUrl;
        assert.ok(url, 'preview active');
        var revoked = [];
        var orig = URL.revokeObjectURL;
        URL.revokeObjectURL = function (u) { revoked.push(u); return orig.call(URL, u); };
        try { ed.destroy(); } finally { URL.revokeObjectURL = orig; }
        assert.ok(revoked.indexOf(url) !== -1, 'URL revoked');
        ed = null;
    });

    QUnit.test('preview object URL is revoked when the selection changes', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        pickFile($w, makeFile('a.png'));
        var first = $w.data('fileState').previewUrl;
        var revoked = [];
        var orig = URL.revokeObjectURL;
        URL.revokeObjectURL = function (u) { revoked.push(u); return orig.call(URL, u); };
        try { pickFile($w, makeFile('b.png')); } finally { URL.revokeObjectURL = orig; }
        assert.ok(revoked.indexOf(first) !== -1, 'previous preview revoked');
        assert.notEqual($w.data('fileState').previewUrl, first, 'new preview URL');
    });

    // =========================================================================
    // Drag and drop
    // =========================================================================

    QUnit.test('drop: a dropped file takes the same path as the picker (state, preview, native input, onChange)', async function (assert) {
        var changes = [];
        ed = makeEditor({ fields: { logo: { type: 'file', accept: 'image/*', onChange: function (v) { changes.push(v); } } } });
        await ed.open({ record: { logo: '' } });
        var $w = wrapperOf(ed);
        var f = makeFile('dropped.png', 'image/png');
        var ev = dragEvent('drop', [f]);
        $w[0].dispatchEvent(ev);
        assert.ok(ev.defaultPrevented, 'drop default prevented (no page navigation)');
        assert.equal($w.data('fileState').file.name, 'dropped.png', 'state.file set');
        assert.equal($w.find('input[type="file"]')[0].files[0].name, 'dropped.png', 'native input shows the file');
        assert.ok(/^blob:/.test($w.find('.file-thumb').attr('src')), 'preview created');
        assert.equal(ed.getFieldValue('logo'), 'dropped.png', 'value');
        assert.deepEqual(changes, ['dropped.png'], 'onChange fired');
        assert.strictEqual(ed._getFileUploads().logo.name, 'dropped.png', 'queued for upload');
    });

    QUnit.test('drop: validation applies (disallowed type and oversized file)', async function (assert) {
        await openFileEditor({ logo: '' }, null, null);
        ed.options.fields.logo.maxFileSize = 10;
        var $w = wrapperOf(ed);
        $w[0].dispatchEvent(dragEvent('drop', [makeFile('x.txt', 'text/plain')]));
        assert.strictEqual($w.data('fileState').file, null, 'type rejected');
        assert.equal(errorOf(ed).text(), 'File type not allowed', 'type error shown');
        $w[0].dispatchEvent(dragEvent('drop', [makeFile('big.png', 'image/png', 50)]));
        assert.strictEqual($w.data('fileState').file, null, 'size rejected');
        assert.equal(errorOf(ed).text(), 'File is too large', 'size error shown');
        assert.deepEqual(ed._getFileUploads(), {}, 'nothing queued');
    });

    QUnit.test('drop: only the first of several files is used', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        $w[0].dispatchEvent(dragEvent('drop', [makeFile('first.png'), makeFile('second.png'), makeFile('third.png')]));
        assert.equal(ed.getFieldValue('logo'), 'first.png', 'first file only');
        assert.equal($w.find('input[type="file"]')[0].files.length, 1, 'single file in the native input');
    });

    QUnit.test('drop: directories are skipped; non-file drags are ignored', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);

        $w[0].dispatchEvent(fakeDrop([{ dir: true, file: makeFile('folder') }]));
        assert.strictEqual($w.data('fileState').file, null, 'a lone directory is ignored');

        $w[0].dispatchEvent(fakeDrop([{ dir: true, file: makeFile('folder') }, { file: makeFile('real.png') }]));
        assert.equal(ed.getFieldValue('logo'), 'real.png', 'directory skipped, next file used');

        clickRemove($w);
        var textDrop = dragEvent('drop', [], { text: 'hello' });
        $w[0].dispatchEvent(textDrop);
        assert.notOk(textDrop.defaultPrevented, 'text drag not handled');
        assert.strictEqual($w.data('fileState').file, null, 'no file from a text drop');
        var enter = dragEvent('dragenter', [], { text: 'hello' });
        $w[0].dispatchEvent(enter);
        assert.notOk($w.hasClass('file-drop-active'), 'no highlight for a text drag');
    });

    QUnit.test('drag highlight: file-drop-active toggles without flicker from child elements', async function (assert) {
        await openFileEditor({ logo: '' });
        var $w = wrapperOf(ed);
        var $child = $w.find('.file-body');
        var f = makeFile('a.png');

        var over = dragEvent('dragover', [f]);
        $w[0].dispatchEvent(over);
        assert.ok(over.defaultPrevented, 'dragover default prevented for files');

        $w[0].dispatchEvent(dragEvent('dragenter', [f]));
        assert.ok($w.hasClass('file-drop-active'), 'active after entering the wrapper');
        $child[0].dispatchEvent(dragEvent('dragenter', [f]));   // entering a child
        $w[0].dispatchEvent(dragEvent('dragleave', [f]));        // leaving the wrapper (child entered)
        assert.ok($w.hasClass('file-drop-active'), 'still active while over a child');
        $child[0].dispatchEvent(dragEvent('dragleave', [f]));
        assert.notOk($w.hasClass('file-drop-active'), 'removed once the pointer fully leaves');

        $w[0].dispatchEvent(dragEvent('dragenter', [f]));
        $w[0].dispatchEvent(dragEvent('drop', [f]));
        assert.notOk($w.hasClass('file-drop-active'), 'cleared on drop');
    });

    QUnit.test('dropZone:false, readonly, readOnly, disabled: no handlers and no hint; drops are ignored', async function (assert) {
        var variants = [{ dropZone: false }, { readonly: true }, { readOnly: true }, { disabled: true }];
        for (var i = 0; i < variants.length; i++) {
            safeDestroy(ed);
            ed = makeEditor({ fields: { logo: Object.assign({ type: 'file' }, variants[i]) } });
            await ed.open({ record: { logo: '' } });
            var $w = wrapperOf(ed);
            var label = JSON.stringify(variants[i]);
            assert.equal($w.find('.file-drop-hint').length, 0, label + ': no hint');
            var enter = dragEvent('dragenter', [makeFile('a.png')]);
            $w[0].dispatchEvent(enter);
            assert.notOk($w.hasClass('file-drop-active'), label + ': no highlight');
            var drop = dragEvent('drop', [makeFile('a.png')]);
            $w[0].dispatchEvent(drop);
            assert.notOk(drop.defaultPrevented, label + ': drop not handled');
            assert.strictEqual($w.data('fileState').file, null, label + ': no file selected');
        }
    });

    // =========================================================================
    // Theme styling hooks (useJQueryUITheme)
    // =========================================================================

    QUnit.test('themed: Remove gets ui-button, drag highlight adds ui-state-highlight, progress gets ui-widget-header', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { logo: { type: 'file' } } });
        await ed.open({ record: { logo: 'a.png' } });
        var $w = wrapperOf(ed);
        assert.ok($w.find('.file-remove-btn').hasClass('ui-button'), 'Remove styled as a jQuery UI button');
        $w[0].dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
        assert.ok($w.hasClass('file-drop-active') && $w.hasClass('ui-state-highlight'), 'theme highlight on drag');
        $w[0].dispatchEvent(dragEvent('dragleave', [makeFile('a.png')]));
        assert.notOk($w.hasClass('ui-state-highlight'), 'theme highlight removed');
        ed._showUploadProgress(10);
        assert.ok(ed._$uploadProgress.find('progress').hasClass('ui-widget-header'), 'progress themed');
    });

    QUnit.test('unthemed: no jQuery UI classes on the file controls', async function (assert) {
        await openFileEditor({ logo: 'a.png' });
        var $w = wrapperOf(ed);
        assert.notOk($w.find('.file-remove-btn').hasClass('ui-button'), 'Remove not a ui-button');
        $w[0].dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
        assert.notOk($w.hasClass('ui-state-highlight'), 'no ui-state-highlight');
        ed._showUploadProgress(10);
        assert.notOk(ed._$uploadProgress.find('progress').hasClass('ui-widget-header'), 'progress not themed');
    });
});


// ============================================================
// 27. Read-only fields
// ============================================================
QUnit.module('27. Read-only fields', function (hooks) {
    var ed;
    hooks.afterEach(function () { safeDestroy(ed); });

    QUnit.test('text-like types: readonly attribute, tabindex -1, value still submitted', async function (assert) {
        ed = makeEditor({ fields: {
            name:  { label: 'N', type: 'text',         readonly: true },
            notes: { label: 'T', type: 'textarea',     readonly: true },
            pwd:   { label: 'P', type: 'password',     readonly: true },
            city:  { label: 'C', type: 'autocomplete', source: ['London'], readonly: true }
        }});
        await ed.open({ record: { name: 'Alice', notes: 'hi', pwd: 's3cret', city: 'London' } });
        ['name', 'notes', 'pwd', 'city'].forEach(function (f) {
            var $i = ed.fieldInputs.get(f);
            assert.ok($i.is('[readonly]'), f + ': readonly attribute');
            assert.equal($i.attr('tabindex'), '-1', f + ': tabindex = -1');
            assert.ok($i.hasClass('readonly-field'), f + ': readonly-field class');
        });
        assert.deepEqual(ed._getFormData(), { name: 'Alice', notes: 'hi', pwd: 's3cret', city: 'London' }, 'all values submitted');
    });

    QUnit.test('date: datepicker exists but can never open', async function (assert) {
        ed = makeEditor({ fields: { due: { label: 'Due', type: 'date', readonly: true } } });
        await ed.open({ record: { due: '2026-11-17' } });
        var $d = ed.fieldInputs.get('due');
        assert.ok($d.is('[readonly]'), 'readonly attribute');
        assert.ok($d.data('datepicker'), 'datepicker initialised');
        assert.strictEqual(typeof $d.datepicker('option', 'beforeShow'), 'function', 'beforeShow set');
        assert.strictEqual($d.datepicker('option', 'beforeShow')(), false, 'beforeShow returns false');
        $d.datepicker('show');
        assert.notOk($d.datepicker('widget').is(':visible'), 'calendar did not open');
        assert.equal(ed._getFormData().due, '2026-11-17', 'record value round-trips');
    });

    QUnit.test('time: readonly input and no timepicker is created', async function (assert) {
        ed = makeEditor({ fields: { at: { label: 'At', type: 'time', readonly: true } } });
        await ed.open({ record: { at: '09:30' } });
        await wait(60);
        var $t = ed.fieldInputs.get('at');
        assert.ok($t.is('[readonly]'), 'readonly attribute');
        assert.ok($t.hasClass('readonly-field'), 'readonly-field class');
        assert.notOk($t.data('timepicker-initialized'), 'timepicker not initialised');
        assert.equal(ed.getFieldValue('at'), '09:30', 'value preserved');
    });

    QUnit.test('checkbox / checkboxradio: control disabled, wrapper marked, value round-trips', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: {
            a: { label: 'A', type: 'checkbox',      checkboxLabel: 'A', readonly: true },
            b: { label: 'B', type: 'checkboxradio', checkboxLabel: 'B', readOnly: true }
        }});
        await ed.open({ record: { a: true, b: false } });
        await wait(50);
        ['a', 'b'].forEach(function (f) {
            var $w = ed.fieldInputs.get(f);
            var $i = $w.find('input[type="checkbox"]');
            assert.ok($w.hasClass('checkbox-container'), f + ': checkbox-container class');
            assert.ok($w.hasClass('readonly-field'), f + ': wrapper readonly-field class');
            assert.ok($i.prop('disabled'), f + ': control disabled');
            assert.ok($w.find('label').hasClass('ui-state-disabled'), f + ': themed label disabled');
        });
        assert.deepEqual(ed._getFormData(), { a: true, b: false }, 'values still submitted');
        assert.equal(ed.getFieldValue('a'), true, 'getFieldValue still returns state');
    });

    QUnit.test('radiogroup: all radios disabled and wrapper marked', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { role: {
            label: 'Role', type: 'radiogroup', readonly: true,
            options: [{ Value: 'admin', DisplayText: 'Admin' }, { Value: 'user', DisplayText: 'User' }]
        }}});
        await ed.open({ record: { role: 'user' } });
        await wait(80);
        var $w = ed.fieldInputs.get('role');
        var $radios = $w.find('input[type="radio"]');
        assert.ok($w.hasClass('readonly-field'), 'wrapper readonly-field class');
        assert.equal($radios.length, 2, 'two radios');
        assert.equal($radios.filter(':disabled').length, 2, 'all radios disabled');
        assert.ok($radios.eq(1).next('label').hasClass('ui-state-disabled'), 'themed checked label disabled');
        assert.equal(ed.getFieldValue('role'), 'user', 'value preserved');
    });

    QUnit.test('select: control disabled and selectmenu created disabled', async function (assert) {
        ed = makeEditor({ useJQueryUITheme: true, fields: { s: { label: 'S', type: 'select', readonly: true, options: SELECT_OPTIONS } } });
        await ed.open({ record: { s: 'active' } });
        await wait(120);
        var $s = ed.fieldInputs.get('s');
        assert.ok($s.prop('disabled'), 'select disabled');
        assert.ok($s.hasClass('readonly-field'), 'readonly-field class on the select');
        assert.ok($s.data('ui-selectmenu'), 'selectmenu created');
        assert.equal($s.selectmenu('option', 'disabled'), true, 'selectmenu disabled');
        assert.equal(ed.getFieldValue('s'), 'active', 'value preserved');
    });

    QUnit.test('spinner: stays a plain read-only input with no spinner widget', async function (assert) {
        ed = makeEditor({ fields: { n: { label: 'N', type: 'spinner', readonly: true } } });
        await ed.open({ record: { n: 3 } });
        await wait(260);
        var $n = ed.fieldInputs.get('n');
        assert.ok($n.is('[readonly]'), 'readonly attribute');
        assert.ok($n.hasClass('readonly-field'), 'readonly-field class');
        assert.notOk($n.data('ui-spinner'), 'no spinner widget');
        assert.equal(ed.getFieldValue('n'), '3', 'value round-trips via .val()');
        assert.equal(ed._getFormData().n, '3', 'formdata reads .val()');
    });

    QUnit.test('slider: value input readonly and widget disabled', async function (assert) {
        ed = makeEditor({ fields: { rating: { label: 'R', type: 'slider', min: 0, max: 10, readonly: true } } });
        await ed.open({ record: { rating: 5 } });
        await wait(80);
        var $w = ed.fieldInputs.get('rating');
        var $value = $w.find('.slider-value');
        var $slider = $w.find('.slider-widget');
        assert.ok($w.hasClass('readonly-field'), 'wrapper readonly-field class');
        assert.ok($value.prop('readonly'), 'value input readonly');
        assert.ok($value.hasClass('readonly-field'), 'value input readonly-field class');
        assert.ok($slider.data('ui-slider'), 'slider widget created');
        assert.equal($slider.slider('option', 'disabled'), true, 'slider widget disabled');
        assert.equal(ed.getFieldValue('rating'), '5', 'value preserved');
    });

    QUnit.test('disabled alias behaves like readonly', async function (assert) {
        ed = makeEditor({ fields: { name: { label: 'N', type: 'text', disabled: true } } });
        await ed.open({ record: { name: 'Alice' } });
        var $i = ed.fieldInputs.get('name');
        assert.ok($i.is('[readonly]'), 'readonly attribute');
        assert.ok($i.hasClass('readonly-field'), 'readonly-field class');
        assert.equal(ed.getFieldValue('name'), 'Alice', 'value preserved');
    });
});
