import { chromium, type FullConfig } from '@playwright/test';

/**
 * Logs in once with the user of E2eSeeder and keeps the session for every
 * test (logging in each time would hit the rate limit of the login).
 */
export default async function globalSetup(config: FullConfig) {
    const { baseURL, storageState } = config.projects[0]!.use;
    const browser = await chromium.launch();
    const page = await browser.newPage({ baseURL });

    await page.goto('/login');
    await page.getByLabel('Email address').fill('e2e@example.com');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/dashboard');
    await page.context().storageState({ path: storageState as string });
    await browser.close();
}
