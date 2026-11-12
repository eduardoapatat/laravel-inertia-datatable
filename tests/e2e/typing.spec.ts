import { dataTable, expect, openProducts, query, test, visit } from './support';

test.beforeEach(async ({ page }) => {
    await openProducts(page);
});

for (const field of ['search', 'Name filter']) {
    test(`the ${field} keeps the space typed before the response`, async ({
        page,
    }) => {
        const input =
            field === 'search'
                ? page.getByPlaceholder(/Search/)
                : page.getByRole('textbox', { name: 'Name' });
        const key = field === 'search' ? 'search' : 'filter[name]';

        await input.click();
        // The server trims the text: its response must not eat the space.
        await visit(page, () => page.keyboard.type('an '));
        await expect(input).toHaveValue('an ');

        await visit(page, () => page.keyboard.type('ex'));
        await expect(input).toHaveValue('an ex');
        expect(query(page)).toBe(`?${key}=an ex`);
    });
}

test('an empty list of columns shows the default ones', async ({ page }) => {
    await openProducts(page, '?columns=');

    // Every column but the hidden `created_at`.
    await expect(dataTable(page).locator('thead th')).toHaveCount(10);
});
