# RecEdit Documentation

A jQuery UI-enhanced dialog component for editing table records with extensive customization options.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Constructor Options](#constructor-options)
- [Button Configuration](#button-configuration)
- [Field Configuration](#field-configuration)
- [Field Types](#field-types)
- [Input Masking](#input-masking)
- [Layout Options](#layout-options)
- [Tab Support](#tab-support)
- [Programmatic API](#programmatic-api)
- [Callbacks and Events](#callbacks-and-events)
- [Error Handling](#error-handling)
- [RecEditInlineForm](#receditinlineform)
- [RecEditCustomDialog](#receditcustomdialog)
- [Complete Examples](#complete-examples)
- [Dependencies](#dependencies)
---

## Basic Usage

```javascript
const editor = new RecEdit({
    fields: {
        id: {
            key: true,
            label: 'ID',
            type: 'text',
            readonly: true
        },
        name: {
            label: 'Name',
            type: 'text',
            maxLength: 100
        },
        email: {
            label: 'Email',
            type: 'text'
        }
    },
    onSave: async (edpak) => {
        // edpak.formdata contains current form values
        // edpak.currentRecord contains the original record
        // edpak may contain other app-specific properties
        const response = await fetch('/api/update', {
            method: 'POST',
            body: JSON.stringify(edpak.formdata)
        });
        // Handle response
    }
});

// Open the editor with edpak object and any other app-specific properties needed in callbacks
editor.open({ record: myRecord });
```

---

## Constructor Options

### General Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fields` | Object | `{}` | Field definitions (required) |
| `messages` | Object | See below | UI text messages |
| `onSave` | Function | `null` | Callback when save button is clicked |
| `onCancel` | Function | `null` | Callback when dialog is cancelled |
| `validateForm` | Function | `null` | Custom validation function |
| `onBeforeShow` | Function | `null` | Callback fired after form is populated, just before the dialog is shown. Receives `(editor, edpak)`. May be async. |
| `onAfterShow` | Function | `null` | Callback fired after the dialog animation completes and the dialog is fully visible. Receives `(editor, edpak)`. May be async. |
| `onInit` | Function | `null` | Callback fired once after the form elements are first built, before any record is loaded. Receives `(editor)`. Use for one-time structural setup (e.g. initialising a jQuery UI tabs widget inside an inline form). |

### Messages Object

```javascript
messages: {
    editRecord: 'Edit Record',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving...',
    error: 'Error'
}
```

### jQuery UI Dialog Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useJQueryUITheme` | Boolean | `true` | Apply jQuery UI theme styling |
| `dialogWidth` | Number/String | `600` | Dialog width in pixels |
| `dialogHeight` | String | `'auto'` | Dialog height |
| `dialogTitle` | String | `null` | Custom dialog title (overrides `messages.editRecord`) |
| `modal` | Boolean | `true` | Modal dialog |
| `resizable` | Boolean | `true` | Allow resizing |
| `draggable` | Boolean | `true` | Allow dragging |
| `showEffect` | String | `'fade'` | Show animation effect |
| `hideEffect` | String | `'fade'` | Hide animation effect |
| `effectDuration` | Number | `200` | Animation duration in ms |

### Button Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `buttonIcons` | Boolean | `true` | Master icon toggle — when `true` the default Save and Cancel buttons include jQuery UI icons. Individual button `icon` properties take precedence when set. |
| `saveButton` | Object | `null` | Overrides for the Save button (see [Button Configuration](#button-configuration)) |
| `cancelButton` | Object | `null` | Overrides for the Cancel button (see [Button Configuration](#button-configuration)) |
| `customButtons` | Array | `[]` | Additional buttons to add to the dialog (see [Button Configuration](#button-configuration)) |

### Button Configuration

All button objects — `saveButton`, `cancelButton`, and entries in `customButtons` — share the same property shape:

| Property | Type | Description |
|----------|------|-------------|
| `text` | String | Button label. Defaults to `messages.save` / `messages.cancel` for standard buttons. |
| `icon` | String | jQuery UI icon class, e.g. `'ui-icon-check'`. Defaults to the `buttonIcons`-controlled icon for standard buttons; no icon for custom buttons unless specified. |
| `click` | Function | Click handler. Defaults to `_handleSave()` for Save and `close()` for Cancel. Overriding Save's click bypasses `_handleSave()` (no validation, no saving state). |
| `hidden` | Boolean | When `true` the button is omitted from the dialog entirely. Default: `false`. |
| `align` | String | `'left'` (default) renders the button at the left edge of the button bar using `margin-right: auto`. `'right'` places the button to the right of all left-aligned custom buttons, but still to the left of the standard Cancel and Save buttons. |
| `class` | String | Extra CSS classes for the button. Default for Save: `'ui-button-primary'`; default for Cancel and custom buttons: `''`. |

**Render order** in the button bar: `[left-aligned custom…] [right-aligned custom…] [Cancel] [Save]`

For `saveButton` and `cancelButton`, only properties you explicitly provide are overridden — all others retain their defaults. For example `saveButton: { text: 'Apply' }` changes only the label; the icon, click handler, and class are unchanged.

**Examples:**

```javascript
// Relabel Save and hide Cancel
const editor = new RecEdit({
    saveButton:   { text: 'Apply Changes' },
    cancelButton: { hidden: true },
    fields: { /* ... */ }
});

// Custom icon on Save, suppress icon on Cancel
const editor = new RecEdit({
    saveButton:   { icon: 'ui-icon-disk' },
    cancelButton: { icon: null },
    fields: { /* ... */ }
});

// Custom button on the left; standard buttons remain on the right
const editor = new RecEdit({
    customButtons: [
        {
            text:  'Preview',
            icon:  'ui-icon-search',
            align: 'left',
            click: () => openPreview()
        }
    ],
    fields: { /* ... */ }
});

// Multiple custom buttons — left-edge and pre-standard-buttons positions
// Result: [History] ............... [Reset] [Cancel] [Save]
const editor = new RecEdit({
    customButtons: [
        { text: 'History', icon: 'ui-icon-clock',   click: () => showHistory() },           // align defaults to 'left'
        { text: 'Reset',   icon: 'ui-icon-refresh', click: () => resetForm(), align: 'right' } // right of left-custom, left of Cancel
    ],
    fields: { /* ... */ }
});
```

#### Accessing the editor instance from a custom button click handler

Click handlers are arrow function closures. Because they are only ever *called* after the constructor returns, the editor variable is already fully assigned by the time any button is clicked — even though the handlers are defined inside the same `new RecEdit(...)` call.

**Reference via the containing object property (most common):**

```javascript
tv.editor = new RecEdit({
    customButtons: [
        {
            text: 'History',
            icon: 'ui-icon-clock',
            click: () => {
                const orderId = tv.editor.getFieldValue('orderid');
                showHistory(orderId);
            }
        },
        {
            text:  'Reset',
            icon:  'ui-icon-refresh',
            align: 'right',
            click: () => tv.editor.setFieldValues({ freight: '', shipvia: '' })
        }
    ],
    fields: { /* ... */ }
});
```

**Reference via a local variable (when not stored on an object):**

Declare the variable before the constructor so it is in the closure scope, then assign both it and the containing property in one statement:

```javascript
let editor = null;

tv.editor = editor = new RecEdit({
    customButtons: [
        {
            text:  'Reset',
            click: () => editor.setFieldValues({ freight: '' })
        }
    ],
    fields: { /* ... */ }
});
```

`editor` is `null` when the options literal is evaluated, but will be fully assigned by the time any click handler fires.

### Date Picker Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dateDisplayFormat` | String | `'yy-mm-dd'` | Default date display format (jQuery UI format tokens) |
| `dateRecordFormat` | String | `'yyyy-mm-dd'` | Date format for record data (supports `yyyy`, `yy`, `mm`, `dd`) |
| `changeMonth` | Boolean | `true` | Month dropdown in datepicker |
| `changeYear` | Boolean | `true` | Year dropdown in datepicker |
| `yearRange` | String | `'c-100:c+10'` | Year range for datepicker |

**Date Format Notes:**

- `dateDisplayFormat`: Controls how dates appear to users in the form. Uses jQuery UI datepicker format tokens (`yy`, `mm`, `dd`)
- `dateRecordFormat`: Controls how dates are formatted in the output data when saving. Supports format tokens: `yyyy` (4-digit year), `yy` (2-digit year), `mm` (month), `dd` (day)

**Example:**
```javascript
// Configuration
dateDisplayFormat: 'dd-mm-yy',      // User sees: 03-03-2026
dateRecordFormat: 'yyyy-mm-dd'      // Record gets: 2026-03-03
```

### Layout Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `formLayout` | String | `'vertical'` | Default layout: `'vertical'` or `'horizontal'` |
| `labelWidth` | String | `'150px'` | Label width in horizontal layout |
| `defaultInputWidth` | String/Number/null | `null` | Default width for text inputs (null = full-width, can be overridden per field) |

### Tab Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tabs` | Array | `null` | Tab definitions (see [Tab Support](#tab-support)) |
| `tabsCollapsible` | Boolean | `false` | Whether tabs can be collapsed |
| `tabsActive` | Number | `0` | Index of initially active tab (0-based) |

---

## Field Configuration

Each field in the `fields` object can have the following properties:

### Common Field Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | String | Display label for the field. Falls back to `title` then the field name if omitted. |
| `omitLabel` | Boolean | If `true`, suppresses the label entirely for this field. Takes precedence over any value in `label` or `title`. |
| `title` | String | Alternative to `label` (for backward compatibility) |
| `type` | String | Field type (see [Field Types](#field-types)) |
| `placeholder` | String | Placeholder (hint) text |
| `inputClass` | String | Additional CSS classes for the input |
| `readonly` / `readOnly` | Boolean | Make field read-only |
| `edit` | Boolean | If `false`, field is not shown in form |
| `key` | Boolean | If `true`, field is a key field (hidden from editing) |
| `transient` | Boolean | If `true`, field is shown in the form but omitted from the save data (`edpak.formdata`). Default: `false`. |
| `layout` | String | `'vertical'` or `'horizontal'` (overrides global setting) |
| `labelWidth` | String | Label width in horizontal layout, e.g. `'150px'` (overrides global setting)|
| `tab` | String | Tab ID or title where field should appear |
| `fieldGroup` | String | Group name - fields with same value appear on one line (horizontal layout only) |
| `required` | Boolean | If `true`, marks the field as required with a red asterisk (`*`) after the label and sets `aria-required` on the input |


### Text Input Properties

| Property | Type | Description |
|----------|------|-------------|
| `maxLength` / `maxlength` | Number | Maximum character length |
| `width` | Number/String | Width (number = character count, string = CSS width) |
| `inputWidth` | String | Alternative CSS width property |
| `inputmask` / `inputMask` | String/Object | Input mask to apply via jquery.inputmask. May be a mask string (e.g. `'(999) 999-9999'`) or an inputmask options object. See [Input Masking](#input-masking). |

### Textarea Properties

| Property | Type | Description |
|----------|------|-------------|
| `rows` | Number | Number of rows (default: 4) |
| `cols` / `columns` | Number | Number of columns |
| `width` | Number/String | Width (number = columns, string = CSS width) |
| `height` / `inputHeight` | String | CSS height (e.g., '150px') |
| `maxLength` / `maxlength` | Number | Maximum character length |

### Character Counter

| Property | Type | Description |
|----------|------|-------------|
| `showCounter` | Boolean | Show character counter,  `maxLength` must be also set (default: `false`)) |

### Checkbox / Checkboxradio Properties

| Property | Type | Description |
|----------|------|-------------|
| `checkboxLabel` | String | Inline label text displayed beside the checkbox (default: `''`). This is separate from the field `label`, which still appears as the row label in the form layout. |

**Value notes:**

- `getFieldValue()` always returns a Boolean (`true` / `false`).
- When populating the form, the record value is coerced with `Boolean(value)`, so truthy values such as `1` or `'yes'` will check the box.
- Both `checkbox` and `checkboxradio` share identical properties and value semantics. The only difference is the jQuery UI widget used for styling: `.button()` for `checkbox`, `.checkboxradio()` for `checkboxradio`.

**Example:**

```javascript
// Legacy jQuery UI button-enhanced checkbox
active: {
    label: 'Status',
    type: 'checkbox',
    checkboxLabel: 'Account is active'
}

// Modern jQuery UI checkboxradio widget
active: {
    label: 'Status',
    type: 'checkboxradio',
    checkboxLabel: 'Account is active'
}
```

### Radio Group Properties

| Property | Type | Description |
|----------|------|-------------|
| `options` | Object/Array/String/Function | Options for the radio group — each entry becomes one radio button. Accepts the same formats as the dropdown field (see below). |

**Value semantics:**

- `getFieldValue()` returns the `Value` of the checked radio button, or `null` if none is selected.
- On form load the radio whose `Value` matches the record field value is checked; all others are unchecked.
- Selecting any radio automatically unchecks the others (native browser `name`-group behaviour).

**Example:**

```javascript
priority: {
    label: 'Priority',
    type: 'radiogroup',
    options: {
        'low':    'Low',
        'medium': 'Medium',
        'high':   'High'
    }
}
```

Array format also works:
```javascript
priority: {
    label: 'Priority',
    type: 'radiogroup',
    options: [
        { Value: 'low',    DisplayText: 'Low'    },
        { Value: 'medium', DisplayText: 'Medium' },
        { Value: 'high',   DisplayText: 'High'   }
    ]
}
```

### Dropdown/Select Properties

| Property | Type | Description |
|----------|------|-------------|
| `options` | Object/Array/String/Function | Options for dropdown (see examples below) |
| `width` / `inputWidth` | String | CSS width of the dropdown button (e.g. `'250px'`, `'12em'`). Integer character-count is **not** supported for dropdowns — use a CSS string. Omit for full-width (default). |
| `onChange` | Function | Callback fired when the user changes the selected value. Receives `(event, ui)` where `ui.item` has `value`, `label`, and `index` properties corresponding to the newly selected option. |

**Options formats:**

```javascript
// Object format
options: {
    'value1': 'Display Text 1',
    'value2': 'Display Text 2'
}

// Array format
options: [
    { Value: 'value1', DisplayText: 'Display Text 1' },
    { Value: 'value2', DisplayText: 'Display Text 2' }
]

// URL (fetches from server)
options: '/api/get-options'

// Function (may also return a Promise resolving to any of the above formats)
options: function() {
    return [
        { Value: 'value1', DisplayText: 'Display Text 1' }
    ];
}
```

> Both `string` (URL) and `function` options are resolved asynchronously — the record value is applied to the field only after the options finish loading.

**`onChange` example — show or hide a dependent field based on the selected value:**

```javascript
const editor = new RecEdit({
    fields: {
        shipvia: {
            label: 'Ship Via',
            type: 'select',
            options: {
                '1': 'Speedy Express',
                '2': 'United Package',
                '3': 'Federal Shipping'
            },
            onChange: function(event, ui) {
                // ui.item.value  → the option value of the newly selected item
                // ui.item.label  → the display text
                // ui.item.index  → the zero-based position in the list
                const showFreight = ui.item.value !== '3';
                editor.setFieldVisible('freight', showFreight);
            }
        },
        freight: {
            label: 'Freight Cost',
            type: 'text'
        }
    },
    onSave: async (edpak) => {
        await fetch('/api/orders/update', {
            method: 'POST',
            body: JSON.stringify(edpak.formdata)
        });
    }
});
```

**Key points:**
- `ui.item.value` is the `value` attribute of the selected `<option>` element (a string).
- The callback fires only on a user-initiated change, not when the form is populated programmatically via `open()` or `setFieldValue()`.
- `editor` in the handler is safe to use — the dialog is already open by the time any change can occur (same guarantee as `onSelect` on autocomplete fields).
- `getFieldValue()` returns the selected option's value as a string, or `''` (empty string) when no option is selected.

### Date Field Properties

| Property | Type | Description |
|----------|------|-------------|
| `dateDisplayFormat` | String | Date display format (overrides global, jQuery UI tokens) |
| `dateRecordFormat` | String | Date record format (overrides global, supports `yyyy`, `yy`, `mm`, `dd`) |
| `changeMonth` | Boolean | Show month dropdown |
| `changeYear` | Boolean | Show year dropdown |
| `yearRange` | String | Year range (e.g., 'c-80:c+10') |
| `minDate` | Date/String | Minimum selectable date |
| `maxDate` | Date/String | Maximum selectable date |

### Time Field Properties

> **Requires** the [jquery-timepicker](https://timepicker.co) library to be loaded before RecEdit.

| Property | Type | Description |
|----------|------|-------------|
| `timeFormat` | String | Display/value format (default: `'HH:mm'`). Tokens: `H`/`HH` 24-h, `h`/`hh` 12-h, `m`/`mm` minutes, `s`/`ss` seconds, `p` AM/PM |
| `defaultTime` | String/Date | Pre-selected time when the field is empty. Pass `'now'` for the current time. |
| `minTime` | String/Date | Earliest allowed time entry |
| `maxTime` | String/Date | Latest allowed time entry |
| `minHour` | Number | Minimum allowed 24-hour value (ignored when `minTime` is set) |
| `minMinutes` | Number | Minimum allowed minutes value (ignored when `minTime` is set) |
| `maxHour` | Number | Maximum allowed 24-hour value (ignored when `maxTime` is set) |
| `maxMinutes` | Number | Maximum allowed minutes value (ignored when `maxTime` is set) |
| `startTime` | String/Date | Time of the first entry in the dropdown |
| `startHour` | Number | Hour of the first dropdown entry (ignored when `startTime` is set) |
| `startMinutes` | Number | Minutes of the first dropdown entry (ignored when `startTime` is set) |
| `interval` | Number | Minutes between dropdown entries (default: `30`) |
| `dropdown` | Boolean | Show the time dropdown list (default: `true`) |
| `dynamic` | Boolean | Re-order dropdown so the next time after the selected value is first (default: `false`) |
| `scrollbar` | Boolean | Show a scrollbar in the dropdown (default: `false`) |
| `zindex` | Number | CSS `z-index` for the dropdown container |
| `width` / `inputWidth` | Number/String | Width of the input: integer sets the `size` attribute; string sets CSS width (e.g. `'120px'`) |

**Value notes:**

- `getFieldValue()` returns the time string exactly as displayed, formatted according to `timeFormat`.
- On form load the raw record value is written into the input directly; it should already be in the format matching `timeFormat`.


### Autocomplete Properties

| Property | Type | Description |
|----------|------|-------------|
| `source` | String/Array/Function | Data source for autocomplete |
| `minLength` | Number | Minimum characters before triggering (default: 2) |
| `delay` | Number | Delay in ms before triggering (default: 300) |
| `maxItems` | Number | Maximum number of suggestions shown in the list. Items beyond this limit are clipped from the response. A scrollbar appears automatically when the list exceeds the available height. |
| `scrollHeight` | String | CSS `max-height` of the suggestion dropdown when `maxItems` is set (default: `'200px'`). Accepts any valid CSS length value, e.g. `'220px'`, `'10em'`. |
| `onSelect` | Function | Callback fired when the user picks a suggestion from the dropdown. Receives `(event, ui)` where `ui.item` is the selected item object (with `label` and `value` properties, or the object returned by `source`). Return `false` from the handler to prevent the widget from writing the selected value into the input. |

**`onSelect` example — populate a hidden ID field when the user picks a customer name:**

When `source` returns objects with both display text and an underlying ID, `onSelect` lets you capture the ID and populate another field automatically while the autocomplete input shows the human-readable label.

```javascript
const editor = new RecEdit({
    fields: {
        customerid: {
            key: true,           // hidden from the form; populated programmatically
        },
        customername: {
            label: 'Customer',
            type: 'autocomplete',
            source: function(request, response) {
                $.ajax({
                    url: '/api/customers/search',
                    data: { term: request.term },
                    success: function(data) {
                        // server returns [{ label: 'Alfreds Futterkiste', value: 'ALFKI' }, ...]
                        response(data);
                    }
                });
            },
            minLength: 2,
            onSelect: function(event, ui) {
                // ui.item.label  → display text written into the input
                // ui.item.value  → the customer ID returned by the server
                editor.setFieldValue('customerid', ui.item.value);
                // Return false to write the label instead of the value into the input.
                // Omit the return (or return undefined) to let the widget use the default behaviour.
                return false;
            }
        }
    },
    onSave: async (edpak) => {
        // edpak.formdata.customerid contains the selected customer's ID
        await fetch('/api/orders/update', {
            method: 'POST',
            body: JSON.stringify(edpak.formdata)
        });
    }
});
```

**Key points:**
- `ui.item` is the object from the `source` response, so you control what properties it carries.
- Return `false` from `onSelect` to prevent the widget from replacing the input text with `ui.item.value` — useful when you want the label to remain visible but store the value elsewhere.
- `editor.setFieldValue()` (or any other RecEdit API) can safely be called inside `onSelect` because the dialog is fully open at that point.

### Spinner Properties

| Property | Type | Description |
|----------|------|-------------|
| `min` | Number | Minimum value |
| `max` | Number | Maximum value |
| `step` | Number | Increment/decrement step |

### Slider Properties

| Property | Type | Description |
|----------|------|-------------|
| `min` | Number | Minimum value (default: 0) |
| `max` | Number | Maximum value (default: 100) |
| `step` | Number | Increment step (default: 1) |
| `defaultValue` | Number | Initial value (default: 0) |

### Dynamic Value Properties

| Property | Type | Description |
|----------|------|-------------|
| `dataFunction` | Function | Calculate field value from record |
| `getValue` | Function | Alternative to `dataFunction` |
| `defaultValue` | Any/Function | Default value if field is undefined |

**Example:**

```javascript
fullname: {
    label: 'Full Name',
    type: 'text',
    readonly: true,
    dataFunction: (record) => {
        return `${record.firstname || ''} ${record.lastname || ''}`.trim();
    }
}
```

### Event Handlers

| Property | Type | Description |
|----------|------|-------------|
| `onChange` | Function | Called when field value changes |

**Example:**

```javascript
quantity: {
    label: 'Quantity',
    type: 'spinner',
    onChange: async (value, fieldName, editor) => {
        const price = parseFloat(editor.getFieldValue('price')) || 0;
        await editor.setFieldValue('total', value * price);
    }
}
```

---

## Field Types

### Supported Field Types

| Type | Description |
|------|-------------|
| `text` | Single-line text input (default) |
| `textarea` | Multi-line text input |
| `password` | Password input (masked) |
| `checkbox` | Checkbox input (jQuery UI `.button()` enhanced) |
| `checkboxradio` | Checkbox input (jQuery UI `.checkboxradio()` enhanced — use with jQuery UI 1.12+) |
| `radiogroup` | Group of mutually-exclusive radio buttons (jQuery UI `.checkboxradio()` enhanced — use with jQuery UI 1.12+) |
| `dropdown` / `select` | Dropdown select list |
| `date` | Date picker (jQuery UI datepicker) |
| `time` | Time picker (requires [jquery-timepicker](https://timepicker.co)) |
| `autocomplete` | Autocomplete text input |
| `spinner` | Number spinner with +/- buttons |
| `slider` | Range slider with value display |
| `hidden` | Hidden field |
| `htmldiv` | Raw HTML content block — inserts arbitrary markup at any position in the form |

### htmldiv Properties

Inserts a `<div>` containing arbitrary HTML markup at any point in the dialog. Unlike regular fields the `htmldiv` element has no input value and is excluded from save data. It is useful for inserting headings, instructions, separators, imagery, or any other markup between form fields.

| Property | Type | Description |
|----------|------|-------------|
| `content` | String | HTML markup to insert inside the div |
| `label` | String | Label text displayed in the label column. Only rendered when layout is horizontal and `align` is `'field'`. Styled identically to normal field labels. |
| `id` | String | `id` attribute for the container div. Defaults to `'field-' + fieldName` if omitted. |
| `align` | String | Alignment in horizontal layouts. One of `'dialog'` (default), `'field'`, or `'label'`. See below. |
| `hidden` | Boolean | If `true`, the div is initially hidden. Use `showField()` / `hideField()` to toggle visibility. |
| `class` | String | One or more CSS class names appended to the container div, in addition to the built-in `htmldiv-content` class. |
| `style` | String | Inline CSS style string applied directly to the container div (e.g. `'margin-top:8px; color:#555'`). |

**`align` values (horizontal layout only):**

| Value | Behaviour |
|-------|-----------|
| `'dialog'` | Div spans the full row width — from the start of the label column through the end of the field column. **Default.** |
| `'field'` | Div appears in the field/input column. If `label` is set, it is rendered in the label column; otherwise an invisible spacer keeps the content aligned with other field inputs. |
| `'label'` | Div appears in the label column position, sized to the label width. No input column is rendered. |

In **vertical layout** the `align` property has no effect; the div is simply inserted as a block element.

**Example:**

```javascript
fields: {
    sectionHeading: {
        type: 'htmldiv',
        align: 'dialog',
        content: '<h3 style="margin:0 0 4px">Shipping Address</h3><hr style="margin:0">'
    },
    notice: {
        type: 'htmldiv',
        id: 'ship-notice',
        align: 'field',
        hidden: true,
        content: '<p class="ui-state-highlight" style="padding:6px">Shipping differs from billing address.</p>'
    },
    shipcity: { label: 'City', type: 'text' }
}
```

---

### Field Type Examples

```javascript
fields: {
    // Text
    name: {
        label: 'Name',
        type: 'text',
        maxLength: 100,
        width: '300px'
    },
    
    // Textarea
    description: {
        label: 'Description',
        type: 'textarea',
        rows: 6,
        maxLength: 500,
        showCounter: true
    },
    
    // Checkbox
    active: {
        label: 'Status',
        type: 'checkbox',
        checkboxLabel: 'Account is active'
    },

    // Radio group (mutually exclusive)
    priority: {
        label: 'Priority',
        type: 'radiogroup',
        options: {
            'low':    'Low',
            'medium': 'Medium',
            'high':   'High'
        }
    },
    
    // Dropdown
    category: {
        label: 'Category',
        type: 'dropdown',
        options: {
            'cat1': 'Category 1',
            'cat2': 'Category 2'
        }
    },
    
    // Date
    birthDate: {
        label: 'Birth Date',
        type: 'date',
        dateDisplayFormat: 'dd/mm/yy',
        dateRecordFormat: 'yyyy-mm-dd',
        yearRange: 'c-80:c-18'
    },
    
    // Autocomplete
    country: {
        label: 'Country',
        type: 'autocomplete',
        source: '/api/countries',   // URL: server receives ?term=<typed> for server-side filtering
        minLength: 1,               // show suggestions after 1 character
        delay: 300,                 // ms wait before firing request
        maxItems: 10,               // clip list to 10 items
        scrollHeight: '220px'       // dropdown max-height; scrollbar appears if list is taller
    },
    
    // Spinner
    age: {
        label: 'Age',
        type: 'spinner',
        min: 0,
        max: 120,
        step: 1
    },
    
    // Slider
    rating: {
        label: 'Rating',
        type: 'slider',
        min: 0,
        max: 10,
        step: 1
    },

    // Time (requires jquery-timepicker)
    meetingTime: {
        label: 'Meeting Time',
        type: 'time',
        timeFormat: 'HH:mm',
        minTime: '08:00',
        maxTime: '18:00',
        interval: 15
    }
}
```

---

## Input Masking

RecEdit supports input masking via the [jquery.inputmask](https://github.com/RobinHerbots/Inputmask) library. The library must be loaded before RecEdit.

```html
<script src="/static/js/import/jquery/jquery.inputmask.min.js"></script>
<script src="/static/js/site/recedit.js"></script>
```

Masking is supported on `text`, `password`, `time`, and `autocomplete` field types. Other field types (checkbox, select, slider, spinner, etc.) are silently skipped.

If the jquery.inputmask library is not loaded, all mask configuration is ignored and no error is thrown.

### Field-Level Mask

Set an `inputmask` (or `inputMask`) property on any maskable field definition. The value may be a mask string or a full inputmask options object.

```javascript
fields: {
    phone: {
        label: 'Phone',
        type: 'text',
        inputmask: '(999) 999-9999'
    },
    zip: {
        label: 'Zip Code',
        type: 'text',
        inputmask: '99999'
    },
    ip: {
        label: 'IP Address',
        type: 'text',
        inputmask: {
            mask: '999.999.999.999',
            placeholder: '_'
        }
    },
    // Masks also work on password and autocomplete fields
    pin: {
        label: 'PIN',
        type: 'password',
        inputmask: '9999'
    }
}
```

### Dynamic Mask Override via `dynamicFieldProps`

Pass an `inputMasks` map in `dynamicFieldProps` to apply or override masks at open time. Dynamic masks take precedence over masks set at the field level.

```javascript
editor.open({ record: myRecord }, null, null, {
    inputMasks: {
        phone:    '(999) 999-9999',   // Override field-level mask (or apply where none exists)
        postcode: 'A9 9AA',            // Mask string
        ref:      { mask: 'AA-9999', placeholder: '#' }  // Options object
    }
});
```

### Inputmask Options Object

When passing an object instead of a string, any option accepted by jquery.inputmask can be used:

| Option | Description |
|--------|-------------|
| `mask` | The mask string |
| `placeholder` | Character shown for empty positions (default: `'_'`) |
| `autoUnmask` | When `true`, `.val()` returns the unmasked value (default: `false`) |
| `removeMaskOnSubmit` | Remove mask characters on form submit (default: `false`) |
| `alias` | Use a pre-defined alias such as `'datetime'`, `'currency'`, `'email'` |

See the [jquery.inputmask documentation](https://robinherbots.github.io/Inputmask/) for the full list of options.

### Value Behaviour

- `getFieldValue()` and `_getFormData()` return whatever `.val()` reports on the masked input — by default this is the full masked value including literal mask characters (e.g. `'(555) 123-4567'`).
- To receive only the typed digits/characters (no mask literals, no `_` placeholders), set `autoUnmask: true` in the inputmask options object. RecEdit detects this flag and calls `inputmask('unmaskedvalue')` directly rather than relying on the `$.valHooks` patch (which is unreliable with jQuery 4+).
- Incomplete masks (where the user has not filled all positions) return the partial value with placeholder characters in normal mode. With `autoUnmask: true`, only the typed characters are returned.
- `clearIncomplete: true` can be combined with `autoUnmask: true` to clear the field entirely when the user leaves it incomplete.

### Checking Mask Completeness

Use `getInvalidMaskedFields()` to find all masked fields whose value is not yet fully satisfied. This checks all fields that had a mask applied (field-level or dynamic) during the most recent `open()` call. Note that this function uses the inputmask's `isValid()` function instead of `isComplete()` because `isComplete()` doesn't appear to handle masks with optional markers correctly.

```javascript
const invalid = editor.getInvalidMaskedFields();
if (invalid.length > 0) {
    console.log('Incomplete masked fields:', invalid);
    // e.g. ['phone', 'postcode']
}
```

Typical use: call this inside a `validateForm` callback to block saving until all masks are complete.

```javascript
const editor = new RecEdit({
    fields: {
        phone:    { label: 'Phone',    type: 'text', inputmask: '(999) 999-9999' },
        postcode: { label: 'Postcode', type: 'text', inputmask: 'A9 9AA' }
    },
    validateForm: (edpak) => {
        const invalid = editor.getInvalidMaskedFields();
        if (invalid.length > 0) {
            return { valid: false, message: `Please complete all masked fields: ${invalid.join(', ')}` };
        }
        return { valid: true };
    },
    onSave: async (edpak) => { /* ... */ }
});
```

---

## Layout Options

### Vertical Layout (Default)

Labels appear above inputs.

```javascript
const editor = new RecEdit({
    formLayout: 'vertical',  // Default
    fields: { /* ... */ }
});
```

### Horizontal Layout

Labels appear beside inputs on the same line.

```javascript
const editor = new RecEdit({
    formLayout: 'horizontal',
    labelWidth: '150px',
    fields: { /* ... */ }
});
```

### Default Input Width

Set a default width for all text inputs at the form level. Individual fields can still override this.

```javascript
const editor = new RecEdit({
    defaultInputWidth: '300px',  // All text inputs will be 300px wide by default
    fields: {
        name: {
            label: 'Name',
            type: 'text'
            // Will use 300px width
        },
        email: {
            label: 'Email',
            type: 'text',
            width: '400px'  // Overrides default, will be 400px
        },
        description: {
            label: 'Description',
            type: 'textarea'
            // Textareas are not affected by defaultInputWidth
        },
        notes: {
            label: 'Notes',
            type: 'text',
            width: '100%'  // Full width - overrides default
        }
    }
});
```

**Notes:**
- Set `defaultInputWidth: null` (default) for full-width inputs
- Can be a string (e.g., `'300px'`, `'50%'`, `'20em'`) or number (character count for `size` attribute)
- Only affects text input fields, not textareas or other field types
- Field-level `width` property always takes precedence

### Mixed Layout

Override layout per field:

```javascript
const editor = new RecEdit({
    formLayout: 'vertical',  // Default for all fields
    fields: {
        id: {
            label: 'ID',
            type: 'text',
            layout: 'horizontal',  // This field uses horizontal
            labelWidth: '100px'
        },
        description: {
            label: 'Description',
            type: 'textarea',
            layout: 'vertical'  // This field uses vertical
        }
    }
});
```

### Field Grouping (Horizontal Layout Only)

Fields with the same `fieldGroup` value appear on one line. This only works when `formLayout` is set to `'horizontal'`.

```javascript
const editor = new RecEdit({
    formLayout: 'horizontal',
    fields: {
        firstName: {
            label: 'First Name',
            type: 'text',
            fieldGroup: 'name'  // Same group
        },
        lastName: {
            label: 'Last Name',
            type: 'text',
            fieldGroup: 'name'  // Same group - will appear on same line as firstName
        },
        city: {
            label: 'City',
            type: 'text',
            fieldGroup: 'location'  // Different group
        },
        state: {
            label: 'State',
            type: 'text',
            fieldGroup: 'location'  // Same group - will appear on same line as city
        },
        email: {
            label: 'Email',
            type: 'text'
            // No fieldGroup - will appear on its own line
        }
    }
});
```

---

## Tab Support

The `tabs` option accepts either a simple array of strings or an array of objects — both forms are automatically normalised to the same internal structure. When strings are used, each string becomes both the tab's `id` and its displayed `title`. When objects are used, each must supply at least a `title`; an `id` is generated from the title if omitted. This means you can use either form interchangeably, and assign a field to a tab using its `id` or its `title`.

### Simple Tab Configuration

```javascript
const editor = new RecEdit({
    tabs: ['Personal', 'Contact', 'Additional'],
    fields: {
        firstname: {
            label: 'First Name',
            type: 'text',
            tab: 'Personal'
        },
        email: {
            label: 'Email',
            type: 'text',
            tab: 'Contact'
        },
        notes: {
            label: 'Notes',
            type: 'textarea',
            tab: 'Additional'
        }
    }
});
```

### Advanced Tab Configuration

```javascript
const editor = new RecEdit({
    tabs: [
        { 
            id: 'basic',
            title: 'Basic Information',
            icon: 'ui-icon-person'
        },
        { 
            id: 'contact',
            title: 'Contact Details',
            icon: 'ui-icon-mail'
        },
        {
            id: 'other',
            title: 'Other',
            icon: 'ui-icon-document'
        }
    ],
    tabsActive: 0,           // First tab active by default
    tabsCollapsible: false,
    fields: {
        name: {
            label: 'Name',
            type: 'text',
            tab: 'basic'  // Use tab ID or title
        }
    }
});
```

### Tab Icons

Available jQuery UI icons:
- `ui-icon-person` - Person
- `ui-icon-mail` - Email
- `ui-icon-document` - Document
- `ui-icon-home` - Home
- `ui-icon-calendar` - Calendar
- And many more from jQuery UI theme

---

## Programmatic API

### Opening the Editor

```javascript
// Basic - pass edpak object with record property
editor.open({ record: myRecord });

// With custom title
editor.open({ record: myRecord }, null, 'Edit Customer');

// With app-specific properties in edpak
editor.open({ 
    record: myRecord, 
    op: 'edit',           // App-specific: operation type
    tvars: tableVars      // App-specific: table variables
}, null, 'Edit Customer');

// With field definitions
editor.open({ record: myRecord }, fieldDefinitions, 'Custom Title');

// With dynamic field properties (override creation-time field config for this open)
editor.open({ record: myRecord }, null, null, {
    maxFieldLengths: { customerid: 5, orderdate: 10, shippeddate: 10, shipcity: 15, shipcountry: 15 },
    requiredFields: ['companyname', 'email'],
    fieldLabels: { companyname: 'Organisation Name', contactname: 'Primary Contact' }
});
```

**`dynamicFieldProps`** (4th argument) accepts an object with the following supported keys:

| Key | Type | Description |
|-----|------|-------------|
| `maxFieldLengths` | Object | Map of `fieldName: maxlength` — overrides any `maxLength` set in the field definition. Also updates the character counter max display if `showCounter` is enabled. |
| `requiredFields` | Array&lt;String&gt; | Array of field names to mark as required for this open — adds the asterisk indicator and `aria-required`. Use this when required fields vary per record or are determined server-side. For fields that are always required, prefer the field-level `required: true` property instead. |
| `fieldLabels` | Object | Map of `fieldName: labelText` — overrides the label displayed for each named field. Takes precedence over any `label` or `title` set in the field definition. Has no effect for a field where `omitLabel: true` is set in the field definition (no label element exists in the DOM). |
| `inputMasks` | Object | Map of `fieldName: mask` — overrides any `inputmask` set in the field definition. Each value may be a mask string or an inputmask options object. See [Input Masking](#input-masking). e.g. `{ phone: '(999) 999-9999', zip: '99999' }` |

### Setting Field Values

```javascript
// Set single field
await editor.setFieldValue('name', 'John Doe');

// Set multiple fields
await editor.setFieldValues({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
});
```

### Restoring Form Fields

`restoreForm()` repopulates all form fields from `edpak.record` — the original record object passed to `open()` / `load()`. Any unsaved edits the user has made (including those made via `setFieldValue()`) are discarded.

```javascript
await editor.restoreForm();
```

A common use case is a **Reset** custom button that lets the user undo in-progress edits:

```javascript
const editor = new RecEdit({
    customButtons: [
        {
            text:  'Reset',
            icon:  'ui-icon-arrowreturn-1-w',
            align: 'right',
            click: () => editor.restoreForm()
        }
    ],
    fields: { /* ... */ }
});
```

### Getting Field Values

```javascript
// Get single field value
const name = editor.getFieldValue('name');

// Get all form data
const formData = editor._getFormData();
```

### Tab Management

```javascript
// Switch to tab by index
editor.activateTab(0);

// Switch to tab by ID
editor.activateTab('contact');

// Switch to tab by title
editor.activateTab('Contact Details');
```

### Showing and Hiding Fields

Any field group — including `htmldiv` blocks — can be shown or hidden programmatically by field name.

```javascript
// Hide a field (or htmldiv)
editor.hideField('notice');

// Show it again
editor.showField('notice');
```

The `hidden: true` field property controls initial visibility when the form is built. `showField` / `hideField` are the runtime counterparts.

### Checking Input Mask Completeness

The `getInvalidMaskedFields()` function returns an array of field names whose inputmask has not been fully filled. Covers both field-level masks (`inputmask` / `inputMask` in the field definition) and dynamic masks supplied via `dynamicFieldProps.inputMasks`. Returns `[]` when no masked fields exist or when jquery.inputmask is not loaded.

**Automatic pre-open label marking:** `open()` calls this method automatically *before* `_populateForm()`, while all masked inputs are still empty. All masked fields with mandatory masks (not enclosed in []) are therefore returned as invalid at that point, so these masked fields receive the `field-required` CSS class — producing the same red asterisk indicator as required fields, regardless of whether the record value will eventually satisfy the mask. The class is not persisted — the form is rebuilt on every `open()` call.

```javascript
// Get names of all masked fields that are invalid
const invalid = editor.getInvalidMaskedFields();
// e.g. ['phone', 'postcode']

// Typical validation use-case
if (invalid.length > 0) {
    editor.displayFieldErrors(
        invalid.map(name => ({ name, status: 'Please complete this field' }))
    );
    return; // abort save
}
```

### Closing the Editor

```javascript
editor.close();
```

### Displaying Field Validation Errors

Display inline error messages beneath specific form fields. Errors are cleared automatically when the user clicks Save, or can be cleared manually.

```javascript
// Preferred: plain array of error objects
editor.displayFieldErrors([
    { name: 'companyname', status: 'Value is required' },
    { name: 'email',       status: 'Invalid email address' }
]);

// Legacy object form (still accepted)
editor.displayFieldErrors({
    fieldErrors: [
        { name: 'companyname', status: 'Value is required' },
        { name: 'email',       status: 'Invalid email address' }
    ]
});
```

The `name` property must match the field key used in the `fields` configuration. The `status` text is displayed in small red text directly beneath the field input. The input element also receives the `field-invalid` CSS class, which you can style (e.g. a red border).

### Clearing Field Validation Errors

Hide all currently displayed field error messages and remove the `field-invalid` CSS class from all inputs. This is also called automatically at the start of every save attempt.

```javascript
editor.clearFieldErrors();
```

### Destroying the Editor

```javascript
// Clean up and remove
editor.destroy();
```

---

## Callbacks and Events

### onBeforeShow Callback

Called after the form has been fully populated with record data and just before the dialog is made visible. Use this to perform last-minute field adjustments — for example, setting an image URL derived from another field value, toggling field visibility, or applying conditional formatting based on record state.

> **Note on mask completeness:** After `onBeforeShow` returns the dialog is shown. Note that all masked fields already have the required asterisk applied (added by `open()` *before* the form was populated with record data) — `onBeforeShow` does not affect which fields are marked.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `editor` | RecEdit | The editor instance. All public methods (`setFieldValue`, `showField`, `hideField`, etc.) are immediately available. |
| `edpak` | Object | The edit package passed to `open()`. `edpak.record` is the original record; `edpak.currentRecord` is the shallow copy made at open time. |

The callback may be `async` — `open()` will `await` it before showing the dialog.

```javascript
const editor = new RecEdit({
    fields: { ... },
    onBeforeShow: async (editor, edpak) => {
        // Derive an image URL from the record and push it into the form
        const photoUrl = `/images/employees/${edpak.record.employeeid}.jpg`;
        await editor.setFieldValue('photo', photoUrl);

        // Conditionally hide a field based on record state
        if (edpak.record.status === 'archived') {
            editor.hideField('actionButtons');
        } else {
            editor.showField('actionButtons');
        }
    },
    onSave: async (edpak) => { ... }
});
```

---

### onAfterShow Callback

Called after the dialog animation completes and the dialog is fully visible. The default focus (first editable input) has already been applied by this point, so use this callback to override focus, scroll to a specific tab, highlight a field, or perform any other post-display UI adjustments based on the current record state.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `editor` | RecEdit | The editor instance. All public methods (`setFieldValue`, `getFieldValue`, `activateTab`, `showField`, `hideField`, etc.) are immediately available. |
| `edpak` | Object | The edit package passed to `open()`. `edpak.record` is the original record; `edpak.currentRecord` is the shallow copy made at open time. |

The callback may be `async` — it is awaited inside the post-animation `setTimeout`.

```javascript
const editor = new RecEdit({
    fields: { ... },
    onAfterShow: async (editor, edpak) => {
        // Override default focus — put cursor in a specific field
        editor.getFieldInput('notes').focus();

        // Switch to the relevant tab based on the record's status
        if (edpak.record.status === 'pending') {
            editor.activateTab('approval');
        }

        // Highlight an overdue date field
        if (edpak.record.dueDate && new Date(edpak.record.dueDate) < new Date()) {
            editor.getFieldInput('dueDate').addClass('field-overdue');
        }
    },
    onSave: async (edpak) => { ... }
});
```

---

### onInit Callback

Called **once** after the form elements are first built, before any record has been loaded. Use this for one-time structural setup that operates on the form DOM — for example, initialising a jQuery UI tabs widget inside the form, wiring up third-party plugins to inputs, or measuring layout.

> **When it fires by class:**
> - **`RecEdit` / `RecEditCustomDialog`**: on the first `open()` call, after `_buildForm()` completes but before dynamic props, input masks, `_populateForm()`, and `onBeforeShow` run.
> - **`RecEditInlineForm`**: in the constructor, immediately after `_buildForm()` — before any `load()` call.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `editor` | RecEdit | The editor instance. The form DOM is fully built; `setFieldValue()`, `showField()`, `hideField()`, etc. are available. There is no `edpak` yet — no record has been loaded. |

The callback is **synchronous** — it is called with a plain function call, not awaited. For async setup defer to `onBeforeShow`.

```javascript
const editor = new RecEditInlineForm({
    container: '#my-editor',
    fields: { /* ... */ },

    // Initialise a jQuery UI tabs widget that lives inside the container —
    // runs once after the form DOM is ready, not on every load().
    onInit: (editor) => {
        editor.$form.find('#editor-tabs').tabs({
            active: 0
        });
    },

    onBeforeShow: (editor, edpak) => {
        // This runs on every load() — safe for record-dependent adjustments.
    },

    onSave: async (edpak) => { /* ... */ }
});
```

---

### onSave Callback

Called when the user clicks the Save button. Receives an `edpak` object containing form data and metadata.

**edpak properties:**
- `data` - Current form values
- `currentRecord` - Copy of the original record passed to `open()`
- `record` - The original record passed to `open()`
- Other app-specific properties passed when calling `open()`

```javascript
onSave: async function(edpak) {
    // Access form data and original record
    const formData = edpak.formdata;
    const originalRecord = edpak.currentRecord;
    
    const response = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
        throw new Error('Save failed');
    }
    
    // Dialog closes automatically on success
    // Throw error to keep dialog open and show error message
}
```

### onCancel Callback

Called when the dialog is cancelled or closed.

```javascript
onCancel: function() {
    console.log('Edit cancelled');
    // Cleanup or other actions
}
```

### validateForm Callback

Custom validation before saving. Receives the same `edpak` object as `onSave`.

`validateForm` may return any of three forms:

| Return value | Meaning |
|---|---|
| `null` / `undefined` / `[]` (empty array) | Valid — proceed to save |
| `[{name, status}, ...]` (non-empty array) | Invalid — display inline field errors |
| `{ valid: bool, fieldErrors: [...] }` | Legacy object form — still accepted |

Any field errors are cleared automatically at the start of the next save attempt.

**Preferred (array) form:**

```javascript
validateForm: function(edpak) {
    const formData = edpak.formdata;
    const errors = [];

    if (!formData.companyname || formData.companyname.trim() === '') {
        errors.push({ name: 'companyname', status: 'Value is required' });
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        errors.push({ name: 'email', status: 'Invalid email address' });
    }

    return errors; // empty array = valid; non-empty array = invalid
}
```

**Legacy object form (still accepted):**

```javascript
validateForm: function(edpak) {
    // ...
    if (errors.length > 0) {
        return { valid: false, fieldErrors: errors };
    }
    return { valid: true };
}
```

When field errors are returned, each error message is displayed in small red text immediately below the corresponding field input and the input receives the `field-invalid` CSS class. Both remain until the user clicks Save again (which clears all errors before re-validating).

If the return value signals invalid but no errors are provided, the save is simply aborted silently — the caller is expected to have handled user feedback another way (e.g. via a growl notification).

### Field onChange Event

Called when a field value changes (user interaction only).

```javascript
fields: {
    price: {
        label: 'Price',
        type: 'text',
        onChange: async function(value, fieldName, editor) {
            // Update calculated fields
            const quantity = parseInt(editor.getFieldValue('quantity')) || 0;
            const total = parseFloat(value || 0) * quantity;
            await editor.setFieldValue('total', total.toFixed(2));
        }
    }
}
```

---

## Error Handling

RecEdit uses a custom event system to report errors and notifications to the application. This allows you to implement custom error handling and user notifications.

### The recedit-notice Event

RecEdit triggers a `recedit-notice` event on the document when errors or notifications occur. By default, these are logged to the browser console, but you can intercept and handle them with your own notification system.

**Event Details:**

The event includes a notice object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | String | Notice type: `'error'`, `'info'`, or `'warning'` |
| `title` | String | Short summary or title of the notice |
| `message` | String/Any | Detailed message or error information (optional) |

### Default Behavior

By default, notices are logged to the browser console:

```javascript
console.error('[recedit] error: Title', 'message details');
```

### Custom Error Handling

To implement custom error handling, listen for the `recedit-notice` event and prevent the default console logging:

```javascript
$(document).on('recedit-notice', function(event, notice) {
    // Prevent default console.error logging
    event.preventDefault();
    
    // Handle the notice based on type
    switch(notice.type) {
        case 'error':
            // Show error notification to user
            $.growl.error({
                title: notice.title,
                message: notice.message || '',
                fixed: true
            });
            break;
            
        case 'warning':
            $.growl.warning({
                title: notice.title,
                message: notice.message || ''
            });
            break;
            
        case 'info':
            $.growl.notice({
                title: notice.title,
                message: notice.message || ''
            });
            break;
    }
});
```

### When Notices are Triggered

RecEdit triggers notices in the following situations:

1. **Missing record on open**: When `open()` is called without a valid record object
2. **Failed option fetch**: When dropdown options fail to load from a URL
3. **Save errors**: When the `onSave` callback throws an error

**Example scenarios:**

```javascript
// Error: Missing record
editor.open({ /* missing record property */ });
// Triggers: { type: 'error', title: 'RecEdit open error', 
//            message: 'Missing record property...' }

// Error: Failed to fetch dropdown options
fields: {
    category: {
        type: 'dropdown',
        options: '/api/categories'  // If this fails to fetch
    }
}
// Triggers: { type: 'error', title: 'Failed to fetch options', 
//            message: error.message }

// Error during save
onSave: async (edpak) => {
    throw new Error('Database connection failed');
}
// Triggers: { type: 'error', 
//            message: 'Database connection failed' }
```

### Complete Error Handling Example

Here's a complete example using jQuery Growl notifications:

```javascript
// Set up global error handler for RecEdit
$(document).on('recedit-notice', function(event, notice) {
    // Prevent default console logging
    event.preventDefault();
    
    // Use Growl plugin to show notifications
    const options = {
        title: notice.title || 'Notification',
        message: notice.message || '',
        duration: notice.type === 'error' ? 0 : 3000,  // Errors stay until dismissed
        fixed: notice.type === 'error'
    };
    
    switch(notice.type) {
        case 'error':
            $.growl.error(options);
            break;
        case 'warning':
            $.growl.warning(options);
            break;
        case 'info':
            $.growl.notice(options);
            break;
    }
});

// Create editor - errors will now be shown via Growl
const editor = new RecEdit({
    fields: { /* ... */ },
    
    onSave: async (edpak) => {
        const response = await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(edpak.formdata)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save record');
        }
    }
});
```

### Dual Handling (Custom + Console)

If you want to show custom notifications AND still log to console, don't call `event.preventDefault()`:

```javascript
$(document).on('recedit-notice', function(event, notice) {
    // Don't prevent default - will still log to console
    
    // Show custom notification
    if (notice.type === 'error') {
        showErrorDialog(notice.title, notice.message);
    }
});
```

### Error Handling in onSave

The `onSave` callback should throw errors to trigger the error handling system:

```javascript
onSave: async (edpak) => {
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata)
        });
        
        const result = await response.json();
        
        if (!response.ok || result.error) {
            // Throw error with descriptive message
            throw new Error(result.errmsg || 'Failed to save record');
        }
        
        // Success - dialog will close
        return result;
        
    } catch (error) {
        // Re-throw to trigger recedit-notice event
        throw error;
    }
}
```

### Suppressing Specific Errors

You can selectively handle or suppress specific errors:

```javascript
$(document).on('recedit-notice', function(event, notice) {
    // Suppress option fetch errors (handle silently)
    if (notice.title === 'Failed to fetch options') {
        event.preventDefault();
        console.log('Options not available, using defaults');
        return;
    }
    
    // Handle other errors normally
    if (notice.type === 'error') {
        event.preventDefault();
        alert(`Error: ${notice.title}\n${notice.message}`);
    }
});
```

---

## RecEditInlineForm

`RecEditInlineForm` is a subclass of `RecEdit` that renders an always-visible inline form embedded directly in the page — no jQuery UI dialog is created. It is ideal for dedicated edit panels, sidebar forms, master/detail layouts, and any situation where a modal dialog would be intrusive.

### How It Differs from RecEdit

| Aspect | RecEdit | RecEditInlineForm |
|--------|---------|-------------------|
| Presentation | jQuery UI modal dialog | Container div embedded in the page |
| Visibility | `open()` shows the dialog | Form is visible as soon as the constructor runs |
| Data loading | `open(edpak, ...)` | `load(edpak, ...)` |
| After-save behaviour | Dialog closes | Form resets (or stays populated — see `clearFormOnSave`) |
| Tab support | Built-in via `tabs` option | Developer's responsibility in the HTML markup |
| Title display | Dialog title bar | Optional element matched by `titleSelector` |
| Buttons | jQuery UI dialog footer | Injected into the container (or a `buttonContainerSelector` target) |

### HTML Template

The container must include one placeholder element per editable field, each with a `data-field` attribute matching the field key:

```html
<div id="my-editor">
    <!-- Optional: element to receive the title text -->
    <h3 data-editor-title></h3>

    <!-- One placeholder per editable field -->
    <div data-field="companyname"></div>
    <div data-field="contactname"></div>
    <div data-field="phone"></div>

    <!-- Optional: Save/Reset buttons are injected here when buttonContainerSelector is set -->
    <div class="editor-buttons"></div>
</div>
```

On construction the class injects the full field group (label + input + character counter + error element) into each placeholder. All base-class features — layout modes, validation display, `showField()` / `hideField()`, input masks, counters — work without modification.

### Constructor Options

`RecEditInlineForm` accepts all `RecEdit` options plus the following additional options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | String/jQuery | — | **Required.** CSS selector or jQuery object for the container element. |
| `titleSelector` | String | `null` | CSS selector (relative to the container) for an element that receives the title text. If omitted, title updates are silently ignored. |
| `buttonContainerSelector` | String | `null` | CSS selector (relative to the container) for the element into which Save/Reset buttons are injected. If omitted, buttons are appended to the container itself. |
| `clearFormOnSave` | Boolean | `true` | When `true`, form fields are reset to their `defaultValue` after a successful save. When `false`, the form retains the saved values. |
| `useJQueryUITheme` | Boolean | `true` | When `true`, adds jQuery UI theme classes (`ui-dialog-content ui-widget-content`) and default padding/margin/overflow styles to the container. Set to `false` to manage all container styling yourself. |
| `containerClass` | String | `null` | One or more CSS class names to add to the container element (e.g. `'my-editor panel'`). Applied after the jQuery UI theme classes when `useJQueryUITheme` is `true`, so it can augment or override them. |
| `containerStyle` | Object | `null` | Plain object of CSS properties to apply to the container via jQuery `.css()` (e.g. `{ width: '75%', border: '1px solid #ccc' }`). Applied after `useJQueryUITheme` styles so it takes precedence. |

> **Note:** jQuery UI dialog options (`dialogWidth`, `modal`, `resizable`, `draggable`, `showEffect`, `hideEffect`, `effectDuration`) are accepted but have no effect in `RecEditInlineForm` because no dialog is created.

### Constructor Lifecycle

The constructor:
1. Resolves the `container` option to a jQuery object.
2. Calls `_createDialog()` — wires the container as `this.$dialog` / `this.$form` and injects the Save/Reset button bar.
3. Calls `_buildForm()` — injects empty input widgets into every `[data-field]` placeholder.

The form is immediately visible and interactive. No explicit `open()` / `load()` call is required to display the form — only to populate it with data.

### The `load()` Method

Use `load()` to populate the form with a record. It is the equivalent of `open()` on the base class but does not show or hide the container.

```javascript
await editor.load(edpak, fieldDefinitions?, customTitle?, dynamicFieldProps?);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `edpak` | Object | Edit package. Must have a `record` property. Other app-specific properties are passed through to `onSave` and `validateForm`. |
| `fieldDefinitions` | Object\|null | Optional replacement field definitions. Replaces `options.fields` for this call and all subsequent calls. |
| `customTitle` | String\|null | Optional title text. Applied via `titleSelector` if set. Falls back to `dialogTitle`, then `messages.editRecord`. |
| `dynamicFieldProps` | Object\|null | Same dynamic overrides as the `open()` 4th argument (`maxFieldLengths`, `requiredFields`, `fieldLabels`, `inputMasks`). |

`load()` fires the `onBeforeShow` and `onAfterShow` callbacks (if provided) after populating the form, matching the base-class `open()` sequence.

### After-Save Behaviour

After a successful save the form is **not** hidden. Instead:

- If `clearFormOnSave` is `true` (default): all fields are reset to their `defaultValue`, leaving the form ready for new input.
- If `clearFormOnSave` is `false`: the form retains the values that were just saved.

### Reset Button

`RecEditInlineForm` replaces the standard Cancel button with a **Reset** button. Clicking Reset calls `restoreForm()`, which repopulates all form fields from `edpak.record` — the original record object passed to `load()`. Any unsaved edits (including those made via `setFieldValue()`) are discarded.

The button label defaults to `'Reset'` and uses the `ui-icon-arrowreturn-1-w` icon. The `cancelButton` option overrides these defaults:

```javascript
const editor = new RecEditInlineForm({
    cancelButton: { text: 'Undo Changes' },   // override label only
    fields: { /* ... */ }
});
```

> **Note:** The Reset button does not call `close()`. The `onCancel` callback and `close()` method remain available for developer use, but are no longer connected to the Reset button.

### `close()` and `destroy()`

| Method | Description |
|--------|-------------|
| `close()` | Fires `onCancel` if defined. Does **not** hide the container — the inline form is always visible; hiding is the developer's responsibility. The Reset button does **not** call `close()` — clicking Reset calls `restoreForm()` instead. |
| `destroy()` | Removes the injected button bar and empties all `[data-field]` placeholders. The surrounding container HTML is left intact. |

### Tab Error Indicators

`RecEditInlineForm` supports tab error indicators in developer-supplied jQuery UI tab markup. If the container includes a standard jQuery UI tabs widget, validation errors automatically show a `*` indicator on the tab whose panel contains the failing field:

```html
<div id="my-editor">
    <div class="ui-tabs" id="editor-tabs">
        <ul class="ui-tabs-nav">
            <li><a href="#tab-details">Details</a></li>
            <li><a href="#tab-address">Address</a></li>
        </ul>
        <div id="tab-details" class="ui-tabs-panel">
            <div data-field="companyname"></div>
            <div data-field="contactname"></div>
        </div>
        <div id="tab-address" class="ui-tabs-panel">
            <div data-field="city"></div>
            <div data-field="country"></div>
        </div>
    </div>
    <div class="editor-buttons"></div>
</div>
```

The indicator is added automatically by `validateForm` / `displayFieldErrors` and removed at the start of the next save attempt. No additional configuration is required.

### Basic Usage Example

```html
<!-- In your HTML -->
<div id="customer-editor">
    <h3 data-editor-title></h3>
    <div data-field="companyname"></div>
    <div data-field="contactname"></div>
    <div data-field="phone"></div>
    <div class="editor-buttons"></div>
</div>
```

```javascript
const editor = new RecEditInlineForm({
    container: '#customer-editor',
    useJQueryUITheme: true,
    containerClass: 'my-editor-panel',
    containerStyle: { width: '60%', border: '1px solid #ccc', borderRadius: '4px' },
    titleSelector: '[data-editor-title]',
    buttonContainerSelector: '.editor-buttons',
    formLayout: 'horizontal',
    labelWidth: '140px',
    clearFormOnSave: true,

    fields: {
        customerid: { key: true },
        companyname: { label: 'Company',  type: 'text', maxLength: 40, required: true },
        contactname: { label: 'Contact',  type: 'text', maxLength: 30 },
        phone:       { label: 'Phone',    type: 'text', inputmask: '(999) 999-9999' }
    },

    validateForm: (edpak) => {
        if (!edpak.formdata.companyname) {
            return { valid: false, fieldErrors: [{ name: 'companyname', status: 'Value is required' }] };
        }
        return { valid: true };
    },

    onSave: async (edpak) => {
        const response = await fetch('/api/customers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata)
        });
        if (!response.ok) throw new Error('Failed to save');
    }
});

// Later, when the user selects a row in a table:
async function onRowSelect(customerRecord) {
    await editor.load(
        { record: customerRecord },
        null,
        `Edit Customer — ${customerRecord.companyname}`
    );
}
```

### Add-Record Usage Example

When `clearFormOnSave` is `true` and no record is selected, pass an empty record to `load()` to start a blank new-entry form:

```javascript
async function startNewCustomer() {
    await editor.load(
        { record: { customerid: null, companyname: '', contactname: '', phone: '' } },
        null,
        'New Customer'
    );
}
```

---

## RecEditCustomDialog

`RecEditCustomDialog` is a subclass of `RecEdit` that combines the full jQuery UI dialog chrome (title bar, modal overlay, footer Save/Cancel buttons, draggable, resizable, show/hide effects) with a developer-supplied custom HTML layout. It is ideal when you need precise visual control over how fields are arranged inside a dialog without sacrificing the base-class field management, validation, input masks, or any other standard feature.

### How It Differs from RecEdit

| Aspect | RecEdit | RecEditCustomDialog |
|--------|---------|---------------------|
| Form layout | Auto-generated by the class | Developer-supplied HTML with `data-field` placeholders |
| Tab support | Built-in via `tabs` option | Developer's responsibility in the HTML markup; error indicators supported |
| Presentation | jQuery UI dialog (auto-generated form body) | jQuery UI dialog (developer's container replaces the form body) |
| Usage | `open(edpak, ...)` | `open(edpak, ...)` — identical to base class |

All other behaviour — `open()`, `close()`, `destroy()`, `onSave`, `validateForm`, `onBeforeShow`, `onAfterShow`, `setFieldValue()`, `getFieldValue()`, `showField()`, `hideField()`, button configuration, and dynamic field props — is inherited unchanged from `RecEdit`.

### HTML Template

Provide a hidden container whose inner markup has one placeholder per editable field:

```html
<!-- Keep hidden — RecEditCustomDialog makes it visible when the dialog opens -->
<div id="my-dialog-layout" style="display:none">
    <!-- Placeholders are identified by data-field attributes -->
    <div class="my-row">
        <div data-field="companyname"></div>
        <div data-field="contactname"></div>
    </div>
    <div class="my-row">
        <div data-field="phone"></div>
        <div data-field="country"></div>
    </div>
</div>
```

On every `open()` call the class empties each placeholder and re-injects the full field group (label + input + counter + error element) produced by `_createFieldGroup()`. All base-class selectors (`[data-field=...]`, `.field-group`, `.field-error`, etc.) continue to work without modification.

### Constructor Options

`RecEditCustomDialog` accepts all `RecEdit` options plus the following additional option:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | String/jQuery | — | **Required.** CSS selector or jQuery object for the element containing the `data-field` placeholders. |

> **Note:** The `tabs` option has no effect in `RecEditCustomDialog`. Tab support is the developer's responsibility in the container HTML.

### Usage

```javascript
const editor = new RecEditCustomDialog({
    container: '#my-dialog-layout',   // Required
    dialogWidth: 560,
    dialogTitle: 'Edit Customer',
    formLayout: 'horizontal',
    labelWidth: '140px',

    fields: {
        customerid: { key: true },
        companyname: { label: 'Company',  type: 'text', maxLength: 40, required: true },
        contactname: { label: 'Contact',  type: 'text', maxLength: 30 },
        phone:       { label: 'Phone',    type: 'text', inputmask: '(999) 999-9999' },
        country:     { label: 'Country',  type: 'dropdown', options: '/api/countries' }
    },

    validateForm: (edpak) => {
        if (!edpak.formdata.companyname) {
            return { valid: false, fieldErrors: [{ name: 'companyname', status: 'Value is required' }] };
        }
        return { valid: true };
    },

    onSave: async (edpak) => {
        const response = await fetch('/api/customers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata)
        });
        if (!response.ok) throw new Error('Failed to save');
    }
});

// Open the dialog — identical to RecEdit
editor.open({ record: customerRecord });
```

### Mixed-Width Layout Example

Custom layout allows you to place fields in any arrangement, independent of `formLayout`:

```html
<div id="order-dialog-layout" style="display:none">
    <div style="display:flex; gap:12px">
        <div data-field="orderdate" style="flex:0 0 160px"></div>
        <div data-field="requireddate" style="flex:0 0 160px"></div>
        <div data-field="shippeddate" style="flex:0 0 160px"></div>
    </div>
    <div data-field="shipvia"></div>
    <div data-field="freight"></div>
    <div style="display:flex; gap:12px">
        <div data-field="shipcity" style="flex:1"></div>
        <div data-field="shipcountry" style="flex:1"></div>
    </div>
    <div data-field="notes"></div>
</div>
```

```javascript
const orderEditor = new RecEditCustomDialog({
    container: '#order-dialog-layout',
    dialogWidth: 620,
    dialogTitle: 'Edit Order',
    formLayout: 'vertical',

    fields: {
        orderid:      { key: true },
        orderdate:    { label: 'Order Date',    type: 'date' },
        requireddate: { label: 'Required Date', type: 'date' },
        shippeddate:  { label: 'Shipped Date',  type: 'date' },
        shipvia:      { label: 'Ship Via',      type: 'dropdown', options: '/api/shippers' },
        freight:      { label: 'Freight',       type: 'text' },
        shipcity:     { label: 'City',          type: 'text', maxLength: 15 },
        shipcountry:  { label: 'Country',       type: 'text', maxLength: 15 },
        notes:        { label: 'Notes',         type: 'textarea', rows: 3 }
    },

    onSave: async (edpak) => {
        await fetch('/api/orders/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata)
        });
    }
});
```

### Tab Error Indicators

`RecEditCustomDialog` supports tab error indicators in developer-supplied jQuery UI tab markup, using the same mechanism as `RecEditInlineForm`. If the container includes a jQuery UI tabs widget, validation errors automatically append a `*` indicator to the tab whose panel contains the failing field. No additional configuration is required.

---

## Complete Examples

### Example 1: Basic Customer Form

```javascript
const customerEditor = new RecEdit({
    dialogTitle: 'Edit Customer',
    dialogWidth: 700,
    formLayout: 'horizontal',
    labelWidth: '150px',
    
    fields: {
        customerid: {
            key: true,
            label: 'Customer ID',
            type: 'text',
            readonly: true,
            width: 10
        },
        companyname: {
            label: 'Company Name',
            type: 'text',
            maxLength: 100,
            width: '100%'
        },
        contactname: {
            label: 'Contact Name',
            type: 'text',
            maxLength: 50,
            width: '100%'
        },
        email: {
            label: 'Email',
            type: 'text',
            maxLength: 100,
            width: '100%'
        },
        phone: {
            label: 'Phone',
            type: 'text',
            maxLength: 20,
            width: '200px'
        },
        address: {
            label: 'Address',
            type: 'textarea',
            rows: 3,
            maxLength: 200,
            width: '100%'
        }
    },
    
    validateForm: (edpak) => {
        if (!edpak.formdata.companyname) {
            return { valid: false, fieldErrors: [{ name: 'companyname', status: 'Value is required' }] };
        }
        return { valid: true };
    },
    
    onSave: async (edpak) => {
        const response = await fetch('/api/customers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edpak.formdata)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save customer');
        }
    }
});

// Open editor
customerEditor.open({ record: customerRecord });
```

### Example 2: Form with Tabs

```javascript
const employeeEditor = new RecEdit({
    dialogTitle: 'Edit Employee',
    dialogWidth: 750,
    
    tabs: [
        { id: 'personal', title: 'Personal Info', icon: 'ui-icon-person' },
        { id: 'employment', title: 'Employment', icon: 'ui-icon-suitcase' },
        { id: 'contact', title: 'Contact', icon: 'ui-icon-mail' }
    ],
    
    formLayout: 'horizontal',
    labelWidth: '150px',
    
    fields: {
        // Personal tab
        employeeid: {
            key: true,
            label: 'Employee ID',
            type: 'text',
            tab: 'personal',
            readonly: true
        },
        firstname: {
            label: 'First Name',
            type: 'text',
            tab: 'personal',
            maxLength: 50
        },
        lastname: {
            label: 'Last Name',
            type: 'text',
            tab: 'personal',
            maxLength: 50
        },
        birthdate: {
            label: 'Birth Date',
            type: 'date',
            tab: 'personal',
            dateDisplayFormat: 'dd/mm/yy',
            dateRecordFormat: 'yyyy-mm-dd',
            yearRange: 'c-80:c-18'
        },
        
        // Employment tab
        department: {
            label: 'Department',
            type: 'dropdown',
            tab: 'employment',
            options: '/api/departments'
        },
        position: {
            label: 'Position',
            type: 'text',
            tab: 'employment',
            maxLength: 50
        },
        salary: {
            label: 'Salary',
            type: 'spinner',
            tab: 'employment',
            min: 0,
            max: 500000,
            step: 1000
        },
        startdate: {
            label: 'Start Date',
            type: 'date',
            tab: 'employment'
        },
        
        // Contact tab
        email: {
            label: 'Email',
            type: 'text',
            tab: 'contact',
            maxLength: 100
        },
        phone: {
            label: 'Phone',
            type: 'text',
            tab: 'contact',
            maxLength: 20
        },
        address: {
            label: 'Address',
            type: 'textarea',
            tab: 'contact',
            rows: 4,
            maxLength: 300
        }
    },
    
    onSave: async (edpak) => {
        await fetch('/api/employees/update', {
            method: 'POST',
            body: JSON.stringify(edpak.formdata)
        });
    }
});
```

### Example 3: Calculated Fields with onChange

```javascript
const invoiceEditor = new RecEdit({
    fields: {
        invoiceid: {
            key: true,
            label: 'Invoice ID',
            type: 'text',
            readonly: true
        },
        quantity: {
            label: 'Quantity',
            type: 'spinner',
            min: 1,
            max: 1000,
            onChange: async (value, fieldName, editor) => {
                const price = parseFloat(editor.getFieldValue('unitprice')) || 0;
                const subtotal = value * price;
                const tax = subtotal * 0.1;
                
                await editor.setFieldValues({
                    subtotal: subtotal.toFixed(2),
                    tax: tax.toFixed(2),
                    total: (subtotal + tax).toFixed(2)
                });
            }
        },
        unitprice: {
            label: 'Unit Price',
            type: 'text',
            onChange: async (value, fieldName, editor) => {
                const quantity = parseInt(editor.getFieldValue('quantity')) || 0;
                const price = parseFloat(value) || 0;
                const subtotal = quantity * price;
                const tax = subtotal * 0.1;
                
                await editor.setFieldValues({
                    subtotal: subtotal.toFixed(2),
                    tax: tax.toFixed(2),
                    total: (subtotal + tax).toFixed(2)
                });
            }
        },
        subtotal: {
            label: 'Subtotal',
            type: 'text',
            readonly: true
        },
        tax: {
            label: 'Tax (10%)',
            type: 'text',
            readonly: true
        },
        total: {
            label: 'Total',
            type: 'text',
            readonly: true
        }
    }
});
```

### Example 4: Dynamic Values with dataFunction

```javascript
const userEditor = new RecEdit({
    fields: {
        userid: {
            key: true,
            label: 'User ID',
            type: 'text',
            readonly: true
        },
        firstname: {
            label: 'First Name',
            type: 'text'
        },
        lastname: {
            label: 'Last Name',
            type: 'text'
        },
        fullname: {
            label: 'Full Name',
            type: 'text',
            readonly: true,
            dataFunction: (record) => {
                return `${record.firstname || ''} ${record.lastname || ''}`.trim();
            }
        },
        age: {
            label: 'Age',
            type: 'spinner',
            min: 0,
            max: 120
        },
        category: {
            label: 'Age Category',
            type: 'text',
            readonly: true,
            dataFunction: (record) => {
                const age = parseInt(record.age);
                if (age < 18) return 'Minor';
                if (age < 65) return 'Adult';
                return 'Senior';
            }
        },
        createdat: {
            label: 'Created',
            type: 'date',
            readonly: true,
            defaultValue: () => new Date()
        }
    }
});
```

---

## CSS Customization

### CSS Classes

You can customize the appearance by targeting these classes:

- `.record-editor-dialog` - Main dialog container
- `.record-editor-form` - Form element
- `.record-editor-tabs` - Tabs container
- `.tab-panel` - Tab content panel
- `.field-group` - Field container
- `.field-group-vertical` - Vertical layout field
- `.field-group-horizontal` - Horizontal layout field
- `.field-label` - Field label
- `.field-input-container` - Input wrapper
- `.form-control` - Input/textarea/select elements
- `.readonly-field` - Read-only field
- `.char-counter` - Character counter
- `.char-counter-warning` - Character counter warning (near limit)
- `.field-error` - Inline field validation error message (hidden by default, shown by `displayFieldErrors()`)
- `.field-required` - Applied to the field group when a field is marked required (via `required: true` on the field config, or via `dynamicFieldProps.requiredFields`). Triggers the red asterisk `*` indicator after the label via CSS `::after`.
- `.recedit-btn-left` - Applied automatically to custom buttons whose `align` is `'left'` or unset (the default). Uses `margin-right: auto` inside the flex button bar to push all subsequent buttons to the right.

### Example Custom Styling

```css
/* Custom field label styling */
.field-label {
    font-weight: bold;
    color: #2c3e50;
    font-size: 14px;
}

/* Custom read-only field styling */
.form-control.readonly-field {
    background-color: #ecf0f1;
    border-color: #bdc3c7;
}

/* Custom tab styling */
.record-editor-tabs .ui-tabs-nav {
    background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
}
```

---

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Edge, Safari)
- IE11+ (with jQuery UI compatibility)

## Dependencies

- jQuery (3.x or higher)
- jQuery UI (1.12.x or higher)
  - jQuery UI Dialog
  - jQuery UI Datepicker
  - jQuery UI Tabs
  - jQuery UI Autocomplete
  - jQuery UI Spinner
  - jQuery UI Slider
  - jQuery UI Selectmenu
  - jQuery UI Button
- Optional: [jQuery Inputmask](https://github.com/RobinHerbots/Inputmask) plugin for input masks
- Optional: [jQuery Timepicker](https://timepicker.co/) plugin for time fields
- Optional: [jQuery Growl](https://github.com/ksylvest/jquery-growl) plugin (or similar) for custom notifications

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
