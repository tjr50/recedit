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
});
