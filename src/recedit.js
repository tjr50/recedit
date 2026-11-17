"use strict";
/**
 * RecEdit - A jQuery UI-based record editor dialog component
 * 
 * Provides a flexible, feature-rich dialog for editing record data with support for:
 * - Multiple field types (text, textarea, checkbox, select, date, password, autocomplete, spinner, slider, file)
 * - Tabbed form layouts
 * - Field validation
 * - jQuery UI theme integration
 * - Character counters and field change callbacks
 * - Date picking and autocomplete functionality
 * - Programmatic field value manipulation
 * - Field grouping (horizontal layout only) - fields with the same fieldGroup property appear on one line
 * - onBeforeShow / onAfterShow lifecycle callbacks for pre- and post-display customisation
 * 
 * @class RecEdit
 * @example
 * const editor = new RecEdit({
 *     formLayout: 'horizontal',
 *     fields: {
 *         firstName: { label: 'First Name', type: 'text', fieldGroup: 'name' },
 *         lastName: { label: 'Last Name', type: 'text', fieldGroup: 'name' },
 *         email: { label: 'Email', type: 'text' },
 *         description: { label: 'Description', type: 'textarea', rows: 5 },
 *         status: { label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
 *     },
 *     onSave: async (edpak) => {
 *         const response = await fetch('/api/save', { method: 'POST', body: JSON.stringify(edpak.formdata) });
 *         return await response.json();
 *     },
 *     dialogWidth: 600
 * });
 * 
 * await editor.open({ record: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' } });
 * 
 * @license MIT
 * @author Ozmx Internet Services <recedit@ozmx.com.au>
 */
console.log('RecEdit.js loaded - Version 0.1.3-preview');

// Compatibility shim: $.isFunction was removed in jQuery 4.0.
// Restored here for legacy plugins (e.g. jquery-timepicker) that still call it.
if (typeof jQuery !== 'undefined' && typeof jQuery.isFunction !== 'function') {
    jQuery.isFunction = function(obj) { return typeof obj === 'function'; };
}

class RecEdit {
    constructor(options = {}) {
        this.options = {
            fields: {},
            messages: {
                editRecord: 'Edit Record',
                save: 'Save',
                cancel: 'Cancel',
                saving: 'Saving...',
                error: 'Error',
                removeFile: 'Remove',
                dropHint: 'or drop a file here',
                fileMaxSize: 'max size {size}',
                fileTooLarge: 'File is too large',
                fileTypeNotAllowed: 'File type not allowed',
                uploadFailed: 'Upload failed',
                uploading: 'Uploading... {pct}%'
            },
            onSave: null,
            onCancel: null,
            validateForm: null,
            onBeforeShow: null,   // Called after form is populated, just before dialog is shown. Receives (editor, edpak).
            onAfterShow: null,    // Called after the dialog animation completes and the dialog is fully visible. Receives (editor, edpak). May be async.
            onInit: null,         // Called once after form elements are first built, before any record is loaded. Receives (editor). For one-time structural setup.
            
            // jQuery UI specific options
            useJQueryUITheme: true,
            dialogWidth: 600,
            dialogHeight: 'auto',
            modal: true,
            resizable: true,
            draggable: true,
            showEffect: 'fade',
            hideEffect: 'fade',
            effectDuration: 200,
            
            // Date picker options
            dateDisplayFormat: 'yy-mm-dd',
            changeMonth: true,
            changeYear: true,
            yearRange: 'c-100:c+10',

            // date conversion options
            dateRecordFormat: 'yyyy-mm-dd', // Format that matches the date string in the record (used for parsing)
            
            // Button options
            buttonIcons: true,
            saveButton: null,    // Override save btn props: {text, icon, click, hidden, align, class}
            cancelButton: null,  // Override cancel btn props: {text, icon, click, hidden, align, class}
            customButtons: [],   // Extra buttons: [{text, icon, click, hidden, align, class}, ...]
            
            // Form layout options
            formLayout: 'vertical',  // 'vertical' or 'horizontal'
            labelWidth: '150px',     // Width of label in horizontal layout
            defaultInputWidth: null, // Default width for text inputs (null = full-width)
            
            // Dialog title
            dialogTitle: null,       // Custom dialog title (overrides messages.editRecord)
            
            // Tab options
            tabs: null,              // Array of tab definitions or null for no tabs
            tabsCollapsible: false,  // Whether tabs can be collapsed
            tabsActive: 0,           // Index of initially active tab

            // File field upload options
            fileProgressMinSize: 1048576, // Minimum total upload size (bytes) before the progress bar is shown. 0 = always show, false = never show.
            
            ...options
        };
        
        this.$dialog = null;
        this.$form = null;
        this.$saveBtn = null;      // cached by _setButtonsSaving(), used by _setButtonsNormal()
        this.$cancelBtn = null;    // cached by _setButtonsSaving(), used by _setButtonsNormal()
        this._saveBtnLabel = null;   // effective save label resolved in _createDialogButtons()
        this._cancelBtnLabel = null; // effective cancel label resolved in _createDialogButtons()
        //this.currentRecord = null;
        this.edpak = null;
        this.fieldInputs = new Map();
        this._maskedFields = new Set(); // Field names that currently have an inputmask applied
        this._fieldMasks = new Map();   // Resolved effective mask per field name (includes dynamic overrides)
        this.isInitialized = false;
        this.closedAfterSave = false;
        this._activeUpload = null;       // in-flight XHR created by submit(), aborted on close/destroy
        this._$uploadProgress = null;    // cached form-level upload progress bar element
    }

    /**
     * Opens the edit dialog for a given record
     * @param {Object} edpak - The edit package containing the record and other app-specific metadata.
     *   Required property:
     *   - `record`: {Object} The data record to populate the form with.
     *   Set by open() automatically:
     *   - `currentRecord`: {Object} Shallow copy of the original record at open time (available in callbacks).
     *   - `formdata`: {Object} Current form values (available in onSave / validateForm callbacks).
     * @param {Object|null} fieldDefinitions - Field configuration object. If provided, replaces the fields
     *   option set at construction for this open call and all subsequent opens.
     * @param {String|null} customTitle - Custom dialog title for this open. Overrides `dialogTitle` and
     *   `messages.editRecord`. Pass `null` to fall back to the constructor-level title.
     * @param {Object|null} dynamicFieldProps - Optional per-open overrides for field properties. Applied
     *   after the form is built and take precedence over creation-time field configuration. Supported keys:
     *   - `maxFieldLengths`: {Object} Map of `fieldName: maxlength` — overrides any `maxLength` in the
     *     field definition. Also updates the character-counter max if `showCounter` is enabled.
     *     e.g. `{ customerid: 5, shipcity: 15 }`
     *   - `requiredFields`: {Array<string>} Field names to mark as required (asterisk + aria-required).
     *     e.g. `['companyname', 'email']`
     *   - `fieldLabels`: {Object} Map of `fieldName: labelText` — overrides the displayed label.
     *     Has no effect when `omitLabel: true` is set on the field definition.
     *     e.g. `{ companyname: 'Organisation Name', contactname: 'Primary Contact' }`
     *   - `inputMasks`: {Object} Map of `fieldName: mask` — overrides any `inputmask` set in the
     *     field definition. Requires jquery.inputmask. Each value may be a mask string or an
     *     inputmask options object. e.g. `{ phone: '(999) 999-9999', zip: '99999' }`
     */
    async open(edpak, fieldDefinitions = null, customTitle = null, dynamicFieldProps = null) {

        if (!edpak.record) {
            this._triggerNotice({type: 'error', title: 'RecEdit open error', message: 'Missing record property in edpak object passed to open() method'});
            return;
        }

        this.edpak = edpak;
        this.edpak.currentRecord = { ...edpak.record };
        
        if (fieldDefinitions) {
            this.options.fields = fieldDefinitions;
        }

        // Create dialog if not exists
        const isFirstOpen = !this.isInitialized;
        if (!this.isInitialized) {
            this._createDialog();
            this.isInitialized = true;
        }
        
        // Update dialog title if custom title provided
        if (customTitle) {
            this._setTitle(customTitle);
        } else if (this.options.dialogTitle) {
            this._setTitle(this.options.dialogTitle);
        } else {
            this._setTitle(this.options.messages.editRecord);
        }
        
        this._buildForm();

        // Fire onInit callback on first open — form elements are built but not yet populated with data.
        if (isFirstOpen) {
            if (this && this.options.onInit) {
                this.options.onInit(this);
            }
        }

        // _buildForm() recreates every input on each open, so the autocomplete Tab handlers
        // must be re-attached each time, not just on first open
        this._initializeAutoComplete();

        // Apply dynamic field properties after form is built (overrides creation-time field config)
        if (dynamicFieldProps) {
            this._applyDynamicFieldProps(dynamicFieldProps);
        }

        // Apply input masks (dynamic inputMasks override field-level inputmask property)
        this._initializeInputMasks(dynamicFieldProps ? dynamicFieldProps.inputMasks : null);

        // Mark all masked field labels with the required asterisk.
        // Runs before _populateForm() so that all masked inputs are still empty — getInvalidMaskedFields()
        // therefore returns every masked field, giving consistent required-style marking regardless of
        // whether the record value will eventually satisfy the mask.
        for (const fieldName of this.getInvalidMaskedFields()) {
            const _fc = this.options.fields[fieldName];
            if (_fc && (_fc.readonly || _fc.readOnly)) continue; // readonly fields don't need the required asterisk
            this.$form.find(`[data-field="${fieldName}"]`).addClass('field-required');
        }

        await this._populateForm(edpak.record);

        // Fire pre-show callback — form is fully populated; caller can adjust field values before dialog appears.
        if (this.options.onBeforeShow) {
            await this.options.onBeforeShow(this, this.edpak);
        }

        this._showDialog();
    }

    /**
     * Applies dynamic field properties to already-built form inputs.
     * Called from open() after _buildForm(). Property values override those set at editor creation time.
     *
     * Supported properties:
     * - `maxFieldLengths` {Object} - Map of fieldName → maxlength integer
     * - `requiredFields` {Array<string>} - Array of field names to mark as required
     * - `fieldLabels` {Object} - Map of fieldName → label text
     * - `inputMasks` {Object} - Map of fieldName → mask — handled by _initializeInputMasks(), called
     *   separately from open() after this method returns
     *
     * @param {Object} dynamicFieldProps
     * @param {Object} [dynamicFieldProps.maxFieldLengths] - Field name to maxlength map
     * @param {Array<string>} [dynamicFieldProps.requiredFields] - Field names to mark as required (adds asterisk via CSS, sets aria-required)
     * @param {Object} [dynamicFieldProps.fieldLabels] - Field name to label text map
     * @param {Object} [dynamicFieldProps.inputMasks] - Field name to mask map (see _initializeInputMasks)
     * @private
     */
    _applyDynamicFieldProps(dynamicFieldProps) {
        if (dynamicFieldProps.requiredFields) {
            for (const fieldName of dynamicFieldProps.requiredFields) {
                const _fc = this.options.fields[fieldName];
                if (_fc && (_fc.readonly || _fc.readOnly)) continue; // readonly fields don't need the required asterisk
                this.$form.find(`[data-field="${fieldName}"]`).addClass('field-required');
                const $input = this.fieldInputs.get(fieldName);
                if ($input) $input.attr('aria-required', 'true');
            }
        }

        if (dynamicFieldProps.maxFieldLengths) {
            for (const [fieldName, maxLength] of Object.entries(dynamicFieldProps.maxFieldLengths)) {
                const $input = this.fieldInputs.get(fieldName);
                const fieldConfig = this.options.fields[fieldName];
                
                if ($input && fieldConfig) {
                    $input.attr('maxlength', maxLength);
                    // Update the field config so showCounter references the runtime value
                    fieldConfig.maxLength = maxLength;
                    fieldConfig.maxlength = maxLength;
                    
                    const $inputContainer = $input.closest('.field-input-container');
                    let $counter = $inputContainer.find('.char-counter');
                    
                    // If showCounter is true but counter doesn't exist, create it
                    if (fieldConfig.showCounter === true && !$counter.length) {
                        $counter = $('<div>', {
                            class: 'char-counter',
                            html: `<span class="current">0</span> / <span class="max">${maxLength}</span> characters`
                        });
                        
                        // Insert before field-error div if it exists, otherwise append
                        const $fieldError = $inputContainer.find('.field-error');
                        if ($fieldError.length) {
                            $counter.insertBefore($fieldError);
                        } else {
                            $inputContainer.append($counter);
                        }
                        
                        // Add input handler for the counter
                        $input.on('input', function() {
                            const currentLen = $(this).val().length;
                            $counter.find('.current').text(currentLen);
                            
                            // Optional: add warning class when near limit
                            if (currentLen > maxLength * 0.9) {
                                $counter.addClass('char-counter-warning');
                            } else {
                                $counter.removeClass('char-counter-warning');
                            }
                        });
                    } else if ($counter.length) {
                        // Counter exists, just update the max value
                        $counter.find('.max').text(maxLength);
                    }
                }
            }
        }

        if (dynamicFieldProps.fieldLabels) {
            for (const [fieldName, labelText] of Object.entries(dynamicFieldProps.fieldLabels)) {
                const $label = this.$form.find(`[data-field="${fieldName}"] .field-label`);
                if ($label.length) {
                    $label.text(labelText);
                }
            }
        }

    }

    /**
     * Triggers a notice event and logs to console if not prevented
     * @param {Object} notice - The notice object
     * @param {string} notice.type - The type of notice ('error' | 'info' | 'warning')
     * @param {string} notice.title - The title or summary of the notice
     * @param {*} [notice.message] - The message or detail content of the notice
     * @returns {void}
     */
    _triggerNotice(notice) {
        // TODO: change existing console.warn messages to use this function
        // Trigger the custom event
        const event = $.Event('recedit-notice');
        $(document).trigger(event, notice);
        // Default to console if the developer hasn't prevented default within their event handler
        // with  e.preventDefault(); // This stops the library's default console.error
        if (!event.isDefaultPrevented()) {
            console.error(`[recedit] ${notice.type}: ${notice.title}`, notice.message || '');
        }
    }

   
    /**
     * Creates and initializes a dialog container for the record editor.
     * Sets up the dialog form, attaches event handlers, configures jQuery UI dialog options,
     * and applies theming if enabled.
     * 
     * @private
     * @returns {void}
     */
    _createDialog() {
        // Create dialog container
        const initialTitle = this.options.dialogTitle || this.options.messages.editRecord;
        this.$dialog = $('<div>', {
            class: 'record-editor-dialog',
            title: initialTitle
        });

        // Create form container
        this.$form = $('<form>', {
            class: 'record-editor-form'
        });

        this.$form.on('submit', (e) => {
            e.preventDefault();
            this._handleSave();
        });

        this.$dialog.append(this.$form);
        this.$dialog.appendTo('body');

        // Initialize jQuery UI dialog
        const dialogOptions = {
            autoOpen: false,
            modal: this.options.modal,
            width: this.options.dialogWidth,
            height: this.options.dialogHeight,
            resizable: this.options.resizable,
            draggable: this.options.draggable,
            closeOnEscape: true,
            show: {
                effect: this.options.showEffect,
                duration: this.options.effectDuration
            },
            hide: {
                effect: this.options.hideEffect,
                duration: this.options.effectDuration
            },
            buttons: this._createDialogButtons(),
            close: () => {
                this._abortUpload();
                if (this.options.onCancel && !this.closedAfterSave) {
                    this.options.onCancel();
                }
                // Reset flag for next time
                this.closedAfterSave = false;
            }
        };

        this.$dialog.dialog(dialogOptions);

        // Apply jQuery UI theme classes if enabled
        if (this.options.useJQueryUITheme) {
            this._applyJQueryUITheme();
        }
    }

    /**
     * Creates dialog buttons with jQuery UI styling.
     * Standard Save and Cancel buttons are configured via the `saveButton` and `cancelButton`
     * options respectively. Each accepts the same property shape as custom buttons:
     *   text    {string}   - Button text (defaults to messages.save / messages.cancel)
     *   icon    {string}   - jQuery UI icon class, e.g. 'ui-icon-check' (default per buttonIcons)
     *   click   {function} - Click handler (default: _handleSave / close)
     *   hidden  {boolean}  - When true the button is omitted entirely (default: false)
     *   align   {string}   - 'left' | 'right' (default: 'right')
     *   class   {string}   - Extra CSS classes (default: 'ui-button-primary' for save, '' for cancel)
     * Additional buttons can be added via `customButtons` (same shape, no built-in defaults).
     * Left-aligned buttons are rendered first and push remaining buttons to the right via CSS.
     */
    _createDialogButtons() {
        const useIcons = this.options.buttonIcons;

        // Build effective configs by merging defaults with any user overrides
        const saveCfg = {
            text:   this.options.messages.save,
            icon:   useIcons ? 'ui-icon-check' : null,
            click:  () => this._handleSave(),
            hidden: false,
            align:  'right',
            class:  'ui-button-primary',
            ...( this.options.saveButton || {} )
        };
        const cancelCfg = {
            text:   this.options.messages.cancel,
            icon:   useIcons ? 'ui-icon-closethick' : null,
            click:  () => this.close(),
            hidden: false,
            align:  'right',
            class:  '',
            ...( this.options.cancelButton || {} )
        };

        // Cache effective labels so _setButtonsSaving / _setButtonsNormal can locate buttons by text
        this._saveBtnLabel   = saveCfg.text;
        this._cancelBtnLabel = cancelCfg.text;

        const custom = this.options.customButtons || [];

        // Render order: left-aligned custom | right-aligned custom | cancel | save
        const ordered = [
            ...custom.filter(b => b.align !== 'right'),
            ...custom.filter(b => b.align === 'right'),
            cancelCfg,
            saveCfg
        ];

        return ordered
            .filter(b => !b.hidden)
            .map(b => {
                const jqBtn = { text: b.text, click: b.click };
                if (b.icon)  jqBtn.icon = b.icon;
                const cls = (b.align !== 'right' ? 'recedit-btn-left ' : '') + (b.class || '');
                if (cls.trim()) jqBtn.class = cls.trim();
                return jqBtn;
            });
    }

    /**
     * Applies jQuery UI theme classes to form elements
     */
    _applyJQueryUITheme() {
        // Add theme classes to dialog
        this.$dialog.addClass('ui-widget-content');
        
        // Style will be applied to inputs after form is built
    }

    /**
     * Builds the form based on field definitions
     */
    _buildForm() {
        this.$form.empty();
        this.fieldInputs.clear();

        // Check if tabs are configured
        if (this.options.tabs && this.options.tabs.length > 0) {
            this._buildFormWithTabs();
        } else {
            this._buildFormWithoutTabs();
        }

        // Fields are in the document now, so the checkboxradio widgets can be created
        this._initializeCheckboxRadios();
    }

    /**
     * Builds the form without tabs (original behavior)
     */
    _buildFormWithoutTabs() {
        const $fieldset = $('<fieldset>').addClass('ui-helper-reset');

        // Check if we should group fields (only for horizontal layout)
        const useFieldGrouping = this.options.formLayout === 'horizontal';
        
        if (useFieldGrouping) {
            // Group fields by their fieldGroup property
            const fieldGroups = new Map(); // Map<groupName, Array<[fieldName, fieldConfig]>>
            const ungroupedFields = []; // Array<[fieldName, fieldConfig]>
            
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true) {
                    continue; // Skip non-editable and key fields
                }
                
                if (fieldConfig.type === 'hidden') {
                    const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                    this.fieldInputs.set(fieldName, $hiddenInput);
                    $fieldset.append($hiddenInput);
                } else if (fieldConfig.fieldGroup) {
                    // Add to the appropriate group
                    if (!fieldGroups.has(fieldConfig.fieldGroup)) {
                        fieldGroups.set(fieldConfig.fieldGroup, []);
                    }
                    fieldGroups.get(fieldConfig.fieldGroup).push([fieldName, fieldConfig]);
                } else {
                    ungroupedFields.push([fieldName, fieldConfig]);
                }
            }
            
            // Process field groups in order (preserve insertion order with Map)
            const processedGroups = new Set();
            
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true || fieldConfig.type === 'hidden') {
                    continue;
                }
                
                const groupName = fieldConfig.fieldGroup;
                
                if (groupName && !processedGroups.has(groupName)) {
                    // Create field row for this group
                    const $fieldRow = $('<div>', { class: 'field-row' });
                    const groupFields = fieldGroups.get(groupName);
                    
                    groupFields.forEach(([fName, fConfig]) => {
                        const $fieldGroup = this._createFieldGroup(fName, fConfig);
                        $fieldRow.append($fieldGroup);
                    });
                    
                    $fieldset.append($fieldRow);
                    processedGroups.add(groupName);
                } else if (!groupName) {
                    // Add ungrouped field directly
                    const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);
                    $fieldset.append($fieldGroup);
                }
            }
        } else {
            // Original behavior for non-horizontal layouts
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true) {
                    continue; // Skip non-editable and key fields
                }

                // Hidden fields don't need labels or field groups
                if (fieldConfig.type === 'hidden') {
                    const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                    this.fieldInputs.set(fieldName, $hiddenInput);
                    $fieldset.append($hiddenInput);
                } else {
                    const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);
                    $fieldset.append($fieldGroup);
                }
            }
        }

        this.$form.append($fieldset);
        
        // Initialize datepickers after elements are in DOM
        this._initializeDatepickers();
        this._initializeTimepickers();
    }

    /**
     * Builds the form with tabs
     */
    _buildFormWithTabs() {
        // Normalize tabs configuration
        const tabs = this._normalizeTabs(this.options.tabs);
        
        // Create tabs container
        const $tabsContainer = $('<div>', {
            class: 'record-editor-tabs'
        });

        // Create tab navigation list
        const $tabNav = $('<ul>');
        
        // Create tab content containers
        const tabPanels = new Map();
        
        tabs.forEach((tab, index) => {
            // Create nav item
            const $navItem = $('<li>');
            const $navLink = $('<a>', {
                href: `#tab-${tab.id}`,
                text: tab.title
            });
            
            if (tab.icon) {
                const $icon = $('<span>', {
                    class: `ui-icon ${tab.icon}`
                });
                $navLink.prepend($icon);
            }
            
            $navItem.append($navLink);
            $tabNav.append($navItem);

            // Create tab panel
            const $tabPanel = $('<div>', {
                id: `tab-${tab.id}`,
                class: 'tab-panel'
            });
            
            const $fieldset = $('<fieldset>').addClass('ui-helper-reset');
            $tabPanel.append($fieldset);
            
            tabPanels.set(tab.id, $fieldset);
            $tabsContainer.append($tabPanel);
        });

        $tabsContainer.prepend($tabNav);

        // Check if we should group fields (only for horizontal layout)
        const useFieldGrouping = this.options.formLayout === 'horizontal';
        
        if (useFieldGrouping) {
            // Organize fields into tabs with grouping support
            const tabFieldData = new Map(); // Map<tabId, {groups: Map, ungrouped: Array, hidden: Array}>
            
            // Initialize data structure for each tab
            tabs.forEach(tab => {
                tabFieldData.set(tab.id, {
                    groups: new Map(),
                    ungrouped: [],
                    hidden: []
                });
            });
            
            // First pass: collect all fields organized by tab and group
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true) {
                    continue;
                }
                
                // Determine target tab
                let targetTabId;
                if (fieldConfig.tab) {
                    const tab = tabs.find(t => t.id === fieldConfig.tab || t.title === fieldConfig.tab);
                    if (tab) {
                        targetTabId = tab.id;
                    } else {
                        console.warn(`Tab '${fieldConfig.tab}' not found for field '${fieldName}'`);
                        targetTabId = tabs[0].id; // Default to first tab
                    }
                } else {
                    targetTabId = tabs[0].id; // Default to first tab
                }
                
                const tabData = tabFieldData.get(targetTabId);
                
                if (fieldConfig.type === 'hidden') {
                    tabData.hidden.push([fieldName, fieldConfig]);
                } else if (fieldConfig.fieldGroup) {
                    if (!tabData.groups.has(fieldConfig.fieldGroup)) {
                        tabData.groups.set(fieldConfig.fieldGroup, []);
                    }
                    tabData.groups.get(fieldConfig.fieldGroup).push([fieldName, fieldConfig]);
                } else {
                    tabData.ungrouped.push([fieldName, fieldConfig]);
                }
            }
            
            // Second pass: append fields to tabs in original field order
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true) {
                    continue;
                }
                
                // Determine target tab
                let targetTabId;
                if (fieldConfig.tab) {
                    const tab = tabs.find(t => t.id === fieldConfig.tab || t.title === fieldConfig.tab);
                    targetTabId = tab ? tab.id : tabs[0].id;
                } else {
                    targetTabId = tabs[0].id;
                }
                
                const $fieldset = tabPanels.get(targetTabId);
                const processedGroups = $fieldset.data('processedGroups') || new Set();
                
                if (fieldConfig.type === 'hidden') {
                    const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                    this.fieldInputs.set(fieldName, $hiddenInput);
                    $fieldset.append($hiddenInput);
                } else if (fieldConfig.fieldGroup && !processedGroups.has(fieldConfig.fieldGroup)) {
                    // Create field row for this group
                    const $fieldRow = $('<div>', { class: 'field-row' });
                    const tabData = tabFieldData.get(targetTabId);
                    const groupFields = tabData.groups.get(fieldConfig.fieldGroup);
                    
                    groupFields.forEach(([fName, fConfig]) => {
                        const $fieldGroup = this._createFieldGroup(fName, fConfig);
                        $fieldRow.append($fieldGroup);
                    });
                    
                    $fieldset.append($fieldRow);
                    processedGroups.add(fieldConfig.fieldGroup);
                    $fieldset.data('processedGroups', processedGroups);
                } else if (!fieldConfig.fieldGroup) {
                    // Add ungrouped field directly
                    const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);
                    $fieldset.append($fieldGroup);
                }
            }
        } else {
            // Original behavior for non-horizontal layouts
            const fieldsWithoutTab = [];
            
            for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
                if (fieldConfig.edit === false || fieldConfig.key === true) {
                    continue; // Skip non-editable and key fields
                }

                // Hidden fields don't need labels or field groups
                if (fieldConfig.type === 'hidden') {
                    const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                    this.fieldInputs.set(fieldName, $hiddenInput);
                    // Add to first tab
                    if (tabPanels.size > 0) {
                        tabPanels.values().next().value.append($hiddenInput);
                    }
                    continue;
                }

                const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);
                
                // Determine which tab this field belongs to
                if (fieldConfig.tab) {
                    const tab = tabs.find(t => t.id === fieldConfig.tab || t.title === fieldConfig.tab);
                    if (tab && tabPanels.has(tab.id)) {
                        tabPanels.get(tab.id).append($fieldGroup);
                    } else {
                        // Tab not found, add to first tab or collect for later
                        console.warn(`Tab '${fieldConfig.tab}' not found for field '${fieldName}'`);
                        fieldsWithoutTab.push($fieldGroup);
                    }
                } else {
                    fieldsWithoutTab.push($fieldGroup);
                }
            }

            // Add fields without tabs to the first tab if any
            if (fieldsWithoutTab.length > 0 && tabPanels.size > 0) {
                const firstTab = tabs[0];
                const $firstFieldset = tabPanels.get(firstTab.id);
                fieldsWithoutTab.forEach($group => $firstFieldset.prepend($group));
            }
        }

        this.$form.append($tabsContainer);

        // Initialize datepickers and timepickers now — they don't depend on tabs being ready
        this._initializeDatepickers();
        this._initializeTimepickers();

        // Initialize jQuery UI tabs (deferred so the DOM is ready)
        setTimeout(() => {
            $tabsContainer.tabs({
                collapsible: this.options.tabsCollapsible,
                active: this.options.tabsActive
            });
        }, 0);
    }

    /**
     * Initializes datepickers on all date input fields after they're in the DOM
     * @private
     */
    _initializeDatepickers() {
        this.$form.find('.datepicker').each((i, el) => {
            const $input = $(el);
            const options = $input.data('datepicker-options');

            if (options && !$input.data('datepicker')) {
                // Remove undefined options before initializing
                const cleanOptions = {};
                for (const [key, value] of Object.entries(options)) {
                    if (value !== undefined) {
                        cleanOptions[key] = value;
                    }
                }

                // A read-only date field keeps its datepicker — setDate()/getDate() and the
                // display format conversion still go through the widget — but the calendar may
                // never open: datepicker calls beforeShow on every attempt and aborts when it
                // returns false. The readonly attribute alone is not enough, because the widget
                // writes the picked date with .val().
                const fieldConfig = this.options.fields[$input.attr('name')] || {};
                if (this._isReadonlyField(fieldConfig)) {
                    cleanOptions.beforeShow = () => false;
                }

                $input.datepicker(cleanOptions);
            }
        });
    }

    /**
     * Applies jquery.inputmask masks to text-like form inputs after the form is built.
     *
     * Field-level masks are read from `fieldConfig.inputmask`; dynamic masks passed via
     * `dynamicFieldProps.inputMasks` override the field-level value for the same field.
     *
     * Only applies to maskable input types: `text`, `password`, `autocomplete`, `time`.
     * All other field types (checkbox, select, slider, spinner, etc.) are silently skipped.
     * Skips gracefully if the jquery.inputmask plugin is not loaded.
     *
     * @param {Object|null} [dynamicMasks] - Optional `{fieldName: mask, ...}` map from
     *   `dynamicFieldProps.inputMasks`. Each value may be a mask string (e.g. `'(999) 999-9999'`)
     *   or an inputmask options object. A `null` or `undefined` value for a field name skips that field.
     * @private
     */
    _initializeInputMasks(dynamicMasks) {
        this._maskedFields.clear();
        this._fieldMasks.clear();

        if (typeof $.fn.inputmask !== 'function') {
            return; // jquery.inputmask not loaded — skip silently
        }

        const MASKABLE_TYPES = new Set(['text', 'password', 'autocomplete', 'time']); // Extendable set of input types that can have masks

        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];
            if (!fieldConfig) continue;

            const type = (fieldConfig.type || 'text').toLowerCase();
            if (!MASKABLE_TYPES.has(type)) continue;

            // Dynamic mask overrides field-level mask; undefined dynamic entry falls back to field-level
            // Accept both inputmask (lowercase) and inputMask (camelCase) on the field config
            const effectiveMask = (dynamicMasks && dynamicMasks[fieldName] !== undefined)
                ? dynamicMasks[fieldName]
                : (fieldConfig.inputmask ?? fieldConfig.inputMask);

            // Remove any existing mask before (re-)applying
            $input.inputmask('remove');

            if (effectiveMask) {
                $input.inputmask(effectiveMask);
                this._maskedFields.add(fieldName);
                this._fieldMasks.set(fieldName, effectiveMask); // store resolved mask so getInvalidMaskedFields() can use it
            }
        }
    }

    /**
     * Normalizes tabs configuration to standard format
     */
    _normalizeTabs(tabs) {
        if (!tabs || tabs.length === 0) return [];

        return tabs.map((tab, index) => {
            if (typeof tab === 'string') {
                // Simple string format
                return {
                    id: tab.toLowerCase().replace(/\s+/g, '-'),
                    title: tab,
                    icon: null
                };
            } else if (typeof tab === 'object') {
                // Object format
                return {
                    id: tab.id || tab.title.toLowerCase().replace(/\s+/g, '-'),
                    title: tab.title || tab.id || `Tab ${index + 1}`,
                    icon: tab.icon || null
                };
            }
            return {
                id: `tab-${index}`,
                title: `Tab ${index + 1}`,
                icon: null
            };
        });
    }


    /**
     * Creates a field group element with label, input, and optional character counter.
     * 
     * @param {string} fieldName - The name of the field
     * @param {Object} fieldConfig - Configuration object for the field
     * @param {string} [fieldConfig.label] - Display label for the field
     * @param {string} [fieldConfig.title] - Alternative title if label is not provided
     * @param {string} [fieldConfig.layout='vertical'] - Layout mode ('vertical' or 'horizontal'), overrides global formLayout
     * @param {string} [fieldConfig.type='text'] - Input field type (e.g., 'text', 'checkbox', 'slider', 'spinner')
     * @param {number} [fieldConfig.maxLength] - Maximum character length for the input
     * @param {number} [fieldConfig.maxlength] - Alternative maxLength property name
     * @param {boolean} [fieldConfig.showCounter=false] - Whether to display character counter
     * @param {string} [fieldConfig.labelWidth] - CSS width for label in horizontal layout
     * @param {boolean} [fieldConfig.required=false] - Whether the field is required (adds asterisk indicator and aria-required)
     * @param {Function} [fieldConfig.onChange] - Async callback function triggered on field value change
     * @returns {jQuery} A jQuery object containing the complete field group DOM element with label, input container, and optional counter
     */
    _createFieldGroup(fieldName, fieldConfig) {
        // Determine layout (field-specific overrides global)
        const layout = fieldConfig.layout || this.options.formLayout || 'vertical';
        
        const $group = $('<div>', {
            class: 'field-group field-group-' + layout,
            'data-field': fieldName
        });

        if (fieldConfig.required && !(fieldConfig.readonly || fieldConfig.readOnly)) {
            $group.addClass('field-required');
        }

        // htmldiv type: insert raw HTML content at the specified alignment position
        if ((fieldConfig.type || '').toLowerCase() === 'htmldiv') {
            const align = (fieldConfig.align || 'dialog').toLowerCase();
            const $contentDiv = this._createHtmlDiv(fieldName, fieldConfig);

            if (layout === 'horizontal') {
                if (align === 'dialog') {
                    $group.addClass('htmldiv-align-dialog');
                    $group.append($contentDiv);
                } else if (align === 'label') {
                    const labelWidth = fieldConfig.labelWidth || this.options.labelWidth;
                    $contentDiv.css({ width: labelWidth, flexShrink: '0' });
                    $group.append($contentDiv);
                } else { // 'field' or default
                    const labelWidth = fieldConfig.labelWidth || this.options.labelWidth;
                    let $labelEl;
                    if (fieldConfig.label || fieldConfig.title) {
                        // Render a real visible label, styled identically to normal field labels
                        const labelText = fieldConfig.label || fieldConfig.title;
                        $labelEl = $('<label>', { class: 'field-label', text: labelText });
                        if (this.options.useJQueryUITheme) {
                            $labelEl.addClass('ui-state-default ui-corner-all');
                            $labelEl.css({ padding: '4px 8px', display: 'inline-block', marginBottom: '5px' });
                        }
                    } else {
                        // No label — mirror label styling invisibly so the content div aligns with other inputs
                        $labelEl = $('<label>', { class: 'field-label', 'aria-hidden': 'true' });
                        if (this.options.useJQueryUITheme) {
                            $labelEl.addClass('ui-state-default ui-corner-all');
                            $labelEl.css({ padding: '4px 8px', display: 'inline-block', marginBottom: '5px' });
                        }
                        $labelEl.css('visibility', 'hidden');
                    }
                    $labelEl.css({ width: labelWidth, flexShrink: '0' });
                    const $inputContainer = $('<div>', { class: 'field-input-container' }).append($contentDiv);
                    $group.append($labelEl, $inputContainer);
                }
            } else {
                $group.append($contentDiv);
            }

            if (fieldConfig.hidden === true) {
                $group.hide();
            }

            return $group;
        }

        // Label with proper jQuery UI styling
        // omitLabel: true on the field config suppresses the label entirely
        const labelText = fieldConfig.label || fieldConfig.title || fieldName;
        const showLabel = fieldConfig.omitLabel !== true;

        const $label = showLabel ? $('<label>', {
            class: 'field-label',
            for: `field-${fieldName}`,
            text: labelText
        }) : null;

        if (showLabel) {
            // Use ui-state-default instead of ui-widget-header for visible text
            if (this.options.useJQueryUITheme) {
                $label.addClass('ui-state-default ui-corner-all');
                // Add some padding for better appearance
                $label.css({
                    padding: '4px 8px',
                    display: 'inline-block',
                    marginBottom: '5px'
                });
            }
            
            // Apply label width for horizontal layout
            if (layout === 'horizontal') {
                const labelWidth = fieldConfig.labelWidth || this.options.labelWidth;
                $label.css('width', labelWidth);
            }
        }

        // Input container
        const $inputContainer = $('<div>', {
            class: 'field-input-container'
        });

        const $input = this._createInput(fieldName, fieldConfig);

        // _createInput() returns the control itself for simple field types, but a wrapper element
        // for compound widgets (checkbox, radio group, slider, file). The `field-<name>` id is only
        // a valid label target while it sits on a real control, so the label is re-bound for wrappers.
        const isControl = $input.is('input, select, textarea');
        $input.attr('id', `field-${fieldName}`);
        this._bindFieldLabel($label, $input, fieldName, fieldConfig);

        if (fieldConfig.required) {
            // The marker goes on the element returned by _createInput() — the control itself for
            // simple types, the wrapper for compound widgets (matching _applyDynamicFieldProps(),
            // which also reads aria-required back from fieldInputs). For a wrapper the controls
            // inside it are marked as well, so assistive tech reaches the real input/select.
            $input.attr('aria-required', 'true');
            if (!isControl) {
                $input.find('input:not([type="hidden"]), select, textarea')
                    .attr('aria-required', 'true');
            }
        }
        $inputContainer.append($input);

        // Add character counter if maxLength is specified and showCounter is true
        if ((fieldConfig.maxLength || fieldConfig.maxlength) && fieldConfig.showCounter == true) {
            const maxLen = fieldConfig.maxLength || fieldConfig.maxlength;
            const $counter = $('<div>', {
                class: 'char-counter',
                html: `<span class="current">0</span> / <span class="max">${maxLen}</span> characters`
            });

            $inputContainer.append($counter);

            // Update counter on input
            $input.on('input', function() {
                const currentLen = $(this).val().length;
                $counter.find('.current').text(currentLen);
                
                // Optional: add warning class when near limit
                if (currentLen > maxLen * 0.9) {
                    $counter.addClass('char-counter-warning');
                } else {
                    $counter.removeClass('char-counter-warning');
                }
            });
        }

        // Add field error message element (hidden by default)
        const $fieldError = $('<div>', {
            class: 'field-error'
        }).hide();
        $inputContainer.append($fieldError);

        // Store reference
        this.fieldInputs.set(fieldName, $input);

        // Add onChange handler if specified
        if (fieldConfig.onChange && typeof fieldConfig.onChange === 'function') {
            const handler = async () => {
                const value = this.getFieldValue(fieldName);
                await fieldConfig.onChange(value, fieldName, this);
            };
            
            // Attach to appropriate events based on field type
            const type = (fieldConfig.type || 'text').toLowerCase();
            
            if (type === 'radiogroup') {
                $input.on('change', 'input[type="radio"]', handler);
            } else if (type === 'checkbox' || type === 'checkboxradio') {
                $input.find('input[type="checkbox"]').on('change', handler);
            } else if (type === 'slider') {
                $input.find('.slider-widget').on('slidechange', handler);
                $input.find('.slider-value').on('change', handler);
            } else if (type === 'spinner') {
                // For spinners, need to attach after initialization and listen to spin events
                setTimeout(() => {
                    if ($input.data('ui-spinner')) {
                        // spinchange fires after spinning stops
                        // spin fires during spinning
                        $input.on('spinchange spin', handler);
                    }
                }, 10);
            } else {
                $input.on('change', handler);
            }
        }

        if (showLabel) {
            $group.append($label, $inputContainer);
        } else {
            $group.append($inputContainer);
        }

        if (fieldConfig.hidden === true) {
            $group.hide();
        }

        return $group;
    }

    /**
     * Points a field label at the control it labels.
     *
     * `_createFieldGroup()` gives the element returned by `_createInput()` the id
     * `field-<fieldName>` and the label is created with a matching `for`. That is correct for simple
     * field types, where `_createInput()` returns the control itself, but compound widgets
     * (checkbox/checkboxradio, radiogroup, slider, file) return a wrapper element — a label whose
     * `for` points at a `<div>` activates nothing.
     *
     * For wrappers the label is therefore bound to the first control inside the wrapper (keeping
     * ids the inner widget already assigned, e.g. `check-<fieldName>` for checkboxradio), and
     * unbound when the wrapper holds no control yet (e.g. radiogroup options loaded from a URL).
     * Radio groups are labelled through aria-labelledby instead, because a `for` on a group label
     * would activate (i.e. select) its first option.
     *
     * @param {jQuery|null} $label - The field label element, or null when omitLabel is set
     * @param {jQuery} $input - The element returned by _createInput()
     * @param {string} fieldName - The field name
     * @param {Object} fieldConfig - The field configuration
     * @private
     */
    _bindFieldLabel($label, $input, fieldName, fieldConfig) {
        if (!$label || $input.is('input, select, textarea')) return; // label's for already matches the control

        const type = (fieldConfig.type || 'text').toLowerCase();

        if (type === 'radiogroup') {
            const labelId = `field-${fieldName}-label`;
            $label.attr('id', labelId).removeAttr('for');
            $input.attr({ role: 'group', 'aria-labelledby': labelId });
            return;
        }

        const $control = $input.find('input:not([type="hidden"]), select, textarea').first();
        if (!$control.length) {
            // No control inside the wrapper (should not happen for checkbox/slider/file)
            $label.removeAttr('for');
            return;
        }

        if (!$control.attr('id')) {
            $control.attr('id', `field-${fieldName}-input`);
        }
        $label.attr('for', $control.attr('id'));
    }

    /**
     * Creates an input element based on the specified field configuration type.
     * 
     * Supports multiple input types including text, textarea, checkbox, dropdown/select,
     * date, password, hidden, autocomplete, spinner, slider, and file. Falls back to text input
     * for unknown types.
     * 
     * @param {string} fieldName - The name attribute of the input field
     * @param {Object} fieldConfig - The configuration object for the field
     * @param {string} [fieldConfig.type='text'] - The type of input to create (case-insensitive)
     * @returns {HTMLElement} The created input element
     */
    _createInput(fieldName, fieldConfig) {
        const type = (fieldConfig.type || 'text').toLowerCase();

        switch (type) {
            case 'textarea':
                return this._createTextarea(fieldName, fieldConfig);
            case 'radiogroup':
                return this._createRadioGroup(fieldName, fieldConfig);
            case 'checkboxradio':
            case 'checkbox':
                return this._createCheckbox(fieldName, fieldConfig);
            case 'dropdown':
            case 'select':
                return this._createSelect(fieldName, fieldConfig);
            case 'date':
                return this._createDateInput(fieldName, fieldConfig);
            case 'time':
                return this._createTimeInput(fieldName, fieldConfig);
            case 'password':
                return this._createPasswordInput(fieldName, fieldConfig);
            case 'hidden':
                return this._createHiddenInput(fieldName, fieldConfig);
            case 'autocomplete':
                return this._createAutocomplete(fieldName, fieldConfig);
            case 'spinner':
                return this._createSpinner(fieldName, fieldConfig);
            case 'slider':
                return this._createSlider(fieldName, fieldConfig);
            case 'htmldiv':
                return this._createHtmlDiv(fieldName, fieldConfig);
            case 'file':
                return this._createFileInput(fieldName, fieldConfig);
            default:
                return this._createTextInput(fieldName, fieldConfig);
        }
    }

    /**
     * Returns true when a field is configured read-only (either spelling) or disabled.
     *
     * @param {Object} fieldConfig - The field configuration
     * @returns {boolean}
     * @private
     */
    _isReadonlyField(fieldConfig) {
        return !!(fieldConfig && (fieldConfig.readonly || fieldConfig.readOnly || fieldConfig.disabled));
    }

    /**
     * Marks a text-like control (`input`/`textarea`) as read-only: the `readonly` attribute
     * blocks user input, `tabindex="-1"` keeps it out of the tab order, and the
     * `readonly-field` class supplies the greyed-out styling (see recedit.css).
     *
     * Widget-backed types need more than this: `readonly` does nothing on checkable controls
     * or `<select>` (they are disabled instead), and picker widgets that write the value with
     * `.val()` (datepicker, timepicker, spinner) have to be kept from opening — see the
     * individual builders.
     *
     * @param {jQuery} $el - The control to mark read-only
     * @param {Object} fieldConfig - The field configuration
     * @private
     */
    _applyReadonlyAttr($el, fieldConfig) {
        if (!this._isReadonlyField(fieldConfig)) return;
        $el.attr('readonly', true);
        $el.attr('tabindex', '-1'); // Remove from tab order
        $el.addClass('readonly-field');
    }

    /**
     * Creates a configured text input element with optional styling and validation attributes.
     * 
     * @param {string} fieldName - The name attribute for the input element.
     * @param {Object} fieldConfig - Configuration object for the input field.
     * @param {string} [fieldConfig.placeholder] - Placeholder text for the input.
     * @param {string|number} [fieldConfig.width] - Width of the input. If a number, sets the 'size' attribute; if a string, sets CSS width.
     * @param {string} [fieldConfig.inputWidth] - Alternative CSS width property (takes precedence over width).
     * @param {number} [fieldConfig.maxLength] - Maximum character length for the input.
     * @param {number} [fieldConfig.maxlength] - Alternative maximum character length property.
     * @param {string} [fieldConfig.inputClass] - Additional CSS class to add to the input.
     * @param {boolean} [fieldConfig.readonly] - Whether the input should be read-only.
     * @param {boolean} [fieldConfig.readOnly] - Alternative read-only property.
     * 
     * @returns {jQuery} A jQuery object representing the configured text input element.
     */
    _createTextInput(fieldName, fieldConfig) {
        // Determine base classes
        let baseClasses = 'form-control text ui-widget-content ui-corner-all';
        
        // Determine effective width (field-level overrides form-level)
        const effectiveWidth = fieldConfig.width !== undefined ? fieldConfig.width : this.options.defaultInputWidth;
        
        // Add full-width class only if width is not specified at either level or is set to '100%'
        if (!effectiveWidth || effectiveWidth === '100%') {
            baseClasses += ' full-width';
        }

        const $input = $('<input>', {
            type: 'text',
            name: fieldName,
            class: baseClasses,
            placeholder: fieldConfig.placeholder || ''
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        // Set max length
        if (fieldConfig.maxLength || fieldConfig.maxlength) {
            $input.attr('maxlength', fieldConfig.maxLength || fieldConfig.maxlength);
        }

        // Set display width
        if (effectiveWidth && effectiveWidth !== '100%') {
            if (typeof effectiveWidth === 'number') {
                // Number = character width using 'size' attribute
                $input.attr('size', effectiveWidth);
            } else {
                // String = CSS width (e.g., '200px', '50%', '20em')
                $input.css('width', effectiveWidth);
            }
        }

        // Alternative width property
        if (fieldConfig.inputWidth) {
            $input.css('width', fieldConfig.inputWidth);
        }

        // Set read-only if specified
        this._applyReadonlyAttr($input, fieldConfig);

        return $input;
    }

    /**
     * Creates a textarea element with the specified configuration.
     * 
     * @param {string} fieldName - The name attribute for the textarea element.
     * @param {Object} fieldConfig - Configuration object for textarea properties.
     * @param {string} [fieldConfig.width] - CSS width or character count. If not '100%', applied as CSS; if number, sets cols attribute.
     * @param {number} [fieldConfig.rows=4] - Number of visible rows in the textarea.
     * @param {string} [fieldConfig.placeholder=''] - Placeholder text displayed in the textarea.
     * @param {string} [fieldConfig.inputClass] - Additional CSS class(es) to apply to the textarea.
     * @param {number} [fieldConfig.maxLength] - Maximum character length for input.
     * @param {number} [fieldConfig.maxlength] - Alternative property for maximum character length.
     * @param {number} [fieldConfig.cols] - Number of visible columns (character width).
     * @param {number} [fieldConfig.columns] - Alternative property for number of visible columns.
     * @param {string} [fieldConfig.inputWidth] - Alternative CSS width property.
     * @param {string} [fieldConfig.height] - CSS height of the textarea.
     * @param {string} [fieldConfig.inputHeight] - Alternative CSS height property.
     * @param {boolean} [fieldConfig.readonly=false] - If true, makes the textarea read-only and removes from tab order.
     * @param {boolean} [fieldConfig.readOnly=false] - Alternative property for read-only state.
     * 
     * @returns {jQuery} A jQuery object representing the configured textarea element.
     */
    _createTextarea(fieldName, fieldConfig) {
        // Determine base classes
        let baseClasses = 'form-control ui-widget-content ui-corner-all';
        
        // Add full-width class only if width is not specified or is set to '100%'
        if (!fieldConfig.width || fieldConfig.width === '100%') {
            baseClasses += ' full-width';
        }

        const $textarea = $('<textarea>', {
            name: fieldName,
            class: baseClasses,
            rows: fieldConfig.rows || 4,
            placeholder: fieldConfig.placeholder || ''
        });

        if (fieldConfig.inputClass) {
            $textarea.addClass(fieldConfig.inputClass);
        }

        // Set max length
        if (fieldConfig.maxLength || fieldConfig.maxlength) {
            $textarea.attr('maxlength', fieldConfig.maxLength || fieldConfig.maxlength);
        }

        // Set column width (in characters)
        if (fieldConfig.cols || fieldConfig.columns) {
            $textarea.attr('cols', fieldConfig.cols || fieldConfig.columns);
        }

        // Set display width
        if (fieldConfig.width && fieldConfig.width !== '100%') {
            if (typeof fieldConfig.width === 'number') {
                // Number = character width using 'cols' attribute
                $textarea.attr('cols', fieldConfig.width);
            } else {
                // String = CSS width
                $textarea.css('width', fieldConfig.width);
            }
        }

        // Alternative width property
        if (fieldConfig.inputWidth) {
            $textarea.css('width', fieldConfig.inputWidth);
        }

        // Set height if specified
        if (fieldConfig.height || fieldConfig.inputHeight) {
            $textarea.css('height', fieldConfig.height || fieldConfig.inputHeight);
        }

        // Set read-only if specified
        this._applyReadonlyAttr($textarea, fieldConfig);

        return $textarea;
    }

    /**
     * Creates a checkbox input element with an associated label.
     * 
     * @param {string} fieldName - The name and base ID for the checkbox input element
     * @param {Object} fieldConfig - Configuration object for the checkbox
     * @param {string} fieldConfig.checkboxLabel - The label text to display for the checkbox
     * @param {boolean} [fieldConfig.readonly] - If true, the checkbox is disabled (a checkbox cannot be read-only)
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the checkbox is disabled
     * @returns {jQuery} A jQuery object containing the checkbox container with input and label elements
     * 
     * @description
     * The field group is only built here — the widget is created later by
     * _initializeCheckboxRadios(), which runs once the label and input have been inserted
     * into the document (jQuery UI resolves a checkboxradio label via element.labels() and
     * throws when no label is found). Both the 'checkbox' and 'checkboxradio' field types
     * get the same ui.checkboxradio widget: jQuery UI removed checkbox/radio support from
     * ui.button in 1.13, so button() no longer themes a checkbox.
     */
    _createCheckbox(fieldName, fieldConfig) {
        const isReadonly = this._isReadonlyField(fieldConfig);

        const $container = $('<div>', {
            class: 'checkbox-container' + (isReadonly ? ' readonly-field' : '')
        });

        const $input = $('<input>', {
            type: 'checkbox',
            name: fieldName,
            id: `check-${fieldName}`,
            class: 'form-checkbox'
        });

        // A checkbox has no read-only state: the HTML spec ignores the `readonly` attribute on
        // checkable controls (unlike text inputs/textarea), so a read-only checkbox must be
        // disabled to stop the user toggling it. The `disabled` property is set here — before
        // the widget exists — because ui.checkboxradio reads element.disabled in
        // _getCreateOptions() and then applies both the disabled state and the
        // ui-state-disabled label styling when _initializeCheckboxRadios() creates the widget.
        // The value still round-trips: _getFormData() / getFieldValue() read the checkbox
        // state from fieldInputs, not from a serialization that omits disabled controls.
        if (isReadonly) {
            $input.prop('disabled', true);
        }

        const $label = $('<label>', {
            for: `check-${fieldName}`,
            text: fieldConfig.checkboxLabel || ''
        });

        $container.append($input, $label);

        return $container;
    }

    /**
     * Creates a radio group container. The jQuery UI checkboxradio widget is applied to each
     * radio button by _initializeCheckboxRadios() once the radios are in the document.
     * Options are supplied via fieldConfig.options in the same formats as dropdown.
     *
     * @param {string} fieldName - The name attribute shared by all radio inputs
     * @param {Object} fieldConfig - Configuration object
     * @param {Object|Array|string|Function} fieldConfig.options - Option source (same formats as dropdown)
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes for the container
     * @param {boolean} [fieldConfig.readonly] - If true, the radios are disabled (radios cannot be read-only)
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the radios are disabled
     * @returns {jQuery} A jQuery div containing the radio group
     */
    _createRadioGroup(fieldName, fieldConfig) {
        const isReadonly = this._isReadonlyField(fieldConfig);

        const $container = $('<div>', {
            class: 'radiogroup-container'
                + (fieldConfig.inputClass ? ' ' + fieldConfig.inputClass : '')
                + (isReadonly ? ' readonly-field' : '')
        });

        // Async: resolve options then build radios
        const buildRadios = async () => {
            let optionsArray = [];
            const opts = fieldConfig.options;

            if (typeof opts === 'function') {
                optionsArray = await Promise.resolve(opts());
            } else if (typeof opts === 'string') {
                optionsArray = await this._fetchOptions(opts);
            } else if (Array.isArray(opts)) {
                optionsArray = opts;
            } else if (opts && typeof opts === 'object') {
                optionsArray = Object.entries(opts).map(([value, text]) => ({
                    Value: value,
                    DisplayText: text
                }));
            }

            optionsArray.forEach((opt, idx) => {
                const id = `radio-${fieldName}-${idx}`;
                const $radio = $('<input>', {
                    type: 'radio',
                    name: fieldName,
                    id: id,
                    value: opt.Value,
                    class: 'form-radio'
                });
                // A radio has no read-only state either, so read-only radios are disabled;
                // ui.checkboxradio reads element.disabled when _initializeCheckboxRadios()
                // creates the widget and then styles the label as disabled.
                if (isReadonly) $radio.prop('disabled', true);
                const $label = $('<label>', {
                    for: id,
                    text: opt.DisplayText || opt.Value
                });
                $container.append($radio, $label);
            });

            // Async option sources (function / URL) append the radios after the form has been
            // built, so the theme has to be (re-)applied here; the call is idempotent and is a
            // no-op for radios that are not in the document yet (synchronous array options).
            this._initializeCheckboxRadios();
        };

        buildRadios();
        return $container;
    }

    /**
     * Creates a select element with the specified field name and configuration.
     * 
     * @param {string} fieldName - The name attribute for the select element
     * @param {Object} fieldConfig - Configuration object for the select field
     * @param {string} [fieldConfig.inputClass] - Additional CSS class to apply to the select element
     * @param {Object|Array|string|Function} [fieldConfig.options] - Options to populate the select element
     * @param {string} [fieldConfig.width] - CSS width of the dropdown
     * @param {string} [fieldConfig.inputWidth] - Alternative CSS width property
     * @param {Function} [fieldConfig.onChange] - Callback fired when the user changes the selection.
     *   Receives (event, ui) where ui.item has value, label, and index properties.
     * @param {boolean} [fieldConfig.readonly] - If true, the select is disabled (selects cannot be read-only)
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the select is disabled
     * @returns {jQuery} A jQuery object representing the created select element with applied styles and options
     * 
     * @description
     * Creates a select dropdown with form control styling. If jQuery UI theme is enabled,
     * applies selectmenu widget. Optionally adds custom input classes and populates options
     * from the provided configuration.
     */
    _createSelect(fieldName, fieldConfig) {
        const effectiveWidth = fieldConfig.width !== undefined ? fieldConfig.width : this.options.defaultInputWidth;
        let baseClasses = 'form-control ui-widget-content ui-corner-all';
        if (!effectiveWidth || effectiveWidth === '100%') {
            baseClasses += ' full-width';
        }

        const isReadonly = this._isReadonlyField(fieldConfig);

        const $select = $('<select>', {
            name: fieldName,
            class: baseClasses + (isReadonly ? ' readonly-field' : '')
        });

        if (fieldConfig.inputClass) {
            $select.addClass(fieldConfig.inputClass);
        }

        // `<select>` has no read-only state — the readonly attribute is ignored on selects — so a
        // read-only select is disabled. ui.selectmenu does not read element.disabled when it is
        // created (it only syncs it in refresh()), so _initializeSelectMenus() passes the
        // disabled option explicitly for a select that arrives here already disabled.
        if (isReadonly) {
            $select.prop('disabled', true);
        }

        // Apply CSS width to the raw <select> (effective for non-jQuery UI; also used by
        // _initializeSelectMenus as the source width when jQuery UI selectmenu is enabled)
        if (effectiveWidth && effectiveWidth !== '100%') {
            const cssW = typeof effectiveWidth === 'number' ? effectiveWidth + 'px' : effectiveWidth;
            $select.css('width', cssW);
        }
        if (fieldConfig.inputWidth) {
            $select.css('width', fieldConfig.inputWidth);
        }

        // Will be populated later
        $select.append('<option value="">-- Select --</option>');

        // NOTE: jQuery UI selectmenu initialization is deferred to _initializeSelectMenus(),
        // called from _showDialog() once the dialog is visible. Initializing here via setTimeout
        // is unreliable when options are loaded from a URL (the timeout fires during the fetch).

        // Populate options (skip URL strings — they are fetched on each dialog open in setValue)
        if (fieldConfig.options && typeof fieldConfig.options !== 'string') {
            this._populateSelectOptions($select, fieldConfig.options);
        }

        // For non-jQuery UI: bind onChange directly on the native <select>.
        // For the jQuery UI selectmenu path, onChange is wired in _initializeSelectMenus.
        if (!this.options.useJQueryUITheme && typeof fieldConfig.onChange === 'function') {
            $select.on('change', function(event) {
                const $opt = $(this).find(':selected');
                fieldConfig.onChange(event, {
                    item: {
                        value: $(this).val(),
                        label: $opt.text(),
                        index: $(this)[0].selectedIndex
                    }
                });
            });
        }

        return $select;
    }

    /**
     * Populates a select element with options from various sources.
     * Destroys and recreates the jQuery UI selectmenu widget if it was initialized.
     * 
     * @async
     * @param {jQuery} $select - The select element to populate
     * @param {Object|Array|string|Function} options - Options source. Can be:
     *   - Object: key-value pairs where key is value and value is display text
     *   - Array: array of objects with Value and DisplayText properties
     *   - String: URL to fetch options from
     *   - Function: function that returns options (can be async)
     * @returns {Promise<void>}
     * @private
     */
    async _populateSelectOptions($select, options) {
        // Store selectmenu state
        const isSelectmenu = $select.data('ui-selectmenu');
        
        if (isSelectmenu) {
            $select.selectmenu('destroy');
        }

        $select.empty().append('<option value="">-- Select --</option>');

        let optionsArray = [];

        // Handle different option formats
        if (typeof options === 'function') {
            optionsArray = await Promise.resolve(options());
        } else if (typeof options === 'string') {
            // URL - fetch options
            optionsArray = await this._fetchOptions(options);
        } else if (Array.isArray(options)) {
            optionsArray = options;
        } else if (typeof options === 'object') {
            // Convert object to array
            optionsArray = Object.entries(options).map(([value, text]) => ({
                Value: value,
                DisplayText: text
            }));
        }

        // Add options to select
        optionsArray.forEach(option => {
            const $option = $('<option>', {
                value: option.Value,
                text: option.DisplayText || option.Value
            });
            $select.append($option);
        });

        // Reinitialize selectmenu (carrying over a read-only/disabled select — selectmenu does
        // not read element.disabled on creation, see _initializeSelectMenus)
        if (this.options.useJQueryUITheme && $select.is(':visible')) {
            $select.selectmenu($select.prop('disabled') ? { disabled: true } : {});
            const fieldConfig = this.options.fields && this.options.fields[$select.attr('name')];
            const wCfg = fieldConfig && (fieldConfig.inputWidth || fieldConfig.width);
            if (wCfg) {
                const cssW = typeof wCfg === 'number' ? wCfg + 'px' : wCfg;
                $select.selectmenu('widget').css('width', cssW);
            }
        }
    }

    /**
     * Fetches select options from a remote URL.
     * 
     * @async
     * @param {string} url - The URL to fetch options from
     * @returns {Promise<Array>} Array of option objects with Value and DisplayText properties
     * @throws {Error} Logs error via _triggerNotice and returns empty array on failure
     * @private
     */
    async _fetchOptions(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.Options || data.options || data;
        } catch (error) {
            this._triggerNotice({type: 'error', title: 'Failed to fetch options', message: error.message});
            return [];
        }
    }

    /**
     * Creates a date input field with jQuery UI datepicker widget.
     * 
     * @param {string} fieldName - The name attribute for the input element
     * @param {Object} fieldConfig - Configuration object for the date field
     * @param {string} [fieldConfig.placeholder] - Placeholder text for the input
     * @param {boolean} [fieldConfig.readonly] - If true, the input is read-only and the calendar never opens
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the input is read-only and the calendar never opens
     * @param {string} [fieldConfig.dateDisplayFormat] - Date display format string (e.g., 'dd-mm-yy')
     * @param {string} [fieldConfig.dateRecordFormat] - Date record format string (e.g., 'yyyy-mm-dd')
     * @param {boolean} [fieldConfig.changeMonth] - Whether to show month dropdown
     * @param {boolean} [fieldConfig.changeYear] - Whether to show year dropdown
     * @param {string} [fieldConfig.yearRange] - Year range for the year dropdown (e.g., 'c-100:c+10')
     * @param {Date|string} [fieldConfig.minDate] - Minimum selectable date
     * @param {Date|string} [fieldConfig.maxDate] - Maximum selectable date
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes to apply
     * @returns {jQuery} A jQuery object representing the configured date input element
     * @private
     */
    _createDateInput(fieldName, fieldConfig) {
        const effectiveWidth = fieldConfig.width !== undefined ? fieldConfig.width : this.options.defaultInputWidth;
        let baseClasses = 'form-control datepicker ui-widget-content ui-corner-all';
        if (!effectiveWidth || effectiveWidth === '100%') {
            baseClasses += ' full-width';
        }

        const $input = $('<input>', {
            type: 'text',
            name: fieldName,
            class: baseClasses,
            placeholder: fieldConfig.placeholder || this.options.dateDisplayFormat
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        if (effectiveWidth && effectiveWidth !== '100%') {
            if (typeof effectiveWidth === 'number') {
                $input.attr('size', effectiveWidth);
            } else {
                $input.css('width', effectiveWidth);
            }
        }
        if (fieldConfig.inputWidth) {
            $input.css('width', fieldConfig.inputWidth);
        }

        // Set read-only if specified (the calendar itself is blocked in _initializeDatepickers)
        this._applyReadonlyAttr($input, fieldConfig);

        // Store datepicker options on the element for initialization after DOM insertion
        $input.data('datepicker-options', {
            dateFormat: fieldConfig.dateDisplayFormat || this.options.dateDisplayFormat,
            changeMonth: fieldConfig.changeMonth ?? this.options.changeMonth,
            changeYear: fieldConfig.changeYear ?? this.options.changeYear,
            yearRange: fieldConfig.yearRange || this.options.yearRange,
            showButtonPanel: true,
            minDate: fieldConfig.minDate,
            maxDate: fieldConfig.maxDate
        });

        return $input;
    }

    /**
     * Creates a time input field backed by the jQuery Timepicker plugin.
     * Options are stored on the element and applied in _initializeTimepickers().
     *
     * @param {string} fieldName - The name attribute for the input element
     * @param {Object} fieldConfig - Configuration object for the time field
     * @param {string} [fieldConfig.timeFormat='HH:mm'] - Display/value format string
     * @param {string} [fieldConfig.placeholder] - Placeholder text for the input
     * @param {boolean} [fieldConfig.readonly] - If true, the input is read-only and the timepicker is not created
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the input is read-only and the timepicker is not created
     * @param {string|Date} [fieldConfig.defaultTime] - Default time value
     * @param {string|Date} [fieldConfig.minTime] - Minimum allowed time
     * @param {string|Date} [fieldConfig.maxTime] - Maximum allowed time
     * @param {number} [fieldConfig.minHour] - Minimum allowed hour (ignored if minTime set)
     * @param {number} [fieldConfig.minMinutes] - Minimum allowed minutes (ignored if minTime set)
     * @param {number} [fieldConfig.maxHour] - Maximum allowed hour (ignored if maxTime set)
     * @param {number} [fieldConfig.maxMinutes] - Maximum allowed minutes (ignored if maxTime set)
     * @param {string|Date} [fieldConfig.startTime] - First item in the combobox
     * @param {number} [fieldConfig.startHour] - Hour of first item (ignored if startTime set)
     * @param {number} [fieldConfig.startMinutes] - Minutes of first item (ignored if startTime set)
     * @param {number} [fieldConfig.interval=30] - Minute interval between dropdown entries
     * @param {boolean} [fieldConfig.dropdown=true] - Show dropdown list
     * @param {boolean} [fieldConfig.dynamic=false] - Arrange dropdown relative to selected time
     * @param {boolean} [fieldConfig.scrollbar=false] - Show scrollbar in dropdown
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes to apply
     * @param {string|number} [fieldConfig.width] - CSS width (string e.g. '150px') or integer (size attribute)
     * @returns {jQuery} A jQuery object representing the time input element
     * @private
     */
    _createTimeInput(fieldName, fieldConfig) {
        const timeFormat = fieldConfig.timeFormat || 'HH:mm';
        const $input = $('<input>', {
            type: 'text',
            name: fieldName,
            class: 'form-control timepicker ui-widget-content ui-corner-all',
            placeholder: fieldConfig.placeholder || timeFormat
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        // Apply width
        const wCfg = fieldConfig.inputWidth || fieldConfig.width;
        if (wCfg) {
            if (typeof wCfg === 'number') {
                $input.attr('size', wCfg);
            } else {
                $input.css('width', wCfg);
            }
        }

        // Set read-only if specified (the picker itself is skipped in _initializeTimepickers)
        this._applyReadonlyAttr($input, fieldConfig);

        // Build options object; undefined entries are stripped in _initializeTimepickers
        const tpOptions = {
            timeFormat,
            defaultTime: fieldConfig.defaultTime,
            minTime:     fieldConfig.minTime,
            minHour:     fieldConfig.minHour,
            minMinutes:  fieldConfig.minMinutes,
            maxTime:     fieldConfig.maxTime,
            maxHour:     fieldConfig.maxHour,
            maxMinutes:  fieldConfig.maxMinutes,
            startTime:   fieldConfig.startTime,
            startHour:   fieldConfig.startHour,
            startMinutes: fieldConfig.startMinutes,
            interval:    fieldConfig.interval,
            dropdown:    fieldConfig.dropdown,
            dynamic:     fieldConfig.dynamic,
            scrollbar:   fieldConfig.scrollbar,
            zindex:      fieldConfig.zindex
        };
        $input.data('timepicker-options', tpOptions);

        return $input;
    }

    /**
     * Initializes timepicker widgets on all time input fields after they're in the DOM.
     * Requires the jquery-timepicker library (https://timepicker.co).
     * @private
     */
    _initializeTimepickers() {
        // Detect the dialog z-index so the dropdown always appears on top.
        // Fall back to 1100 if the widget is not a jQuery UI dialog.
        const $dlg = this.$dialog && this.$dialog.closest('.ui-dialog');
        const dlgZIndex = ($dlg && $dlg.length) ? (parseInt($dlg.css('z-index'), 10) || 100) : 100;
        const dropdownZIndex = dlgZIndex + 10;

        this.$form.find('.timepicker').each((i, el) => {
            const $input = $(el);
            const options = $input.data('timepicker-options');
            const fieldConfig = this.options.fields[$input.attr('name')] || {};

            // A read-only time field never gets the timepicker: the plugin opens on focus and
            // writes the selection into the input with .val(), so readonly alone would not stop
            // the user changing the value. The value still goes in/out through .val().
            if (options && !$input.data('timepicker-initialized')
                && !this._isReadonlyField(fieldConfig)) {
                // Remove undefined options before initializing
                const cleanOptions = {};
                for (const [key, value] of Object.entries(options)) {
                    if (value !== undefined) cleanOptions[key] = value;
                }
                // Ensure dropdown z-index is above the dialog unless caller set it explicitly
                if (cleanOptions.zindex === undefined) {
                    cleanOptions.zindex = dropdownZIndex;
                }
                $input.timepicker(cleanOptions);
                $input.data('timepicker-initialized', true);
            }
        });
    }

    /**
     * Initializes the jQuery UI checkboxradio widget on every checkbox and radio input in the form.
     *
     * jQuery UI removed checkbox/radio support from the button widget in 1.13, so checkboxradio is
     * the only widget that themes a checkbox or radio: it hides the native input and styles the
     * associated <label for="..."> (ui-button/ui-widget/ui-state-default, ui-state-active when
     * checked, plus the ui-icon-check/ui-icon-blank icon).
     *
     * Must run after the inputs and their labels have been inserted into the document —
     * checkboxradio resolves its label through element.labels() and errors out when none is found.
     * Visibility is deliberately NOT checked: checkboxradio works on hidden elements (the dialog
     * before it is opened, fields in an inactive tab panel, hidden fields), whereas a :visible test
     * makes initialisation depend on the async timing of open() and silently skips the field.
     *
     * Safe to call repeatedly; already-initialised inputs are skipped.
     *
     * @private
     */
    _initializeCheckboxRadios() {
        if (!this.options.useJQueryUITheme || !this.$form) return;
        if (typeof $.fn.checkboxradio !== 'function') return; // checkboxradio widget not loaded

        this.$form.find('input[type="checkbox"], input[type="radio"]').each(function() {
            const $input = $(this);
            if ($input.data('ui-checkboxradio')) return; // already initialised
            // Skip inputs whose <label> is not in the document yet (e.g. a field group that has
            // not been appended to the form); checkboxradio would throw "No label found".
            if (typeof $input.labels === 'function' && !$input.labels().length) return;
            $input.checkboxradio();
        });
    }

    /**
     * Initializes jQuery UI selectmenu widgets on all select fields after the dialog is visible.
     * Called from _showDialog() so that selectmenu always initializes against a visible element,
     * giving correct auto-width behaviour and avoiding the race condition where a setTimeout fires
     * during an async URL option fetch (before the dialog has opened).
     * @private
     */
    _initializeSelectMenus() {
        if (!this.options.useJQueryUITheme) return;
        this.$form.find('select.form-control').each((i, el) => {
            const $select = $(el);
            if ($select.data('ui-selectmenu')) return; // already initialized
            // selectmenu only learns about a disabled <select> in refresh(), not on creation,
            // so the option has to be passed in for a read-only/disabled field
            $select.selectmenu($select.prop('disabled') ? { disabled: true } : {});
            const fieldName = $select.attr('name');
            const fieldConfig = (this.options.fields && this.options.fields[fieldName]) || {};
            const wCfg = fieldConfig.inputWidth || fieldConfig.width;
            if (wCfg) {
                const cssW = typeof wCfg === 'number' ? wCfg + 'px' : wCfg;
                $select.selectmenu('widget').css('width', cssW);
            }
            if (typeof fieldConfig.onChange === 'function') {
                $select.on('selectmenuchange', fieldConfig.onChange);
            }
        });
    }

    /**
     * Creates a password input field with masked characters.
     * 
     * @param {string} fieldName - The name attribute for the input element
     * @param {Object} fieldConfig - Configuration object for the password field
     * @param {string} [fieldConfig.placeholder] - Placeholder text for the input
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes to apply
     * @param {boolean} [fieldConfig.readonly] - If true, the input is read-only
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the input is read-only
     * @returns {jQuery} A jQuery object representing the password input element
     * @private
     */
    _createPasswordInput(fieldName, fieldConfig) {
        const $input = $('<input>', {
            type: 'password',
            name: fieldName,
            class: 'form-control ui-widget-content ui-corner-all',
            placeholder: fieldConfig.placeholder || ''
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        // Set read-only if specified
        this._applyReadonlyAttr($input, fieldConfig);

        return $input;
    }

    /**
     * Creates a hidden input field that is not visible in the form.
     * 
     * @param {string} fieldName - The name attribute for the hidden input element
     * @param {Object} fieldConfig - Configuration object (not currently used)
     * @returns {jQuery} A jQuery object representing the hidden input element
     * @private
     */
    _createHiddenInput(fieldName, fieldConfig) {
        return $('<input>', {
            type: 'hidden',
            name: fieldName
        });
    }

    /**
     * Creates a div element containing arbitrary HTML markup for the htmldiv field type.
     *
     * @param {string} fieldName - The field name (used as fallback id)
     * @param {Object} fieldConfig - Configuration for the field
     * @param {string} [fieldConfig.content=''] - HTML markup to insert inside the div
     * @param {string} [fieldConfig.id] - id attribute for the div; defaults to 'field-'+fieldName
     * @param {string} [fieldConfig.class] - Additional CSS class(es) appended to 'htmldiv-content'
     * @param {string} [fieldConfig.style] - Inline CSS style string applied to the div
     * @returns {jQuery} A jQuery div element with the content already inserted
     * @private
     */
    _createHtmlDiv(fieldName, fieldConfig) {
        const classes = fieldConfig.class
            ? 'htmldiv-content ' + fieldConfig.class
            : 'htmldiv-content';
        const $div = $('<div>', {
            id: fieldConfig.id || ('field-' + fieldName),
            class: classes
        }).html(fieldConfig.content || '');
        if (fieldConfig.style) {
            $div.attr('style', fieldConfig.style);
        }
        return $div;
    }

    /**
     * Creates an autocomplete input field with jQuery UI autocomplete widget.
     * 
     * @param {string} fieldName - The name attribute for the input element
     * @param {Object} fieldConfig - Configuration object for the autocomplete field
     * @param {string} [fieldConfig.placeholder] - Placeholder text for the input
     * @param {string|Array|Function} [fieldConfig.source] - Data source for autocomplete suggestions
     * @param {number} [fieldConfig.minLength=2] - Minimum characters before triggering autocomplete
     * @param {number} [fieldConfig.delay=300] - Delay in milliseconds before triggering autocomplete
     * @param {number} [fieldConfig.maxItems] - Maximum number of suggestions shown; a scrollbar appears when exceeded
     * @param {string} [fieldConfig.scrollHeight='200px'] - CSS max-height of the suggestion list when maxItems is set
     * @param {Function} [fieldConfig.onSelect] - Callback fired when the user selects a suggestion. Receives (event, ui) where ui.item is the selected item.
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes to apply
     * @param {boolean} [fieldConfig.readonly] - If true, the input is read-only and the suggestion menu never opens
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the input is read-only and the widget is disabled
     * @returns {jQuery} A jQuery object representing the autocomplete input element
     * @private
     */
    _createAutocomplete(fieldName, fieldConfig) {
        const effectiveWidth = fieldConfig.width !== undefined ? fieldConfig.width : this.options.defaultInputWidth;
        let baseClasses = 'form-control ui-widget-content ui-corner-all';
        if (!effectiveWidth || effectiveWidth === '100%') {
            baseClasses += ' full-width';
        }

        const $input = $('<input>', {
            type: 'text',
            name: fieldName,
            class: baseClasses,
            placeholder: fieldConfig.placeholder || ''
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        if (effectiveWidth && effectiveWidth !== '100%') {
            if (typeof effectiveWidth === 'number') {
                $input.attr('size', effectiveWidth);
            } else {
                $input.css('width', effectiveWidth);
            }
        }
        if (fieldConfig.inputWidth) {
            $input.css('width', fieldConfig.inputWidth);
        }

        // Set read-only if specified. ui.autocomplete bails out of its keydown handler when the
        // element is readOnly, so no search is started and the suggestion menu never opens.
        this._applyReadonlyAttr($input, fieldConfig);

        // Initialize autocomplete
        setTimeout(() => {
            const autocompleteOptions = {
                minLength: fieldConfig.minLength || 2,
                delay: fieldConfig.delay || 300
            };

            if (typeof fieldConfig.source === 'string') {
                const url = fieldConfig.source;
                const params = fieldConfig.sourceParams;
                autocompleteOptions.source = (request, response) => {
                    const extra = typeof params === 'function' ? params(request) : (params || {});
                    $.getJSON(url, { ...request, ...extra }, response);
                };
            } else if (Array.isArray(fieldConfig.source)) {
                autocompleteOptions.source = fieldConfig.source;
            } else if (typeof fieldConfig.source === 'function') {
                autocompleteOptions.source = fieldConfig.source;
            }

            // Limit suggestions to maxItems and apply scrollbar
            if (fieldConfig.maxItems) {
                const maxItems = fieldConfig.maxItems;
                const scrollHeight = fieldConfig.scrollHeight || '200px';
                const origResponse = autocompleteOptions.response;
                autocompleteOptions.response = function(event, ui) {
                    if (ui.content.length > maxItems) {
                        ui.content.splice(maxItems);
                    }
                    if (origResponse) origResponse(event, ui);
                };
                autocompleteOptions.open = function() {
                    $(this).autocomplete('widget').css({
                        'max-height': scrollHeight,
                        'overflow-y': 'auto',
                        'overflow-x': 'hidden'
                    });
                };
            }

            if (typeof fieldConfig.onSelect === 'function') {
                autocompleteOptions.select = fieldConfig.onSelect;
            }

            autocompleteOptions.disabled =  fieldConfig.disabled;

            $input.autocomplete(autocompleteOptions);

            if (fieldConfig.disabled) { // set readonly attribute if field is disabled so user cannot type in the field
                $input.attr("readonly", "readonly");
            }

        }, 0);
        return $input;
    }

    /**
     * Creates a spinner input field with jQuery UI spinner widget for numeric values.
     * Provides increment/decrement buttons for adjusting the value.
     * 
     * @param {string} fieldName - The name attribute for the input element
     * @param {Object} fieldConfig - Configuration object for the spinner field
     * @param {number} [fieldConfig.min] - Minimum allowed value
     * @param {number} [fieldConfig.max] - Maximum allowed value
     * @param {number} [fieldConfig.step] - Increment/decrement step value
     * @param {string} [fieldConfig.inputClass] - Additional CSS classes to apply
     * @param {boolean} [fieldConfig.readonly] - If true, the field stays a plain read-only input (no spinner widget)
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - If true, the field stays a plain read-only input (no spinner widget)
     * @returns {jQuery} A jQuery object representing the spinner input element
     * @private
     */
    _createSpinner(fieldName, fieldConfig) {
        const $input = $('<input>', {
            type: 'text',
            name: fieldName,
            class: 'form-control ui-widget-content ui-corner-all'
        });

        if (fieldConfig.inputClass) {
            $input.addClass(fieldConfig.inputClass);
        }

        // Set read-only if specified
        this._applyReadonlyAttr($input, fieldConfig);

        // Initialize spinner
        setTimeout(() => {
            // A read-only spinner stays a plain read-only number field: jQuery UI's spinner does
            // not honour `readonly` (its spin buttons and mouse wheel would still write to the
            // value) and its `disabled` option neither disables the element nor blocks spinning,
            // so the widget is skipped entirely. The value still round-trips through the .val()
            // fallbacks in _setInputValue()/_getFormData()/getFieldValue().
            if (this._isReadonlyField(fieldConfig)) return;

            const spinnerOptions = {};

            if (fieldConfig.min !== undefined) {
                spinnerOptions.min = fieldConfig.min;
            }

            if (fieldConfig.max !== undefined) {
                spinnerOptions.max = fieldConfig.max;
            }

            if (fieldConfig.step !== undefined) {
                spinnerOptions.step = fieldConfig.step;
            }

            $input.spinner(spinnerOptions);
        }, 0);

        return $input;
    }

    /**
     * Creates a slider widget with jQuery UI slider for selecting numeric values.
     * Includes a visual slider control and a synchronized numeric input field.
     * 
     * @param {string} fieldName - The name attribute for the slider's value input element
     * @param {Object} fieldConfig - Configuration object for the slider field
     * @param {number} [fieldConfig.min=0] - Minimum slider value
     * @param {number} [fieldConfig.max=100] - Maximum slider value
     * @param {number} [fieldConfig.step=1] - Increment step for slider movement
     * @param {number} [fieldConfig.defaultValue=0] - Initial slider value
     * @param {boolean} [fieldConfig.readonly=false] - Whether the slider and its numeric input are read-only
     * @param {boolean} [fieldConfig.readOnly] - Alternative property for read-only state
     * @param {boolean} [fieldConfig.disabled] - Alternative property for read-only state
     * @returns {jQuery} A jQuery object representing the slider container with slider widget and value input
     * @private
     */
    _createSlider(fieldName, fieldConfig) {
        const isReadonly = this._isReadonlyField(fieldConfig);

        const $container = $('<div>', {
            class: 'slider-container' + (isReadonly ? ' readonly-field' : '')
        });

        const $slider = $('<div>', {
            class: 'slider-widget'
        });

        const $valueDisplay = $('<input>', {
            type: 'number',
            name: fieldName,
            class: 'slider-value ui-widget-content ui-corner-all' + (isReadonly ? ' readonly-field' : ''),
            readonly: isReadonly
        });

        $container.append($slider, $valueDisplay);

        // Initialize slider
        setTimeout(() => {
            const sliderOptions = {
                min: fieldConfig.min || 0,
                max: fieldConfig.max || 100,
                step: fieldConfig.step || 1,
                value: fieldConfig.defaultValue || 0,
                // slider honours the disabled option: _mouseCapture and the handle keydown
                // handler both bail out, so a read-only slider can only be moved from code
                disabled: isReadonly,
                slide: (event, ui) => {
                    $valueDisplay.val(ui.value);
                },
                change: (event, ui) => {
                    $valueDisplay.val(ui.value);
                }
            };

            $slider.slider(sliderOptions);
            $valueDisplay.val(sliderOptions.value);

            // Update slider when input changes
            $valueDisplay.on('change', function() {
                $slider.slider('value', $(this).val());
            });
        }, 0);

        return $container;
    }

    /**
     * Creates a native `<input type="file">` based field with an optional thumbnail, a
     * filename/Remove display for the existing or newly chosen file, and (by default) a
     * drag-and-drop target covering the whole field.
     *
     * State is kept in `$wrapper.data('fileState') = { original, file, cleared, previewUrl }`
     * and is read by `_setInputValue()`, `_getFormData()`, `getFieldValue()` and `_getFileUploads()`.
     *
     * @param {string} fieldName - The name attribute for the underlying native file input
     * @param {Object} fieldConfig - Configuration object for the field
     * @param {string} [fieldConfig.accept] - Native `accept` attribute, also checked in JS
     * @param {number} [fieldConfig.maxFileSize] - Maximum allowed file size in bytes
     * @param {string|Function} [fieldConfig.thumbnailUrl] - URL template or function(record, fieldName) → url|null
     * @param {number|string} [fieldConfig.thumbnailSize=64] - Thumbnail max width/height: a number (px) or a CSS length string (e.g. '5em')
     * @param {boolean} [fieldConfig.dropZone=true] - Whether the whole field is a drag-and-drop target
     * @param {boolean} [fieldConfig.readonly] - Whether the field is read-only
     * @param {boolean} [fieldConfig.readOnly] - Alternative read-only property
     * @param {boolean} [fieldConfig.disabled] - Whether the field is disabled
     * @returns {jQuery} A jQuery object representing the field wrapper (`div.file-field`)
     * @private
     */
    _createFileInput(fieldName, fieldConfig) {
        const isReadonly = this._isReadonlyField(fieldConfig);
        const dropZoneEnabled = fieldConfig.dropZone !== false && !isReadonly;

        const $wrapper = $('<div>', { class: 'file-field' });
        if (isReadonly) $wrapper.addClass('readonly-field');

        const $thumb = $('<img>', { class: 'file-thumb', alt: '' }).hide();
        $thumb.on('error', function() { $(this).hide().attr('src', ''); });
        // thumbnailSize: number (px) or CSS length string (e.g. '5em'); default 64px
        let thumbSize = fieldConfig.thumbnailSize;
        if (typeof thumbSize === 'number' && thumbSize > 0) {
            thumbSize = thumbSize + 'px';
        } else if (typeof thumbSize !== 'string' || !thumbSize.trim()) {
            thumbSize = '64px';
        }
        $thumb.css({ maxWidth: thumbSize, maxHeight: thumbSize, objectFit: 'contain' });

        const $body = $('<div>', { class: 'file-body' });
        const $current = $('<div>', { class: 'file-current' }).hide();
        const $filename = $('<span>', { class: 'file-current-name' });
        const $removeBtn = $('<button>', {
            type: 'button',
            class: 'file-remove-btn',
            text: this.options.messages.removeFile || 'Remove'
        });
        if (this.options.useJQueryUITheme) $removeBtn.addClass('ui-button ui-widget ui-corner-all');
        $current.append($filename, ' ', $removeBtn);

        const $nativeInput = $('<input>', {
            type: 'file',
            name: fieldName,
            class: 'file-native-input'
        });
        if (fieldConfig.accept) $nativeInput.attr('accept', fieldConfig.accept);
        if (isReadonly) $nativeInput.prop('disabled', true).attr('tabindex', '-1');

        $body.append($current, $nativeInput);

        if (dropZoneEnabled) {
            const restrictions = this._buildFileRestrictionText(fieldConfig);
            const baseHint = this.options.messages.dropHint || 'or drop a file here';
            const $hint = $('<span>', {
                class: 'file-drop-hint',
                text: restrictions ? `${baseHint} (${restrictions})` : baseHint
            });
            $body.append($hint);
        }

        $wrapper.append($thumb, $body);
        $wrapper.data('fileState', { original: '', file: null, cleared: false, previewUrl: null });

        // Native file selection (also reached by the drag-and-drop handler below, which assigns
        // to $nativeInput[0].files and dispatches a native 'change' event)
        $nativeInput.on('change', () => {
            const file = ($nativeInput[0].files && $nativeInput[0].files[0]) || null;
            this._handleFileSelected(fieldName, $wrapper, fieldConfig, file);
        });

        // Remove button — type="button" so it never submits the form
        $removeBtn.on('click', (e) => {
            e.preventDefault();
            this._handleFileRemove(fieldName, $wrapper, fieldConfig);
        });

        if (dropZoneEnabled) {
            this._attachFileDropHandlers($wrapper, $nativeInput);
        }

        this._renderFileCurrent($wrapper);

        return $wrapper;
    }

    /**
     * Formats a byte count as a short string, e.g. 153600 -> '150K', 5242880 -> '5M', 1572864 -> '1.5M'.
     * @param {number} bytes
     * @returns {string}
     * @private
     */
    _formatFileSize(bytes) {
        const units = ['B', 'K', 'M', 'G', 'T'];
        let value = Number(bytes);
        let i = 0;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        return `${parseFloat(value.toFixed(1))}${units[i]}`;
    }

    /**
     * Builds the text describing a file field's restrictions (accepted types and max size),
     * e.g. '.jpg, .jpeg max size 150K'. Returns '' when the field has neither restriction.
     * @param {Object} fieldConfig
     * @returns {string}
     * @private
     */
    _buildFileRestrictionText(fieldConfig) {
        const parts = [];
        if (fieldConfig.accept) {
            const types = String(fieldConfig.accept).split(',').map(s => s.trim()).filter(Boolean);
            if (types.length) parts.push(types.join(', '));
        }
        if (fieldConfig.maxFileSize > 0) {
            const tpl = this.options.messages.fileMaxSize || 'max size {size}';
            parts.push(tpl.replace('{size}', this._formatFileSize(fieldConfig.maxFileSize)));
        }
        return parts.join(' ');
    }

    /**
     * Validates a candidate file against `accept` and `maxFileSize`.
     * @param {File} file
     * @param {Object} fieldConfig
     * @returns {string|null} An error message, or null if the file is acceptable
     * @private
     */
    _validateFileSelection(file, fieldConfig) {
        if (fieldConfig.maxFileSize && file.size > fieldConfig.maxFileSize) {
            return this.options.messages.fileTooLarge || 'File is too large';
        }

        if (fieldConfig.accept) {
            const accepts = String(fieldConfig.accept).split(',').map(s => s.trim()).filter(Boolean);
            if (accepts.length) {
                const mime = (file.type || '').toLowerCase();
                const name = file.name || '';
                const extMatch = name.match(/\.[^.]+$/);
                const ext = extMatch ? extMatch[0].toLowerCase() : '';

                const matches = accepts.some(accept => {
                    const a = accept.toLowerCase();
                    if (a.startsWith('.')) return ext === a;
                    if (a.endsWith('/*')) return mime ? mime.startsWith(a.slice(0, -1)) : false;
                    return mime ? mime === a : false;
                });

                if (!matches) {
                    return this.options.messages.fileTypeNotAllowed || 'File type not allowed';
                }
            }
        }

        return null;
    }

    /**
     * Handles a new file being selected (via the native picker or a drop). Validates the file,
     * updates state and the local image preview, and clears any previous error for this field.
     * @private
     */
    _handleFileSelected(fieldName, $wrapper, fieldConfig, file) {
        this._clearFileFieldError($wrapper);
        const state = $wrapper.data('fileState');
        if (!file) return;

        const error = this._validateFileSelection(file, fieldConfig);
        if (error) {
            const $nativeInput = $wrapper.find('input[type="file"]');
            $nativeInput.val('');
            state.file = null;
            this._revokeFilePreview($wrapper);
            this._applyFileThumbnail($wrapper, state.cleared ? '' : state.original, fieldConfig, fieldName);
            this._renderFileCurrent($wrapper);
            this.displayFieldErrors([{ name: fieldName, status: error }]);
            return;
        }

        state.file = file;
        state.cleared = false;
        this._updateFilePreviewForSelection($wrapper, file);
        this._renderFileCurrent($wrapper);
    }

    /**
     * Handles a Remove button click. If a new file is currently selected the selection is
     * discarded and the field reverts to its original value; otherwise the value becomes ''
     * (deleting the existing file on save).
     * @private
     */
    _handleFileRemove(fieldName, $wrapper, fieldConfig) {
        this._clearFileFieldError($wrapper);
        const state = $wrapper.data('fileState');
        const $nativeInput = $wrapper.find('input[type="file"]');
        $nativeInput.val('');
        this._revokeFilePreview($wrapper);

        if (state.file) {
            // Discard the new selection; the existing file (if any) is kept
            state.file = null;
            state.cleared = false;
            this._applyFileThumbnail($wrapper, state.original, fieldConfig, fieldName);
        } else {
            state.cleared = true;
            this._applyFileThumbnail($wrapper, '', fieldConfig, fieldName);
        }

        this._renderFileCurrent($wrapper);
        $wrapper.trigger('change');
    }

    /**
     * Attaches drag-and-drop handlers to the field wrapper so the whole field acts as a drop
     * target. The dropped file is assigned to the native input via a DataTransfer and a native
     * 'change' event is dispatched, reusing the same validation/state/preview path as the picker.
     * @private
     */
    _attachFileDropHandlers($wrapper, $nativeInput) {
        let dragCounter = 0;
        const activeCls = this.options.useJQueryUITheme ? 'file-drop-active ui-state-highlight' : 'file-drop-active';

        const hasFiles = (e) => {
            const dt = e.originalEvent && e.originalEvent.dataTransfer;
            return !!(dt && dt.types && Array.prototype.indexOf.call(dt.types, 'Files') !== -1);
        };

        $wrapper.on('dragenter', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragCounter++;
            e.originalEvent.dataTransfer.dropEffect = 'copy';
            $wrapper.addClass(activeCls);
        });

        $wrapper.on('dragover', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'copy';
        });

        $wrapper.on('dragleave', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragCounter = Math.max(0, dragCounter - 1);
            if (dragCounter === 0) $wrapper.removeClass(activeCls);
        });

        $wrapper.on('drop', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragCounter = 0;
            $wrapper.removeClass(activeCls);

            const dt = e.originalEvent.dataTransfer;
            let file = null;

            if (dt.items && dt.items.length) {
                for (let i = 0; i < dt.items.length; i++) {
                    const item = dt.items[i];
                    if (item.kind !== 'file') continue;
                    const entry = (typeof item.webkitGetAsEntry === 'function') ? item.webkitGetAsEntry() : null;
                    if (entry && entry.isDirectory) continue;
                    file = item.getAsFile();
                    if (file) break;
                }
            } else if (dt.files && dt.files.length) {
                file = dt.files[0];
            }

            if (!file) return;

            const nativeEl = $nativeInput[0];
            try {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                nativeEl.files = transfer.files;
                nativeEl.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (err) {
                // Fallback for browsers that don't support assigning input.files:
                // handle the dropped file directly through the same validation/state path.
                const fieldName = nativeEl.name;
                const fieldConfig = this.options.fields[fieldName];
                this._handleFileSelected(fieldName, $wrapper, fieldConfig, file);
            }
        });
    }

    /**
     * Revokes any active object URL used for a local image preview and clears it from state.
     * @private
     */
    _revokeFilePreview($wrapper) {
        const state = $wrapper.data('fileState');
        if (state && state.previewUrl) {
            URL.revokeObjectURL(state.previewUrl);
            state.previewUrl = null;
        }
    }

    /**
     * Creates (and tracks) a local object URL preview for a newly selected image file.
     * For a non-image file the thumbnail is cleared, so the previous file's image is not
     * shown next to the new filename.
     * @private
     */
    _updateFilePreviewForSelection($wrapper, file) {
        this._revokeFilePreview($wrapper);
        const $thumb = $wrapper.find('.file-thumb');
        if (file && file.type && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            $wrapper.data('fileState').previewUrl = url;
            $thumb.attr('src', url).show();
        } else {
            $thumb.hide().attr('src', '');
        }
    }

    /**
     * Resolves `fieldConfig.thumbnailUrl` (string template or function) against the current
     * record merged with the candidate value for this field.
     * @returns {string|null}
     * @private
     */
    _resolveThumbnailUrl(fieldConfig, fieldName, value) {
        if (!fieldConfig.thumbnailUrl || !value) return null;
        const record = { ...((this.edpak && this.edpak.currentRecord) || {}), [fieldName]: value };

        if (typeof fieldConfig.thumbnailUrl === 'function') {
            return fieldConfig.thumbnailUrl(record, fieldName) || null;
        }

        return String(fieldConfig.thumbnailUrl).replace(/\{(\w+)\}/g, (m, key) => {
            const v = record[key];
            return (v !== undefined && v !== null) ? encodeURIComponent(v) : '';
        });
    }

    /**
     * Sets the thumbnail `<img>` src from `thumbnailUrl` for the given value, or hides it
     * when there is no URL (empty value, no thumbnailUrl configured, or the image fails to load
     * — handled by the `error` handler attached in `_createFileInput()`).
     * @private
     */
    _applyFileThumbnail($wrapper, value, fieldConfig, fieldName) {
        const $thumb = $wrapper.find('.file-thumb');
        const url = this._resolveThumbnailUrl(fieldConfig, fieldName, value);
        if (url) {
            $thumb.attr('src', url).show();
        } else {
            $thumb.hide().attr('src', '');
        }
    }

    /**
     * Updates the filename + Remove button display based on the field's current state.
     * While a file is present the thumbnail, filename and Remove button are shown on one line
     * and the native "Choose file" input and drop hint are hidden; removing the file restores them.
     * The Remove button is hidden for read-only fields even when a file is present.
     * @private
     */
    _renderFileCurrent($wrapper) {
        const state = $wrapper.data('fileState') || {};
        const $current = $wrapper.find('.file-current');
        const $filename = $wrapper.find('.file-current-name');
        const $removeBtn = $wrapper.find('.file-remove-btn');
        const $picker = $wrapper.find('.file-native-input, .file-drop-hint');
        const isReadonly = $wrapper.hasClass('readonly-field');

        const displayName = state.file ? state.file.name : (!state.cleared ? (state.original || '') : '');

        if (displayName) {
            $filename.text(displayName);
            $current.show();
            $removeBtn.toggle(!isReadonly);
            $picker.hide();
            $wrapper.addClass('has-file');
        } else {
            $filename.text('');
            $current.hide();
            $picker.show();
            $wrapper.removeClass('has-file');
        }
    }

    /**
     * Clears this field's own error display (if any) without affecting other fields' errors.
     * Called on every new selection, drop or Remove so a stale message doesn't linger.
     * @private
     */
    _clearFileFieldError($wrapper) {
        const $group = $wrapper.closest('[data-field]');
        $group.find('.field-error').hide().text('');
        $wrapper.removeClass('field-invalid');
    }

    /**
     * Returns `{ fieldName: File }` for every non-transient `file` field that currently has a
     * newly selected file. Used by `_handleSave()` to populate `edpak.files`.
     * @returns {Object<string, File>}
     * @private
     */
    _getFileUploads() {
        const files = {};
        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];
            if (!fieldConfig || fieldConfig.transient === true) continue;
            if ((fieldConfig.type || '').toLowerCase() !== 'file') continue;

            const state = $input.data('fileState');
            if (state && state.file) {
                files[fieldName] = state.file;
            }
        }
        return files;
    }

    /**
     * Populates form with record data
     */
    async _populateForm(record) {
        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            let value = record[fieldName];
            const fieldConfig = this.options.fields[fieldName];

            if (!fieldConfig) continue;

            // Check if field has a data function to get the value
            if (fieldConfig.dataFunction && typeof fieldConfig.dataFunction === 'function') {
                value = await Promise.resolve(fieldConfig.dataFunction(record, fieldName, this));
            } else if (fieldConfig.getValue && typeof fieldConfig.getValue === 'function') {
                value = await Promise.resolve(fieldConfig.getValue(record, fieldName, this));
            } else if (fieldConfig.defaultValue !== undefined && value === undefined) {
                // Use defaultValue if field value is undefined
                value = typeof fieldConfig.defaultValue === 'function' 
                    ? await Promise.resolve(fieldConfig.defaultValue(record, fieldName, this))
                    : fieldConfig.defaultValue;
            }

            await this._setInputValue($input, value, fieldConfig, fieldName);
        }
    }

    /**
     * Sets the value of an input field based on its type.
     * Handles different input types including checkboxes, dates, selects, spinners, sliders, and text inputs.
     * Implements retry logic for jQuery UI widgets that may not be fully initialized.
     * 
     * @async
     * @param {jQuery} $input - The jQuery input element to set the value on
     * @param {*} value - The value to set (type varies based on field type)
     * @param {Object} fieldConfig - Configuration object for the field
     * @param {string} [fieldConfig.type='text'] - The type of input field
     * @param {string} [fieldConfig.dateDisplayFormat] - Date display format string for date inputs
     * @param {string} [fieldConfig.dateRecordFormat] - Date record format string for date inputs
     * @param {string} [fieldName] - The field name. Optional for backward compatibility with
     *   existing 3-argument callers, but required for the 'file' type (used to resolve
     *   `thumbnailUrl` and to merge the candidate value into the current record).
     * @returns {Promise<void>}
     * @private
     */
    async _setInputValue($input, value, fieldConfig, fieldName) {
        if (!$input || !$input.length) return;

        const type = (fieldConfig.type || 'text').toLowerCase();

        switch (type) {
            case 'file': {
                this._revokeFilePreview($input);
                const $nativeInput = $input.find('input[type="file"]');
                $nativeInput.val('');
                const original = value || '';
                $input.data('fileState', { original, file: null, cleared: false, previewUrl: null });
                this._renderFileCurrent($input);
                this._applyFileThumbnail($input, original, fieldConfig, fieldName);
                break;
            }

            case 'radiogroup':
                // Check the radio whose value matches; uncheck all others
                $input.find('input[type="radio"]').each(function() {
                    const shouldCheck = ($(this).val() == value);
                    $(this).prop('checked', shouldCheck);
                    if ($(this).data('ui-checkboxradio')) {
                        $(this).checkboxradio('refresh');
                    }
                });
                break;

            case 'checkboxradio':
            case 'checkbox':
                const $checkbox = $input.find('input[type="checkbox"]');
                if ($checkbox.length) {
                    $checkbox.prop('checked', Boolean(value));
                    if ($checkbox.data('ui-checkboxradio')) {
                        $checkbox.checkboxradio('refresh');
                    }
                }
                break;

            case 'date':
                if (value) {
                    const date = new Date(value);
                    if ($input.data('datepicker')) {
                        $input.datepicker('setDate', date);
                    } else {
                        $input.val(this._formatDate(date, fieldConfig.dateDisplayFormat || this.options.dateDisplayFormat));
                    }
                }
                break;

            case 'time':
                $input.val(value ?? '');
                break;

            case 'dropdown':
            case 'select':
                // Wait for options to load if they're being fetched (URL) or resolved async (function)
                if (fieldConfig.options && (typeof fieldConfig.options === 'string' || typeof fieldConfig.options === 'function')) {
                    await this._populateSelectOptions($input, fieldConfig.options);
                }
                
                // Set value with retry for selectmenu widget
                const setSelectValue = (retries = 10) => {
                    $input.val(value ?? '');
                    if ($input.data('ui-selectmenu')) {
                        $input.selectmenu('refresh');
                    } else if (this.options.useJQueryUITheme && retries > 0) {
                        // Selectmenu might not be initialized yet, wait and try again
                        setTimeout(() => setSelectValue(retries - 1), 20);
                    }
                };
                
                setSelectValue();
                break;

            case 'spinner':
                // Set value with retry for spinner widget
                const setSpinnerValue = (retries = 10) => {
                    if ($input.data('ui-spinner')) {
                        $input.spinner('value', value ?? 0);
                    } else if (retries > 0) {
                        // Spinner might not be initialized yet, wait and try again
                        setTimeout(() => {
                            if ($input.data('ui-spinner')) {
                                $input.spinner('value', value ?? 0);
                            } else {
                                setSpinnerValue(retries - 1);
                            }
                        }, 20);
                    } else {
                        // Fallback: just set the input value
                        $input.val(value ?? 0);
                    }
                };
                
                setSpinnerValue();
                break;

            case 'slider':
                const $slider = $input.find('.slider-widget');
                const $valueInput = $input.find('.slider-value');
                
                // Slider might not be initialized yet (due to setTimeout in _createSlider)
                // Wait for it to be ready
                const setSliderValue = (retries = 10) => {
                    if ($slider.length && $slider.data('ui-slider')) {
                        // Slider is ready, set the value
                        $slider.slider('value', value ?? 0);
                        $valueInput.val(value ?? 0);
                    } else if (retries > 0) {
                        // Slider not ready yet, wait and try again
                        setTimeout(() => setSliderValue(retries - 1), 20);
                    } else {
                        // Fallback: just set the input value
                        $valueInput.val(value ?? 0);
                    }
                };
                
                setSliderValue();
                break;

            case 'autocomplete':
                $input.val(value ?? '');
                $input.trigger('input'); // Update character counter
                break;

            default:
                $input.val(value ?? '');
                $input.trigger('input'); // Update character counter
        }
    }

    /**
     * Formats a Date object into a string based on the provided format.
     * Supports date format tokens: yyyy (4-digit year), yy (2-digit year), mm (month), dd (day).
     * 
     * @param {Date} date - The date object to format
     * @param {string} format - The format string (e.g., 'yyyy-mm-dd', 'dd/mm/yy')
     * @returns {string} The formatted date string
     * @private
     */
    _formatDate(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return format
            .replace('yyyy', year)  // 4-digit year
            .replace('yy', String(year).slice(-2))  // 2-digit year
            .replace('mm', month)
            .replace('dd', day);
    }

    /**
     * Reads the current value from an input element, respecting autoUnmask when set.
     *
     * jquery.inputmask's autoUnmask feature is supposed to work by patching $.valHooks
     * so that $input.val() returns the unmasked value. However, this patching is unreliable
     * with jQuery 4.0+. This method bypasses the patching and calls
     * $input.inputmask('unmaskedvalue') directly when autoUnmask:true is configured,
     * ensuring placeholder characters (e.g. '_') are never included in saved data.
     *
     * @param {jQuery} $input - The input element
     * @param {Object} fieldConfig - The field configuration
     * @returns {string} The field value, unmasked if autoUnmask:true was configured
     * @private
     */
    _readMaskedInputValue($input, fieldConfig) {
        const mask = fieldConfig.inputmask ?? fieldConfig.inputMask;
        if (mask && typeof mask === 'object' && mask.autoUnmask === true
                && typeof $.fn.inputmask === 'function') {
            return $input.inputmask('unmaskedvalue');
        }
        return $input.val();
    }

    /**
     * Initializes autocomplete fields by identifying all visible, non-readonly fields
     * and attaching appropriate change handlers to autocomplete-type fields.
     * Automatically determines the next field for focus after selection, with wrapping.
     *
     * @returns {void}
     * @private
     */
    _initializeAutoComplete() {
        // loop through all field inputs and add names of those that are not hidden or readOnly for use as nextfield in the loop below
        let nextFields = [];
        for (const [fieldName, $field] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];
            // console.log(`Field config for ${fieldName}: ${JSON.stringify(fieldConfig)}`);
            if (fieldConfig && !fieldConfig.readOnly && !fieldConfig.readonly && !(fieldConfig.type === 'hidden') && !(fieldConfig.type === 'file')) {
                nextFields.push(fieldName);
            }
        }
        //console.log(`Next fields: ${JSON.stringify(nextFields)}`);

        // loop through all field inputs attach autocomplete change handlers if applicable
        for (let i = 0; i < this.fieldInputs.size; i++) {
            const [fieldName, $field] = Array.from(this.fieldInputs.entries())[i];
            const fieldConfig = this.options.fields[fieldName];
            const fieldType = (fieldConfig && fieldConfig.type) || 'text';
            const isAutocomplete = fieldType.toLowerCase() === 'autocomplete';
            if (isAutocomplete) {
                let nextfield = null;
                const currentIndex = nextFields.indexOf(fieldName);
                if (currentIndex >= 0 && currentIndex + 1 < nextFields.length) {
                    nextfield = nextFields[currentIndex + 1];
                } else if (currentIndex > 0) {  // wrap around to the first field if not the first element
                    nextfield = nextFields[0];
                }
                this._attachAutocompleteChange($field, fieldName, fieldConfig.nextfield ? fieldConfig.nextfield : nextfield);
            }
        }
    }

    /**
     * Attaches autocomplete change handler with Tab key detection to trigger search and selection.
     *
     * @param {jQuery} field - The jQuery field element to attach the handler to
     * @param {string} curfield - The current field name (used for event namespace)
     * @param {string} [nextfield] - The next field name to focus after selection
     * @returns {Promise<void>}
     * @private
     */
    async _attachAutocompleteChange(field,curfield, nextfield) {
        // Attach keydown event to autocomplete field to detect Tab and trigger autocomplete search
        const $field = field // this.fieldInputs.get(curfield);
        if ($field) {
            let isProcessingSelection = false;
            const self = this; // Capture context
            let selectedByWidget = false;
            // Remove any previously attached handlers to avoid duplicates
            $field.off(`keydown.${curfield} blur.${curfield} autocompleteselect.${curfield}`);
            // jQuery UI's own Tab handling selects the highlighted item and fires 'select' synchronously
            $field.on(`autocompleteselect.${curfield}`, function() {
                selectedByWidget = true;
            });
            $field.on(`keydown.${curfield}`, function(e) {
                // Only handle Tab key (keyCode 9)
                if (e.keyCode === 9 && !isProcessingSelection) {
                    const value = $(this).val().trim();
                    
                    if (value && value.length > 0) {
                        const acWidget = $field.data('ui-autocomplete');
                        if (acWidget) {
                            isProcessingSelection = true;
                            selectedByWidget = false;
                            e.preventDefault();  // Prevent default Tab behavior temporarily

                            // Snapshot the highlighted item now, before the widget closes the menu
                            const menu = acWidget.menu;
                            const highlighted = (menu && menu.element.is(':visible') && menu.active && menu.active.length)
                                ? menu.active : null;

                            const finish = () => {
                                $field.autocomplete('close');
                                isProcessingSelection = false;
                                // set focus to the next input field if specified
                                if (nextfield) {
                                    const $nextInput = self.fieldInputs.get(nextfield);
                                    if ($nextInput) {
                                        $nextInput.focus();
                                    }
                                }
                            };

                            // Wait until all keydown handlers (including the widget's) have run
                            setTimeout(() => {
                                if (selectedByWidget) {
                                    // Widget already selected the highlighted item - a new search would
                                    // rebuild the menu and overwrite it with the first result
                                    finish();
                                } else if (highlighted) {
                                    try {
                                        highlighted.trigger('click');
                                    } finally {
                                        finish();
                                    }
                                } else {
                                    // Nothing highlighted: run a fresh search, wait for its response (not a
                                    // fixed delay, which could pick from a stale menu) and prefer the item
                                    // that exactly matches the typed value, else the first result
                                    clearTimeout(acWidget.searching); // cancel any pending typed-search
                                    let done = false;
                                    const pick = (content) => {
                                        if (done) return;
                                        done = true;
                                        $field.off(`autocompleteresponse.${curfield}`);
                                        // the menu is rendered after the response event fires
                                        setTimeout(() => {
                                            const lc = value.toLowerCase();
                                            let idx = -1;
                                            if (content && content.length > 0) {
                                                idx = content.findIndex(i =>
                                                    String(i.value).toLowerCase() === lc ||
                                                    String(i.label).toLowerCase() === lc);
                                                if (idx < 0 && content.length === 1) idx = 0;
                                            }
                                            if (idx >= 0) {
                                                try {
                                                    menu.element.children().eq(idx).trigger('click');
                                                } finally {
                                                    finish();
                                                }
                                            } else {
                                                // no valid match: clear the field if nothing matched at all,
                                                // otherwise leave the candidates open for the user to choose
                                                isProcessingSelection = false;
                                                if (content && content.length === 0) {
                                                    $field.autocomplete('close');
                                                    $field.val('');
                                                }
                                                $field.focus();
                                            }
                                        }, 0);
                                    };
                                    $field.on(`autocompleteresponse.${curfield}`, (ev, ui) => pick(ui.content));
                                    setTimeout(() => pick(null), 5000); // safety net if the request fails
                                    $field.autocomplete('search', value);
                                }
                            }, 0);
                        }
                    }
                }
            } );
        }
    }

    /**
     * Gets form data as object
     */
    _getFormData() {
        const data = {};

        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];

            // Transient fields are display-only and excluded from save data
            if (fieldConfig.transient === true) continue;

            const type = (fieldConfig.type || 'text').toLowerCase();

            switch (type) {
                case 'file': {
                    const state = $input.data('fileState') || {};
                    if (state.file) {
                        data[fieldName] = state.file.name;
                    } else if (state.cleared) {
                        data[fieldName] = '';
                    } else {
                        data[fieldName] = state.original || '';
                    }
                    break;
                }

                case 'radiogroup': {
                    const $checked = $input.find('input[type="radio"]:checked');
                    data[fieldName] = $checked.length ? $checked.val() : null;
                    break;
                }

                case 'checkboxradio':
                case 'checkbox':
                    const $checkbox = $input.find('input[type="checkbox"]');
                    data[fieldName] = $checkbox.length ? $checkbox.is(':checked') : false;
                    break;

                case 'date':
                    // Get date from datepicker and convert to record format
                    if ($input.data('datepicker')) {
                        const dateObj = $input.datepicker('getDate');
                        if (dateObj) {
                            const recordFormat = fieldConfig.dateRecordFormat || this.options.dateRecordFormat;
                            data[fieldName] = this._formatDate(dateObj, recordFormat);
                        } else {
                            data[fieldName] = '';
                        }
                    } else {
                        // Fallback: just get the text value
                        data[fieldName] = $input.val();
                    }
                    break;

                case 'dropdown':
                case 'select':
                    data[fieldName] = $input.val();
                    break;

                case 'spinner':
                    if ($input.data('ui-spinner')) {
                        data[fieldName] = $input.spinner('value');
                    } else {
                        data[fieldName] = $input.val();
                    }
                    break;

                case 'slider':
                    const $valueInput = $input.find('.slider-value');
                    data[fieldName] = $valueInput.val();
                    break;

                case 'time':
                    data[fieldName] = this._readMaskedInputValue($input, fieldConfig);
                    break;

                default:
                    data[fieldName] = this._readMaskedInputValue($input, fieldConfig);
            }
        }

        // Include key field from original record
        for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
            if (fieldConfig.key === true) {
                data[fieldName] = this.edpak.currentRecord[fieldName];
            }
        }

        return data;
    }

    /**
     * Handles save button click
     */
    /**
     * Handles the save operation for the form dialog.
     * Validates form data if a validator is provided, disables dialog buttons during save,
     * calls the onSave callback with form data and current record, and updates the current
     * record with any returned data before closing the dialog.
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If the onSave callback throws an error, displays error message and re-enables buttons
     * @private
     */
    async _handleSave() {
        // Clear any previously displayed field errors
        this.clearFieldErrors();

        const formData = this._getFormData();
        this.edpak.formdata = formData; // Update edpak data with current form data
        this.edpak.files = this._getFileUploads(); // Newly selected File objects, keyed by field name

        // Validate if validator provided
        if (this.options.validateForm) {
            // validateForm may return:
            //   null / undefined / []  — valid, proceed to save
            //   [{name, status}, ...]  — array of field errors (invalid)
            //   {valid: bool, fieldErrors: [...]}  — legacy object form
            const raw = this.options.validateForm(this.edpak);
            let isValid, fieldErrors;
            if (!raw || (Array.isArray(raw) && raw.length === 0)) {
                isValid = true;
                fieldErrors = [];
            } else if (Array.isArray(raw)) {
                isValid = false;
                fieldErrors = raw;
            } else {
                isValid = raw.valid !== false;
                fieldErrors = raw.fieldErrors || [];
            }
            if (!isValid) {
                if (fieldErrors.length > 0) {
                    this.displayFieldErrors(fieldErrors);
                }
                return;
            }
        }

        this._setButtonsSaving();

        try {
            let result = null;
            if (this.options.onSave) {
                result = await this.options.onSave(this.edpak);
            }
            
            this._setButtonsNormal();
            this._hideUploadProgress();
            
            // Update current record with returned data if provided
            if (result && typeof result === 'object') {
                this.edpak.currentRecord = { ...this.edpak.currentRecord, ...result };
            }
            
            // Commit file field state (filename, thumbnail, cleared flag) from the save result
            await this._commitFileFields(result);
            
            // Delegate post-save behaviour — subclasses can override _afterSave()
            await this._afterSave();
        } catch (error) {
            if (error && error.aborted === true) {
                // Dialog was closed mid-upload (see _abortUpload()). The editor may already be
                // tearing down, so skip commit, _afterSave() and the error notice entirely.
                return;
            }
            // only show error message if error has a message property, otherwise assume onSave handled the error 
            // (e.g. by showing field validation errors) and just re-enable buttons
            if (error.message && error.message.length > 0) {
                this._triggerNotice({type: 'error', message: error.message || 'Failed to save record'});
            }
            this._setButtonsNormal();
            this._hideUploadProgress();
        }
    }


    /**
     * Re-runs the 'file' field logic of `_setInputValue()` for every file field using the
     * committed value: `result[field]` when the host's `onSave` returned the saved record
     * containing that field, otherwise `edpak.formdata[field]` (the chosen filename, or ''
     * if removed). Also updates `edpak.currentRecord[field]` and clears `edpak.files` so the
     * saved File objects don't linger until the next save.
     *
     * Guarded against a destroyed editor (`this.$form` null).
     *
     * @param {Object|null} result - The value returned by onSave()
     * @private
     */
    async _commitFileFields(result) {
        if (!this.$form) return; // editor was destroyed mid-save

        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];
            if (!fieldConfig || (fieldConfig.type || '').toLowerCase() !== 'file') continue;

            const hasResultValue = result && typeof result === 'object'
                && Object.prototype.hasOwnProperty.call(result, fieldName);
            const committedValue = hasResultValue
                ? result[fieldName]
                : ((this.edpak.formdata && this.edpak.formdata[fieldName]) ?? '');

            await this._setInputValue($input, committedValue, fieldConfig, fieldName);

            if (this.edpak.currentRecord) {
                this.edpak.currentRecord[fieldName] = committedValue;
            }
        }

        this.edpak.files = {};
    }


    /**
     * Called after a successful save.  Default behaviour closes the dialog.
     * Subclasses can override to change what happens after a save without
     * duplicating the full _handleSave() method.
     * @private
     */
    async _afterSave() {
        this.closedAfterSave = true;
        this.close();
    }

    /**
     * Shows dialog
     */
    _showDialog() {
        if (this.$dialog) {
            this.$dialog.dialog('open');
            this._initializeSelectMenus();
            
            // Focus first editable input (skip hidden, readonly and file fields), then fire onAfterShow
            setTimeout(async () => {
                if (!this.$form) return; // editor was destroyed before timer fired
                const $firstInput = this.$form.find('input:not([type="hidden"]):not([type="file"]):not([readonly]):visible, textarea:not([readonly]):visible, select:visible').first();
                if ($firstInput.length) {
                    $firstInput.focus();
                }
                if (this.options.onAfterShow) {
                    await this.options.onAfterShow(this, this.edpak);
                }
            }, this.options.effectDuration + 50);
        }
    }

    /**
     * Closes dialog
     */
    close() {
        if (this.$dialog) {
            this.$dialog.dialog('close');
        }
    }

    /**
     * Switches to a specific tab (if tabs are enabled)
     * @param {String|Number} tab - Tab ID, title, or index (0-based)
     */
    activateTab(tab) {
        const $tabsContainer = this.$form.find('.record-editor-tabs');
        
        if (!$tabsContainer.length || !$tabsContainer.data('ui-tabs')) {
            console.warn('Tabs are not enabled for this form');
            return;
        }

        // Normalize tabs configuration to find the tab
        const tabs = this._normalizeTabs(this.options.tabs);
        
        if (typeof tab === 'number') {
            // Index provided
            $tabsContainer.tabs('option', 'active', tab);
        } else if (typeof tab === 'string') {
            // ID or title provided
            const tabIndex = tabs.findIndex(t => t.id === tab || t.title === tab);
            if (tabIndex !== -1) {
                $tabsContainer.tabs('option', 'active', tabIndex);
            } else {
                console.warn(`Tab '${tab}' not found`);
            }
        }
    }

    /**
     * Sets a single field value programmatically
     * @param {String} fieldName - The name of the field to set
     * @param {*} value - The value to set
     */
    async setFieldValue(fieldName, value) {
        const $input = this.fieldInputs.get(fieldName);
        const fieldConfig = this.options.fields[fieldName];
        
        if (!$input || !fieldConfig) {
            console.warn(`Field '${fieldName}' not found in form`);
            return;
        }

        await this._setInputValue($input, value, fieldConfig, fieldName);
        
        // Update current record
        if (this.edpak && this.edpak.currentRecord) {
            this.edpak.currentRecord[fieldName] = value;
        }
    }

    /**
     * Sets multiple field values programmatically
     * @param {Object} values - Object with fieldName: value pairs
     */
    async setFieldValues(values) {
        for (const [fieldName, value] of Object.entries(values)) {
            await this.setFieldValue(fieldName, value);
        }
    }

    /**
     * Restores all form fields to the values in `edpak.record` — the original record
     * object passed to `open()` / `load()`. Any unsaved edits (including those made via
     * `setFieldValue()`) are discarded.
     * Has no effect if no record has been loaded yet.
     *
     * @returns {Promise<void>}
     */
    async restoreForm() {
        if (!this.edpak || !this.edpak.record) {
            console.warn('restoreForm: no record is currently loaded');
            return;
        }
        await this._populateForm(this.edpak.record);
    }

    /**
     * Gets a single field value
     * @param {String} fieldName - The name of the field to get
     * @returns {*} The current value of the field
     */
    getFieldValue(fieldName) {
        const $input = this.fieldInputs.get(fieldName);
        const fieldConfig = this.options.fields[fieldName];
        
        if (!$input || !fieldConfig) {
            console.warn(`Field '${fieldName}' not found in form`);
            return null;
        }

        const type = (fieldConfig.type || 'text').toLowerCase();

        switch (type) {
            case 'file': {
                const state = $input.data('fileState') || {};
                if (state.file) return state.file.name;
                if (state.cleared) return '';
                return state.original || '';
            }

            case 'radiogroup': {
                const $checked = $input.find('input[type="radio"]:checked');
                return $checked.length ? $checked.val() : null;
            }

            case 'checkboxradio':
            case 'checkbox':
                const $checkbox = $input.find('input[type="checkbox"]');
                return $checkbox.length ? $checkbox.is(':checked') : false;

            case 'dropdown':
            case 'select':
                // jQuery 4 returns null when no option is selected; normalise to ''
                return $input.val() ?? '';

            case 'spinner':
                if ($input.data('ui-spinner')) {
                    return $input.spinner('value');
                }
                return $input.val();

            case 'slider':
                const $valueInput = $input.find('.slider-value');
                return $valueInput.val();

            case 'time':
                return this._readMaskedInputValue($input, fieldConfig);

            default:
                return this._readMaskedInputValue($input, fieldConfig);
        }
    }

    /**
     * Shows a field group (any field type, including htmldiv) by its field name.
     * Persists the visible state in the field config so it survives dialog rebuilds
     * and works correctly when called before the dialog is first opened.
     *
     * @param {string} fieldName - The field name to show
     */
    showField(fieldName) {
        const fieldConfig = this.options.fields[fieldName];
        if (fieldConfig) fieldConfig.hidden = false;
        if (this.$form) {
            this.$form.find(`.field-group[data-field="${fieldName}"]`).show();
        }
    }

    /**
     * Hides a field group (any field type, including htmldiv) by its field name.
     * Persists the hidden state in the field config so it survives dialog rebuilds
     * and works correctly when called before the dialog is first opened.
     *
     * @param {string} fieldName - The field name to hide
     */
    hideField(fieldName) {
        const fieldConfig = this.options.fields[fieldName];
        if (fieldConfig) fieldConfig.hidden = true;
        if (this.$form) {
            this.$form.find(`.field-group[data-field="${fieldName}"]`).hide();
        }
    }

    /**
     * Returns an array of field names whose inputmask is currently incomplete.
     *
     * Checks every field that had a mask applied during the most recent open() call
     * (both field-level `inputmask` / `inputMask` properties and dynamic `inputMasks`
     * overrides) using the inputmask `isComplete` method.
     *
     * Returns an empty array when:
     * - No masked fields exist in the current form
     * - jquery.inputmask is not loaded
     * - All masked fields are complete
     *
     * @returns {string[]} Array of field names whose mask is not yet fully filled.
     */
    getInvalidMaskedFields() {
        if (typeof $.fn.inputmask !== 'function' || this._maskedFields.size === 0) {
            return [];
        }

        const invalid = [];
        for (const fieldName of this._maskedFields) {
            const fieldConfig = this.options.fields[fieldName];
            if (fieldConfig && fieldConfig.hidden) continue; // hidden fields are always considered complete
            const $input = this.fieldInputs.get(fieldName);
            const mask = this._fieldMasks.get(fieldName);
            // Inputmask.isValid() accepts either a mask string or an options object.
            // Normalise to an options object so both forms are handled identically.
            const maskSpec = typeof mask === 'string' ? mask : mask.mask;
            if ($input && !Inputmask.isValid($input.val(), maskSpec)) {
                invalid.push(fieldName);
            }
        }
        return invalid;

    }

    /**
     * Updates the title of the editor's container/header.
     * In the base RecEdit class this sets the jQuery UI dialog title via the dialog API.
     *
     * Subclasses that render into a plain DIV (RecEditInline, RecEditExisting) override
     * this to update a heading element inside their container instead, keeping all
     * title-update logic in one place and out of open().
     *
     * @param {string} title - The title string to display
     * @private
     */
    _setTitle(title) {
        this.$dialog.dialog('option', 'title', title);
    }

    /**
     * Puts the editor's action buttons into a «saving in progress» state.
     * In the base RecEdit class this locates the jQuery UI dialog Save and Cancel
     * buttons, disables both, and changes the Save button label to the configured
     * `messages.saving` text.  The located button elements are cached as
     * `this.$saveBtn` / `this.$cancelBtn` so that _setButtonsNormal() can restore
     * them without a second DOM search.
     *
     * Subclasses that render their own inline buttons (RecEditInline, RecEditExisting)
     * override this to target their own button elements directly, avoiding the
     * jQuery UI dialog DOM traversal entirely.
     *
     * @private
     */
    _setButtonsSaving() {
        const $dialogWidget = this.$dialog.closest('.ui-dialog');
        const saveLabel   = this._saveBtnLabel   || this.options.messages.save;
        const cancelLabel = this._cancelBtnLabel || this.options.messages.cancel;
        this.$saveBtn   = $dialogWidget.find('button:contains("' + saveLabel + '")');
        this.$cancelBtn = $dialogWidget.find('button:contains("' + cancelLabel + '")');
        this._setButtonLabel(this.$saveBtn, this.options.messages.saving);
        this.$saveBtn.prop('disabled', true);
        this.$cancelBtn.prop('disabled', true);
    }

    /**
     * Replaces the visible label text of a button, keeping its icon intact.
     *
     * jQuery UI 1.12 replaced the generated `.ui-button-text` / `.ui-button-icon-primary` spans with
     * the button widget's `label` option: the label is now the button's own content and the widget
     * appends/removes the icon spans itself. Writing to `.ui-button-text` (the pre-1.12 markup) is a
     * silent no-op on modern versions, which is why the Save button never showed «Saving...».
     *
     * Plain buttons (e.g. the inline form's manually built buttons, and pre-1.12 markup) are handled
     * by replacing the trailing text node only, so icon spans are preserved.
     *
     * @param {jQuery} $button - The button element(s)
     * @param {string} text - The new label text
     * @private
     */
    _setButtonLabel($button, text) {
        if (!$button || !$button.length) return;

        if ($button.data('ui-button')) {
            $button.button('option', 'label', text);
            return;
        }

        const last = $button.contents().last()[0];
        if (last && last.nodeType === Node.TEXT_NODE) {
            last.nodeValue = text;
        } else {
            $button.append(document.createTextNode(text));
        }
    }

    /**
     * Restores the editor's action buttons to their normal enabled state.
     * In the base RecEdit class this uses the cached `this.$saveBtn` /
     * `this.$cancelBtn` references set by _setButtonsSaving() to re-enable both
     * buttons and restore the Save label to the configured `messages.save` text.
     *
     * Subclasses that render their own inline buttons override this to target
     * their own button elements, keeping save-button lifecycle management
     * entirely inside the subclass without touching _handleSave().
     *
     * @private
     */
    _setButtonsNormal() {
        if (this.$saveBtn) {
            const saveLabel = this._saveBtnLabel || this.options.messages.save;
            this.$saveBtn.prop('disabled', false);
            this._setButtonLabel(this.$saveBtn, saveLabel);
        }
        if (this.$cancelBtn) {
            this.$cancelBtn.prop('disabled', false);
        }
    }

    /**
     * Sets button enabled/disabled state
     */
    _setButtonState(button, enabled, text) {
        const $buttons = this.$dialog.dialog('option', 'buttons');
        const updatedButtons = $buttons.map(btn => {
            if (btn === button) {
                return {
                    ...btn,
                    text: text || btn.text,
                    disabled: !enabled
                };
            }
            return btn;
        });
        this.$dialog.dialog('option', 'buttons', updatedButtons);
    }

    /**
     * Returns the element that the form-level upload progress bar should be inserted into
     * (prepended, so it sits opposite the right-aligned Save/Cancel buttons).
     * Base class: the jQuery UI dialog's button pane.
     * Overridden by `RecEditInlineForm` to target its own `.recedit-button-bar`.
     * @returns {jQuery|null}
     * @private
     */
    _getProgressHost() {
        if (!this.$dialog) return null;
        const $host = this.$dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane');
        return $host.length ? $host : null;
    }

    /**
     * Shows (creating if necessary) the single form-level upload progress bar, setting its
     * value and label. Re-creates or re-inserts the element if it is no longer attached to the
     * DOM or no longer inside the current host — `_setButtonState()` rebuilds the dialog's
     * button pane via `dialog('option', 'buttons', ...)`, which detaches a previously inserted bar.
     *
     * @param {number} pct - Percentage complete (0-100)
     * @private
     */
    _showUploadProgress(pct) {
        const $host = this._getProgressHost();
        if (!$host || !$host.length) return;

        if (!this._$uploadProgress || !$.contains(document.documentElement, this._$uploadProgress[0])) {
            this._$uploadProgress = $('<div>', { class: 'recedit-upload-progress' });
            this._$uploadProgress.append(
                $('<progress>', { max: 100, value: 0 })
                    .toggleClass('ui-widget-header ui-corner-all', !!this.options.useJQueryUITheme),
                $('<span>', { class: 'recedit-upload-label' })
            );
        }

        if (this._$uploadProgress.parent()[0] !== $host[0]) {
            $host.prepend(this._$uploadProgress);
        }

        const clamped = Math.max(0, Math.min(100, Math.round(pct)));
        this._$uploadProgress.find('progress').val(clamped);
        const template = this.options.messages.uploading || 'Uploading... {pct}%';
        this._$uploadProgress.find('.recedit-upload-label').text(template.replace('{pct}', clamped));
        this._$uploadProgress.show();
    }

    /**
     * Hides the form-level upload progress bar and resets its value to 0.
     * Safe to call when it was never created or after `destroy()`.
     * @private
     */
    _hideUploadProgress() {
        if (this._$uploadProgress) {
            this._$uploadProgress.hide();
            this._$uploadProgress.find('progress').val(0);
        }
    }

    /**
     * Public alias of `_showUploadProgress()`, for hosts that drive the bar with their own
     * upload transport instead of `submit()`.
     * @param {number} pct - Percentage complete (0-100)
     */
    showUploadProgress(pct) {
        this._showUploadProgress(pct);
    }

    /**
     * Public alias of `_hideUploadProgress()`, for hosts that drive the bar with their own
     * upload transport instead of `submit()`.
     */
    hideUploadProgress() {
        this._hideUploadProgress();
    }

    /**
     * Aborts the in-flight XHR created by `submit()`, if any. `submit()`'s abort handler
     * rejects with `error.aborted = true`, which `_handleSave()` recognises so it can skip
     * commit, `_afterSave()` and the error notice. Called from the dialog's close handler and
     * from `destroy()`, since the dialog may still be closed (Escape / title-bar close) while
     * an upload is in flight.
     * @private
     */
    _abortUpload() {
        if (this._activeUpload) {
            this._activeUpload.abort();
            this._activeUpload = null;
        }
    }

    /**
     * Revokes any active local image-preview object URLs on 'file' fields. Called from
     * `destroy()`; the fields themselves are removed with the form, so this only needs to
     * release the URL, not touch the DOM.
     * @private
     */
    _revokeAllFilePreviews() {
        for (const [fieldName, $input] of this.fieldInputs.entries()) {
            const fieldConfig = this.options.fields[fieldName];
            if (fieldConfig && (fieldConfig.type || '').toLowerCase() === 'file') {
                this._revokeFilePreview($input);
            }
        }
    }

    /**
     * Sends `edpak.formdata` (as a JSON part) plus every `edpak.files[field]` (as file parts)
     * in a single multipart POST, using XMLHttpRequest so upload progress can be reported
     * (fetch cannot report upload progress). Drives the form-level progress bar when the total
     * size of the files being sent is at least `options.fileProgressMinSize` bytes.
     *
     * @param {string} url - The request URL
     * @param {Object} edpak - The edit package; `edpak.formdata` and `edpak.files` are read
     * @param {Object} [opts]
     * @param {string} [opts.method='POST'] - HTTP method
     * @param {Object} [opts.headers={}] - Extra request headers (for example a CSRF token).
     *   A `Content-Type` header is ignored (with a console warning) because the browser must
     *   generate the multipart boundary itself.
     * @param {string} [opts.dataField='data'] - Form field name for the JSON part. Must not
     *   match the name of any file field.
     * @param {boolean} [opts.withCredentials=false] - Send credentials on cross-origin requests
     * @returns {Promise<Object|null>} Resolves with the parsed JSON response body (or null if
     *   the body was empty) on a 2xx response.
     */
    submit(url, edpak, opts = {}) {
        const options = {
            method: 'POST',
            headers: {},
            dataField: 'data',
            withCredentials: false,
            ...opts
        };

        // The browser must generate the multipart boundary itself
        const headers = {};
        for (const [key, value] of Object.entries(options.headers || {})) {
            if (key.toLowerCase() === 'content-type') {
                console.warn('[recedit] submit(): ignoring a Content-Type header — the browser must set the multipart boundary itself.');
                continue;
            }
            headers[key] = value;
        }

        const files = (edpak && edpak.files) || {};
        const formData = new FormData();
        formData.append(options.dataField, JSON.stringify((edpak && edpak.formdata) || {}));

        let totalSize = 0;
        for (const [fieldName, file] of Object.entries(files)) {
            formData.append(fieldName, file);
            totalSize += file.size || 0;
        }

        const minSizeOption = this.options.fileProgressMinSize;
        let showProgress = false;
        if (minSizeOption !== false && Object.keys(files).length > 0) {
            const threshold = (minSizeOption === undefined || minSizeOption === null) ? 1048576 : minSizeOption;
            showProgress = totalSize >= threshold;
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this._activeUpload = xhr;

            xhr.open(options.method, url, true);
            xhr.withCredentials = !!options.withCredentials;

            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }

            if (showProgress) {
                this._showUploadProgress(0);
            }

            xhr.upload.onprogress = (event) => {
                if (!showProgress || !event.lengthComputable) return;
                // Use event.total, not the summed file sizes: the multipart body is slightly
                // larger than the files themselves.
                const pct = (event.loaded / event.total) * 100;
                this._showUploadProgress(pct);
            };

            const cleanup = () => {
                if (this._activeUpload === xhr) this._activeUpload = null;
                this._hideUploadProgress();
            };

            xhr.onload = () => {
                cleanup();
                const status = xhr.status;

                if (status >= 200 && status < 300) {
                    let body = null;
                    if (xhr.responseText) {
                        try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
                    }
                    resolve(body);
                    return;
                }

                if (status === 413) {
                    // Typically an HTML body from MAX_CONTENT_LENGTH or a reverse proxy, not JSON
                    reject(new Error(this.options.messages.fileTooLarge || 'File is too large'));
                    return;
                }

                let parsedBody = null;
                if (xhr.responseText) {
                    try { parsedBody = JSON.parse(xhr.responseText); } catch (e) { parsedBody = null; }
                }

                if (Array.isArray(parsedBody)) {
                    this.displayFieldErrors(parsedBody);
                    // Empty message follows the _handleSave() convention that the error was already handled
                    reject(new Error(''));
                    return;
                }

                const serverMessage = parsedBody && (parsedBody.message || parsedBody.status || parsedBody.error);
                reject(new Error(serverMessage || `Save failed (HTTP ${status})`));
            };

            xhr.onerror = () => {
                cleanup();
                reject(new Error(this.options.messages.uploadFailed || 'Upload failed'));
            };

            xhr.onabort = () => {
                cleanup();
                const err = new Error('');
                err.aborted = true;
                reject(err);
            };

            xhr.send(formData);
        });
    }

    /**
     * Displays inline field-level validation error messages under the relevant form fields.
     * Errors remain visible until the user clicks Save (which calls clearFieldErrors) or
     * clearFieldErrors() is called directly.
     *
     * @param {Object} errorMap - Object containing a fieldErrors array
     * @param {Array<{name: string, status: string}>} errorMap.fieldErrors - Array of field error objects
     * @param {string} errorMap.fieldErrors[].name  - The field name (must match a field in the form)
     * @param {string} errorMap.fieldErrors[].status - The error message to display
     *
     * @example
     * editor.displayFieldErrors({
     *     fieldErrors: [
     *         { name: 'companyname', status: 'Value is required' },
     *         { name: 'email',       status: 'Invalid email address' }
     *     ]
     * });
     */
    displayFieldErrors(errors) {
        // Accept either a plain array [{name, status}, ...] or a legacy {fieldErrors: [...]} object.
        const fieldErrors = Array.isArray(errors)
            ? errors
            : (errors && Array.isArray(errors.fieldErrors) ? errors.fieldErrors : null);

        if (!fieldErrors || !fieldErrors.length) return;

        fieldErrors.forEach(error => {
            if (!error.name || !error.status) return;
            const $errorEl = this.$form.find(`.field-group[data-field="${error.name}"] .field-error`);
            if ($errorEl.length) {
                $errorEl.text(error.status).show();
            }
            const $input = this.fieldInputs.get(error.name);
            if ($input) $input.addClass('field-invalid');
        });

        // Mark tabs that contain error fields
        this._markTabsWithErrors(fieldErrors);
    }

    /**
     * Hides all inline field error messages currently displayed in the form.
     * Called automatically when the Save button is clicked.
     */
    clearFieldErrors() {
        if (this.$form) {
            this.$form.find('.field-error').hide().text('');
            this.$form.find('.field-invalid').removeClass('field-invalid');
        }

        // Clear tab error indicators
        this._clearTabErrorIndicators();
    }

    /**
     * Marks tabs that contain fields with validation errors by adding an indicator to the tab title.
     * Only marks tabs that are not currently active.
     * 
     * @param {Array<{name: string}>} fieldErrors - Array of field error objects
     * @private
     */
    _markTabsWithErrors(fieldErrors) {
        const $tabsContainer = this.$form.find('.record-editor-tabs');
        if (!$tabsContainer.length || !$tabsContainer.data('ui-tabs')) return;
        
        const tabsWithErrors = new Set();
        
        // Determine which tabs contain error fields
        const tabs = this._normalizeTabs(this.options.tabs);
        fieldErrors.forEach(error => {
            const fieldConfig = this.options.fields[error.name];
            if (fieldConfig) {
                if (fieldConfig.tab) {
                    const tabIndex = tabs.findIndex(t => t.id === fieldConfig.tab || t.title === fieldConfig.tab);
                    if (tabIndex !== -1) {
                        tabsWithErrors.add(tabIndex);
                    }
                } else {
                    // Fields with no tab property belong to the first tab
                    tabsWithErrors.add(0);
                }
            }
        });
        
        // Add error indicator to affected tabs
        tabsWithErrors.forEach(tabIndex => {
            const $tabLink = $tabsContainer.find(`ul.ui-tabs-nav li:eq(${tabIndex}) a`);
            if ($tabLink.length && !$tabLink.find('.tab-error-indicator').length) {
                $tabLink.append('<span class="tab-error-indicator"> *</span>');
            }
        });
    }

    /**
     * Removes error indicators from all tab titles.
     * Called when validation errors are cleared.
     * 
     * @private
     */
    _clearTabErrorIndicators() {
        const $tabsContainer = this.$form.find('.record-editor-tabs');
        if ($tabsContainer.length) {
            $tabsContainer.find('.tab-error-indicator').remove();
        }
    }

    /**
     * Shows error message using jQuery UI dialog
     */
    _showError(message) {
        const $errorDialog = $('<div>', {
            title: this.options.messages.error
        }).html(`<p><span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>${message}</p>`);

        $errorDialog.dialog({
            modal: true,
            buttons: {
                Ok: function() {
                    $(this).dialog('close');
                    $(this).remove();
                }
            }
        });
    }

    /**
     * Destroys the dialog and cleans up jQuery UI widgets
     */
    destroy() {
        this._abortUpload();
        this._revokeAllFilePreviews();

        if (this.$dialog) {
            // Destroy tabs if present
            this.$dialog.find('.record-editor-tabs').each(function() {
                if ($(this).data('ui-tabs')) {
                    $(this).tabs('destroy');
                }
            });

            // Destroy all jQuery UI widgets
            this.$dialog.find('.datepicker').each(function() {
                if ($(this).data('datepicker')) {
                    $(this).datepicker('destroy');
                }
            });

            this.$dialog.find('select').each(function() {
                if ($(this).data('ui-selectmenu')) {
                    $(this).selectmenu('destroy');
                }
            });

            this.$dialog.find('.ui-spinner').each(function() {
                if ($(this).data('ui-spinner')) {
                    $(this).spinner('destroy');
                }
            });

            this.$dialog.find('.slider-widget').each(function() {
                if ($(this).data('ui-slider')) {
                    $(this).slider('destroy');
                }
            });

            this.$dialog.find('.ui-autocomplete-input').each(function() {
                if ($(this).data('ui-autocomplete')) {
                    $(this).autocomplete('destroy');
                }
            });

            // Destroy dialog
            this.$dialog.dialog('destroy');
            this.$dialog.remove();
        }

        this.$dialog = null;
        this.$form = null;
        this.fieldInputs.clear();
        this.isInitialized = false;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecEdit;
}

/**
 * RecEditInlineForm - Record editor that injects form inputs into developer-supplied placeholder elements.
 *
 * The developer provides a container DIV whose inner markup contains one placeholder element per
 * editable field.  Each placeholder must carry a `data-field="<fieldName>"` attribute that matches
 * a key in the `fields` option.  RecEditInlineForm empties each placeholder on every `open()` call
 * and re-injects the full field group (label + input + character counter + error element) produced
 * by the base class `_createFieldGroup()` method, so all standard label positioning, layout modes,
 * counters, validation display, show/hide, inputmask and every other base-class feature works
 * unchanged.
 *
 * Labels are generated automatically from the field configuration, positioned according to the
 * `formLayout` option ('vertical' or 'horizontal') exactly as in the dialog-based RecEdit class.
 * If a field definition has `omitLabel: true`, no label is produced.
 *
 * Save and Cancel buttons are rendered inside the container by the class itself.  Their placement
 * can be controlled via the `buttonContainerSelector` option.  If not provided the buttons are
 * appended directly to the container.
 *
 * @class RecEditInlineForm
 * @extends RecEdit
 *
 * @example
 * // HTML:
 * // <div id="my-editor">
 * //     <h3 data-editor-title></h3>
 * //     <div data-field="companyname"></div>
 * //     <div data-field="contactname"></div>
 * //     <div class="editor-buttons"></div>
 * // </div>
 *
 * const editor = new RecEditInlineForm({
 *     container: '#my-editor',            // Required – selector or jQuery object
 *     titleSelector: '[data-editor-title]', // Optional – element to receive the title text
 *     buttonContainerSelector: '.editor-buttons', // Optional – where Save/Cancel buttons are inserted
 *     useJQueryUITheme: true,              // Optional – apply jQuery UI theme classes/styles (default true)
 *     containerClass: 'my-editor-class',  // Optional – extra CSS class(es) added to the container
 *     containerStyle: { border: '1px solid #ccc', borderRadius: '4px' }, // Optional – extra inline styles
 *     formLayout: 'horizontal',
 *     labelWidth: '130px',
 *     fields: {
 *         companyname: { label: 'Company', type: 'text', maxLength: 40 },
 *         contactname: { label: 'Contact', type: 'text' }
 *     },
 *     onSave: async (edpak) => { ... }
 * });
 *
 * await editor.open({ record: { companyname: 'Acme', contactname: 'Alice' } });
 */
class RecEditInlineForm extends RecEdit {

    constructor(options = {}) {
        super(options);

        if (!options.container) {
            throw new Error('RecEditInlineForm: "container" option is required');
        }

        // Resolve container to a jQuery object once
        this._$container = $(options.container);
        if (!this._$container.length) {
            throw new Error(`RecEditInlineForm: container "${options.container}" not found in DOM`);
        }

        // Optional selector for a title element inside the container
        this._titleSelector = options.titleSelector || null;

        // Optional selector for where Save/Cancel buttons should be inserted
        this._buttonContainerSelector = options.buttonContainerSelector || null;

        // When true (default), form fields are reset to default values after a successful save.
        // When false, the form retains the saved values after save.
        this.clearFormOnSave = options.clearFormOnSave ?? true;

        // Build the form immediately so it is visible on the page without needing open()/load().
        this._createDialog();
        this.isInitialized = true;
        this._buildForm();

        // Fire onInit callback — form elements are built and visible; no record has been loaded yet.
        if (this.options.onInit) {
            this.options.onInit(this);
        }
    }

    // -------------------------------------------------------------------------
    // Data loading
    // -------------------------------------------------------------------------

    /**
     * Populates the already-visible form with data from the supplied edit package.
     * Equivalent to the base-class `open()` but without creating the dialog or
     * showing/hiding the container — the form remains visible on the page at all times.
     *
     * @param {Object}  edpak             - Edit package (must have a `record` property).
     * @param {Object}  [fieldDefinitions] - Optional replacement field definitions map.
     * @param {string}  [customTitle]      - Optional title text (displayed if `titleSelector` is set).
     * @param {Object}  [dynamicFieldProps] - Optional dynamic field properties (same as `open()`).
     */
    async load(edpak, fieldDefinitions = null, customTitle = null, dynamicFieldProps = null) {
        if (!edpak.record) {
            this._triggerNotice({type: 'error', title: 'RecEditInlineForm load error', message: 'Missing record property in edpak object passed to load() method'});
            return;
        }

        this.edpak = edpak;
        this.edpak.currentRecord = { ...edpak.record };

        if (fieldDefinitions) {
            this.options.fields = fieldDefinitions;
        }

        // Update title if a titleSelector was provided
        if (customTitle) {
            this._setTitle(customTitle);
        } else if (this.options.dialogTitle) {
            this._setTitle(this.options.dialogTitle);
        } else {
            this._setTitle(this.options.messages.editRecord);
        }

        this._buildForm();
        this._initializeAutoComplete();

        if (dynamicFieldProps) {
            this._applyDynamicFieldProps(dynamicFieldProps);
        }

        this._initializeInputMasks(dynamicFieldProps ? dynamicFieldProps.inputMasks : null);

        // Mark all mandatory-masked field labels with the required asterisk
        for (const fieldName of this.getInvalidMaskedFields()) {
            const _fc = this.options.fields[fieldName];
            if (_fc && (_fc.readonly || _fc.readOnly)) continue;
            this.$form.find(`[data-field="${fieldName}"]`).addClass('field-required');
        }

        await this._populateForm(edpak.record);

        if (this.options.onBeforeShow) {
            await this.options.onBeforeShow(this, this.edpak);
        }

        // Selectmenus require a visible element; initialise them now that the container is present.
        this._initializeSelectMenus();

        // Focus first editable input and fire onAfterShow after widget animation settles
        setTimeout(async () => {
            if (!this.$form) return; // editor was destroyed before timer fired
            const $firstInput = this.$form.find('input:not([type="hidden"]):not([type="file"]):not([readonly]):visible, textarea:not([readonly]):visible, select:visible').first();
            if ($firstInput.length) {
                $firstInput.focus();
            }
            if (this.options.onAfterShow) {
                await this.options.onAfterShow(this, this.edpak);
            }
        }, this.options.effectDuration + 50);
    }

    // -------------------------------------------------------------------------
    // Container lifecycle
    // -------------------------------------------------------------------------

    /**
     * Wires up the container DIV as both `this.$dialog` and `this.$form`, then injects
     * Save/Cancel buttons.  No jQuery UI dialog is created.
     * @private
     */
    _createDialog() {
        if (this.options.useJQueryUITheme) {
            // set standard classes on the container
            this._$container.addClass('ui-dialog-content ui-widget-content');
            this._$container.css({ margin: '0 auto', padding: '20px 20px 0 20px', overflow: 'hidden' });
        }
        if (this.options.containerClass) {
            this._$container.addClass(this.options.containerClass);
        }
        if (this.options.containerStyle) {
            this._$container.css(this.options.containerStyle);
        }

        this.$dialog = this._$container;
        // Wrap entire container in a <form> only if it isn't already one.
        // If the container is not a <form>, we use it directly as $form so that
        // _buildForm() appends inputs into it.
        if (this.$dialog.is('form')) {
            this.$form = this.$dialog;
        } else {
            // Use the container itself; submit via button click rather than form submission
            this.$form = this.$dialog;
        }

        // Inject Save / Reset buttons
        const saveLabel   = (this.options.saveButton   && this.options.saveButton.text)   || this.options.messages.save;
        const cancelLabel = (this.options.cancelButton && this.options.cancelButton.text) || 'Reset';

        this._saveBtnLabel   = saveLabel;
        this._cancelBtnLabel = cancelLabel;

        const saveCfg   = { text: saveLabel,   class: 'ui-button ui-corner-all ui-widget ui-button-primary recedit-save-btn',   ...(this.options.saveButton   || {}) };
        const cancelCfg = { text: cancelLabel, class: 'ui-button ui-corner-all ui-widget recedit-reset-btn',                   ...(this.options.cancelButton || {}) };

        this.$saveBtn   = $('<button>', { type: 'button', class: saveCfg.class });
        this.$saveBtn.append(
            $('<span>', { class: 'ui-button-icon ui-icon ui-icon-check' }),
            $('<span>', { class: 'ui-button-icon-space', text: ' ' }),
            document.createTextNode(saveCfg.text)
        );
        this.$cancelBtn = $('<button>', { type: 'button', class: cancelCfg.class });
        this.$cancelBtn.append(
            $('<span>', { class: 'ui-button-icon ui-icon ui-icon-arrowreturn-1-w' }),
            $('<span>', { class: 'ui-button-icon-space', text: ' ' }),
            document.createTextNode(cancelCfg.text)
        );

        this.$saveBtn.on('click',   () => this._handleSave());
        this.$cancelBtn.on('click', () => this.restoreForm());

        const $btnSet  = $('<div>', { class: 'ui-dialog-buttonset' });
        $btnSet.append(this.$cancelBtn, this.$saveBtn);

        const $btnWrap = $('<div>', { class: 'ui-dialog-buttonpane ui-widget-content ui-helper-clearfix recedit-button-bar' });
        $btnWrap.append($btnSet);

        const $btnTarget = this._buttonContainerSelector
            ? this._$container.find(this._buttonContainerSelector)
            : this._$container;

        $btnTarget.append($btnWrap);
    }

    // -------------------------------------------------------------------------
    // Form building — inject inputs into placeholders
    // -------------------------------------------------------------------------

    /**
     * For each field in `options.fields`, finds the placeholder `[data-field="fieldName"]`
     * inside the container, builds the complete field group (label + input + counter + error)
     * via the inherited `_createFieldGroup()`, then transfers the group's contents into the
     * placeholder and promotes the placeholder to carry the same CSS classes as the group.
     * This means every base-class selector (`[data-field=...]`, `.field-group`, `.field-error`,
     * etc.) continues to work without any change to the base class.
     * @private
     */
    _buildForm() {
        this.fieldInputs.clear();

        for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
            if (fieldConfig.edit === false || fieldConfig.key === true) continue;

            const $placeholder = this.$form.find(`[data-field="${fieldName}"]`);
            if (!$placeholder.length) {
                console.warn(`RecEditInlineForm: no placeholder found for field '${fieldName}'`);
                continue;
            }

            // Clear any previous open() content
            $placeholder.empty();
            // Reset promoted classes from a previous open() so they don't accumulate
            $placeholder.removeClass('field-group field-group-vertical field-group-horizontal htmldiv-align-dialog');

            if (fieldConfig.type === 'hidden') {
                const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                this.fieldInputs.set(fieldName, $hiddenInput);
                $placeholder.append($hiddenInput);
                continue;
            }

            // Build the full label + input + counter + error group
            const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);

            // Promote the placeholder: copy the group's CSS classes onto it so base-class
            // selectors like `.field-group[data-field="x"]` match the placeholder element.
            $placeholder.addClass($fieldGroup.attr('class'));

            // Move children from the temporary wrapper into the placeholder.
            // jQuery .append() moves live DOM nodes, so all `fieldInputs` references
            // set by _createFieldGroup() → _createInput() remain valid.
            $placeholder.append($fieldGroup.children());
        }
        this._initializeAutoComplete();
        this._initializeDatepickers();
        this._initializeTimepickers();
        this._initializeCheckboxRadios();
    }

    // -------------------------------------------------------------------------
    // Show / hide
    // -------------------------------------------------------------------------

    /**
     * Makes the container visible and initialises selectmenus (which require a visible element).
     * Fires the `onAfterShow` callback after a short delay, matching base-class behaviour.
     * @private
     */
    _showDialog() {
        this._$container.show();
        this._initializeSelectMenus();

        setTimeout(async () => {
            if (!this.$form) return; // editor was destroyed before timer fired
            const $firstInput = this.$form
                .find('input:not([type="hidden"]):not([type="file"]):not([readonly]):visible, textarea:not([readonly]):visible, select:visible')
                .first();
            if ($firstInput.length) {
                $firstInput.focus();
            }
            if (this.options.onAfterShow) {
                await this.options.onAfterShow(this, this.edpak);
            }
        }, this.options.effectDuration + 50);
    }

    /**
     * Fires the `onCancel` callback if defined. Does NOT hide the container —
     * the inline form is always visible; hiding is the developer's responsibility.
     */
    close() {
        if (this.options.onCancel) {
            this.options.onCancel();
        }
    }

    // -------------------------------------------------------------------------
    // Title + button state hooks (override base-class dialog variants)
    // -------------------------------------------------------------------------

    /**
     * Updates the title text.  If a `titleSelector` option was provided the matching
     * element inside the container is updated; otherwise the call is silently ignored
     * (the developer can use a static heading in their markup).
     * @param {string} title
     * @private
     */
    _setTitle(title) {
        if (this._titleSelector) {
            this._$container.find(this._titleSelector).text(title);
        }
    }

    /**
     * Disables Save and Cancel buttons and relabels Save to `messages.saving`.
     * Uses `this.$saveBtn` / `this.$cancelBtn` set up in `_createDialog()` directly,
     * avoiding the jQuery UI dialog DOM traversal used by the base class.
     * @private
     */
    _setButtonsSaving() {
        if (this.$saveBtn) {
            this.$saveBtn.prop('disabled', true);
            this._setButtonLabel(this.$saveBtn, this.options.messages.saving);
        }
        if (this.$cancelBtn) {
            this.$cancelBtn.prop('disabled', true);
        }
    }

    /**
     * Re-enables Save and Cancel buttons and restores the Save label.
     * @private
     */
    _setButtonsNormal() {
        if (this.$saveBtn) {
            this.$saveBtn.prop('disabled', false);
            this._setButtonLabel(this.$saveBtn, this._saveBtnLabel || this.options.messages.save);
        }
        if (this.$cancelBtn) {
            this.$cancelBtn.prop('disabled', false);
        }
    }

    /**
     * Returns `.recedit-button-bar` (the inline form's own injected button row) as the host
     * for the form-level upload progress bar.
     * @returns {jQuery|null}
     * @private
     */
    _getProgressHost() {
        if (!this.$saveBtn || !this.$saveBtn.length) return null;
        const $host = this.$saveBtn.closest('.recedit-button-bar');
        return $host.length ? $host : null;
    }

    /**
     * Post-save behaviour for inline forms.  Instead of closing the form, either
     * resets all field values to their defaults (when `clearFormOnSave` is true) or
     * leaves the form populated with the saved data (when `clearFormOnSave` is false).
     * @private
     */
    async _afterSave() {
        if (this.clearFormOnSave) {
            // Passing an empty record causes _setInputValue to fall back to each field's
            // defaultValue, which is the same clear/reset path used on first open().
            await this._populateForm({});
        }
        // If clearFormOnSave is false, do nothing — leave the form as-is.
    }

    // -------------------------------------------------------------------------
    // Tab error indicators — DOM-based, works with developer-supplied tab markup
    // -------------------------------------------------------------------------

    /**
     * Marks jQuery UI tab nav links for any tab panel that contains a field with
     * a validation error.  Works with any jQuery UI tabs structure in the
     * developer-supplied container, not just RecEdit-generated tabs.
     * @param {Array<{name: string}>} fieldErrors
     * @private
     */
    _markTabsWithErrors(fieldErrors) {
        const $uiTabs = this.$form.find('.ui-tabs').first();
        if (!$uiTabs.length) return;

        fieldErrors.forEach(error => {
            const $placeholder = this.$form.find(`[data-field="${error.name}"]`);
            if (!$placeholder.length) return;

            const $panel = $placeholder.closest('.ui-tabs-panel');
            if (!$panel.length) return;

            const $tabLink = $uiTabs.find(`ul.ui-tabs-nav a[href="#${$panel.attr('id')}"]`);
            if ($tabLink.length && !$tabLink.find('.tab-error-indicator').length) {
                $tabLink.append('<span class="tab-error-indicator"> *</span>');
            }
        });
    }

    /**
     * Removes all tab error indicators from the developer-supplied tab markup.
     * @private
     */
    _clearTabErrorIndicators() {
        this.$form.find('.tab-error-indicator').remove();
    }

    // -------------------------------------------------------------------------
    // Destruction
    // -------------------------------------------------------------------------

    /**
     * Cleans up injected inputs and buttons without touching the surrounding
     * developer-supplied container markup.
     */
    destroy() {
        this._abortUpload();
        this._revokeAllFilePreviews();

        // Remove injected button bar
        this._$container.find('.recedit-button-bar').remove();

        // Clear inputs from placeholders (leave placeholder elements intact)
        for (const [fieldName] of this.fieldInputs) {
            const $placeholder = this._$container.find(`[data-field="${fieldName}"]`);
            $placeholder.empty();
            $placeholder.removeClass('field-group field-group-vertical field-group-horizontal htmldiv-align-dialog');
        }

        this.$dialog = null;
        this.$form = null;
        this.fieldInputs.clear();
        this.isInitialized = false;
    }
}

/**
 * RecEditCustomDialog - A jQuery UI dialog record editor with a developer-supplied custom layout.
 *
 * Combines the full jQuery UI dialog chrome (title bar, modal overlay, footer Save/Cancel buttons,
 * draggable, resizable, show/hide effects) from the base `RecEdit` class with the
 * `data-field` placeholder-based form layout from `RecEditInlineForm`.
 *
 * The developer provides a container element (identified by `options.container`) whose inner
 * markup contains one placeholder element per editable field, each carrying a
 * `data-field="<fieldName>"` attribute matching a key in `options.fields`.  On every `open()`
 * call the class empties each placeholder and re-injects the complete field group (label + input
 * + character counter + error element) produced by `_createFieldGroup()`, so all base-class
 * features — validation display, `showField()` / `hideField()`, input masks, counters, dynamic
 * field properties — continue to work without modification.
 *
 * Tab support is intentionally omitted.  Passing a `tabs` option has no effect.
 *
 * @class RecEditCustomDialog
 * @extends RecEdit
 *
 * @example
 * // HTML:
 * // <div id="my-dialog-layout" style="display:none">
 * //     <div data-field="companyname"></div>
 * //     <div data-field="contactname"></div>
 * // </div>
 *
 * const editor = new RecEditCustomDialog({
 *     container: '#my-dialog-layout',   // Required – selector or jQuery object
 *     dialogWidth: 500,
 *     formLayout: 'horizontal',
 *     labelWidth: '130px',
 *     fields: {
 *         companyname: { label: 'Company', type: 'text', maxLength: 40 },
 *         contactname: { label: 'Contact', type: 'text' }
 *     },
 *     onSave: async (edpak) => { ... }
 * });
 *
 * await editor.open({ record: { companyname: 'Acme', contactname: 'Alice' } });
 */
class RecEditCustomDialog extends RecEdit {

    constructor(options = {}) {
        super(options);

        if (!options.container) {
            throw new Error('RecEditCustomDialog: "container" option is required');
        }

        this._$container = $(options.container);
        if (!this._$container.length) {
            throw new Error(`RecEditCustomDialog: container "${options.container}" not found in DOM`);
        }
    }

    // -------------------------------------------------------------------------
    // Dialog creation — use base class dialog chrome, swap in the custom layout
    // -------------------------------------------------------------------------

    /**
     * Calls the base-class `_createDialog()` to create the full jQuery UI dialog (title bar,
     * modal, footer buttons, close handler, theme), then replaces the auto-generated
     * `<form>` body with the developer-supplied container element.
     * @private
     */
    _createDialog() {
        // Build the jQuery UI dialog shell (creates this.$dialog and this.$form,
        // initialises buttons, modal, effects, close handler, etc.)
        super._createDialog();

        // Remove the auto-generated empty <form> from the dialog
        this.$form.remove();

        // Adopt the developer's container as the form body
        this.$form = this._$container;

        // Ensure it is visible (developer may have hidden it with display:none)
        this.$form.show();

        // Move it inside the jQuery UI dialog wrapper
        this.$dialog.append(this.$form);
    }

    // -------------------------------------------------------------------------
    // Form building — inject inputs into data-field placeholders
    // -------------------------------------------------------------------------

    /**
     * For each field in `options.fields`, finds the placeholder `[data-field="fieldName"]`
     * inside the container, builds the complete field group via `_createFieldGroup()`, then
     * transfers the group's contents into the placeholder and promotes the placeholder to carry
     * the same CSS classes.  Mirrors `RecEditInlineForm._buildForm()` without tab logic.
     * @private
     */
    _buildForm() {
        this.fieldInputs.clear();

        for (const [fieldName, fieldConfig] of Object.entries(this.options.fields)) {
            if (fieldConfig.edit === false || fieldConfig.key === true) continue;

            const $placeholder = this.$form.find(`[data-field="${fieldName}"]`);
            if (!$placeholder.length) {
                console.warn(`RecEditCustomDialog: no placeholder found for field '${fieldName}'`);
                continue;
            }

            // Clear any previous open() content
            $placeholder.empty();
            // Reset promoted classes from a previous open() so they don't accumulate
            $placeholder.removeClass('field-group field-group-vertical field-group-horizontal htmldiv-align-dialog');

            if (fieldConfig.type === 'hidden') {
                const $hiddenInput = this._createHiddenInput(fieldName, fieldConfig);
                this.fieldInputs.set(fieldName, $hiddenInput);
                $placeholder.append($hiddenInput);
                continue;
            }

            // Build the full label + input + counter + error group
            const $fieldGroup = this._createFieldGroup(fieldName, fieldConfig);

            // Promote the placeholder: copy the group's CSS classes onto it so base-class
            // selectors like `.field-group[data-field="x"]` match the placeholder element.
            $placeholder.addClass($fieldGroup.attr('class'));

            // Move children from the temporary wrapper into the placeholder.
            $placeholder.append($fieldGroup.children());
        }
        super._initializeAutoComplete();
        this._initializeDatepickers();
        this._initializeTimepickers();
        this._initializeCheckboxRadios();
    }

    // -------------------------------------------------------------------------
    // Tab error indicators — DOM-based, works with developer-supplied tab markup
    // -------------------------------------------------------------------------

    /**
     * Marks jQuery UI tab nav links for any tab panel that contains a field with
     * a validation error.  Works with any jQuery UI tabs structure in the
     * developer-supplied container, not just RecEdit-generated tabs.
     * @param {Array<{name: string}>} fieldErrors
     * @private
     */
    _markTabsWithErrors(fieldErrors) {
        const $uiTabs = this.$form.find('.ui-tabs').first();
        if (!$uiTabs.length) return;

        fieldErrors.forEach(error => {
            const $placeholder = this.$form.find(`[data-field="${error.name}"]`);
            if (!$placeholder.length) return;

            const $panel = $placeholder.closest('.ui-tabs-panel');
            if (!$panel.length) return;

            const $tabLink = $uiTabs.find(`ul.ui-tabs-nav a[href="#${$panel.attr('id')}"]`);
            if ($tabLink.length && !$tabLink.find('.tab-error-indicator').length) {
                $tabLink.append('<span class="tab-error-indicator"> *</span>');
            }
        });
    }

    /**
     * Removes all tab error indicators from the developer-supplied tab markup.
     * @private
     */
    _clearTabErrorIndicators() {
        this.$form.find('.tab-error-indicator').remove();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RecEdit, RecEditInlineForm, RecEditCustomDialog };
}


/**
 * jQuery plugin wrapper for RecEdit
 * 
 * @param {Object|String} options - Configuration options or method name
 * @param {...*} args - Method arguments if first param is method name
 * @returns {jQuery} jQuery object for chaining
 * 
 * @example
 * // Initialize
 * $('#table tbody tr').recEdit({
 *     fields: { ... },
 *     getRecordData: function() { return $(this).data('record'); }
 * });
 * 
 * @example
 * // Call methods
 * $('#table tbody tr').recEdit('open', { record: data });
 * $('#table tbody tr').recEdit('destroy');
 */
$.fn.recEdit = function(options, ...args) {
    // Method call pattern: $el.recEdit('methodName', arg1, arg2)
    if (typeof options === 'string') {
        const method = options;
        const editor = this.first().data('recEdit');
        
        if (!editor) {
            console.error('RecEdit not initialized on this element');
            return this;
        }
        
        // Call method on editor instance
        if (typeof editor[method] === 'function') {
            editor[method](...args);
        }
        
        return this;
    }
    
    // Initialization pattern: $el.recEdit({ options })
    const settings = $.extend({
        // Default option
        getRecordData: function() {
            return $(this).data('record');
        },
        triggerEvent: 'click', // 'click', 'dblclick', or 'none'
        // ... other defaults
    }, options);
    
    // Create one shared editor instance
    const editor = new RecEdit(settings);
    
    return this.each(function() {
        const $element = $(this);
        
        // Store editor reference
        $element.data('recEdit', editor);
        
        // Auto-bind event if specified
        if (settings.triggerEvent && settings.triggerEvent !== 'none') {
            $element.on(`${settings.triggerEvent}.recEdit`, async function(e) {
                try {
                    const record = await settings.getRecordData.call(this, e);
                    
                    if (record) {
                        await editor.open({ record });
                    }
                } catch (error) {
                    console.error('Error getting record data:', error);
                }
            });
        }
    });
};

// Optional: Add to RecEdit class for discoverability
RecEdit.jQueryPlugin = $.fn.recEdit;
