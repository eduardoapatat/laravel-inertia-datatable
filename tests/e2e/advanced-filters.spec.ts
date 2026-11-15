import type { Page } from '@playwright/test';

import {
    columnTexts,
    dataTable,
    expect,
    query,
    test,
    toolbar,
    visit,
} from './support';

// Columns of ProductsTable, 1-based, as the rows show them.
const STATUS = 4;
const WEIGHT = 7;
const FEATURED = 8;
const PUBLISHED = 10;

const filterList = (page: Page) =>
    page.locator('[data-slot=data-table-filter-list]');
const filterRows = (page: Page) =>
    filterList(page).locator('[data-slot=data-table-filter-item]');
const sortList = (page: Page) =>
    page.locator('[data-slot=data-table-sort-list]');

async function openFilterList(page: Page) {
    // "Filters 1" with filters in the URL.
    await toolbar(page)
        .getByRole('button', { name: /^Filters( \d+)?$/ })
        .click();
    await expect(filterList(page)).toBeVisible();
}

/** Adds a row and picks its column: the new row is the last one. */
async function addFilter(page: Page, column: string) {
    await filterList(page).getByRole('button', { name: 'Add filter' }).click();
    await filterRows(page)
        .last()
        .getByRole('button', { name: 'Field' })
        .click();
    await page.getByRole('option', { name: column, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/products/advanced');
    await dataTable(page).waitFor();
});

test('the filter list combines its rows with AND or with OR', async ({
    page,
}) => {
    await openFilterList(page);

    await addFilter(page, 'Status');
    await filterList(page)
        .getByRole('button', { name: 'Status value' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: /Draft/ }).click(),
    );
    await page.keyboard.press('Escape');

    await addFilter(page, 'Featured');
    await filterList(page)
        .getByRole('combobox', { name: 'Featured value' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'Yes', exact: true }).click(),
    );

    expect(query(page)).toBe('?filter[status]=draft&filter[is_featured]=true');
    expect(new Set(await columnTexts(page, STATUS))).toEqual(
        new Set(['Draft']),
    );
    expect(new Set(await columnTexts(page, FEATURED))).toEqual(
        new Set(['Yes']),
    );

    await filterList(page)
        .getByRole('combobox', { name: 'Combine filters' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'or', exact: true }).click(),
    );

    expect(query(page)).toBe(
        '?filter[status]=draft&filter[is_featured]=true&join=or',
    );
    const statuses = await columnTexts(page, STATUS);
    const featured = await columnTexts(page, FEATURED);
    expect(
        statuses.every(
            (status, index) => status === 'Draft' || featured[index] === 'Yes',
        ),
    ).toBe(true);
    expect(statuses.some((status) => status !== 'Draft')).toBe(true);
    expect(featured.some((value) => value !== 'Yes')).toBe(true);
});

test('a row without a value stays out of the URL until it has one', async ({
    page,
}) => {
    await openFilterList(page);
    await addFilter(page, 'Price');

    await expect(filterRows(page)).toHaveCount(1);
    expect(query(page)).toBe('');

    await visit(page, () =>
        filterList(page)
            .getByRole('spinbutton', { name: 'Price value: From' })
            .fill('100'),
    );
    expect(query(page)).toBe('?filter[price]=100,');

    await visit(page, () =>
        filterList(page)
            .getByRole('spinbutton', { name: 'Price value: to' })
            .fill('200'),
    );
    expect(query(page)).toBe('?filter[price]=100,200');
});

test('an operator without a value, removing a row and Reset', async ({
    page,
}) => {
    await openFilterList(page);
    await addFilter(page, 'Weight');
    await filterList(page)
        .getByRole('combobox', { name: 'Weight operator' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'Is empty', exact: true }).click(),
    );

    expect(query(page)).toBe('?filter[weight]=is.empty');
    expect(new Set(await columnTexts(page, WEIGHT))).toEqual(new Set(['—']));

    await addFilter(page, 'Status');
    await filterList(page)
        .getByRole('button', { name: 'Status value' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: /Active/ }).click(),
    );
    await page.keyboard.press('Escape');

    expect(query(page)).toContain('filter[weight]=is.empty');
    expect(query(page)).toContain('filter[status]=active');
    // The rows keep their order when the server answers.
    expect(
        await filterRows(page).evaluateAll((rows) =>
            rows.map((row) => row.getAttribute('data-column')),
        ),
    ).toEqual(['weight', 'status']);

    await visit(page, () =>
        filterList(page)
            .getByRole('button', { name: 'Remove Weight filter' })
            .click(),
    );
    expect(query(page)).toBe('?filter[status]=active');

    await visit(page, () =>
        filterList(page).getByRole('button', { name: 'Reset filters' }).click(),
    );
    expect(query(page)).toBe('');
    await expect(filterRows(page)).toHaveCount(0);
});

// The products were published in 2025: no period of this year has rows, and
// the past 10 years have all of them (until 2035).
test('a date row relative to today picks a period instead of a day', async ({
    page,
}) => {
    await openFilterList(page);
    await addFilter(page, 'Published');
    await filterList(page)
        .getByRole('combobox', { name: 'Published operator' })
        .click();
    await page
        .getByRole('option', { name: 'Is relative to today', exact: true })
        .click();

    const value = filterList(page).getByRole('combobox', {
        name: 'Published value',
    });
    await expect(value).toHaveText('Pick a period');
    expect(query(page)).toBe('');

    await value.click();
    await visit(page, () =>
        page.getByRole('option', { name: 'This month', exact: true }).click(),
    );

    expect(query(page)).toBe('?filter[published_at]=rel.this-month');
    await expect(dataTable(page).getByText('No results.')).toBeVisible();
    // The days the server resolved the period to.
    await expect(value).toHaveAttribute('title', /\d{4}/);

    await page.goto('/products/advanced?filter[published_at]=rel.-10Y');
    await dataTable(page).waitFor();
    expect(await columnTexts(page, PUBLISHED)).not.toContain('Unpublished');
    expect(await columnTexts(page, PUBLISHED)).toHaveLength(10);

    await openFilterList(page);
    await expect(
        filterList(page).getByRole('combobox', { name: 'Published value' }),
    ).toHaveText('Past 10 years');
});

test('a toolbar filter shows up as a row of the list', async ({ page }) => {
    await toolbar(page).getByRole('button', { name: 'Status' }).click();
    await visit(page, () =>
        page.getByRole('option', { name: /Active/ }).click(),
    );
    await page.keyboard.press('Escape');

    const trigger = toolbar(page).getByRole('button', {
        name: /^Filters/,
    });
    await expect(trigger).toContainText('1');

    await trigger.click();

    await expect(filterRows(page)).toHaveCount(1);
    await expect(filterRows(page)).toHaveAttribute('data-column', 'status');
    await expect(
        filterList(page).getByRole('button', { name: 'Status value' }),
    ).toHaveText('Active');
});

test('the sort list sorts by several columns in its order', async ({
    page,
}) => {
    await toolbar(page).getByRole('button', { name: 'Sort' }).click();
    const addSort = sortList(page).getByRole('button', { name: 'Add sort' });

    await visit(page, () => addSort.click());
    expect(query(page)).toBe('?sort=name');

    await visit(page, () => addSort.click());
    expect(query(page)).toBe('?sort=name,sku');

    await sortList(page)
        .getByRole('combobox', { name: 'SKU direction' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'Desc', exact: true }).click(),
    );
    expect(query(page)).toBe('?sort=name,-sku');

    await visit(page, () =>
        sortList(page).getByRole('button', { name: 'Move SKU up' }).click(),
    );
    expect(query(page)).toBe('?sort=-sku,name');
    await expect(
        dataTable(page).getByRole('columnheader', { name: /SKU/ }),
    ).toHaveAttribute('aria-sort', 'descending');

    await visit(page, () =>
        sortList(page)
            .getByRole('button', { name: 'Remove Name sort' })
            .click(),
    );
    expect(query(page)).toBe('?sort=-sku');

    await visit(page, () =>
        sortList(page).getByRole('button', { name: 'Reset sorting' }).click(),
    );
    expect(query(page)).toBe('');
});

test('every control of the lists has a name', async ({ page }) => {
    await openFilterList(page);
    await filterList(page).getByRole('button', { name: 'Add filter' }).click();

    const row = filterRows(page).first();
    await expect(row.getByRole('button', { name: 'Field' })).toBeVisible();
    await expect(
        row.getByRole('combobox', { name: 'Name operator' }),
    ).toBeVisible();
    await expect(
        row.getByRole('textbox', { name: 'Name value' }),
    ).toBeVisible();
    await expect(
        row.getByRole('button', { name: 'Remove Name filter' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await toolbar(page).getByRole('button', { name: 'Sort' }).click();
    await visit(page, () =>
        sortList(page).getByRole('button', { name: 'Add sort' }).click(),
    );
    for (const name of [
        'Field',
        'Name direction',
        'Move Name up',
        'Move Name down',
        'Remove Name sort',
    ]) {
        await expect(
            sortList(page).getByRole(
                name.endsWith('direction') ? 'combobox' : 'button',
                { name },
            ),
        ).toBeVisible();
    }
});

test('a select row with "is" still shows in the toolbar, which replaces it', async ({
    page,
}) => {
    const status = toolbar(page).getByRole('button', { name: /^Status/ });

    await status.click();
    await visit(page, () =>
        page.getByRole('option', { name: /Draft/ }).click(),
    );
    await page.keyboard.press('Escape');

    await openFilterList(page);
    await filterList(page)
        .getByRole('combobox', { name: 'Status operator' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'Is', exact: true }).click(),
    );
    await page.keyboard.press('Escape');

    expect(query(page)).toBe('?filter[status]=eq.draft');
    await expect(status).toContainText('Draft');
    await expect(
        toolbar(page).locator('[data-slot=data-table-hidden-filters]'),
    ).toHaveCount(0);

    await status.click();
    await visit(page, () =>
        page.getByRole('option', { name: /Active/ }).click(),
    );

    // Status is a single select: the toolbar replaces the row, it does not add
    // a second filter.
    expect(query(page)).toBe('?filter[status]=active');
});

test('the rows without a value join the other rows of their column with or', async ({
    page,
}) => {
    await openFilterList(page);

    await addFilter(page, 'Category');
    await filterList(page)
        .getByRole('button', { name: 'Category value' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: /Books/ }).click(),
    );
    await page.keyboard.press('Escape');

    await addFilter(page, 'Price');

    await addFilter(page, 'Category');
    await filterRows(page)
        .last()
        .getByRole('combobox', { name: 'Category operator' })
        .click();
    await visit(page, () =>
        page.getByRole('option', { name: 'Is empty', exact: true }).click(),
    );

    // The server adds the rows without a category with OR to Books.
    expect(query(page)).toMatch(
        /^\?filter\[category\]\[\d*\]=Books&filter\[category\]\[\d*\]=is\.empty$/,
    );
    await expect(filterRows(page)).toHaveCount(3);
    const empty = filterRows(page).nth(1);
    await expect(empty).toHaveAttribute('data-column', 'category');
    await expect(empty).toHaveAttribute('data-group', 'empty');
    await expect(empty).toContainText('or');
    await expect(filterRows(page).nth(2)).toHaveAttribute(
        'data-column',
        'price',
    );
    await expect(
        filterRows(page)
            .nth(2)
            .getByRole('combobox', { name: 'Combine filters' }),
    ).toHaveText('and');
});

test('a toolbar filter marks the filters of its column it can not show', async ({
    page,
}) => {
    await openFilterList(page);
    await addFilter(page, 'Name');
    await filterList(page)
        .getByRole('combobox', { name: 'Name operator' })
        .click();
    await page.getByRole('option', { name: 'Is', exact: true }).click();
    await visit(page, () =>
        filterList(page)
            .getByRole('textbox', { name: 'Name value' })
            .fill('Product 01'),
    );
    await page.keyboard.press('Escape');

    expect(query(page)).toBe('?filter[name]=eq.Product 01');
    await expect(
        toolbar(page).locator('[data-slot=data-table-hidden-filters]'),
    ).toContainText('+1');
});
