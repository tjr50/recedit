/**
 * Playwright runner for the RecEdit QUnit test suite
 * ===================================================
 * Opens the QUnit HTML harness served by the test server, waits for all tests
 * to complete, then surfaces individual failures as a single Playwright
 * assertion so that the output is visible in the standard `npm test` report.
 *
 * The QUnit page is served at:
 *   http://127.0.0.1:54400/qunit/recedit-tests.html
 */

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('QUnit unit tests', () => {

    /**
     * QUnit 2.x adds class qunit-pass or qunit-fail to #qunit-banner when the
     * run finishes.  Individual failures appear as <li class="fail"> inside
     * #qunit-tests.  We allow 120 s to accommodate CDN asset loads.
     */
    test('all QUnit tests pass', async ({ page }) => {
        test.setTimeout(120_000);

        await page.goto('/qunit/recedit-tests.html');

        // Wait for QUnit to finish (#qunit-banner gets qunit-pass or qunit-fail)
        await page.waitForFunction(
            () => {
                const banner = document.querySelector('#qunit-banner');
                return banner && (banner.classList.contains('qunit-pass') || banner.classList.contains('qunit-fail'));
            },
            { timeout: 110_000 }
        );

        // Read summary counts from the result banner
        const summary = await page.evaluate(() => {
            const el = document.querySelector('#qunit-testresult');
            // QUnit 2.x embeds counts in the text; also exposes them in data attrs in some builds
            const text   = el?.textContent ?? '';
            const passM  = text.match(/(\d+)\s+passed/);
            const failM  = text.match(/(\d+)\s+failed/);
            const totalM = text.match(/(\d+)\s+tests? completed/);
            // Fallback to child span counts (structure differs across minor versions)
            const passed = passM  ? parseInt(passM[1],  10) : parseInt(el?.querySelector('.passed')?.textContent  ?? '0', 10);
            const failed = failM  ? parseInt(failM[1],  10) : parseInt(el?.querySelector('.failed')?.textContent  ?? '0', 10);
            const total  = totalM ? parseInt(totalM[1], 10) : parseInt(el?.querySelector('.total')?.textContent   ?? '0', 10);
            return { passed, failed, total };
        });

        // Collect names of any failing tests so the error message is useful
        const failures = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#qunit-tests > li.fail'))
                .map(li => {
                    const module = li.querySelector('.module-name')?.textContent ?? '';
                    const name   = li.querySelector('.test-name')?.textContent   ?? '(unknown)';
                    const msg    = li.querySelector('.test-message')?.textContent ?? '';
                    return module ? `${module} › ${name}${msg ? ': ' + msg : ''}` : `${name}${msg ? ': ' + msg : ''}`;
                });
        });

        const failReport = failures.length
            ? `\n\nFailed tests:\n  ${failures.join('\n  ')}`
            : '';

        expect(
            summary.failed,
            `QUnit: ${summary.passed}/${summary.total} passed${failReport}`
        ).toBe(0);
    });

});
