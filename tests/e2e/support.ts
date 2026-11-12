import {
    test as base,
    expect,
    type Locator,
    type Page,
} from '@playwright/test';

/**
 * Every test fails when the browser console logs an error or a warning, or
 * the page throws, except for what it expects (`test.use({ expectedConsole })`).
 */
export const test = base.extend<{
    expectedConsole: RegExp | undefined;
    consoleProblems: string[];
}>({
    expectedConsole: [undefined, { option: true }],
    consoleProblems: [
        async ({ page, expectedConsole }, use) => {
            const problems: string[] = [];

            page.on('console', (message) => {
                if (['error', 'warning'].includes(message.type())) {
                    problems.push(`${message.type()}: ${message.text()}`);
                }
            });
            page.on('pageerror', (error) =>
                problems.push(`pageerror: ${error.message}`),
            );

            await use(problems);

            expect(
                problems.filter((problem) => !expectedConsole?.test(problem)),
                'console errors and warnings',
            ).toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };

export const dataTable = (page: Page) => page.locator('[data-slot=data-table]');

export const toolbar = (page: Page) =>
    page.locator('[data-slot=data-table-toolbar]');

/** The query string of the page, decoded (`?filter[status]=active`). */
export const query = (page: Page) =>
    decodeURIComponent(new URL(page.url()).search);

/** Texts of a column of the visible rows (1-based). */
export const columnTexts = async (page: Page, index: number) =>
    (
        await dataTable(page)
            .locator(`tbody tr td:nth-child(${index})`)
            .allInnerTexts()
    ).map((text) => text.trim());

export async function openProducts(page: Page, search = '') {
    await page.goto(`/products${search}`);
    await dataTable(page).waitFor();
}

/**
 * Runs an action that makes a visit of the table and waits until its
 * response arrives and the table is idle again.
 */
export async function visit(page: Page, action: () => Promise<unknown>) {
    const response = page.waitForResponse(
        (candidate) => candidate.request().headers()['x-inertia'] === 'true',
    );

    await action();
    await response;
    await expect(dataTable(page).locator('[aria-busy=true]')).toHaveCount(0);
}

/**
 * Delays the Inertia responses by `delay.ms` (0 lets them through at once),
 * to see the loading states.
 */
export async function delayVisits(page: Page, delay: { ms: number }) {
    await page.route('**/*', async (route) => {
        if (delay.ms > 0 && route.request().headers()['x-inertia']) {
            await new Promise((resolve) => setTimeout(resolve, delay.ms));
        }

        await route.continue().catch(() => {});
    });
}

export interface TableShape {
    height: number;
    toolbar: number;
    headers: string[];
    widths: number[];
    aligns: string[];
    rows: number;
}

/**
 * Size of the table or the skeleton, to compare them: total height, height of
 * the toolbar (the child at `toolbarIndex`) and its headers.
 */
export const measure = (locator: Locator, toolbarIndex: number) =>
    locator.evaluate((element, index): TableShape => {
        const height = (node: Element | null) =>
            Math.round(node?.getBoundingClientRect().height ?? 0);
        const headers = [...element.querySelectorAll('thead th')];

        return {
            height: height(element),
            toolbar: height(element.children[index] ?? null),
            headers: headers.map((th) => (th as HTMLElement).innerText.trim()),
            widths: headers.map((th) =>
                Math.round(th.getBoundingClientRect().width),
            ),
            aligns: headers.map((th) => getComputedStyle(th).textAlign),
            rows: element.querySelectorAll('tbody tr').length,
        };
    }, toolbarIndex);
