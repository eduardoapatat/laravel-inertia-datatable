# Testing reference

Follow the app's existing test style (Pest functions or PHPUnit classes; check `tests/Feature`). Use factories with named states, one action per test, and Inertia's assertions on the table prop.

```php
public function test_products_are_filtered_by_category_and_sorted_by_price()
{
    $this->actingAs(User::factory()->create());
    $books = Category::factory()->create(['name' => 'Books']);
    Product::factory()->for($books)->create(['name' => 'Atlas', 'price' => 30]);
    Product::factory()->for($books)->create(['name' => 'Bible', 'price' => 10]);
    Product::factory()->create(['name' => 'Chair']);

    $response = $this->get(route('products.index', [
        'filter' => ['category' => 'Books'],
        'sort' => 'price',
    ]));

    $response->assertInertia(fn (Assert $page) => $page
        ->component('products/index')
        ->has('products.data', 2)
        ->where('products.data.0.name', 'Bible')
        ->where('products.meta.total', 2)
    );
}
```

Useful paths in the prop:

| Path | Content |
|---|---|
| `<prop>.data` | Rows of the current page (only visible columns) |
| `<prop>.meta` | `current_page`, `per_page`, `last_page`, `total`, `from`, `to` |
| `<prop>.state.sorting` / `.columnFilters` / `.globalFilter` / `.columnVisibility` | Normalized state actually applied |
| `<prop>.facets.<column>` | `[{value, label, count}]` for option columns (without `count` when they have no filter), `{min, max}` for ranges |
| `<prop>.config` | Columns (`display`, `filter`), page sizes, default sort, query parameter names |

What is worth a test in an app:

- Guests are redirected / unauthorized users get 403, as for any page.
- Each filter, sort or search the page depends on, with known data and known expected rows.
- Scoping: a parent-model table never shows rows of another parent.
- Hidden columns are absent from `data` (`->missing('products.data.0.cost')`) when the data is sensitive.

The package itself already tests parsing, operators, injection attempts and facet maths; do not duplicate those in the app.
