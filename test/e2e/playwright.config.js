// @ts-check
/**
 * Playwright configuration for RecEdit E2E tests.
 *
 * A minimal Express server (server.js) is started automatically before the
 * tests run.  It serves recedit.js and recedit.css from the repo root and
 * loads jQuery / jQuery UI from CDN.  No backend application or database
 * is required.
 *
 * Prerequisites
 * -------------
 *   npm install                        (installs @playwright/test + express)
 *   npx playwright install chromium    (add firefox/webkit if desired)
 *
 * Run
 * ---
 *   npm test                                    # all tests, headless
 *   npm run test:e2e:headed                     # visible browser
 *   npm run test:e2e:debug                      # step-through debugger
 *   npx playwright test tests/recedit-dialog.spec.js   # one file
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',

    /* Auto-start the Express test server before running tests */
    webServer: {
        command: 'node test/e2e/server.js',
        url: 'http://127.0.0.1:54400',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: require('path').resolve(__dirname, '../..'),
    },

    /* Maximum time (ms) one test may run */
    timeout: 30_000,

    /* Retry once on CI to handle transient timing issues */
    retries: process.env.CI ? 1 : 0,

    /* Fail fast in CI */
    forbidOnly: !!process.env.CI,

    /* Reporter: list in terminal + HTML report in playwright-report/ */
    reporter: [['list'], ['html', { open: 'never' }]],

    use: {
        /* Express test server base URL */
        baseURL: 'http://127.0.0.1:54400',

        /* Capture screenshot and trace on failure */
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',

        /* Viewport */
        viewport: { width: 1280, height: 800 },
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // Uncomment to add more browsers:
        // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        // { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
    ],
});
