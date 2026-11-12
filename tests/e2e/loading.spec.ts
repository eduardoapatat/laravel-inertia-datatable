import {
    dataTable,
    delayVisits,
    expect,
    measure,
    query,
    test,
} from './support';

const skeletonOf = (page: import('@playwright/test').Page) =>
    page.locator('[data-slot=data-table-skeleton]');

for (const width of [1280, 1440]) {
    test(`the first-load skeleton looks like the table at ${width}px`, async ({
        page,
    }) => {
        const delay = { ms: 1500 };
        await page.setViewportSize({ width, height: 900 });
        await delayVisits(page, delay);

        await page.goto('/products');
        await expect(skeletonOf(page)).toBeVisible();
        const skeleton = await measure(skeletonOf(page), 1);
        await expect(skeletonOf(page)).toMatchAriaSnapshot(
            '- status: Loading table…',
        );

        await dataTable(page).waitFor();
        const table = await measure(dataTable(page), 0);

        expect(skeleton.headers).toEqual(table.headers);
        expect(skeleton.widths).toEqual(table.widths);
        expect(skeleton.widths[0]).toBe(320);
        expect(skeleton.aligns).toEqual(table.aligns);
        expect(skeleton.rows).toBe(table.rows);
        expect(Math.abs(skeleton.toolbar - table.toolbar)).toBeLessThanOrEqual(
            2,
        );
        expect(Math.abs(skeleton.height - table.height)).toBeLessThanOrEqual(4);
    });
}

test('the skeleton takes the page size and the columns of the URL', async ({
    page,
}) => {
    await delayVisits(page, { ms: 1500 });

    await page.goto(
        '/products?per_page=20&columns=name,category,price,created_at',
    );
    await expect(skeletonOf(page)).toBeVisible();
    const skeleton = await measure(skeletonOf(page), 1);
    await dataTable(page).waitFor();
    const table = await measure(dataTable(page), 0);

    expect(skeleton.rows).toBe(20);
    expect(table.rows).toBe(20);
    expect(skeleton.headers).toEqual(['Name', 'Category', 'Price', 'Created']);
    expect(skeleton.headers).toEqual(table.headers);
});

test('visits in a row dim the rows, then show skeleton rows, without blinking', async ({
    page,
}) => {
    const delay = { ms: 0 };
    await delayVisits(page, delay);
    await page.goto('/products');
    await dataTable(page).waitFor();

    // Every change of the loading phase, with its time.
    await page.evaluate(() => {
        const phases: string[] = [];
        const start = performance.now();
        let last = 'idle';
        (window as unknown as { phases: string[] }).phases = phases;
        new MutationObserver(() => {
            const current =
                document
                    .querySelector('[data-loading]')
                    ?.getAttribute('data-loading') ?? 'idle';
            if (current !== last) {
                last = current;
                phases.push(
                    `${Math.round(performance.now() - start)}:${current}`,
                );
            }
        }).observe(document.body, {
            attributes: true,
            subtree: true,
            childList: true,
        });
    });

    delay.ms = 1200;
    const next = page.getByRole('button', { name: 'Go to next page' });
    await next.click();
    await page.waitForTimeout(400);

    const tbody = dataTable(page).locator('tbody');
    expect(
        Number(
            await tbody.evaluate(
                (element) => getComputedStyle(element).opacity,
            ),
        ),
    ).toBeLessThan(1);
    await expect(page.locator('[data-slot=data-table-progress]')).toHaveCount(
        0,
    );

    await next.click();
    await page.waitForTimeout(400);
    await next.click();
    await expect(dataTable(page).locator('[aria-busy=true]')).toHaveCount(0, {
        timeout: 5000,
    });

    const phases = await page.evaluate(
        () => (window as unknown as { phases: string[] }).phases,
    );
    expect(phases.join(' → ')).toMatch(/^\d+:busy → \d+:slow → \d+:idle$/);
    expect(query(page)).toBe('?page=4');
});

test.describe('a failed visit', () => {
    // Inertia reports a network error that no `onNetworkError` handles.
    test.use({
        expectedConsole: /net::ERR_FAILED|pageerror: Network error/,
    });

    test('leaves the table as it was', async ({ page }) => {
        await page.goto('/products');
        await dataTable(page).waitFor();
        const pageInfo = page.locator('[data-slot=data-table-page-info]');
        const before = await pageInfo.innerText();
        const firstRow = dataTable(page).locator('tbody tr').first();
        const beforeRow = await firstRow.textContent();

        await page.route('**/products*', (route) =>
            route.request().headers()['x-inertia']
                ? route.abort('failed')
                : route.continue(),
        );
        const failed = page.waitForEvent('requestfailed');
        await page.getByRole('button', { name: 'Go to next page' }).click();
        await failed;

        await expect(pageInfo).toHaveText(before);
        expect(await firstRow.textContent()).toBe(beforeRow);
        await expect(dataTable(page).locator('[data-loading]')).toHaveCount(0);
        expect(query(page)).toBe('');
    });
});

test('the focus stays on a row while a slow visit shows skeleton rows', async ({
    page,
}) => {
    const delay = { ms: 0 };
    await delayVisits(page, delay);
    await page.goto('/products');
    await dataTable(page).waitFor();

    delay.ms = 1500;
    await dataTable(page).locator('tbody a').first().focus();
    // Clicked without moving the focus, as a keyboard shortcut would.
    await page.evaluate(() =>
        document
            .querySelector<HTMLButtonElement>(
                'button[aria-label="Go to next page"]',
            )
            ?.click(),
    );
    await expect(dataTable(page).locator('[data-loading=slow]')).toHaveCount(1);

    const focusInRows = () =>
        page.evaluate(() => document.activeElement?.closest('tbody') !== null);
    expect(await focusInRows()).toBe(true);
});
