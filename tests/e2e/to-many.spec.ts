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

// The tags of E2eSeeder: Sale every 2nd, New every 5th, Eco every 3rd, Gift
// every 10th; the products that are not multiples of 2, 3 or 5 have none.
// With `columns=name,tags` the name is column 1 and the tags column 2.
const NAME = 1;
const TAGS = 2;
const SHOWN = '?columns=name,tags';

const tagsCell = (name: string) =>
    `tbody tr:has(td:nth-child(${NAME}):text-is("${name}")) td:nth-child(${TAGS})`;

test('the cells show the values as badges, up to 3 and then +N', async ({
    page,
}) => {
    await openProducts(page, `${SHOWN}&filter[tags]=Gift`);

    expect(await columnTexts(page, NAME)).toEqual([
        // Cut by `->limit(40)` of the name column.
        'An extremely long product name that goes…',
        'Product 10',
        'Product 20',
        'Product 30',
    ]);

    const thirty = dataTable(page).locator(tagsCell('Product 30'));
    await expect(thirty).toContainText('Sale');
    await expect(thirty).toContainText('Eco');
    await expect(thirty).not.toContainText('Gift');
    await expect(thirty.locator('[data-slot=data-table-more]')).toHaveText(
        '+1',
    );
    await expect(thirty.locator('[data-slot=data-table-more]')).toHaveAttribute(
        'title',
        'Gift',
    );

    const ten = dataTable(page).locator(tagsCell('Product 10'));
    await expect(ten).toContainText('Gift');
    await expect(ten.locator('[data-slot=data-table-more]')).toHaveCount(0);
});

test('the filter counts each product once in every tag it has', async ({
    page,
}) => {
    await openProducts(page);
    await toolbar(page).getByRole('button', { name: 'Tags' }).click();

    await expect(page.getByRole('option')).toHaveText([
        /Eco\s*13/,
        /Gift\s*4/,
        /New\s*8/,
        /Sale\s*20/,
        /No value\s*10/,
    ]);
});

test('picking a tag keeps the products that have it', async ({ page }) => {
    await openProducts(page, SHOWN);
    await toolbar(page).getByRole('button', { name: 'Tags' }).click();
    await visit(page, () => page.getByRole('option', { name: /Eco/ }).click());

    expect(query(page)).toBe('?columns=name,tags&filter[tags]=Eco');
    const tags = await columnTexts(page, TAGS);
    expect(tags).toHaveLength(10);
    expect(tags.every((text) => text.includes('Eco'))).toBe(true);
});

test('the products without tags, and those without some tags', async ({
    page,
}) => {
    await openProducts(page, `${SHOWN}&filter[tags]=is.empty`);

    expect(await columnTexts(page, NAME)).toEqual(
        [1, 7, 11, 13, 17, 19, 23, 29, 31, 37].map(
            (i) => `Product ${String(i).padStart(2, '0')}`,
        ),
    );

    // Neither Sale nor Eco: only New (#5, #25, #35) or no tag at all.
    await openProducts(page, `${SHOWN}&filter[tags]=not.in.Sale,Eco`);

    const tags = await columnTexts(page, TAGS);
    expect(tags).toHaveLength(10);
    expect(new Set(tags)).toEqual(new Set(['New', '—']));
});

test('the tags column cannot be sorted', async ({ page }) => {
    await openProducts(page, SHOWN);

    await dataTable(page)
        .locator('thead')
        .getByRole('button', { name: 'Tags column options' })
        .click();

    await expect(page.getByRole('menuitem', { name: 'Hide' })).toBeVisible();
    await expect(
        page.getByRole('menuitemcheckbox', { name: 'Asc' }),
    ).toHaveCount(0);
});
