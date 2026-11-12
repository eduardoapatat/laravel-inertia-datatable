import {
    columnTexts,
    dataTable,
    expect,
    openProducts,
    query,
    test,
    toolbar,
    visit,
} from './support';

// Columns of ProductsTable, 1-based, as the rows show them.
const NAME = 1;
const CATEGORY = 3;
const STATUS = 4;
const WEIGHT = 7;
const FEATURED = 8;

test.beforeEach(async ({ page }) => {
    await openProducts(page);
});

test('a select filter lists the server options with their counts', async ({
    page,
}) => {
    await toolbar(page).getByRole('button', { name: 'Status' }).click();

    await expect(page.getByRole('option')).toHaveText([
        /Draft\s*13/,
        /Active\s*14/,
        /Archived\s*13/,
    ]);
});

test('picking and unpicking an option filters on the server', async ({
    page,
}) => {
    const status = toolbar(page).getByRole('button', { name: 'Status' });

    await status.click();
    await visit(page, () =>
        page.getByRole('option', { name: /Active/ }).click(),
    );

    expect(query(page)).toBe('?filter[status]=active');
    expect(new Set(await columnTexts(page, STATUS))).toEqual(
        new Set(['Active']),
    );

    await status.click();
    await visit(page, () =>
        page.getByRole('option', { name: /Active/ }).click(),
    );

    expect(query(page)).toBe('');
});

test('the option of the rows without a value', async ({ page }) => {
    await toolbar(page).getByRole('button', { name: 'Category' }).click();
    await visit(page, () =>
        page.getByRole('option', { name: /No category/ }).click(),
    );
    await page.keyboard.press('Escape');

    expect(query(page)).toBe('?filter[category]=is.empty');
    expect(await columnTexts(page, CATEGORY)).toEqual(
        Array(5).fill('No category'),
    );
});

test('the range slider takes its bounds from the server', async ({ page }) => {
    await toolbar(page).getByRole('button', { name: 'Price' }).click();
    const thumbs = page.locator('[data-slot=popover-content] [role=slider]');

    await expect(thumbs.first()).toHaveAttribute('aria-valuemin', '12.5');
    await expect(thumbs.first()).toHaveAttribute('aria-valuemax', '500');

    await thumbs.first().focus();
    await visit(page, () => page.keyboard.press('PageUp'));

    expect(query(page)).toMatch(/^\?filter\[price\]=[\d.]+,500$/);
});

test('a range filter can keep only the rows without a value', async ({
    page,
}) => {
    await toolbar(page).getByRole('button', { name: 'Weight' }).click();
    const empty = page
        .locator('[data-slot=popover-content]')
        .getByRole('checkbox');

    await expect(
        page.locator('[data-slot=popover-content] label').last(),
    ).toHaveText('No value');
    await visit(page, () => empty.click());

    expect(query(page)).toBe('?filter[weight]=is.empty');
    expect(await columnTexts(page, WEIGHT)).toEqual(Array(8).fill('—'));
});

test('a date range from the URL, and its calendar opens on that month', async ({
    page,
}) => {
    await openProducts(page, '?filter[published_at]=2025-03-01,2025-03-31');

    expect(await columnTexts(page, NAME)).toEqual([
        'Product 03',
        'Product 15',
        'Product 27',
        'Product 39',
    ]);

    await toolbar(page)
        .getByRole('button', { name: /Published/ })
        .click();
    const selected = await page
        .locator('[data-slot=popover-content] select')
        .evaluateAll((selects) =>
            selects.map(
                (select) =>
                    (select as HTMLSelectElement).selectedOptions[0]?.text,
            ),
        );

    expect(selected.join(' ')).toMatch(/Mar.*2025/);
});

test('a boolean filter', async ({ page }) => {
    await toolbar(page).getByRole('button', { name: 'Featured' }).click();
    await visit(page, () => page.getByRole('option', { name: 'Yes' }).click());
    await page.keyboard.press('Escape');

    expect(query(page)).toBe('?filter[is_featured]=true');
    expect(await columnTexts(page, FEATURED)).toEqual(Array(10).fill('Yes'));
});

test('text and number inputs filter together, and emptying them clears', async ({
    page,
}) => {
    const name = toolbar(page).getByRole('textbox', { name: 'Name' });
    const stock = toolbar(page).getByRole('spinbutton', { name: 'Stock' });

    await visit(page, () => name.fill('Product 1'));
    expect(await columnTexts(page, NAME)).toHaveLength(10);

    await visit(page, () => stock.fill('33'));
    expect(await columnTexts(page, NAME)).toEqual(['Product 11']);
    expect(query(page)).toContain('filter[name]=Product 1');
    expect(query(page)).toContain('filter[stock]=33');

    await visit(page, () => name.fill(''));
    await visit(page, () => stock.fill(''));
    expect(query(page)).toBe('');
});

test('number inputs ask iOS for a keypad with a decimal separator', async ({
    page,
}) => {
    await expect(
        toolbar(page).getByRole('spinbutton', { name: 'Stock' }),
    ).toHaveAttribute('inputmode', 'decimal');
});

test('Reset clears the filters and keeps the sorting', async ({ page }) => {
    await openProducts(page, '?filter[status]=draft&sort=-price');

    await visit(page, () =>
        toolbar(page).getByRole('button', { name: /Reset/ }).click(),
    );

    expect(query(page)).toBe('?sort=-price');
});

test('sorting, paging and hiding a column', async ({ page }) => {
    await dataTable(page)
        .locator('thead')
        .getByRole('button', { name: 'Price column options' })
        .click();
    await visit(page, () =>
        page.getByRole('menuitemcheckbox', { name: 'Desc' }).click(),
    );
    await visit(page, () =>
        page.getByRole('button', { name: 'Go to next page' }).click(),
    );

    expect(query(page)).toBe('?page=2&sort=-price');

    await toolbar(page).getByRole('button', { name: /View/ }).click();
    await visit(page, () => page.getByRole('option', { name: 'SKU' }).click());
    await page.keyboard.press('Escape');

    await expect(
        dataTable(page).locator('thead th', { hasText: /^SKU$/ }),
    ).toHaveCount(0);
});
