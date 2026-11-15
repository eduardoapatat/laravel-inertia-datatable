import { dataTable, expect, test } from './support';

// Every e2e test runs with Inertia SSR (playwright.config.ts) and fails on a
// hydration error in the console; these check what the server renders.

const MARCH = '?filter[published_at]=2025-03-01,2025-03-31';

test('the server renders the rows of the table', async ({ page }) => {
    const html = await (
        await page.request.get(`/products/eager${MARCH}`)
    ).text();

    expect(html).toContain('data-server-rendered');
    expect(html).toContain('data-slot="data-table"');
    expect(html).toMatch(
        /Product 03[\s\S]*Product 15[\s\S]*Product 27[\s\S]*Product 39/,
    );
});

test('with the rows deferred, the server renders the skeleton', async ({
    page,
}) => {
    const html = await (await page.request.get('/products')).text();

    expect(html).toContain('data-server-rendered');
    expect(html).toContain('data-slot="data-table-skeleton"');
});

test.describe('in another time zone than the SSR server, in UTC', () => {
    // Published at 12:00 UTC: already the next day in UTC+14.
    test.use({ timezoneId: 'Pacific/Kiritimati' });

    test('the page hydrates and shows the dates of the browser', async ({
        page,
    }) => {
        await page.goto(`/products/eager${MARCH}`);

        await expect(dataTable(page).locator('tbody time')).toHaveText([
            'March 4, 2025',
            'March 16, 2025',
            'March 28, 2025',
            'March 29, 2025',
        ]);
        await page.waitForLoadState('networkidle');
    });
});
