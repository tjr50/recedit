# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0-preview] - 2026-05-01

### Added
- `RecEdit` — jQuery UI dialog-based record editor with support for text,
  textarea, checkbox, radiogroup, select, date, datetime, password,
  autocomplete, spinner, slider, and htmldiv field types.
- `RecEditInlineForm` — inline (non-dialog) variant that renders fields inside
  an existing container element.
- `RecEditCustomDialog` — variant that uses a pre-built hidden container as the
  dialog body.
- Tabbed form layout via `normalizeTabs`.
- Horizontal form layout with optional field grouping (`fieldGroup`).
- Field validation: required, maxLength, and custom `validateForm` callback.
- Lifecycle callbacks: `onInit`, `onBeforeShow`, `onAfterShow`, `onSave`, `onCancel`.
- jQuery UI theme compatibility.
- Input masking via [jQuery Inputmask](https://github.com/RobinHerbots/Inputmask).
- Time/datetime picking via [jquery-timepicker](https://timepicker.co/).
- QUnit unit test suite (`test/unit/`).
- Playwright E2E test suite (`test/e2e/`).
- Standalone Express test server with CDN-sourced jQuery / jQuery UI and optional dependencies.
