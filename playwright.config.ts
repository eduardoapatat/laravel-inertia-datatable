import { defineConfig, devices } from '@playwright/test';

/**
 * e2e tests of the UI in a real app: a starter kit made by
 * `.github/scripts/starter-kit.sh` and prepared by `tests/e2e/setup.sh`, whose
 * folder is `E2E_APP_DIR`. `composer verify -- e2e` does all of it.
 */
const appDir = process.env.E2E_APP_DIR;
const port = Number(process.env.E2E_PORT ?? 8199);
const baseURL = `http://127.0.0.1:${port}`;

if (!appDir) {
    throw new Error(
        'Set E2E_APP_DIR to the app prepared by tests/e2e/setup.sh (or run `composer verify -- e2e`).',
    );
}

export default defineConfig({
    testDir: 'tests/e2e',
    // One at a time: the loading tests measure timings.
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI
        ? [['list'], ['html', { open: 'never' }]]
        : [['list']],
    globalSetup: './tests/e2e/global-setup.ts',
    use: {
        baseURL,
        storageState: 'tests/e2e/.auth/user.json',
        viewport: { width: 1280, height: 900 },
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `php artisan serve --port=${port} --no-reload`,
        cwd: appDir,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
