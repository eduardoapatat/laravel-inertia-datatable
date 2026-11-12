import {
    dataTable,
    expect,
    openProducts,
    test,
    toolbar,
    visit,
} from './support';

test.beforeEach(async ({ page }) => {
    await openProducts(page);
});

test('the header menu and the toolbar filter of a column have different names', async ({
    page,
}) => {
    await expect(
        dataTable(page)
            .locator('thead')
            .getByRole('button', { name: 'Status column options' }),
    ).toHaveCount(1);
    await expect(
        page.getByRole('button', { name: 'Status', exact: true }),
    ).toHaveCount(1);
    await expect(
        toolbar(page).getByRole('button', { name: 'Status', exact: true }),
    ).toHaveCount(1);
});

test('the search field of a select filter has a name', async ({ page }) => {
    await toolbar(page).getByRole('button', { name: 'Category' }).click();

    await expect(
        page.getByRole('combobox', { name: 'Category' }),
    ).toBeVisible();
});

test('the sorted column says so', async ({ page }) => {
    const price = dataTable(page).locator('thead th', { hasText: 'Price' });

    await expect(price).not.toHaveAttribute('aria-sort');

    await dataTable(page)
        .locator('thead')
        .getByRole('button', { name: 'Price column options' })
        .click();
    await visit(page, () =>
        page.getByRole('menuitemcheckbox', { name: 'Asc' }).click(),
    );

    await expect(price).toHaveAttribute('aria-sort', 'ascending');
});

test('the rows are busy while a visit loads', async ({ page }) => {
    await page.route('**/products*', async (route) => {
        if (route.request().headers()['x-inertia']) {
            await new Promise((resolve) => setTimeout(resolve, 800));
        }
        await route.continue();
    });

    await page.getByRole('button', { name: 'Go to next page' }).click();

    await expect(dataTable(page).locator('[aria-busy=true]')).toHaveCount(1);
    await expect(dataTable(page).locator('[aria-busy=true]')).toHaveCount(0);
});
